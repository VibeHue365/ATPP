import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import {
  Provider,
  ProviderCapability,
  ProviderDocument,
} from '../schemas/provider.schema';
import {
  ProviderStaff,
  ProviderStaffDocument,
  ProviderStaffStatus,
} from '../schemas/provider-staff.schema';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { Review } from '../../reviews/schemas/review.schema';
import {
  AuthProviderType,
  User,
  UserStatus,
} from '../../users/schemas/user.schema';
import { RefreshToken } from '../../auth/schemas/refresh-token.schema';
import { RedisService } from '../../../common/redis/redis.service';
import { bumpProviderAvailabilityVersion } from '../../bookings/services/provider-availability-version';
import {
  AddProviderStaffBlockDto,
  CreateProviderStaffDto,
  ProvisionStaffAccountDto,
  ResetStaffPasswordDto,
  ToggleStaffAccountLockDto,
  UpdateProviderCapacityDto,
  UpdateProviderStaffDto,
} from '../dto/provider-staff.dto';

const MAX_STAFF_PER_STUDIO = 30;
const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const STAFF_PASSWORD_SALT_ROUNDS = 12;
const WEAK_STAFF_PASSWORDS = new Set([
  '12345678',
  'password',
  'password123',
  'qwerty123',
  'admin1234',
  'letmein123',
]);

function toIctDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
}

function toIctMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class ProviderStaffService {
  constructor(
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
    @InjectModel(ProviderStaff.name)
    private readonly staffModel: Model<ProviderStaffDocument>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<Review>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  private async requirePhotographyProvider(
    userIdStr: string,
  ): Promise<ProviderDocument> {
    if (!Types.ObjectId.isValid(userIdStr)) {
      throw new ForbiddenException('Tài khoản nhà cung cấp không hợp lệ.');
    }
    const provider = await this.providerModel
      .findOne({ userId: new Types.ObjectId(userIdStr) })
      .exec();
    if (!provider) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
    }
    if (!provider.capabilities?.includes(ProviderCapability.Photography)) {
      throw new ForbiddenException(
        'Tính năng quản lý đội ngũ thợ chụp chỉ áp dụng cho đối tác có dịch vụ Chụp ảnh.',
      );
    }
    return provider;
  }

  private computeEffectiveCapacity(
    activeStaffCount: number,
    maxConcurrentSessions?: number | null,
  ): number {
    if (activeStaffCount <= 0) return 1;
    if (
      maxConcurrentSessions === null ||
      maxConcurrentSessions === undefined ||
      maxConcurrentSessions <= 0
    ) {
      return activeStaffCount;
    }
    return Math.min(activeStaffCount, maxConcurrentSessions);
  }

  async listPublicByProvider(providerIdStr: string) {
    if (!Types.ObjectId.isValid(providerIdStr)) {
      throw new BadRequestException('ID nhà cung cấp không hợp lệ.');
    }
    const providerId = new Types.ObjectId(providerIdStr);
    const [provider, staff] = await Promise.all([
      this.providerModel
        .findById(providerId)
        .select('businessName photographySettings capabilities')
        .lean()
        .exec(),
      this.staffModel
        .find({ providerId, status: ProviderStaffStatus.Active })
        .sort({ sortOrder: 1, createdAt: 1 })
        .select('_id name avatarUrl specialty bio experienceYears sortOrder')
        .lean()
        .exec(),
    ]);
    if (!provider) {
      throw new NotFoundException('Không tìm thấy studio/nhiếp ảnh gia.');
    }
    const maxConcurrentSessions =
      provider.photographySettings?.maxConcurrentSessions ?? null;
    const maxDailySessions =
      provider.photographySettings?.maxDailySessions ?? null;
    const effectiveCapacity = this.computeEffectiveCapacity(
      staff.length,
      maxConcurrentSessions,
    );

    return {
      providerId: providerIdStr,
      activeStaffCount: staff.length,
      maxConcurrentSessions,
      maxDailySessions,
      effectiveCapacity,
      staff: staff.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        avatarUrl: s.avatarUrl ?? null,
        specialty: s.specialty ?? null,
        bio: s.bio ?? null,
        experienceYears: s.experienceYears ?? null,
      })),
    };
  }

  async listForOwner(userIdStr: string) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    const providerId = provider._id;
    const now = new Date();
    const todayKey = toIctDateKey(now);
    const monthPrefix = todayKey.slice(0, 7);

    const [staffList, schedules, pendingDepositBookings] = await Promise.all([
      this.staffModel
        .find({ providerId })
        .sort({ status: 1, sortOrder: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.bookingScheduleModel
        .find({
          providerId,
          scheduleType: BookingScheduleType.Photoshoot,
          assignedStaffId: { $ne: null },
        })
        .select(
          'bookingId assignedStaffId status startsAt endsAt providerLocalDate holdExpiresAt checkedInAt shootFinishedAt',
        )
        .lean()
        .exec(),
      this.bookingModel
        .find({
          providerIds: providerId,
          status: BookingStatus.DepositPaid,
        })
        .select('_id')
        .lean()
        .exec(),
    ]);

    const bookingIds = [
      ...new Set(schedules.map((s) => s.bookingId?.toString()).filter(Boolean)),
    ].map((id) => new Types.ObjectId(id));

    const [bookings, reviews] = bookingIds.length
      ? await Promise.all([
          this.bookingModel
            .find({ _id: { $in: bookingIds } })
            .select('_id status')
            .lean()
            .exec(),
          this.reviewModel
            .find({ bookingId: { $in: bookingIds } })
            .select('bookingId rating')
            .lean()
            .exec(),
        ])
      : [[], []];

    const bookingStatusById = new Map<string, string>(
      bookings.map((b: any) => [b._id.toString(), b.status]),
    );
    const reviewsByBookingId = new Map<string, number[]>();
    for (const rev of reviews as any[]) {
      const bId = rev.bookingId?.toString();
      if (!bId || typeof rev.rating !== 'number') continue;
      const arr = reviewsByBookingId.get(bId) ?? [];
      arr.push(rev.rating);
      reviewsByBookingId.set(bId, arr);
    }

    let pendingAssignmentCount = 0;
    if (pendingDepositBookings.length > 0) {
      const depositIds = pendingDepositBookings.map((b) => b._id);
      pendingAssignmentCount = await this.bookingScheduleModel.countDocuments({
        providerId,
        bookingId: { $in: depositIds },
        scheduleType: BookingScheduleType.Photoshoot,
        status: {
          $in: [BookingScheduleStatus.Confirmed, BookingScheduleStatus.Held],
        },
        assignedStaffId: null,
      });
    }

    const activeStaffTodaySet = new Set<string>();
    const metricsByStaff = new Map<
      string,
      {
        completedShoots: number;
        completedThisMonth: number;
        upcomingShoots: number;
        todayShoots: number;
        inProgressNow: boolean;
        disputeCount: number;
        ratingSum: number;
        ratingCount: number;
      }
    >();

    const seenBookingPerStaff = new Set<string>();

    for (const sch of schedules) {
      const staffId = sch.assignedStaffId?.toString();
      if (!staffId) continue;
      const bId = sch.bookingId?.toString() ?? '';
      const bStatus = bookingStatusById.get(bId) ?? '';
      const metric = metricsByStaff.get(staffId) ?? {
        completedShoots: 0,
        completedThisMonth: 0,
        upcomingShoots: 0,
        todayShoots: 0,
        inProgressNow: false,
        disputeCount: 0,
        ratingSum: 0,
        ratingCount: 0,
      };

      const isActiveSchedule =
        sch.status === BookingScheduleStatus.Confirmed ||
        (sch.status === BookingScheduleStatus.Held &&
          sch.holdExpiresAt &&
          new Date(sch.holdExpiresAt) > now);

      const endMs = sch.endsAt ? new Date(sch.endsAt).getTime() : 0;
      const isFuture =
        endMs > now.getTime() ||
        (sch.providerLocalDate ? sch.providerLocalDate >= todayKey : false);

      if (
        isActiveSchedule &&
        isFuture &&
        ![
          BookingStatus.Cancelled,
          BookingStatus.Completed,
          BookingStatus.Refunded,
        ].includes(bStatus as BookingStatus)
      ) {
        metric.upcomingShoots += 1;
      }

      if (
        isActiveSchedule &&
        sch.providerLocalDate === todayKey &&
        bStatus !== BookingStatus.Cancelled
      ) {
        metric.todayShoots += 1;
        activeStaffTodaySet.add(staffId);
      }

      if (bStatus === BookingStatus.InProgress) {
        metric.inProgressNow = true;
        activeStaffTodaySet.add(staffId);
      }

      const dedupKey = `${staffId}:${bId}`;
      if (bId && !seenBookingPerStaff.has(dedupKey)) {
        seenBookingPerStaff.add(dedupKey);
        if (bStatus === BookingStatus.Completed) {
          metric.completedShoots += 1;
          if (sch.providerLocalDate?.startsWith(monthPrefix)) {
            metric.completedThisMonth += 1;
          }
        }
        if (bStatus === BookingStatus.Disputed) {
          metric.disputeCount += 1;
        }
        const ratings = reviewsByBookingId.get(bId);
        if (ratings && ratings.length > 0) {
          for (const r of ratings) {
            metric.ratingSum += r;
            metric.ratingCount += 1;
          }
        }
      }

      metricsByStaff.set(staffId, metric);
    }

    const activeStaffCount = staffList.filter(
      (s) => s.status === ProviderStaffStatus.Active,
    ).length;
    const maxConcurrentSessions =
      provider.photographySettings?.maxConcurrentSessions ?? null;
    const maxDailySessions =
      provider.photographySettings?.maxDailySessions ?? null;
    const effectiveCapacity = this.computeEffectiveCapacity(
      activeStaffCount,
      maxConcurrentSessions,
    );

    const linkedUserIds = staffList
      .map((s) => s.linkedUserId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const linkedUsers = linkedUserIds.length
      ? await this.userModel
          .find({ _id: { $in: linkedUserIds } })
          .select('_id auth.email accountStatus')
          .lean()
          .exec()
      : [];
    const linkedUserMap = new Map<string, { email: string; status: string }>(
      linkedUsers.map((u: any) => [
        u._id.toString(),
        {
          email: u.auth?.email ?? '',
          status: u.accountStatus ?? UserStatus.Active,
        },
      ]),
    );

    const items = staffList.map((s) => {
      const id = s._id.toString();
      const m = metricsByStaff.get(id);
      const linkedInfo = s.linkedUserId
        ? (linkedUserMap.get(s.linkedUserId.toString()) ?? null)
        : null;
      return {
        _id: id,
        providerId: s.providerId.toString(),
        name: s.name,
        phone: s.phone,
        avatarUrl: s.avatarUrl ?? null,
        specialty: s.specialty ?? null,
        bio: s.bio ?? null,
        experienceYears: s.experienceYears ?? null,
        internalNote: s.internalNote ?? null,
        status: s.status,
        sortOrder: s.sortOrder ?? 0,
        linkedUserId: s.linkedUserId?.toString() ?? null,
        staffAccount: linkedInfo,
        blockedSlots: (s.blockedSlots ?? [])
          .filter((b) => b.date >= todayKey)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((b) => ({
            _id: b._id.toString(),
            date: b.date,
            startTime: b.startTime ?? null,
            endTime: b.endTime ?? null,
            reason: b.reason ?? null,
            createdAt: b.createdAt,
          })),
        metrics: {
          completedShoots: m?.completedShoots ?? 0,
          completedThisMonth: m?.completedThisMonth ?? 0,
          upcomingShoots: m?.upcomingShoots ?? 0,
          todayShoots: m?.todayShoots ?? 0,
          inProgressNow: m?.inProgressNow ?? false,
          disputeCount: m?.disputeCount ?? 0,
          averageRating:
            m && m.ratingCount > 0
              ? Number((m.ratingSum / m.ratingCount).toFixed(1))
              : null,
          reviewCount: m?.ratingCount ?? 0,
        },
      };
    });

    return {
      summary: {
        totalStaff: staffList.length,
        activeStaff: activeStaffCount,
        inactiveStaff: staffList.length - activeStaffCount,
        maxConcurrentSessions,
        maxDailySessions,
        effectiveCapacity,
        activeTodayCount: activeStaffTodaySet.size,
        pendingAssignmentCount,
      },
      items,
    };
  }

  async create(userIdStr: string, dto: CreateProviderStaffDto) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    const existingCount = await this.staffModel.countDocuments({
      providerId: provider._id,
    });
    if (existingCount >= MAX_STAFF_PER_STUDIO) {
      throw new BadRequestException(
        `Mỗi Studio chỉ được khai báo tối đa ${MAX_STAFF_PER_STUDIO} thợ chụp.`,
      );
    }

    let preparedAccount: {
      email: string;
      emailNormalized: string;
      passwordHash: string;
      temporaryPassword: string | null;
    } | null = null;

    if (dto.createAccount) {
      if (!dto.email?.trim()) {
        throw new BadRequestException(
          'Vui lòng nhập email đăng nhập khi tạo tài khoản cho thợ chụp.',
        );
      }
      preparedAccount = await this.prepareStaffAccountCredentials(
        dto.email,
        dto.password,
      );
    }

    const created = await this.staffModel.create({
      providerId: provider._id,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      avatarUrl: dto.avatarUrl?.trim() || null,
      specialty: dto.specialty?.trim() || null,
      bio: dto.bio?.trim() || null,
      experienceYears: dto.experienceYears ?? null,
      internalNote: dto.internalNote?.trim() || null,
      status: ProviderStaffStatus.Active,
      sortOrder: dto.sortOrder ?? existingCount,
      linkedUserId: null,
      blockedSlots: [],
    });

    let provisionedInfo: {
      linkedUserId: string;
      email: string;
      accountStatus: string;
      temporaryPassword: string | null;
    } | null = null;

    if (preparedAccount) {
      const createdUser = await this.createLinkedStaffUser({
        staffId: created._id,
        staffName: created.name,
        staffPhone: created.phone,
        staffAvatarUrl: created.avatarUrl ?? null,
        staffStatus: created.status,
        email: preparedAccount.email,
        emailNormalized: preparedAccount.emailNormalized,
        passwordHash: preparedAccount.passwordHash,
      });

      created.linkedUserId = createdUser._id;
      if (typeof (created as any).save === 'function') {
        await (created as any).save();
      } else if (typeof this.staffModel.updateOne === 'function') {
        await this.staffModel.updateOne(
          { _id: created._id },
          { $set: { linkedUserId: createdUser._id } },
        );
      }

      provisionedInfo = {
        linkedUserId: createdUser._id.toString(),
        email: createdUser.auth.email,
        accountStatus: createdUser.accountStatus,
        temporaryPassword: preparedAccount.temporaryPassword,
      };
    }

    bumpProviderAvailabilityVersion(provider._id.toString());

    if (!provisionedInfo) {
      return created;
    }

    const plain =
      typeof (created as any).toObject === 'function'
        ? (created as any).toObject()
        : { ...created };

    return {
      ...plain,
      linkedUserId: provisionedInfo.linkedUserId,
      staffAccount: {
        email: provisionedInfo.email,
        status: provisionedInfo.accountStatus,
      },
      temporaryPassword: provisionedInfo.temporaryPassword,
    };
  }

  async update(
    userIdStr: string,
    staffIdStr: string,
    dto: UpdateProviderStaffDto,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const updateFields: Record<string, unknown> = {};
    if (dto.name !== undefined) updateFields.name = dto.name.trim();
    if (dto.phone !== undefined) updateFields.phone = dto.phone.trim();
    if (dto.avatarUrl !== undefined)
      updateFields.avatarUrl = dto.avatarUrl?.trim() || null;
    if (dto.specialty !== undefined)
      updateFields.specialty = dto.specialty?.trim() || null;
    if (dto.bio !== undefined) updateFields.bio = dto.bio?.trim() || null;
    if (dto.experienceYears !== undefined)
      updateFields.experienceYears = dto.experienceYears;
    if (dto.internalNote !== undefined)
      updateFields.internalNote = dto.internalNote?.trim() || null;
    if (dto.sortOrder !== undefined) updateFields.sortOrder = dto.sortOrder;

    const updated = await this.staffModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(staffIdStr),
          providerId: provider._id,
        },
        { $set: updateFields },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }

    if (
      updated.linkedUserId &&
      typeof this.userModel?.updateOne === 'function' &&
      (dto.name !== undefined || dto.avatarUrl !== undefined)
    ) {
      const userProfileUpdate: Record<string, unknown> = {};
      if (dto.name !== undefined) {
        userProfileUpdate['profile.fullName'] = updated.name;
      }
      if (dto.avatarUrl !== undefined) {
        userProfileUpdate['profile.avatarUrl'] = updated.avatarUrl ?? null;
      }
      await this.userModel.updateOne(
        { _id: updated.linkedUserId },
        { $set: userProfileUpdate },
      );
    }

    return updated;
  }

  async updateStatus(
    userIdStr: string,
    staffIdStr: string,
    status: ProviderStaffStatus,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }
    const staffId = new Types.ObjectId(staffIdStr);
    const staff = await this.staffModel
      .findOne({ _id: staffId, providerId: provider._id })
      .exec();
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }

    if (status === ProviderStaffStatus.Inactive) {
      const now = new Date();
      const todayKey = toIctDateKey(now);
      const activeFutureSchedules = await this.bookingScheduleModel
        .find({
          providerId: provider._id,
          assignedStaffId: staffId,
          scheduleType: BookingScheduleType.Photoshoot,
          $or: [
            { status: BookingScheduleStatus.Confirmed },
            { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
          ],
          $and: [
            {
              $or: [
                { endsAt: { $gt: now } },
                { providerLocalDate: { $gte: todayKey } },
              ],
            },
          ],
        })
        .select('bookingId providerLocalDate')
        .lean()
        .exec();

      if (activeFutureSchedules.length > 0) {
        const bIds = [
          ...new Set(activeFutureSchedules.map((s) => s.bookingId.toString())),
        ].map((id) => new Types.ObjectId(id));
        const activeBookings = await this.bookingModel
          .find({
            _id: { $in: bIds },
            status: {
              $nin: [
                BookingStatus.Cancelled,
                BookingStatus.Completed,
                BookingStatus.Refunded,
              ],
            },
          })
          .select('_id bookingCode status')
          .lean()
          .exec();

        if (activeBookings.length > 0) {
          const codes = activeBookings
            .map((b: any) => b.bookingCode || b._id.toString())
            .join(', ');
          throw new BadRequestException({
            message: `Thợ ${staff.name} đang phụ trách ${activeBookings.length} đơn sắp tới (${codes}). Vui lòng chuyển sang thợ khác trước khi tạm ngưng.`,
            blockingBookings: activeBookings.map((b: any) => ({
              bookingId: b._id.toString(),
              bookingCode: b.bookingCode,
              status: b.status,
            })),
          });
        }
      }
    }

    staff.status = status;
    await staff.save();
    bumpProviderAvailabilityVersion(provider._id.toString());

    const activeStaffCount = await this.staffModel.countDocuments({
      providerId: provider._id,
      status: ProviderStaffStatus.Active,
    });
    const currentMax = provider.photographySettings?.maxConcurrentSessions;
    if (
      currentMax !== null &&
      currentMax !== undefined &&
      activeStaffCount > 0 &&
      currentMax > activeStaffCount
    ) {
      await this.providerModel.updateOne(
        { _id: provider._id },
        {
          $set: {
            'photographySettings.maxConcurrentSessions': activeStaffCount,
          },
        },
      );
    }

    if (staff.linkedUserId) {
      if (status === ProviderStaffStatus.Inactive) {
        await this.userModel.updateOne(
          { _id: staff.linkedUserId },
          { $set: { accountStatus: UserStatus.Suspended } },
        );
        await this.revokeStaffSessions(staff.linkedUserId);
      } else {
        await this.userModel.updateOne(
          { _id: staff.linkedUserId },
          {
            $set: {
              accountStatus: UserStatus.Active,
              'security.lockedAt': null,
              'security.lockedBy': null,
              'security.lockedReason': null,
            },
          },
        );
      }
    }

    return staff;
  }

  async updateCapacity(userIdStr: string, dto: UpdateProviderCapacityDto) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    const activeStaffCount = await this.staffModel.countDocuments({
      providerId: provider._id,
      status: ProviderStaffStatus.Active,
    });

    const maxAllowed = Math.max(1, activeStaffCount);
    if (
      dto.maxConcurrentSessions !== undefined &&
      dto.maxConcurrentSessions !== null &&
      dto.maxConcurrentSessions > maxAllowed
    ) {
      throw new BadRequestException(
        activeStaffCount === 0
          ? 'Studio chưa có danh sách thợ chụp nên chỉ nhận tối đa 1 ca đồng thời. Hãy thêm thợ chụp trước khi tăng số ca.'
          : `Số ca đồng thời tối đa (${dto.maxConcurrentSessions}) không được vượt quá số thợ đang hoạt động (${activeStaffCount}).`,
      );
    }

    const nextSettings = {
      ...(provider.photographySettings ?? {}),
      ...(dto.maxConcurrentSessions !== undefined
        ? { maxConcurrentSessions: dto.maxConcurrentSessions }
        : {}),
      ...(dto.maxDailySessions !== undefined
        ? { maxDailySessions: dto.maxDailySessions }
        : {}),
    };

    await this.providerModel.updateOne(
      { _id: provider._id },
      { $set: { photographySettings: nextSettings } },
    );
    bumpProviderAvailabilityVersion(provider._id.toString());

    return {
      activeStaffCount,
      maxConcurrentSessions: nextSettings.maxConcurrentSessions ?? null,
      maxDailySessions: nextSettings.maxDailySessions ?? null,
      effectiveCapacity: this.computeEffectiveCapacity(
        activeStaffCount,
        nextSettings.maxConcurrentSessions,
      ),
    };
  }

  async addBlockedSlot(
    userIdStr: string,
    staffIdStr: string,
    dto: AddProviderStaffBlockDto,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const todayKey = toIctDateKey(new Date());
    if (dto.date < todayKey) {
      throw new BadRequestException(
        'Không thể khóa lịch nghỉ cho ngày trong quá khứ.',
      );
    }

    const cleanStart = dto.startTime?.trim() || null;
    const cleanEnd = dto.endTime?.trim() || null;
    const hasStart = Boolean(cleanStart);
    const hasEnd = Boolean(cleanEnd);
    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ cả giờ bắt đầu và giờ kết thúc (hoặc để trống cả hai để khóa cả ngày).',
      );
    }

    const blockStartMin = cleanStart ? parseTimeToMinutes(cleanStart) : 0;
    const blockEndMin = cleanEnd ? parseTimeToMinutes(cleanEnd) : 24 * 60;
    if (blockStartMin >= blockEndMin) {
      throw new BadRequestException('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
    }

    const staffId = new Types.ObjectId(staffIdStr);
    const staff = await this.staffModel
      .findOne({ _id: staffId, providerId: provider._id })
      .exec();
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }

    const existingOverlap = (staff.blockedSlots ?? []).find((blk) => {
      if (blk.date !== dto.date) return false;
      const exStart = blk.startTime ? parseTimeToMinutes(blk.startTime) : 0;
      const exEnd = blk.endTime ? parseTimeToMinutes(blk.endTime) : 24 * 60;
      return exStart < blockEndMin && blockStartMin < exEnd;
    });
    if (existingOverlap) {
      const existingLabel =
        existingOverlap.startTime && existingOverlap.endTime
          ? `${existingOverlap.startTime}-${existingOverlap.endTime}`
          : 'Cả ngày';
      throw new ConflictException(
        `Khung giờ này bị trùng với lịch nghỉ đã đăng ký ngày ${dto.date} (${existingLabel}).`,
      );
    }

    const now = new Date();
    const sameDaySchedules = await this.bookingScheduleModel
      .find({
        providerId: provider._id,
        assignedStaffId: staffId,
        providerLocalDate: dto.date,
        scheduleType: BookingScheduleType.Photoshoot,
        $or: [
          {
            status: {
              $in: [
                BookingScheduleStatus.Confirmed,
                BookingScheduleStatus.Scheduled,
              ],
            },
          },
          { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
        ],
      })
      .select('bookingId startsAt endsAt')
      .lean()
      .exec();

    const conflictingSchedules = sameDaySchedules.filter((s) => {
      if (!s.startsAt || !s.endsAt) return true;
      const schStart = toIctMinutes(new Date(s.startsAt));
      const schEnd = toIctMinutes(new Date(s.endsAt));
      return schStart < blockEndMin && blockStartMin < schEnd;
    });

    if (conflictingSchedules.length > 0) {
      const bIds = conflictingSchedules.map((s) => s.bookingId);
      const activeBookings = await this.bookingModel
        .find({
          _id: { $in: bIds },
          status: {
            $nin: [
              BookingStatus.Cancelled,
              BookingStatus.Completed,
              BookingStatus.Refunded,
            ],
          },
        })
        .select('bookingCode')
        .lean()
        .exec();

      if (activeBookings.length > 0) {
        const codes = activeBookings
          .map((b: any) => b.bookingCode || b._id.toString())
          .join(', ');
        throw new ConflictException(
          `Thợ ${staff.name} đã có lịch chụp ngày ${dto.date} (${codes}). Vui lòng đổi thợ cho các đơn này trước khi khóa lịch nghỉ.`,
        );
      }
    }

    const newBlock = {
      _id: new Types.ObjectId(),
      date: dto.date,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      reason: dto.reason?.trim() || null,
      createdAt: new Date(),
    };

    staff.blockedSlots = [...(staff.blockedSlots ?? []), newBlock];
    await staff.save();
    bumpProviderAvailabilityVersion(provider._id.toString());

    return {
      _id: newBlock._id.toString(),
      date: newBlock.date,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      reason: newBlock.reason,
      createdAt: newBlock.createdAt,
    };
  }

  async removeBlockedSlot(
    userIdStr: string,
    staffIdStr: string,
    blockIdStr: string,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (
      !Types.ObjectId.isValid(staffIdStr) ||
      !Types.ObjectId.isValid(blockIdStr)
    ) {
      throw new BadRequestException('ID không hợp lệ.');
    }

    const updated = await this.staffModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(staffIdStr),
          providerId: provider._id,
        },
        {
          $pull: {
            blockedSlots: { _id: new Types.ObjectId(blockIdStr) },
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }
    bumpProviderAvailabilityVersion(provider._id.toString());
    return { removed: true, blockId: blockIdStr };
  }

  async provisionAccount(
    userIdStr: string,
    staffIdStr: string,
    dto: ProvisionStaffAccountDto,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const staff = await this.staffModel
      .findOne({
        _id: new Types.ObjectId(staffIdStr),
        providerId: provider._id,
      })
      .exec();
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }
    if (staff.linkedUserId) {
      throw new ConflictException(
        'Thợ chụp này đã được cấp tài khoản đăng nhập.',
      );
    }

    const credentials = await this.prepareStaffAccountCredentials(
      dto.email,
      dto.password,
    );

    const createdUser = await this.createLinkedStaffUser({
      staffId: staff._id,
      staffName: staff.name,
      staffPhone: staff.phone,
      staffAvatarUrl: staff.avatarUrl ?? null,
      staffStatus: staff.status,
      email: credentials.email,
      emailNormalized: credentials.emailNormalized,
      passwordHash: credentials.passwordHash,
    });

    staff.linkedUserId = createdUser._id;
    await staff.save();

    if (typeof this.bookingScheduleModel?.updateMany === 'function') {
      await this.bookingScheduleModel.updateMany(
        {
          providerId: provider._id,
          assignedStaffId: staff._id,
          scheduleType: BookingScheduleType.Photoshoot,
          status: {
            $in: [BookingScheduleStatus.Confirmed, BookingScheduleStatus.Held],
          },
          assignedStaffSnapshot: { $ne: null },
        },
        {
          $set: {
            'assignedStaffSnapshot.linkedUserId': createdUser._id.toString(),
          },
        },
      );
    }

    return {
      staffId: staff._id.toString(),
      linkedUserId: createdUser._id.toString(),
      email: createdUser.auth.email,
      accountStatus: createdUser.accountStatus,
      temporaryPassword: credentials.temporaryPassword,
    };
  }

  async resetStaffPassword(
    userIdStr: string,
    staffIdStr: string,
    dto: ResetStaffPasswordDto,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const staff = await this.staffModel
      .findOne({
        _id: new Types.ObjectId(staffIdStr),
        providerId: provider._id,
      })
      .exec();
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }
    if (!staff.linkedUserId) {
      throw new BadRequestException(
        'Thợ chụp này chưa có tài khoản đăng nhập. Vui lòng cấp tài khoản trước.',
      );
    }

    const customPassword = dto.newPassword?.trim();
    let rawPassword: string;
    let temporaryPassword: string | null = null;
    if (customPassword) {
      this.assertStaffPasswordPolicy(customPassword);
      rawPassword = customPassword;
    } else {
      rawPassword = this.generateTemporaryPassword();
      temporaryPassword = rawPassword;
    }

    const passwordHash = await bcrypt.hash(
      rawPassword,
      STAFF_PASSWORD_SALT_ROUNDS,
    );

    await this.userModel.updateOne(
      { _id: staff.linkedUserId },
      {
        $set: {
          'auth.passwordHash': passwordHash,
          'security.passwordChangedAt': new Date(),
          'security.failedLoginAttempts': 0,
        },
      },
    );
    await this.revokeStaffSessions(staff.linkedUserId);

    return {
      staffId: staff._id.toString(),
      linkedUserId: staff.linkedUserId.toString(),
      passwordReset: true,
      temporaryPassword,
    };
  }

  async setStaffAccountLocked(
    userIdStr: string,
    staffIdStr: string,
    dto: ToggleStaffAccountLockDto,
  ) {
    const provider = await this.requirePhotographyProvider(userIdStr);
    if (!Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const staff = await this.staffModel
      .findOne({
        _id: new Types.ObjectId(staffIdStr),
        providerId: provider._id,
      })
      .exec();
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thợ chụp thuộc Studio này.');
    }
    if (!staff.linkedUserId) {
      throw new BadRequestException(
        'Thợ chụp này chưa được cấp tài khoản đăng nhập.',
      );
    }

    if (dto.locked) {
      await this.userModel.updateOne(
        { _id: staff.linkedUserId },
        {
          $set: {
            accountStatus: UserStatus.Suspended,
            'security.lockedAt': new Date(),
            'security.lockedBy': new Types.ObjectId(userIdStr),
            'security.lockedReason':
              dto.reason?.trim() || 'Tạm khóa tài khoản bởi chủ Studio',
          },
        },
      );
      await this.revokeStaffSessions(staff.linkedUserId);

      return {
        staffId: staff._id.toString(),
        linkedUserId: staff.linkedUserId.toString(),
        accountStatus: UserStatus.Suspended,
      };
    }

    if (staff.status !== ProviderStaffStatus.Active) {
      throw new BadRequestException(
        'Thợ chụp đang tạm ngưng hoạt động (INACTIVE). Vui lòng kích hoạt lại hồ sơ thợ trước khi mở khóa tài khoản.',
      );
    }

    await this.userModel.updateOne(
      { _id: staff.linkedUserId },
      {
        $set: {
          accountStatus: UserStatus.Active,
          'security.lockedAt': null,
          'security.lockedBy': null,
          'security.lockedReason': null,
        },
      },
    );

    return {
      staffId: staff._id.toString(),
      linkedUserId: staff.linkedUserId.toString(),
      accountStatus: UserStatus.Active,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const compact = phone.replace(/[\s.-]/g, '').trim();
    if (!compact) return null;
    if (compact.startsWith('+84') && compact.length > 3) {
      return `0${compact.slice(3)}`;
    }
    if (compact.startsWith('84') && compact.length >= 10) {
      return `0${compact.slice(2)}`;
    }
    return compact;
  }

  private assertStaffPasswordPolicy(password: string): void {
    const normalized = password.trim().toLowerCase();
    if (password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự.');
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số.',
      );
    }
    if (WEAK_STAFF_PASSWORDS.has(normalized)) {
      throw new BadRequestException(
        'Mật khẩu quá yếu, vui lòng chọn mật khẩu an toàn hơn.',
      );
    }
  }

  private generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const all = `${upper}${lower}${digits}`;
    const chars = [
      upper[randomInt(upper.length)],
      lower[randomInt(lower.length)],
      digits[randomInt(digits.length)],
    ];
    while (chars.length < 12) {
      chars.push(all[randomInt(all.length)]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private async prepareStaffAccountCredentials(
    rawEmail: string,
    rawPassword?: string,
  ): Promise<{
    email: string;
    emailNormalized: string;
    passwordHash: string;
    temporaryPassword: string | null;
  }> {
    const email = rawEmail.trim();
    const emailNormalized = this.normalizeEmail(email);

    const existingEmail =
      typeof this.userModel?.findOne === 'function'
        ? await this.userModel
            .findOne({ 'auth.emailNormalized': emailNormalized })
            .select('_id')
            .lean()
            .exec()
        : null;
    if (existingEmail) {
      throw new ConflictException(
        'Email này đã được sử dụng bởi tài khoản khác.',
      );
    }

    const customPassword = rawPassword?.trim();
    let passwordToHash: string;
    let temporaryPassword: string | null = null;
    if (customPassword) {
      this.assertStaffPasswordPolicy(customPassword);
      passwordToHash = customPassword;
    } else {
      passwordToHash = this.generateTemporaryPassword();
      temporaryPassword = passwordToHash;
    }

    const passwordHash = await bcrypt.hash(
      passwordToHash,
      STAFF_PASSWORD_SALT_ROUNDS,
    );

    return {
      email,
      emailNormalized,
      passwordHash,
      temporaryPassword,
    };
  }

  private async createLinkedStaffUser(params: {
    staffId: Types.ObjectId;
    staffName: string;
    staffPhone: string;
    staffAvatarUrl: string | null;
    staffStatus: ProviderStaffStatus;
    email: string;
    emailNormalized: string;
    passwordHash: string;
  }) {
    const normalizedPhone = this.normalizePhone(params.staffPhone);
    let storedPhoneNormalized: string | null = normalizedPhone;

    if (normalizedPhone && typeof this.userModel?.findOne === 'function') {
      const existingPhoneUser = await this.userModel
        .findOne({ 'auth.phoneNormalized': normalizedPhone })
        .select('_id')
        .lean()
        .exec();
      if (existingPhoneUser) {
        storedPhoneNormalized = null;
      }
    }

    return this.userModel.create({
      auth: {
        email: params.email,
        emailNormalized: params.emailNormalized,
        phone: params.staffPhone,
        phoneNormalized: storedPhoneNormalized,
        passwordHash: params.passwordHash,
        emailVerified: true,
        phoneVerified: false,
        authProviders: [
          {
            provider: AuthProviderType.Local,
            providerUserId: null,
          },
        ],
      },
      roles: ['STAFF'],
      defaultRole: 'STAFF',
      accountStatus:
        params.staffStatus === ProviderStaffStatus.Active
          ? UserStatus.Active
          : UserStatus.Suspended,
      hasCompletedOnboarding: true,
      profile: {
        fullName: params.staffName,
        avatarUrl: params.staffAvatarUrl,
      },
      security: {
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
      },
    });
  }

  private async revokeStaffSessions(userId: Types.ObjectId): Promise<void> {
    let activeSessionIds: string[] = [];
    if (
      this.redisService &&
      typeof this.refreshTokenModel?.find === 'function'
    ) {
      const activeTokens = await this.refreshTokenModel
        .find({ userId, revokedAt: null })
        .select('_id')
        .lean()
        .exec();
      activeSessionIds = activeTokens.map((t: any) => t._id.toString());
    }

    await this.refreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    if (this.redisService && activeSessionIds.length > 0) {
      await Promise.all(
        activeSessionIds.map((sessionId) =>
          this.redisService!.del(`auth:session:${sessionId}`).catch(
            () => undefined,
          ),
        ),
      );
    }
  }
}
