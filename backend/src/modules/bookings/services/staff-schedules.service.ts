import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  ProviderStaff,
  ProviderStaffDocument,
  ProviderStaffStatus,
} from '../../providers/schemas/provider-staff.schema';
import { Booking, BookingStatus } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { bumpProviderAvailabilityVersion } from './provider-availability-version';
import {
  CreateStaffBlockedSlotDto,
  StaffCheckInDto,
  StaffFinishShootDto,
  StaffSchedulesQueryDto,
} from '../dto/staff-schedules.dto';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ALLOWED_STAFF_CHECKIN_STATUSES: BookingStatus[] = [
  BookingStatus.Confirmed,
  BookingStatus.PickupPending,
  BookingStatus.PickedUp,
];

const BLOCKED_STAFF_FINISH_STATUSES: BookingStatus[] = [
  BookingStatus.Draft,
  BookingStatus.PendingPayment,
  BookingStatus.DepositPaid,
  BookingStatus.Cancelled,
  BookingStatus.Refunded,
  BookingStatus.PartiallyRefunded,
  BookingStatus.Disputed,
  BookingStatus.Completed,
  BookingStatus.AwaitingReview,
  BookingStatus.ComboPhotosApproved,
];

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
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function formatIctTimeRange(
  startsAt?: Date | string | null,
  endsAt?: Date | string | null,
  fallbackSlot?: string | null,
): string | null {
  if (startsAt && endsAt) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: BUSINESS_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${fmt.format(new Date(startsAt))} - ${fmt.format(new Date(endsAt))}`;
  }
  return fallbackSlot ?? null;
}

@Injectable()
export class StaffSchedulesService {
  constructor(
    @InjectModel(ProviderStaff.name)
    private readonly staffModel: Model<ProviderStaffDocument>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async resolveActiveStaff(userIdStr: string) {
    if (!Types.ObjectId.isValid(userIdStr)) {
      throw new ForbiddenException('Tài khoản thợ chụp không hợp lệ.');
    }
    const staff = await this.staffModel
      .findOne({ linkedUserId: new Types.ObjectId(userIdStr) })
      .exec();

    if (!staff) {
      throw new ForbiddenException(
        'Tài khoản này chưa được liên kết với hồ sơ thợ chụp nào.',
      );
    }
    if (staff.status !== ProviderStaffStatus.Active) {
      throw new ForbiddenException(
        'Hồ sơ thợ chụp của bạn đang tạm ngưng hoạt động.',
      );
    }

    const studio = await this.providerModel
      .findById(staff.providerId)
      .select('_id userId businessName contact address media')
      .lean()
      .exec();

    return { staff, studio };
  }

  async getProfile(userIdStr: string) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    const todayKey = toIctDateKey(new Date());
    const monthPrefix = todayKey.slice(0, 7);

    const schedules = await this.bookingScheduleModel
      .find({
        assignedStaffId: staff._id,
        providerId: staff.providerId,
        scheduleType: BookingScheduleType.Photoshoot,
        status: {
          $in: [BookingScheduleStatus.Confirmed, BookingScheduleStatus.Completed],
        },
      })
      .select('bookingId providerLocalDate shootFinishedAt status')
      .lean()
      .exec();

    const bookingIds = [
      ...new Set(schedules.map((s) => s.bookingId?.toString()).filter(Boolean)),
    ].map((id) => new Types.ObjectId(id));

    const bookings = bookingIds.length
      ? await this.bookingModel
          .find({ _id: { $in: bookingIds } })
          .select('_id status')
          .lean()
          .exec()
      : [];
    const statusByBookingId = new Map(
      bookings.map((b: any) => [b._id.toString(), b.status]),
    );

    let todayShoots = 0;
    let upcomingShoots = 0;
    const completedThisMonthBookings = new Set<string>();

    for (const sch of schedules) {
      const bId = sch.bookingId?.toString() ?? '';
      const bStatus = statusByBookingId.get(bId);
      if (
        !bStatus ||
        [
          BookingStatus.PendingPayment,
          BookingStatus.Cancelled,
          BookingStatus.Refunded,
        ].includes(bStatus)
      ) {
        continue;
      }

      const dateKey = sch.providerLocalDate ?? '';
      const isDone =
        Boolean(sch.shootFinishedAt) ||
        [BookingStatus.Completed, BookingStatus.AwaitingReview].includes(bStatus);

      if (dateKey === todayKey && !isDone) {
        todayShoots += 1;
      }
      if (dateKey >= todayKey && !isDone) {
        upcomingShoots += 1;
      }
      if (isDone && dateKey.startsWith(monthPrefix)) {
        completedThisMonthBookings.add(bId);
      }
    }

    return {
      staff: {
        _id: staff._id.toString(),
        name: staff.name,
        phone: staff.phone,
        avatarUrl: staff.avatarUrl ?? null,
        specialty: staff.specialty ?? null,
        bio: staff.bio ?? null,
        experienceYears: staff.experienceYears ?? null,
        status: staff.status,
        blockedSlots: (staff.blockedSlots ?? [])
          .filter((b) => b.date >= todayKey)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((b) => ({
            _id: b._id.toString(),
            date: b.date,
            startTime: b.startTime ?? null,
            endTime: b.endTime ?? null,
            reason: b.reason ?? null,
          })),
      },
      studio: studio
        ? {
            _id: studio._id.toString(),
            ownerUserId: studio.userId?.toString?.() ?? null,
            businessName: studio.businessName,
            phone: studio.contact?.phone ?? null,
            address: studio.address ?? null,
            logoUrl: studio.media?.logoUrl ?? null,
          }
        : null,
      metrics: {
        todayShoots,
        upcomingShoots,
        completedThisMonth: completedThisMonthBookings.size,
      },
    };
  }

  async getMySchedules(userIdStr: string, query: StaffSchedulesQueryDto = {}) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    const todayKey = toIctDateKey(new Date());

    const scheduleFilter: Record<string, any> = {
      assignedStaffId: staff._id,
      providerId: staff.providerId,
      scheduleType: BookingScheduleType.Photoshoot,
      status: {
        $in: [BookingScheduleStatus.Confirmed, BookingScheduleStatus.Completed],
      },
    };

    if (query.from || query.to) {
      scheduleFilter.providerLocalDate = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    const schedules = await this.bookingScheduleModel
      .find(scheduleFilter)
      .sort({ startsAt: 1, scheduledDate: 1 })
      .lean()
      .exec();

    if (schedules.length === 0) {
      return {
        staff: {
          _id: staff._id.toString(),
          name: staff.name,
          avatarUrl: staff.avatarUrl ?? null,
        },
        studio: studio
          ? {
              _id: studio._id.toString(),
              ownerUserId: studio.userId?.toString?.() ?? null,
              businessName: studio.businessName,
            }
          : null,
        items: [],
      };
    }

    const bookingIds = [
      ...new Set(schedules.map((s) => s.bookingId?.toString()).filter(Boolean)),
    ].map((id) => new Types.ObjectId(id));

    const itemIds = [
      ...new Set(
        schedules.map((s) => s.bookingItemId?.toString()).filter(Boolean),
      ),
    ].map((id) => new Types.ObjectId(id));

    const [bookings, bookingItems] = await Promise.all([
      this.bookingModel
        .find({
          _id: { $in: bookingIds },
          status: {
            $nin: [
              BookingStatus.PendingPayment,
              BookingStatus.Cancelled,
              BookingStatus.Refunded,
            ],
          },
        })
        .select('_id bookingCode status customerId customerNote notes')
        .populate('customerId', 'profile.fullName profile.avatarUrl auth.phone')
        .lean()
        .exec(),
      itemIds.length > 0
        ? this.bookingItemModel
            .find({
              _id: { $in: itemIds },
              itemType: BookingItemType.PhotographyPackage,
            })
            .select('_id photographyPackageId packageSnapshot')
            .populate('photographyPackageId', 'name')
            .lean()
            .exec()
        : [],
    ]);

    const bookingMap = new Map<string, any>(
      bookings.map((b: any) => [b._id.toString(), b]),
    );
    const itemMap = new Map<string, any>(
      bookingItems.map((it: any) => [it._id.toString(), it]),
    );

    const scope = query.scope ?? 'all';
    const items: Array<Record<string, unknown>> = [];

    for (const sch of schedules) {
      const booking = bookingMap.get(sch.bookingId?.toString() ?? '');
      if (!booking) continue;

      const dateKey =
        sch.providerLocalDate ??
        (sch.startsAt ? toIctDateKey(new Date(sch.startsAt)) : '');

      const isFinished =
        Boolean(sch.shootFinishedAt) ||
        [
          BookingStatus.AwaitingReview,
          BookingStatus.ComboPhotosApproved,
          BookingStatus.Completed,
        ].includes(booking.status);

      if (scope === 'today' && dateKey !== todayKey) continue;
      if (scope === 'upcoming' && (dateKey < todayKey || isFinished)) continue;
      if (scope === 'completed' && !isFinished) continue;

      const pkgItem = itemMap.get(sch.bookingItemId?.toString() ?? '');
      const customerDoc = booking.customerId as any;
      const packageName =
        pkgItem?.photographyPackageId?.name ??
        pkgItem?.packageSnapshot?.name ??
        'Gói chụp ảnh';

      const canCheckIn =
        !sch.checkedInAt &&
        !sch.shootFinishedAt &&
        ALLOWED_STAFF_CHECKIN_STATUSES.includes(booking.status);

      const checkInBlockedReason =
        !sch.checkedInAt && !sch.shootFinishedAt && !canCheckIn
          ? booking.status === BookingStatus.DepositPaid
            ? 'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.'
            : booking.status === BookingStatus.PendingPayment
              ? 'Đơn hàng chưa hoàn tất bước xác nhận.'
              : null
          : null;

      const canFinishShoot =
        !sch.shootFinishedAt &&
        !BLOCKED_STAFF_FINISH_STATUSES.includes(booking.status) &&
        (Boolean(sch.checkedInAt) ||
          booking.status === BookingStatus.InProgress);

      items.push({
        scheduleId: sch._id.toString(),
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        scheduleStatus: sch.status,
        providerLocalDate: dateKey || null,
        startsAt: sch.startsAt ? new Date(sch.startsAt).toISOString() : null,
        endsAt: sch.endsAt ? new Date(sch.endsAt).toISOString() : null,
        timeSlot: formatIctTimeRange(sch.startsAt, sch.endsAt, sch.timeSlot),
        locationAddress:
          sch.locationAddress ?? sch.locationSnapshot?.address ?? null,
        locationSnapshot: sch.locationSnapshot ?? null,
        packageName,
        customer: customerDoc
          ? {
              userId: customerDoc._id?.toString?.() ?? null,
              fullName: customerDoc.profile?.fullName ?? 'Khách hàng',
              avatarUrl: customerDoc.profile?.avatarUrl ?? null,
              phone: customerDoc.auth?.phone ?? null,
            }
          : null,
        customerNote: booking.customerNote ?? booking.notes ?? null,
        scheduleNotes: sch.notes ?? null,
        checkedInAt: sch.checkedInAt
          ? new Date(sch.checkedInAt).toISOString()
          : null,
        checkInPhotoUrl: sch.checkInPhotoUrl ?? null,
        shootFinishedAt: sch.shootFinishedAt
          ? new Date(sch.shootFinishedAt).toISOString()
          : null,
        staffFieldNote: sch.staffFieldNote ?? null,
        canCheckIn,
        checkInBlockedReason,
        canFinishShoot,
      });
    }

    return {
      staff: {
        _id: staff._id.toString(),
        name: staff.name,
        avatarUrl: staff.avatarUrl ?? null,
      },
      studio: studio
        ? {
            _id: studio._id.toString(),
            ownerUserId: studio.userId?.toString?.() ?? null,
            businessName: studio.businessName,
          }
        : null,
      items,
    };
  }

  async checkIn(
    userIdStr: string,
    scheduleIdStr: string,
    dto: Partial<StaffCheckInDto> = {},
  ) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    if (!Types.ObjectId.isValid(scheduleIdStr)) {
      throw new BadRequestException('ID lịch chụp không hợp lệ.');
    }

    const schedule = await this.bookingScheduleModel
      .findById(scheduleIdStr)
      .exec();
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch chụp.');
    }

    if (
      !schedule.assignedStaffId ||
      schedule.assignedStaffId.toString() !== staff._id.toString() ||
      schedule.providerId?.toString() !== staff.providerId.toString()
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền check-in lịch chụp của thợ khác.',
      );
    }

    if (schedule.checkedInAt) {
      throw new BadRequestException(
        'Lịch chụp này đã được check-in bắt đầu trước đó.',
      );
    }

    if (schedule.shootFinishedAt) {
      throw new BadRequestException(
        'Ca chụp này đã được đánh dấu hoàn thành trước đó.',
      );
    }

    if (
      [
        BookingScheduleStatus.Cancelled,
        BookingScheduleStatus.Expired,
      ].includes(schedule.status)
    ) {
      throw new BadRequestException(
        'Lịch chụp này đã bị hủy hoặc hết hiệu lực.',
      );
    }

    const booking = await this.bookingModel.findById(schedule.bookingId).exec();
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng liên quan.');
    }

    if (booking.status === BookingStatus.DepositPaid) {
      throw new BadRequestException(
        'Đơn hàng đang chờ Chủ Studio duyệt xác nhận lịch chụp. Bạn chỉ có thể check-in sau khi đơn được xác nhận.',
      );
    }

    if (!ALLOWED_STAFF_CHECKIN_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        `Không thể check-in khi đơn hàng đang ở trạng thái ${booking.status}.`,
      );
    }

    const cleanPhotoUrl = dto.photoUrl?.trim() || '';
    if (!cleanPhotoUrl) {
      throw new BadRequestException(
        'Vui lòng chụp ảnh xác nhận đã đến điểm hẹn trước khi check-in.',
      );
    }

    const now = new Date();
    const cleanNote = dto.note?.trim() || null;
    schedule.checkedInAt = now;
    schedule.checkInPhotoUrl = cleanPhotoUrl;
    if (cleanNote) {
      schedule.staffFieldNote = cleanNote;
    }
    await schedule.save();

    if (booking.status !== BookingStatus.InProgress) {
      booking.status = BookingStatus.InProgress;
      booking.statusTimeline = [
        ...(booking.statusTimeline ?? []),
        {
          status: BookingStatus.InProgress,
          changedAt: now,
          changedBy: new Types.ObjectId(userIdStr),
          note: cleanNote
            ? `Thợ chụp ${staff.name} đã check-in xác nhận có mặt kèm ảnh: ${cleanNote}`
            : `Thợ chụp ${staff.name} đã chụp ảnh check-in xác nhận có mặt tại điểm hẹn.`,
        },
      ];
      await booking.save();
    }

    try {
      const custId =
        (booking.customerId as any)?._id?.toString?.() ??
        booking.customerId?.toString?.();
      if (custId) {
        await this.notificationsService.createNotification(
          custId,
          'Thợ chụp đã check-in tại điểm hẹn',
          `Thợ chụp ${staff.name} đã gửi ảnh xác nhận có mặt và bắt đầu buổi chụp cho đơn ${booking.bookingCode}.`,
          NotificationType.Booking,
          {
            bookingId: booking._id,
            scheduleId: schedule._id,
            checkInPhotoUrl: cleanPhotoUrl,
          },
        );
      }
      if (studio?.userId) {
        await this.notificationsService.createNotification(
          studio.userId.toString(),
          'Nhân sự đã check-in buổi chụp',
          `Thợ ${staff.name} đã gửi ảnh check-in xác nhận có mặt đơn ${booking.bookingCode}.`,
          NotificationType.Booking,
          {
            bookingId: booking._id,
            scheduleId: schedule._id,
            checkInPhotoUrl: cleanPhotoUrl,
          },
        );
      }
    } catch {
      // Best-effort notification
    }

    return {
      scheduleId: schedule._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      checkedInAt: schedule.checkedInAt.toISOString(),
      checkInPhotoUrl: schedule.checkInPhotoUrl ?? null,
      staffFieldNote: schedule.staffFieldNote ?? null,
    };
  }

  async finishShoot(
    userIdStr: string,
    scheduleIdStr: string,
    dto: StaffFinishShootDto = {},
  ) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    if (!Types.ObjectId.isValid(scheduleIdStr)) {
      throw new BadRequestException('ID lịch chụp không hợp lệ.');
    }

    const schedule = await this.bookingScheduleModel
      .findById(scheduleIdStr)
      .exec();
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch chụp.');
    }

    if (
      !schedule.assignedStaffId ||
      schedule.assignedStaffId.toString() !== staff._id.toString() ||
      schedule.providerId?.toString() !== staff.providerId.toString()
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền kết thúc lịch chụp của thợ khác.',
      );
    }

    if (schedule.shootFinishedAt) {
      throw new BadRequestException(
        'Ca chụp này đã được đánh dấu hoàn thành trước đó.',
      );
    }

    const booking = await this.bookingModel.findById(schedule.bookingId).exec();
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng liên quan.');
    }

    if (BLOCKED_STAFF_FINISH_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        `Không thể kết thúc ca chụp khi đơn hàng đang ở trạng thái ${booking.status}.`,
      );
    }

    if (
      !schedule.checkedInAt &&
      booking.status !== BookingStatus.InProgress
    ) {
      throw new BadRequestException(
        'Vui lòng check-in bắt đầu buổi chụp trước khi kết thúc ca chụp.',
      );
    }

    const now = new Date();
    const cleanNote = dto.note?.trim() || null;
    schedule.shootFinishedAt = now;
    if (cleanNote) {
      schedule.staffFieldNote = schedule.staffFieldNote
        ? `${schedule.staffFieldNote} | Kết thúc: ${cleanNote}`
        : cleanNote;
    }
    await schedule.save();

    booking.statusTimeline = [
      ...(booking.statusTimeline ?? []),
      {
        status: booking.status,
        changedAt: now,
        changedBy: new Types.ObjectId(userIdStr),
        note: cleanNote
          ? `Thợ chụp ${staff.name} đã báo hoàn thành buổi chụp: ${cleanNote}`
          : `Thợ chụp ${staff.name} đã báo hoàn thành buổi chụp. Chờ Studio hậu kỳ & giao ảnh.`,
      },
    ];
    await booking.save();

    try {
      if (studio?.userId) {
        await this.notificationsService.createNotification(
          studio.userId.toString(),
          'Thợ chụp đã hoàn thành ca chụp',
          `Thợ ${staff.name} đã báo chụp xong đơn ${booking.bookingCode}. Vui lòng hậu kỳ & giao ảnh cho khách.`,
          NotificationType.Booking,
          { bookingId: booking._id, scheduleId: schedule._id },
        );
      }
      const custId =
        (booking.customerId as any)?._id?.toString?.() ??
        booking.customerId?.toString?.();
      if (custId) {
        await this.notificationsService.createNotification(
          custId,
          'Buổi chụp đã hoàn thành',
          `Thợ chụp ${staff.name} đã hoàn thành buổi chụp đơn ${booking.bookingCode}. Studio sẽ hậu kỳ và gửi ảnh cho bạn.`,
          NotificationType.Booking,
          { bookingId: booking._id, scheduleId: schedule._id },
        );
      }
    } catch {
      // Best-effort notification
    }

    return {
      scheduleId: schedule._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      checkedInAt: schedule.checkedInAt
        ? new Date(schedule.checkedInAt).toISOString()
        : null,
      checkInPhotoUrl: schedule.checkInPhotoUrl ?? null,
      shootFinishedAt: schedule.shootFinishedAt.toISOString(),
      staffFieldNote: schedule.staffFieldNote ?? null,
    };
  }

  async addMyBlockedSlot(
    userIdStr: string,
    dto: CreateStaffBlockedSlotDto,
  ) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    const todayKey = toIctDateKey(new Date());

    if (dto.date < todayKey) {
      throw new BadRequestException(
        'Không thể đăng ký lịch bận cho ngày trong quá khứ.',
      );
    }

    const cleanStart = dto.startTime?.trim() || null;
    const cleanEnd = dto.endTime?.trim() || null;
    const hasStart = Boolean(cleanStart);
    const hasEnd = Boolean(cleanEnd);

    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ cả giờ bắt đầu và giờ kết thúc (hoặc để trống cả hai để báo bận cả ngày).',
      );
    }

    const blockStartMin = cleanStart ? parseTimeToMinutes(cleanStart) : 0;
    const blockEndMin = cleanEnd ? parseTimeToMinutes(cleanEnd) : 24 * 60;
    if (blockStartMin >= blockEndMin) {
      throw new BadRequestException('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
    }

    // 1. Prevent duplicate / overlapping blocked slot on the same date
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
        `Khung giờ này bị trùng với lịch bận đã đăng ký ngày ${dto.date} (${existingLabel}).`,
      );
    }

    // 2. Prevent blocking over an active assigned shoot schedule
    const now = new Date();
    const sameDaySchedules = await this.bookingScheduleModel
      .find({
        providerId: staff.providerId,
        assignedStaffId: staff._id,
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
          `Bạn đã được phân công ca chụp ngày ${dto.date} (${codes}). Vui lòng nhắn Chủ Studio đổi thợ trước khi báo bận.`,
        );
      }
    }

    const newBlock = {
      _id: new Types.ObjectId(),
      date: dto.date,
      startTime: cleanStart,
      endTime: cleanEnd,
      reason: dto.reason?.trim() || null,
      createdAt: now,
    };

    staff.blockedSlots = [...(staff.blockedSlots ?? []), newBlock];
    await staff.save();
    bumpProviderAvailabilityVersion(staff.providerId.toString());

    const rangeLabel =
      cleanStart && cleanEnd ? `${cleanStart}–${cleanEnd}` : 'cả ngày';
    const reasonSuffix = newBlock.reason ? ` (${newBlock.reason})` : '';
    try {
      if (studio?.userId) {
        await this.notificationsService.createNotification(
          studio.userId.toString(),
          'Thợ chụp vừa đăng ký lịch bận',
          `Thợ ${staff.name} đã báo bận ngày ${dto.date} (${rangeLabel})${reasonSuffix}. Lịch trống của Studio đã tự động cập nhật.`,
          NotificationType.Booking,
          {
            staffId: staff._id,
            blockId: newBlock._id,
            date: dto.date,
          },
        );
      }
    } catch {
      // Best-effort notification
    }

    return {
      _id: newBlock._id.toString(),
      date: newBlock.date,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      reason: newBlock.reason,
      createdAt: newBlock.createdAt.toISOString(),
    };
  }

  async removeMyBlockedSlot(userIdStr: string, blockIdStr: string) {
    const { staff, studio } = await this.resolveActiveStaff(userIdStr);
    if (!Types.ObjectId.isValid(blockIdStr)) {
      throw new BadRequestException('ID lịch bận không hợp lệ.');
    }

    const existingBlocks = staff.blockedSlots ?? [];
    const targetBlock = existingBlocks.find(
      (blk) => blk._id?.toString?.() === blockIdStr,
    );
    if (!targetBlock) {
      throw new NotFoundException('Không tìm thấy lịch bận này.');
    }

    staff.blockedSlots = existingBlocks.filter(
      (blk) => blk._id?.toString?.() !== blockIdStr,
    );
    await staff.save();
    bumpProviderAvailabilityVersion(staff.providerId.toString());

    const rangeLabel =
      targetBlock.startTime && targetBlock.endTime
        ? `${targetBlock.startTime}–${targetBlock.endTime}`
        : 'cả ngày';
    try {
      if (studio?.userId) {
        await this.notificationsService.createNotification(
          studio.userId.toString(),
          'Thợ chụp đã hủy lịch bận',
          `Thợ ${staff.name} đã gỡ lịch bận ngày ${targetBlock.date} (${rangeLabel}) và sẵn sàng nhận ca trở lại.`,
          NotificationType.Booking,
          {
            staffId: staff._id,
            blockId: blockIdStr,
            date: targetBlock.date,
          },
        );
      }
    } catch {
      // Best-effort notification
    }

    return { removed: true, blockId: blockIdStr };
  }
}
