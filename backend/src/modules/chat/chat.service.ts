import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import {
  ChatMessage,
  ChatMessageDocument,
} from './schemas/chat-message.schema';
import { User } from '../users/schemas/user.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../providers/schemas/provider.schema';
import {
  ProviderStaff,
  ProviderStaffStatus,
} from '../providers/schemas/provider-staff.schema';
import {
  Booking,
  BookingStatus,
  BookingType,
} from '../bookings/schemas/booking.schema';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../bookings/schemas/booking-schedule.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @Optional()
    @InjectModel(ProviderStaff.name)
    private readonly providerStaffModel?: Model<ProviderStaff>,
    @Optional()
    @InjectModel(Booking.name)
    private readonly bookingModel?: Model<Booking>,
    @Optional()
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel?: Model<BookingSchedule>,
  ) {}

  async assertUserInRoom(
    roomId: string,
    userId: string,
    userRoles: string[] = [],
  ): Promise<ChatRoomDocument> {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('ID phòng chat không hợp lệ');
    }
    const roomObjectId = new Types.ObjectId(roomId);

    const room = await this.chatRoomModel.findById(roomObjectId).exec();
    if (!room) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện này');
    }

    const isParticipant = room.participants.some(
      (p) => p.toString() === userId,
    );
    const isAdmin = (userRoles || []).some((r) => r.toUpperCase() === 'ADMIN');

    if (!isParticipant && !isAdmin) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập hoặc gửi tin nhắn trong cuộc trò chuyện này',
      );
    }

    return room;
  }

  private resolveProviderAvatar(provider: any): string | null {
    const media = provider?.media as
      | {
          logoUrl?: string | null;
          coverUrl?: string | null;
          images?: string[];
        }
      | undefined;
    const legacyPortfolio = provider?.portfolio as string[] | undefined;
    return (
      media?.logoUrl ||
      media?.coverUrl ||
      media?.images?.[0] ||
      legacyPortfolio?.[0] ||
      null
    );
  }

  private getRolePerspective(userRoles: string[] = []) {
    const normalized = (userRoles || []).map((r) => String(r).toUpperCase());
    const isAdmin = normalized.includes('ADMIN');
    const isProvider =
      !isAdmin &&
      (normalized.includes('PROVIDER') ||
        normalized.includes('PHOTOGRAPHER') ||
        normalized.includes('MERCHANT') ||
        normalized.includes('STORE_OWNER'));
    const isStaffOnly = normalized.includes('STAFF') && !isProvider && !isAdmin;
    return { isAdmin, isProvider, isStaffOnly };
  }

  private formatBookingServiceLabel(bookingType?: string): string {
    switch (bookingType) {
      case BookingType.Photography:
        return 'Lịch chụp ảnh';
      case BookingType.AoDaiRental:
        return 'Thuê Áo Dài';
      case BookingType.Combo:
        return 'Combo Áo Dài & Chụp ảnh';
      default:
        return 'Dịch vụ VibeHue';
    }
  }

  private buildBookingContextPayload(booking: any, schedule?: any) {
    if (!booking) return null;
    const shootDateRaw =
      schedule?.startsAt ??
      schedule?.providerLocalDate ??
      schedule?.scheduledDate ??
      null;
    const shootDate =
      shootDateRaw instanceof Date
        ? shootDateRaw.toISOString()
        : shootDateRaw
          ? String(shootDateRaw)
          : null;

    return {
      bookingId: booking._id?.toString?.() ?? String(booking._id),
      bookingCode: booking.bookingCode || '',
      bookingType: booking.bookingType || '',
      status: booking.status || '',
      serviceLabel: this.formatBookingServiceLabel(booking.bookingType),
      shootDate,
      timeSlot: schedule?.timeSlot || null,
      locationAddress:
        schedule?.locationSnapshot?.address || schedule?.locationAddress || null,
    };
  }

  async getRooms(userId: string, userRoles: string[] = []) {
    const userObjectId = new Types.ObjectId(userId);
    const rooms = await this.chatRoomModel
      .find({ participants: userObjectId })
      .populate('participants', 'profile roles defaultRole auth.email')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'profile' },
      })
      .sort({ lastMessageAt: -1 })
      .exec();

    const roomIds = rooms.map((room) => room._id);
    const unreadRows = roomIds.length
      ? await this.chatMessageModel.aggregate<{
          _id: Types.ObjectId;
          count: number;
        }>([
          {
            $match: {
              roomId: { $in: roomIds },
              senderId: { $ne: userObjectId },
              readBy: { $ne: userObjectId },
            },
          },
          { $group: { _id: '$roomId', count: { $sum: 1 } } },
        ])
      : [];
    const unreadByRoom = new Map(
      unreadRows.map((row) => [row._id.toString(), row.count]),
    );

    const { isProvider, isStaffOnly } = this.getRolePerspective(userRoles);

    const otherByRoomId = new Map<string, any>();
    const otherObjectIds: Types.ObjectId[] = [];
    const seenOtherIds = new Set<string>();
    for (const room of rooms) {
      const other = (room.participants || []).find(
        (p: any) => p?._id?.toString?.() !== userId,
      ) as any;
      if (other?._id) {
        otherByRoomId.set(room._id.toString(), other);
        const oid = other._id.toString();
        if (!seenOtherIds.has(oid) && Types.ObjectId.isValid(oid)) {
          seenOtherIds.add(oid);
          otherObjectIds.push(new Types.ObjectId(oid));
        }
      }
    }

    const providerByOwnerUserId = new Map<string, any>();
    const providerById = new Map<string, any>();
    const myOwnedProviderIds: Types.ObjectId[] = [];
    if (typeof this.providerModel?.find === 'function') {
      const providers = await this.providerModel
        .find({ userId: { $in: [userObjectId, ...otherObjectIds] } })
        .select('_id userId businessName capabilities media portfolio')
        .lean()
        .exec();
      for (const p of providers) {
        providerById.set(p._id.toString(), p);
        const ownerStr = p.userId?.toString?.();
        if (ownerStr) {
          providerByOwnerUserId.set(ownerStr, p);
          if (ownerStr === userId) {
            myOwnedProviderIds.push(new Types.ObjectId(p._id.toString()));
          }
        }
      }
    }

    const staffByLinkedUserId = new Map<string, any>();
    const myStaffIds: Types.ObjectId[] = [];
    const myEmployerProviderIds: Types.ObjectId[] = [];
    const extraProviderIdsToLoad: Types.ObjectId[] = [];

    if (typeof this.providerStaffModel?.find === 'function') {
      const staffDocs = await this.providerStaffModel
        .find({ linkedUserId: { $in: [userObjectId, ...otherObjectIds] } })
        .select('_id providerId name avatarUrl specialty linkedUserId status')
        .lean()
        .exec();
      for (const s of staffDocs) {
        const linkedStr = s.linkedUserId?.toString?.();
        if (linkedStr) {
          staffByLinkedUserId.set(linkedStr, s);
          if (linkedStr === userId) {
            myStaffIds.push(new Types.ObjectId(s._id.toString()));
            if (s.providerId) {
              myEmployerProviderIds.push(
                new Types.ObjectId(s.providerId.toString()),
              );
            }
          }
        }
        if (s.providerId && !providerById.has(s.providerId.toString())) {
          extraProviderIdsToLoad.push(
            new Types.ObjectId(s.providerId.toString()),
          );
        }
      }
    }

    const myStudioOwnerUserIds = new Set<string>();
    if (
      extraProviderIdsToLoad.length > 0 &&
      typeof this.providerModel?.find === 'function'
    ) {
      const extraProviders = await this.providerModel
        .find({ _id: { $in: extraProviderIdsToLoad } })
        .select('_id userId businessName capabilities media portfolio')
        .lean()
        .exec();
      for (const p of extraProviders) {
        providerById.set(p._id.toString(), p);
        if (p.userId) {
          providerByOwnerUserId.set(p.userId.toString(), p);
        }
      }
    }
    for (const pid of myEmployerProviderIds) {
      const p = providerById.get(pid.toString());
      if (p?.userId) {
        myStudioOwnerUserIds.add(p.userId.toString());
      }
    }

    const bookingContextByOtherUserId = new Map<string, any>();
    if (
      otherObjectIds.length > 0 &&
      typeof this.bookingModel?.find === 'function'
    ) {
      if (
        isStaffOnly &&
        myStaffIds.length > 0 &&
        typeof this.bookingScheduleModel?.find === 'function'
      ) {
        const staffSchedules = await this.bookingScheduleModel
          .find({
            assignedStaffId: { $in: myStaffIds },
            scheduleType: BookingScheduleType.Photoshoot,
            status: { $ne: BookingScheduleStatus.Cancelled },
          })
          .select(
            'bookingId scheduleType startsAt scheduledDate timeSlot providerLocalDate locationAddress locationSnapshot status',
          )
          .lean()
          .exec();

        const scheduleByBookingId = new Map<string, any>();
        const bookingIds: Types.ObjectId[] = [];
        for (const sch of staffSchedules) {
          if (sch.bookingId) {
            const bid = sch.bookingId.toString();
            if (!scheduleByBookingId.has(bid)) {
              scheduleByBookingId.set(bid, sch);
              bookingIds.push(new Types.ObjectId(bid));
            }
          }
        }

        if (bookingIds.length > 0) {
          const bookings = await this.bookingModel
            .find({
              _id: { $in: bookingIds },
              customerId: { $in: otherObjectIds },
              status: {
                $nin: [
                  BookingStatus.PendingPayment,
                  BookingStatus.Cancelled,
                  BookingStatus.Refunded,
                  BookingStatus.Draft,
                ],
              },
            })
            .select('_id bookingCode customerId bookingType status')
            .sort({ updatedAt: -1 })
            .lean()
            .exec();

          for (const b of bookings) {
            const custId = b.customerId?.toString?.();
            if (custId && !bookingContextByOtherUserId.has(custId)) {
              const ctx = this.buildBookingContextPayload(
                b,
                scheduleByBookingId.get(b._id.toString()),
              );
              if (ctx) bookingContextByOtherUserId.set(custId, ctx);
            }
          }
        }
      } else if (isProvider && myOwnedProviderIds.length > 0) {
        const providerBookings = await this.bookingModel
          .find({
            providerIds: { $in: myOwnedProviderIds },
            customerId: { $in: otherObjectIds },
            status: { $nin: [BookingStatus.Cancelled, BookingStatus.Draft] },
          })
          .select('_id bookingCode customerId bookingType status')
          .sort({ updatedAt: -1 })
          .limit(100)
          .lean()
          .exec();

        const scheduleByBookingId = new Map<string, any>();
        if (
          providerBookings.length > 0 &&
          typeof this.bookingScheduleModel?.find === 'function'
        ) {
          const bIds = providerBookings.map((b) => b._id);
          const schedules = await this.bookingScheduleModel
            .find({
              bookingId: { $in: bIds },
              status: { $ne: BookingScheduleStatus.Cancelled },
            })
            .select(
              'bookingId scheduleType startsAt scheduledDate timeSlot providerLocalDate locationAddress locationSnapshot status',
            )
            .lean()
            .exec();
          for (const sch of schedules) {
            const bid = sch.bookingId?.toString?.();
            if (!bid) continue;
            const existing = scheduleByBookingId.get(bid);
            if (
              !existing ||
              sch.scheduleType === BookingScheduleType.Photoshoot
            ) {
              scheduleByBookingId.set(bid, sch);
            }
          }
        }

        for (const b of providerBookings) {
          const custId = b.customerId?.toString?.();
          if (custId && !bookingContextByOtherUserId.has(custId)) {
            const ctx = this.buildBookingContextPayload(
              b,
              scheduleByBookingId.get(b._id.toString()),
            );
            if (ctx) bookingContextByOtherUserId.set(custId, ctx);
          }
        }
      } else if (!isStaffOnly && !isProvider) {
        const custBookings = await this.bookingModel
          .find({
            customerId: userObjectId,
            status: { $nin: [BookingStatus.Cancelled, BookingStatus.Draft] },
          })
          .select('_id bookingCode providerIds bookingType status')
          .sort({ updatedAt: -1 })
          .limit(100)
          .lean()
          .exec();

        const scheduleByBookingId = new Map<string, any>();
        const bookingById = new Map<string, any>();
        for (const b of custBookings) {
          bookingById.set(b._id.toString(), b);
        }
        const schedulesByStaffId = new Map<string, any[]>();
        if (
          custBookings.length > 0 &&
          typeof this.bookingScheduleModel?.find === 'function'
        ) {
          const bIds = custBookings.map((b) => b._id);
          const schedules = await this.bookingScheduleModel
            .find({
              bookingId: { $in: bIds },
              status: { $ne: BookingScheduleStatus.Cancelled },
            })
            .select(
              'bookingId scheduleType assignedStaffId startsAt scheduledDate timeSlot providerLocalDate locationAddress locationSnapshot status',
            )
            .lean()
            .exec();
          for (const sch of schedules) {
            const bid = sch.bookingId?.toString?.();
            if (bid) {
              const existing = scheduleByBookingId.get(bid);
              if (
                !existing ||
                sch.scheduleType === BookingScheduleType.Photoshoot
              ) {
                scheduleByBookingId.set(bid, sch);
              }
            }
            const sid = sch.assignedStaffId?.toString?.();
            if (sid) {
              const list = schedulesByStaffId.get(sid) || [];
              list.push(sch);
              schedulesByStaffId.set(sid, list);
            }
          }
        }

        for (const oid of otherObjectIds) {
          const oidStr = oid.toString();
          const staffDoc = staffByLinkedUserId.get(oidStr);
          if (staffDoc) {
            const staffSchedules =
              schedulesByStaffId.get(staffDoc._id.toString()) || [];
            for (const sch of staffSchedules) {
              const parentBooking = bookingById.get(sch.bookingId?.toString?.());
              if (parentBooking) {
                const ctx = this.buildBookingContextPayload(parentBooking, sch);
                if (ctx) {
                  bookingContextByOtherUserId.set(oidStr, ctx);
                  break;
                }
              }
            }
            if (bookingContextByOtherUserId.has(oidStr)) continue;
          }

          const providerDoc = providerByOwnerUserId.get(oidStr);
          if (providerDoc) {
            const matchedBooking = custBookings.find((b) =>
              (b.providerIds || []).some(
                (pid: any) => pid?.toString?.() === providerDoc._id.toString(),
              ),
            );
            if (matchedBooking) {
              const ctx = this.buildBookingContextPayload(
                matchedBooking,
                scheduleByBookingId.get(matchedBooking._id.toString()),
              );
              if (ctx) bookingContextByOtherUserId.set(oidStr, ctx);
            }
          }
        }
      }
    }

    const mapped = rooms.map((room) => {
      const otherParticipant = otherByRoomId.get(room._id.toString()) || null;
      const otherId = otherParticipant?._id?.toString?.() || '';
      const staffDoc = otherId ? staffByLinkedUserId.get(otherId) : null;
      const providerDoc = otherId ? providerByOwnerUserId.get(otherId) : null;
      const employerProvider = staffDoc?.providerId
        ? providerById.get(staffDoc.providerId.toString())
        : null;

      const otherRoles = new Set<string>(
        (otherParticipant?.roles || []).map((r: string) =>
          String(r).toUpperCase(),
        ),
      );
      const otherDefaultRole = String(
        otherParticipant?.defaultRole || '',
      ).toUpperCase();

      const otherIsAdmin =
        otherRoles.has('ADMIN') || otherDefaultRole === 'ADMIN';
      const otherIsProvider =
        Boolean(providerDoc) ||
        otherRoles.has('PROVIDER') ||
        otherRoles.has('PHOTOGRAPHER') ||
        otherRoles.has('MERCHANT') ||
        otherRoles.has('STORE_OWNER') ||
        otherDefaultRole === 'PROVIDER';
      const otherIsStaff =
        Boolean(staffDoc) ||
        (!otherIsProvider &&
          (otherRoles.has('STAFF') || otherDefaultRole === 'STAFF'));

      let roomCategory:
        | 'STAFF_TO_OWNER'
        | 'STAFF_TO_CUSTOMER'
        | 'OWNER_TO_STAFF'
        | 'CUSTOMER_TO_STAFF'
        | 'CUSTOMER_TO_PROVIDER'
        | 'SUPPORT'
        | 'GENERAL' = 'GENERAL';
      let isPinned = false;
      let participantRole: 'CUSTOMER' | 'PROVIDER' | 'STAFF' | 'ADMIN' =
        'CUSTOMER';
      let roleBadge = 'Khách hàng';
      let studioName: string | null =
        providerDoc?.businessName || employerProvider?.businessName || null;
      const staffSpecialty: string | null = staffDoc?.specialty || null;

      if (otherParticipant) {
        if (isStaffOnly) {
          if (myStudioOwnerUserIds.has(otherId) || otherIsProvider) {
            roomCategory = 'STAFF_TO_OWNER';
            isPinned = true;
            participantRole = 'PROVIDER';
            roleBadge = 'Chủ Studio';
            studioName =
              providerDoc?.businessName ||
              myEmployerProviderIds
                .map((id) => providerById.get(id.toString())?.businessName)
                .find(Boolean) ||
              null;
          } else if (otherIsAdmin) {
            roomCategory = 'SUPPORT';
            participantRole = 'ADMIN';
            roleBadge = 'Hỗ trợ VibeHue';
          } else {
            roomCategory = 'STAFF_TO_CUSTOMER';
            participantRole = 'CUSTOMER';
            roleBadge = 'Khách chụp của bạn';
          }
        } else if (isProvider) {
          if (otherIsStaff) {
            roomCategory = 'OWNER_TO_STAFF';
            participantRole = 'STAFF';
            roleBadge = 'Thợ chụp Studio';
          } else if (otherIsAdmin) {
            roomCategory = 'SUPPORT';
            participantRole = 'ADMIN';
            roleBadge = 'Hỗ trợ VibeHue';
          } else {
            roomCategory = 'CUSTOMER_TO_PROVIDER';
            participantRole = 'CUSTOMER';
            roleBadge = 'Khách hàng';
          }
        } else {
          if (otherIsStaff) {
            roomCategory = 'CUSTOMER_TO_STAFF';
            participantRole = 'STAFF';
            roleBadge = 'Thợ chụp phụ trách';
          } else if (otherIsAdmin) {
            roomCategory = 'SUPPORT';
            participantRole = 'ADMIN';
            roleBadge = 'Hỗ trợ VibeHue';
          } else if (otherIsProvider) {
            roomCategory = 'CUSTOMER_TO_PROVIDER';
            participantRole = 'PROVIDER';
            const caps: string[] = providerDoc?.capabilities || [];
            roleBadge =
              caps.includes(ProviderCapability.AoDaiRental) &&
              !caps.includes(ProviderCapability.Photography)
                ? 'Tiệm Áo Dài'
                : 'Studio / Đối tác';
          } else {
            roomCategory = 'GENERAL';
            participantRole = 'CUSTOMER';
            roleBadge = 'Khách hàng';
          }
        }
      }

      const displayFullName =
        participantRole === 'STAFF' && staffDoc?.name
          ? staffDoc.name
          : participantRole === 'PROVIDER' && providerDoc?.businessName
            ? providerDoc.businessName
            : otherParticipant?.profile?.fullName || 'Người dùng';

      const displayAvatarUrl =
        otherParticipant?.profile?.avatarUrl ||
        staffDoc?.avatarUrl ||
        this.resolveProviderAvatar(providerDoc) ||
        null;

      return {
        id: room._id,
        roomCategory,
        isPinned,
        bookingContext: otherId
          ? bookingContextByOtherUserId.get(otherId) || null
          : null,
        otherParticipant: otherParticipant
          ? {
              id: otherParticipant._id,
              fullName: displayFullName,
              avatarUrl: displayAvatarUrl,
              roles: otherParticipant.roles,
              defaultRole: otherParticipant.defaultRole,
              participantRole,
              roleBadge,
              studioName,
              staffSpecialty,
            }
          : null,
        lastMessage: room.lastMessage
          ? {
              id: (room.lastMessage as any)._id,
              messageText: (room.lastMessage as any).messageText,
              senderId:
                (room.lastMessage as any).senderId?._id ||
                (room.lastMessage as any).senderId,
              isRead: (room.lastMessage as any).isRead,
              createdAt: (room.lastMessage as any).createdAt,
            }
          : null,
        lastMessageAt: room.lastMessageAt,
        unreadCount: unreadByRoom.get(room._id.toString()) || 0,
      };
    });

    return mapped.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }

  async getAvailablePartners(userId: string, userRoles: string[] = []) {
    const userObjectId = new Types.ObjectId(userId);
    const existingRooms = await this.chatRoomModel
      .find({ participants: userObjectId })
      .select('participants')
      .lean()
      .exec();

    const excludedUserIds = new Set<string>([userId]);
    for (const room of existingRooms) {
      for (const participantId of room.participants) {
        excludedUserIds.add(participantId.toString());
      }
    }

    const { isProvider, isStaffOnly } = this.getRolePerspective(userRoles);

    if (isStaffOnly) {
      if (typeof this.providerStaffModel?.find !== 'function') return [];
      const staffDocs = await this.providerStaffModel
        .find({
          linkedUserId: userObjectId,
          status: ProviderStaffStatus.Active,
        })
        .select('_id providerId')
        .lean()
        .exec();
      if (staffDocs.length === 0) return [];

      const myStaffIds = staffDocs.map(
        (s) => new Types.ObjectId(s._id.toString()),
      );
      const myProviderIds = staffDocs
        .map((s) => s.providerId)
        .filter((pid): pid is Types.ObjectId => Boolean(pid))
        .map((pid) => new Types.ObjectId(pid.toString()));

      const results: Array<{
        _id: any;
        userId: any;
        businessName: string;
        capabilities: string[];
        avatarUrl: string | null;
        partnerType: 'STUDIO_OWNER' | 'ASSIGNED_CUSTOMER';
        subtitle: string;
      }> = [];

      if (
        myProviderIds.length > 0 &&
        typeof this.providerModel?.find === 'function'
      ) {
        const owners = await this.providerModel
          .find({ _id: { $in: myProviderIds } })
          .select('_id userId businessName capabilities media portfolio')
          .lean()
          .exec();
        const ownerUserIds = owners
          .map((o) => o.userId)
          .filter(
            (oid): oid is Types.ObjectId =>
              Boolean(oid) && !excludedUserIds.has(oid.toString()),
          );
        if (ownerUserIds.length > 0) {
          const ownerUsers = await this.userModel
            .find({ _id: { $in: ownerUserIds } })
            .select('_id profile.fullName profile.avatarUrl')
            .lean()
            .exec();
          const ownerUsersMap = new Map(
            ownerUsers.map((u) => [u._id.toString(), u]),
          );
          for (const owner of owners) {
            const ownerUid = owner.userId?.toString?.();
            if (!ownerUid || excludedUserIds.has(ownerUid)) continue;
            const ownerUser = ownerUsersMap.get(ownerUid);
            if (!ownerUser) continue;
            excludedUserIds.add(ownerUid);
            results.push({
              _id: owner._id,
              userId: ownerUser._id,
              businessName:
                owner.businessName ||
                ownerUser.profile?.fullName ||
                'Chủ Studio',
              capabilities: owner.capabilities || [],
              avatarUrl:
                ownerUser.profile?.avatarUrl ||
                this.resolveProviderAvatar(owner),
              partnerType: 'STUDIO_OWNER',
              subtitle: 'Chủ Studio quản lý',
            });
          }
        }
      }

      if (
        typeof this.bookingScheduleModel?.find === 'function' &&
        typeof this.bookingModel?.find === 'function'
      ) {
        const schedules = await this.bookingScheduleModel
          .find({
            assignedStaffId: { $in: myStaffIds },
            scheduleType: BookingScheduleType.Photoshoot,
            status: { $ne: BookingScheduleStatus.Cancelled },
          })
          .select('bookingId')
          .lean()
          .exec();
        const bookingIds = Array.from(
          new Set(
            schedules
              .map((s) => s.bookingId?.toString?.())
              .filter((id): id is string => Boolean(id)),
          ),
        ).map((id) => new Types.ObjectId(id));

        if (bookingIds.length > 0) {
          const bookings = await this.bookingModel
            .find({
              _id: { $in: bookingIds },
              status: {
                $nin: [
                  BookingStatus.PendingPayment,
                  BookingStatus.Cancelled,
                  BookingStatus.Refunded,
                  BookingStatus.Draft,
                ],
              },
            })
            .select('_id customerId bookingCode')
            .sort({ updatedAt: -1 })
            .lean()
            .exec();

          const bookingCodeByCustId = new Map<string, string>();
          const custObjectIds: Types.ObjectId[] = [];
          for (const b of bookings) {
            const cid = b.customerId?.toString?.();
            if (cid && !excludedUserIds.has(cid) && !bookingCodeByCustId.has(cid)) {
              bookingCodeByCustId.set(cid, b.bookingCode || '');
              custObjectIds.push(new Types.ObjectId(cid));
            }
          }

          if (custObjectIds.length > 0) {
            const custUsers = await this.userModel
              .find({ _id: { $in: custObjectIds } })
              .select('_id profile.fullName profile.avatarUrl')
              .lean()
              .exec();
            for (const cu of custUsers) {
              const cid = cu._id.toString();
              excludedUserIds.add(cid);
              const code = bookingCodeByCustId.get(cid);
              results.push({
                _id: cu._id,
                userId: cu._id,
                businessName: cu.profile?.fullName || 'Khách hàng',
                capabilities: [],
                avatarUrl: cu.profile?.avatarUrl || null,
                partnerType: 'ASSIGNED_CUSTOMER',
                subtitle: code ? `Khách đơn #${code}` : 'Khách chụp của bạn',
              });
            }
          }
        }
      }

      return results;
    }

    if (isProvider) {
      if (
        typeof this.providerModel?.find !== 'function' ||
        typeof this.providerStaffModel?.find !== 'function'
      ) {
        return [];
      }
      const ownedProviders = await this.providerModel
        .find({ userId: userObjectId })
        .select('_id')
        .lean()
        .exec();
      if (ownedProviders.length === 0) return [];

      const ownedProviderIds = ownedProviders.map((p) => p._id);
      const staffMembers = await this.providerStaffModel
        .find({
          providerId: { $in: ownedProviderIds },
          status: ProviderStaffStatus.Active,
          linkedUserId: { $ne: null },
        })
        .select('_id name avatarUrl specialty linkedUserId')
        .lean()
        .exec();

      const candidateUserIds = staffMembers
        .map((s) => s.linkedUserId)
        .filter(
          (uid): uid is Types.ObjectId =>
            uid != null && !excludedUserIds.has(uid.toString()),
        );
      if (candidateUserIds.length === 0) return [];

      const users = await this.userModel
        .find({ _id: { $in: candidateUserIds } })
        .select('_id profile.fullName profile.avatarUrl')
        .lean()
        .exec();
      const usersById = new Map(users.map((u) => [u._id.toString(), u]));

      return staffMembers.flatMap((staff) => {
        const linkedStr = staff.linkedUserId?.toString?.();
        if (!linkedStr || excludedUserIds.has(linkedStr)) return [];
        const userDoc = usersById.get(linkedStr);
        if (!userDoc) return [];
        return [
          {
            _id: staff._id,
            userId: userDoc._id,
            businessName:
              staff.name || userDoc.profile?.fullName || 'Thợ chụp Studio',
            capabilities: [],
            avatarUrl: staff.avatarUrl || userDoc.profile?.avatarUrl || null,
            partnerType: 'STAFF' as const,
            subtitle: staff.specialty || 'Thợ chụp trong Studio',
          },
        ];
      });
    }

    const providers = await this.providerModel
      .find({
        status: ProviderStatus.Active,
        capabilities: {
          $in: [ProviderCapability.Photography, ProviderCapability.AoDaiRental],
        },
      })
      .select('_id userId businessName capabilities media portfolio')
      .lean()
      .exec();

    const candidateUserIds = providers
      .map((provider) => provider.userId)
      .filter(
        (partnerUserId): partnerUserId is Types.ObjectId =>
          Boolean(partnerUserId) &&
          !excludedUserIds.has(partnerUserId.toString()),
      );

    if (candidateUserIds.length === 0) return [];

    const users = await this.userModel
      .find({ _id: { $in: candidateUserIds } })
      .select('_id profile.fullName profile.avatarUrl')
      .lean()
      .exec();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    return providers.flatMap((provider) => {
      const partnerUserId = provider.userId?.toString();
      if (!partnerUserId || excludedUserIds.has(partnerUserId)) return [];

      const partnerUser = usersById.get(partnerUserId);
      if (!partnerUser) return [];

      const caps = provider.capabilities || [];
      const subtitle =
        caps.includes(ProviderCapability.Photography) &&
        caps.includes(ProviderCapability.AoDaiRental)
          ? 'Studio & Tiệm Áo Dài'
          : caps.includes(ProviderCapability.Photography)
            ? 'Studio Chụp Ảnh'
            : 'Tiệm Thuê Áo Dài';

      return [
        {
          _id: provider._id,
          userId: partnerUser._id,
          businessName:
            provider.businessName || partnerUser.profile?.fullName || 'Đối tác',
          capabilities: caps,
          avatarUrl:
            partnerUser.profile?.avatarUrl ||
            this.resolveProviderAvatar(provider),
          partnerType: 'PROVIDER' as const,
          subtitle,
        },
      ];
    });
  }

  async getMessages(
    roomId: string,
    userId: string,
    userRoles: string[] = [],
    limit: number = 50,
    skip: number = 0,
  ) {
    await this.assertUserInRoom(roomId, userId, userRoles);

    const messages = await this.chatMessageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ createdAt: 1 }) // Order from oldest to newest for visual flow
      .skip(skip)
      .limit(limit)
      .exec();

    return messages;
  }

  async getOrCreateRoom(
    userId: string,
    otherUserId: string,
    callerRoles: string[] = [],
  ) {
    if (!Types.ObjectId.isValid(otherUserId)) {
      throw new BadRequestException('Invalid partner id');
    }

    const userObjectId = new Types.ObjectId(userId);
    let partner = await this.userModel.findById(otherUserId).exec();
    if (!partner) {
      const provider = await this.providerModel
        .findById(otherUserId)
        .select('userId')
        .lean()
        .exec();
      if (provider?.userId) {
        partner = await this.userModel.findById(provider.userId).exec();
      }
    }
    if (!partner && this.providerStaffModel) {
      const staffDoc = await this.providerStaffModel
        .findById(otherUserId)
        .select('linkedUserId')
        .lean()
        .exec();
      if (staffDoc) {
        if (!staffDoc.linkedUserId) {
          throw new BadRequestException(
            'Thợ chụp này chưa được cấp tài khoản chat trực tiếp. Vui lòng nhắn cho Studio hoặc gọi SĐT của thợ.',
          );
        }
        partner = await this.userModel.findById(staffDoc.linkedUserId).exec();
      }
    }
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    const partnerObjectId = partner._id;
    if (userObjectId.equals(partnerObjectId)) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    const normalizedRoles = (callerRoles || []).map((r) =>
      String(r).toUpperCase(),
    );
    const isPureStaff =
      normalizedRoles.includes('STAFF') &&
      !normalizedRoles.includes('PROVIDER') &&
      !normalizedRoles.includes('ADMIN');

    if (
      isPureStaff &&
      this.providerStaffModel &&
      this.bookingScheduleModel &&
      this.bookingModel
    ) {
      const staff = await this.providerStaffModel
        .findOne({ linkedUserId: userObjectId })
        .select('_id providerId')
        .lean()
        .exec();
      if (!staff) {
        throw new ForbiddenException(
          'Tài khoản thợ chụp chưa được liên kết với hồ sơ Studio.',
        );
      }

      const studio = await this.providerModel
        .findById(staff.providerId)
        .select('userId')
        .lean()
        .exec();
      const isStudioOwner =
        studio?.userId && studio.userId.toString() === partnerObjectId.toString();

      if (!isStudioOwner) {
        const staffSchedules = await this.bookingScheduleModel
          .find({
            providerId: staff.providerId,
            assignedStaffId: staff._id,
            scheduleType: BookingScheduleType.Photoshoot,
            status: {
              $in: [
                BookingScheduleStatus.Confirmed,
                BookingScheduleStatus.Completed,
              ],
            },
          })
          .select('bookingId')
          .lean()
          .exec();

        const staffBookingIds = [
          ...new Set(
            staffSchedules.map((s) => s.bookingId?.toString()).filter(Boolean),
          ),
        ].map((id) => new Types.ObjectId(id));

        const matchingBooking = staffBookingIds.length
          ? await this.bookingModel
              .findOne({
                _id: { $in: staffBookingIds },
                customerId: partnerObjectId,
                status: {
                  $nin: [
                    BookingStatus.PendingPayment,
                    BookingStatus.Cancelled,
                    BookingStatus.Refunded,
                  ],
                },
              })
              .select('_id')
              .lean()
              .exec()
          : null;

        if (!matchingBooking) {
          throw new ForbiddenException(
            'Thợ chụp chỉ được nhắn tin với chủ Studio hoặc khách hàng thuộc đơn mình phụ trách.',
          );
        }
      }
    }

    // Find 1v1 room
    let room = await this.chatRoomModel
      .findOne({
        participants: { $all: [userObjectId, partnerObjectId] },
      })
      .exec();

    if (!room) {
      room = await this.chatRoomModel.create({
        participants: [userObjectId, partnerObjectId],
        lastMessage: null,
        lastMessageAt: new Date(),
      });
    }

    // Populate and return mapped room
    const populatedRoom = await room.populate(
      'participants',
      'profile roles defaultRole',
    );
    const otherParticipant = populatedRoom.participants.find(
      (p: any) => p._id.toString() !== userId,
    ) as any;

    return {
      id: populatedRoom._id,
      otherParticipant: otherParticipant
        ? {
            id: otherParticipant._id,
            fullName: otherParticipant.profile?.fullName || 'Người dùng',
            avatarUrl: otherParticipant.profile?.avatarUrl || null,
            roles: otherParticipant.roles,
            defaultRole: otherParticipant.defaultRole,
          }
        : null,
      lastMessage: null,
      lastMessageAt: populatedRoom.lastMessageAt,
    };
  }

  async createMessage(
    roomId: string,
    senderId: string,
    messageText: string,
    attachments: string[] = [],
  ) {
    await this.assertUserInRoom(roomId, senderId);

    const cleanText = (messageText || '').trim();
    if (!cleanText && (!attachments || attachments.length === 0)) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống.');
    }
    if (cleanText.length > 2000) {
      throw new BadRequestException(
        'Nội dung tin nhắn vượt quá giới hạn 2000 ký tự.',
      );
    }
    if (attachments && attachments.length > 5) {
      throw new BadRequestException(
        'Mỗi tin nhắn chỉ được đính kèm tối đa 5 tệp.',
      );
    }

    const message = await this.chatMessageModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId(senderId),
      messageText: cleanText,
      attachments,
      isRead: false,
      readBy: [new Types.ObjectId(senderId)],
    });

    await this.chatRoomModel.updateOne(
      { _id: new Types.ObjectId(roomId) },
      {
        $set: {
          lastMessage: message._id,
          lastMessageAt: new Date(),
        },
      },
    );

    return message;
  }

  async markRoomAsRead(roomId: string, userId: string) {
    await this.assertUserInRoom(roomId, userId);

    const roomObjectId = new Types.ObjectId(roomId);
    const userObjectId = new Types.ObjectId(userId);

    await this.chatMessageModel.updateMany(
      {
        roomId: roomObjectId,
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
      },
      {
        $set: { isRead: true },
        $addToSet: { readBy: userObjectId },
      },
    );
  }

  async getRoomParticipants(roomId: string): Promise<string[]> {
    const room = await this.chatRoomModel
      .findById(new Types.ObjectId(roomId))
      .exec();
    if (!room) return [];
    return room.participants.map((id) => id.toString());
  }

  async getStaffChatForBookingSupervision(
    bookingIdStr: string,
    actorUserId: string,
    actorRoles: string[] = [],
    staffIdStr?: string,
    limit: number = 100,
    skip: number = 0,
  ) {
    if (!this.bookingModel || !this.bookingScheduleModel) {
      throw new BadRequestException('Tính năng giám sát chat chưa được cấu hình.');
    }
    if (!Types.ObjectId.isValid(bookingIdStr)) {
      throw new BadRequestException('ID đơn hàng không hợp lệ.');
    }
    if (staffIdStr && !Types.ObjectId.isValid(staffIdStr)) {
      throw new BadRequestException('ID thợ chụp không hợp lệ.');
    }

    const booking = await this.bookingModel
      .findById(bookingIdStr)
      .select('_id bookingCode customerId providerIds status')
      .populate('customerId', 'profile.fullName profile.avatarUrl auth.phone')
      .lean()
      .exec();

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng này.');
    }

    const isAdmin = (actorRoles || []).some(
      (r) => String(r).toUpperCase() === 'ADMIN',
    );
    let scopedProviderIds: Types.ObjectId[] | null = null;

    if (!isAdmin) {
      if (!Types.ObjectId.isValid(actorUserId)) {
        throw new ForbiddenException('Không có quyền giám sát cuộc trò chuyện.');
      }
      const ownedProviders = await this.providerModel
        .find({ userId: new Types.ObjectId(actorUserId) })
        .select('_id')
        .lean()
        .exec();
      const ownedIds = new Set(ownedProviders.map((p) => p._id.toString()));
      const matched = (booking.providerIds ?? []).filter((pid) =>
        ownedIds.has(pid.toString()),
      );
      if (matched.length === 0) {
        throw new ForbiddenException(
          'Bạn không có quyền xem trao đổi của đơn hàng thuộc Studio khác.',
        );
      }
      scopedProviderIds = matched;
    }

    const customerDoc = booking.customerId as any;
    const customerIdStr =
      customerDoc?._id?.toString?.() ?? booking.customerId?.toString?.() ?? null;
    const customer = customerDoc?._id
      ? {
          userId: customerDoc._id.toString(),
          fullName: customerDoc.profile?.fullName ?? 'Khách hàng',
          avatarUrl: customerDoc.profile?.avatarUrl ?? null,
          phone: customerDoc.auth?.phone ?? null,
        }
      : customerIdStr
        ? { userId: customerIdStr, fullName: 'Khách hàng', avatarUrl: null, phone: null }
        : null;

    const scheduleQuery: Record<string, any> = {
      bookingId: booking._id,
      scheduleType: BookingScheduleType.Photoshoot,
      assignedStaffId: staffIdStr ? new Types.ObjectId(staffIdStr) : { $ne: null },
      ...(scopedProviderIds ? { providerId: { $in: scopedProviderIds } } : {}),
    };

    const schedules = await this.bookingScheduleModel
      .find(scheduleQuery)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const targetSchedule =
      schedules.find(
        (s) => s.status !== BookingScheduleStatus.Cancelled && s.assignedStaffId,
      ) ?? schedules.find((s) => Boolean(s.assignedStaffId));

    if (!targetSchedule?.assignedStaffId) {
      return {
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        readOnly: true,
        roomId: null,
        staff: null,
        customer,
        messages: [],
        note: 'Đơn hàng chưa có thợ chụp được phân công.',
      };
    }

    const staffDoc = this.providerStaffModel
      ? await this.providerStaffModel
          .findById(targetSchedule.assignedStaffId)
          .select('_id name avatarUrl phone linkedUserId')
          .lean()
          .exec()
      : null;

    const linkedUserId =
      staffDoc?.linkedUserId?.toString?.() ??
      targetSchedule.assignedStaffSnapshot?.linkedUserId ??
      null;

    const staffInfo = {
      staffId: targetSchedule.assignedStaffId.toString(),
      name: staffDoc?.name ?? targetSchedule.assignedStaffSnapshot?.name ?? 'Thợ chụp',
      avatarUrl:
        staffDoc?.avatarUrl ??
        targetSchedule.assignedStaffSnapshot?.avatarUrl ??
        null,
      phone:
        staffDoc?.phone ?? targetSchedule.assignedStaffSnapshot?.phone ?? null,
      linkedUserId,
    };

    if (!linkedUserId || !customerIdStr) {
      return {
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        readOnly: true,
        roomId: null,
        staff: staffInfo,
        customer,
        messages: [],
        note: 'Thợ chụp phụ trách chưa được cấp tài khoản chat trực tiếp.',
      };
    }

    const room = await this.chatRoomModel
      .findOne({
        participants: {
          $all: [
            new Types.ObjectId(customerIdStr),
            new Types.ObjectId(linkedUserId),
          ],
        },
      })
      .lean()
      .exec();

    if (!room) {
      return {
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        readOnly: true,
        roomId: null,
        staff: staffInfo,
        customer,
        messages: [],
        note: 'Khách hàng và thợ chụp chưa có đoạn hội thoại nào.',
      };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const safeSkip = Math.max(Number(skip) || 0, 0);

    const messages = await this.chatMessageModel
      .find({ roomId: room._id })
      .sort({ createdAt: 1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean()
      .exec();

    return {
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      readOnly: true,
      roomId: room._id.toString(),
      staff: staffInfo,
      customer,
      messages,
    };
  }
}
