import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Provider,
  ProviderDocument,
} from '../../providers/schemas/provider.schema';
import {
  ProviderStaff,
  ProviderStaffDocument,
  ProviderStaffStatus,
} from '../../providers/schemas/provider-staff.schema';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { BookingItem } from '../schemas/booking-item.schema';
import { Booking, BookingStatus } from '../schemas/booking.schema';
import { ProviderScheduleLock } from '../schemas/provider-schedule-lock.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { bumpProviderAvailabilityVersion } from './provider-availability-version';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MAX_TRANSACTION_RETRIES = 3;

export interface SessionWindowInput {
  clientId: string;
  dateKey: string;
  startMin: number;
  endMin: number;
}

export interface StaffSnapshot {
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  specialty?: string | null;
  linkedUserId?: string | null;
}

export interface StaffAssignmentDecision {
  assignedStaffId: Types.ObjectId | null;
  assignedStaffSnapshot: StaffSnapshot | null;
  remainingSlotsAfterAssign: number;
}

export interface OccupancyRecord {
  bookingId: string;
  bookingItemId: string;
  scheduleId: string | null;
  dateKey: string;
  startMin: number;
  endMin: number;
  assignedStaffId: string | null;
}

export interface SessionEvaluationResult {
  valid: boolean;
  errors: Array<{ clientId: string; code: 'SLOT_UNAVAILABLE'; message: string }>;
  configuredCapacity: number;
  activeStaffCount: number;
  assignmentsByClientId: Map<string, StaffAssignmentDecision>;
  remainingByClientId: Map<string, number>;
}

export interface SlotAvailabilityWindow {
  date: string;
  timeSlot: string;
  occupiedCount: number;
  capacity: number;
  remainingSlots: number;
}

export function toIctDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
}

export function toIctMinutes(date: Date): number {
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

export function formatMinutesToHHmm(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseTimeRangeToMinutes(
  value?: string | null,
): { startMin: number; endMin: number } | null {
  if (!value || !value.includes('-')) return null;
  const parts = value.split('-').map((p) => p.trim());
  if (parts.length < 2) return null;
  const parsePart = (part: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(part);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 24 || m < 0 || m > 59) return null;
    if (h === 24 && m > 0) return null;
    return h * 60 + m;
  };
  const startMin = parsePart(parts[0]);
  const endMin = parsePart(parts[1]);
  if (startMin === null || endMin === null || startMin >= endMin) return null;
  return { startMin, endMin };
}

function toMinutesOfHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getStaffBlockReason(
  staff: { blockedSlots?: Array<any> },
  dateKey: string,
  startMin: number,
  endMin: number,
): { blocked: boolean; reason?: string | null } {
  const blocks = staff.blockedSlots ?? [];
  for (const b of blocks) {
    if (b.date !== dateKey) continue;
    const bStart = b.startTime ? toMinutesOfHHmm(b.startTime) : 0;
    const bEnd = b.endTime ? toMinutesOfHHmm(b.endTime) : 24 * 60;
    if (bStart < endMin && startMin < bEnd) {
      return {
        blocked: true,
        reason: b.reason || (b.startTime && b.endTime ? `Nghỉ ${b.startTime}-${b.endTime}` : 'Nghỉ phép cả ngày'),
      };
    }
  }
  return { blocked: false };
}

@Injectable()
export class StaffAvailabilityService {
  constructor(
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
    @InjectModel(ProviderStaff.name)
    private readonly staffModel: Model<ProviderStaffDocument>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(ProviderScheduleLock.name)
    private readonly scheduleLockModel: Model<ProviderScheduleLock>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async loadProviderCapacityContext(
    providerId: Types.ObjectId,
    session?: ClientSession,
  ) {
    const providerQuery = this.providerModel
      .findById(providerId)
      .select('businessName photographySettings');
    if (session) providerQuery.session(session);

    const staffQuery = this.staffModel
      .find({ providerId, status: ProviderStaffStatus.Active })
      .sort({ sortOrder: 1, createdAt: 1 });
    if (session) staffQuery.session(session);

    const [provider, activeStaff] = await Promise.all([
      providerQuery.lean().exec(),
      staffQuery.lean().exec(),
    ]);

    const maxConcurrentSessions =
      provider?.photographySettings?.maxConcurrentSessions ?? null;
    const maxDailySessions =
      provider?.photographySettings?.maxDailySessions ?? null;
    const activeStaffCount = activeStaff.length;
    const configuredCapacity =
      activeStaffCount <= 0
        ? 1
        : maxConcurrentSessions && maxConcurrentSessions > 0
          ? Math.min(activeStaffCount, maxConcurrentSessions)
          : activeStaffCount;

    return {
      provider,
      activeStaff,
      activeStaffCount,
      maxConcurrentSessions,
      maxDailySessions,
      configuredCapacity,
    };
  }

  async loadActiveOccupancies(
    providerId: Types.ObjectId,
    dateKeys?: string[],
    session?: ClientSession,
    options?: {
      excludeScheduleId?: Types.ObjectId;
      excludeBookingItemId?: Types.ObjectId;
    },
  ): Promise<OccupancyRecord[]> {
    const now = new Date();
    const v2Filter: Record<string, unknown> = {
      providerId,
      scheduleType: BookingScheduleType.Photoshoot,
      $or: [
        { status: BookingScheduleStatus.Confirmed },
        { status: BookingScheduleStatus.Scheduled },
        { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
      ],
    };
    if (dateKeys && dateKeys.length > 0) {
      v2Filter.providerLocalDate = { $in: dateKeys };
    }

    const v2Query = this.bookingScheduleModel
      .find(v2Filter)
      .select(
        '_id bookingId bookingItemId startsAt endsAt scheduledDate timeSlot providerLocalDate assignedStaffId',
      );
    if (session) v2Query.session(session);

    const legacyItemQuery = this.bookingItemModel
      .find({ providerId })
      .select('_id bookingId shootDate shootTimeSlot rescheduleRequest');
    if (session) legacyItemQuery.session(session);

    const [v2Schedules, allProviderItems] = await Promise.all([
      v2Query.lean().exec(),
      legacyItemQuery.lean().exec(),
    ]);

    const dateFilterSet =
      dateKeys && dateKeys.length > 0 ? new Set(dateKeys) : null;
    const excludeScheduleIdStr = options?.excludeScheduleId?.toString();
    const excludeBookingItemIdStr = options?.excludeBookingItemId?.toString();

    const occupancies: OccupancyRecord[] = [];
    const seenV2BookingItemIds = new Set<string>();

    for (const sch of v2Schedules as any[]) {
      const schIdStr = sch._id?.toString();
      const itemIdStr = sch.bookingItemId?.toString() ?? '';
      if (itemIdStr) seenV2BookingItemIds.add(itemIdStr);
      if (excludeScheduleIdStr && schIdStr === excludeScheduleIdStr) continue;
      if (excludeBookingItemIdStr && itemIdStr === excludeBookingItemIdStr)
        continue;

      let dateKey: string | null = sch.providerLocalDate ?? null;
      let startMin: number | null = null;
      let endMin: number | null = null;

      if (sch.startsAt && sch.endsAt) {
        const sDate = new Date(sch.startsAt);
        const eDate = new Date(sch.endsAt);
        if (!dateKey) dateKey = toIctDateKey(sDate);
        startMin = toIctMinutes(sDate);
        const rawEnd = toIctMinutes(eDate);
        endMin =
          rawEnd === 0 && eDate.getTime() > sDate.getTime() ? 24 * 60 : rawEnd;
      } else if (sch.scheduledDate && sch.timeSlot) {
        dateKey = toIctDateKey(new Date(sch.scheduledDate));
        const parsed = parseTimeRangeToMinutes(sch.timeSlot);
        if (parsed) {
          startMin = parsed.startMin;
          endMin = parsed.endMin;
        }
      }

      if (
        !dateKey ||
        startMin === null ||
        endMin === null ||
        startMin >= endMin
      ) {
        continue;
      }
      if (dateFilterSet && !dateFilterSet.has(dateKey)) continue;

      occupancies.push({
        bookingId: sch.bookingId?.toString() ?? '',
        bookingItemId: itemIdStr,
        scheduleId: schIdStr ?? null,
        dateKey,
        startMin,
        endMin,
        assignedStaffId: sch.assignedStaffId?.toString() ?? null,
      });
    }

    // Legacy fallback: only include items NOT already represented in BookingSchedule
    // to eliminate the V2 double-count bug!
    const candidateLegacyItems = (allProviderItems as any[]).filter((item) => {
      const idStr = item._id?.toString() ?? '';
      if (excludeBookingItemIdStr && idStr === excludeBookingItemIdStr)
        return false;
      const hasLegacySlot = Boolean(item.shootDate && item.shootTimeSlot);
      const hasPendingReschedule = Boolean(
        item.rescheduleRequest &&
          ['PENDING', 'PROCESSING'].includes(item.rescheduleRequest.status) &&
          item.rescheduleRequest.newShootDate &&
          item.rescheduleRequest.newShootTimeSlot &&
          (!item.rescheduleRequest.lockedExpiresAt ||
            new Date(item.rescheduleRequest.lockedExpiresAt) > now),
      );
      return (
        (!seenV2BookingItemIds.has(idStr) && hasLegacySlot) ||
        hasPendingReschedule
      );
    });

    if (candidateLegacyItems.length > 0) {
      const bookingIds = [
        ...new Set(
          candidateLegacyItems
            .map((it) => it.bookingId?.toString())
            .filter((id) => id && Types.ObjectId.isValid(id)),
        ),
      ].map((id) => new Types.ObjectId(id));

      const activeBookingsQuery = this.bookingModel
        .find({
          _id: { $in: bookingIds },
          status: {
            $nin: [
              BookingStatus.Cancelled,
              BookingStatus.Completed,
              BookingStatus.Returned,
              BookingStatus.Refunded,
            ],
          },
        })
        .select('_id');
      if (session) activeBookingsQuery.session(session);
      const activeBookings = await activeBookingsQuery.lean().exec();
      const activeBookingIdSet = new Set(
        activeBookings.map((b: any) => b._id.toString()),
      );

      for (const item of candidateLegacyItems) {
        const bIdStr = item.bookingId?.toString() ?? '';
        if (!activeBookingIdSet.has(bIdStr)) continue;
        const itemIdStr = item._id?.toString() ?? '';

        if (
          !seenV2BookingItemIds.has(itemIdStr) &&
          item.shootDate &&
          item.shootTimeSlot
        ) {
          const dateKey =
            typeof item.shootDate === 'string'
              ? item.shootDate.slice(0, 10)
              : toIctDateKey(new Date(item.shootDate));
          const parsed = parseTimeRangeToMinutes(item.shootTimeSlot);
          if (parsed && (!dateFilterSet || dateFilterSet.has(dateKey))) {
            occupancies.push({
              bookingId: bIdStr,
              bookingItemId: itemIdStr,
              scheduleId: null,
              dateKey,
              startMin: parsed.startMin,
              endMin: parsed.endMin,
              assignedStaffId: null,
            });
          }
        }

        const req = item.rescheduleRequest;
        if (
          req &&
          ['PENDING', 'PROCESSING'].includes(req.status) &&
          req.newShootDate &&
          req.newShootTimeSlot &&
          (!req.lockedExpiresAt || new Date(req.lockedExpiresAt) > now)
        ) {
          const reqDateKey =
            typeof req.newShootDate === 'string'
              ? req.newShootDate.slice(0, 10)
              : toIctDateKey(new Date(req.newShootDate));
          const parsed = parseTimeRangeToMinutes(req.newShootTimeSlot);
          if (parsed && (!dateFilterSet || dateFilterSet.has(reqDateKey))) {
            occupancies.push({
              bookingId: bIdStr,
              bookingItemId: itemIdStr,
              scheduleId: null,
              dateKey: reqDateKey,
              startMin: parsed.startMin,
              endMin: parsed.endMin,
              assignedStaffId: null,
            });
          }
        }
      }
    }

    return occupancies;
  }

  async evaluateSessions(
    providerId: Types.ObjectId,
    sessions: SessionWindowInput[],
    options?: {
      preferredStaffId?: string | null;
      preferStaffIdForReschedule?: string | null;
      session?: ClientSession;
      excludeScheduleId?: Types.ObjectId;
      excludeBookingItemId?: Types.ObjectId;
    },
  ): Promise<SessionEvaluationResult> {
    const dateKeys = [...new Set(sessions.map((s) => s.dateKey))];
    const [ctx, occupancies] = await Promise.all([
      this.loadProviderCapacityContext(providerId, options?.session),
      this.loadActiveOccupancies(providerId, dateKeys, options?.session, {
        excludeScheduleId: options?.excludeScheduleId,
        excludeBookingItemId: options?.excludeBookingItemId,
      }),
    ]);

    const errors: Array<{
      clientId: string;
      code: 'SLOT_UNAVAILABLE';
      message: string;
    }> = [];
    const assignmentsByClientId = new Map<string, StaffAssignmentDecision>();
    const remainingByClientId = new Map<string, number>();

    const { activeStaff, activeStaffCount, configuredCapacity, maxDailySessions } =
      ctx;

    // Validate preferredStaffId if supplied
    let preferredStaffDoc: any = null;
    if (options?.preferredStaffId) {
      if (!Types.ObjectId.isValid(options.preferredStaffId)) {
        for (const s of sessions) {
          errors.push({
            clientId: s.clientId,
            code: 'SLOT_UNAVAILABLE',
            message: 'Nhiếp ảnh gia bạn chọn không hợp lệ.',
          });
        }
        return {
          valid: false,
          errors,
          configuredCapacity,
          activeStaffCount,
          assignmentsByClientId,
          remainingByClientId,
        };
      }
      preferredStaffDoc =
        activeStaff.find(
          (st: any) => st._id.toString() === options.preferredStaffId,
        ) ?? null;
      if (!preferredStaffDoc) {
        for (const s of sessions) {
          errors.push({
            clientId: s.clientId,
            code: 'SLOT_UNAVAILABLE',
            message:
              'Nhiếp ảnh gia bạn chọn hiện không nhận lịch hoặc không thuộc Studio này.',
          });
        }
        return {
          valid: false,
          errors,
          configuredCapacity,
          activeStaffCount,
          assignmentsByClientId,
          remainingByClientId,
        };
      }
    }

    // Track per-day booking count (unique existing bookings + current booking) for maxDailySessions
    if (maxDailySessions && maxDailySessions > 0) {
      for (const dateKey of dateKeys) {
        const distinctBookingsOnDay = new Set(
          occupancies
            .filter((o) => o.dateKey === dateKey)
            .map((o) => o.bookingId || o.bookingItemId),
        );
        if (distinctBookingsOnDay.size >= maxDailySessions) {
          for (const s of sessions.filter((x) => x.dateKey === dateKey)) {
            errors.push({
              clientId: s.clientId,
              code: 'SLOT_UNAVAILABLE',
              message: `Studio đã nhận đủ giới hạn ${maxDailySessions} ca chụp trong ngày ${dateKey}.`,
            });
          }
        }
      }
      if (errors.length > 0) {
        return {
          valid: false,
          errors,
          configuredCapacity,
          activeStaffCount,
          assignmentsByClientId,
          remainingByClientId,
        };
      }
    }

    // Check whether a single staff member can cover all requested sessions (multi-session affinity)
    let sharedStaffForAllSessions: any = null;
    if (activeStaffCount > 0 && sessions.length > 1 && !preferredStaffDoc) {
      const candidates = activeStaff.filter((st: any) => {
        const stId = st._id.toString();
        return sessions.every((req) => {
          const blk = getStaffBlockReason(
            st,
            req.dateKey,
            req.startMin,
            req.endMin,
          );
          if (blk.blocked) return false;
          const overlaps = occupancies.filter(
            (o) =>
              o.dateKey === req.dateKey &&
              o.startMin < req.endMin &&
              req.startMin < o.endMin,
          );
          if (overlaps.some((o) => o.assignedStaffId === stId)) return false;
          return true;
        });
      });

      if (candidates.length > 0) {
        // Prefer preferStaffIdForReschedule or least loaded across all requested dates
        const preferMatch = options?.preferStaffIdForReschedule
          ? candidates.find(
              (c: any) =>
                c._id.toString() === options.preferStaffIdForReschedule,
            )
          : null;
        if (preferMatch) {
          sharedStaffForAllSessions = preferMatch;
        } else {
          candidates.sort((a: any, b: any) => {
            const countA = occupancies.filter(
              (o) => o.assignedStaffId === a._id.toString(),
            ).length;
            const countB = occupancies.filter(
              (o) => o.assignedStaffId === b._id.toString(),
            ).length;
            return countA - countB || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          });
          sharedStaffForAllSessions = candidates[0];
        }
      }
    }

    // Track virtual occupancies created by earlier sessions in the same multi-session request
    const workingOccupancies: OccupancyRecord[] = [...occupancies];

    for (const req of sessions) {
      const overlapping = workingOccupancies.filter(
        (o) =>
          o.dateKey === req.dateKey &&
          o.startMin < req.endMin &&
          req.startMin < o.endMin,
      );

      if (activeStaffCount === 0) {
        const remainingBefore = Math.max(0, 1 - overlapping.length);
        remainingByClientId.set(req.clientId, remainingBefore);
        if (remainingBefore <= 0) {
          errors.push({
            clientId: req.clientId,
            code: 'SLOT_UNAVAILABLE',
            message:
              'Khung giờ này vừa có người khác đặt hoặc đang được giữ chỗ.',
          });
          continue;
        }
        assignmentsByClientId.set(req.clientId, {
          assignedStaffId: null,
          assignedStaffSnapshot: null,
          remainingSlotsAfterAssign: 0,
        });
        workingOccupancies.push({
          bookingId: 'PENDING_NEW',
          bookingItemId: req.clientId,
          scheduleId: null,
          dateKey: req.dateKey,
          startMin: req.startMin,
          endMin: req.endMin,
          assignedStaffId: null,
        });
        continue;
      }

      const workingStaff = activeStaff.filter(
        (st: any) =>
          !getStaffBlockReason(st, req.dateKey, req.startMin, req.endMin)
            .blocked,
      );
      const slotEffectiveCapacity = Math.min(
        configuredCapacity,
        workingStaff.length,
      );
      const busyStaffIds = new Set(
        overlapping
          .map((o) => o.assignedStaffId)
          .filter((id): id is string => Boolean(id)),
      );
      const legacyUnassignedCount = overlapping.filter(
        (o) => !o.assignedStaffId,
      ).length;
      const freeStaff = workingStaff.filter(
        (st: any) => !busyStaffIds.has(st._id.toString()),
      );

      const remainingByCapacity = slotEffectiveCapacity - overlapping.length;
      const remainingByFreeStaff = freeStaff.length - legacyUnassignedCount;
      const remainingSlots = Math.max(
        0,
        Math.min(remainingByCapacity, remainingByFreeStaff),
      );
      remainingByClientId.set(req.clientId, remainingSlots);

      if (remainingSlots <= 0) {
        errors.push({
          clientId: req.clientId,
          code: 'SLOT_UNAVAILABLE',
          message:
            'Khung giờ này hiện đã hết suất thợ chụp trống. Vui lòng chọn giờ khác.',
        });
        continue;
      }

      let chosenStaff: any = null;
      if (preferredStaffDoc) {
        const prefId = preferredStaffDoc._id.toString();
        const blockCheck = getStaffBlockReason(
          preferredStaffDoc,
          req.dateKey,
          req.startMin,
          req.endMin,
        );
        if (blockCheck.blocked) {
          errors.push({
            clientId: req.clientId,
            code: 'SLOT_UNAVAILABLE',
            message: `Thợ chụp ${preferredStaffDoc.name} nghỉ vào khung giờ này (${blockCheck.reason}).`,
          });
          continue;
        }
        if (busyStaffIds.has(prefId)) {
          errors.push({
            clientId: req.clientId,
            code: 'SLOT_UNAVAILABLE',
            message: `Thợ chụp ${preferredStaffDoc.name} đã có lịch trong khung giờ này.`,
          });
          continue;
        }
        chosenStaff = preferredStaffDoc;
      } else if (
        sharedStaffForAllSessions &&
        freeStaff.some(
          (st: any) =>
            st._id.toString() === sharedStaffForAllSessions._id.toString(),
        )
      ) {
        chosenStaff = sharedStaffForAllSessions;
      } else {
        const rescheduleMatch = options?.preferStaffIdForReschedule
          ? freeStaff.find(
              (st: any) =>
                st._id.toString() === options.preferStaffIdForReschedule,
            )
          : null;
        if (rescheduleMatch) {
          chosenStaff = rescheduleMatch;
        } else {
          // Load balance: pick the free staff with fewest bookings on this date
          const sorted = [...freeStaff].sort((a: any, b: any) => {
            const dayCountA = workingOccupancies.filter(
              (o) =>
                o.dateKey === req.dateKey &&
                o.assignedStaffId === a._id.toString(),
            ).length;
            const dayCountB = workingOccupancies.filter(
              (o) =>
                o.dateKey === req.dateKey &&
                o.assignedStaffId === b._id.toString(),
            ).length;
            return dayCountA - dayCountB || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          });
          chosenStaff = sorted[0];
        }
      }

      const snapshot: StaffSnapshot = {
        name: chosenStaff.name,
        phone: chosenStaff.phone ?? null,
        avatarUrl: chosenStaff.avatarUrl ?? null,
        specialty: chosenStaff.specialty ?? null,
        linkedUserId: chosenStaff.linkedUserId?.toString?.() ?? null,
      };

      assignmentsByClientId.set(req.clientId, {
        assignedStaffId: new Types.ObjectId(chosenStaff._id),
        assignedStaffSnapshot: snapshot,
        remainingSlotsAfterAssign: Math.max(0, remainingSlots - 1),
      });

      workingOccupancies.push({
        bookingId: 'PENDING_NEW',
        bookingItemId: req.clientId,
        scheduleId: null,
        dateKey: req.dateKey,
        startMin: req.startMin,
        endMin: req.endMin,
        assignedStaffId: chosenStaff._id.toString(),
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      configuredCapacity,
      activeStaffCount,
      assignmentsByClientId,
      remainingByClientId,
    };
  }

  async computeBusyScheduleSummary(
    providerId: Types.ObjectId,
    staffId?: string,
  ): Promise<{
    bookedDates: string[];
    bookedSlots: { date: string; timeSlot: string; bookingItemId: string }[];
    totalActiveStaff: number;
    maxConcurrentSessions: number | null;
    effectiveCapacity: number;
    slotAvailability: SlotAvailabilityWindow[];
  }> {
    const [ctx, occupancies] = await Promise.all([
      this.loadProviderCapacityContext(providerId),
      this.loadActiveOccupancies(providerId),
    ]);

    const { activeStaff, activeStaffCount, configuredCapacity, maxConcurrentSessions } =
      ctx;

    const targetStaffDoc =
      staffId && Types.ObjectId.isValid(staffId)
        ? activeStaff.find((st: any) => st._id.toString() === staffId) ?? null
        : null;

    // Collect all dates that have occupancies or blocked slots
    const allDates = new Set<string>();
    for (const occ of occupancies) allDates.add(occ.dateKey);
    if (targetStaffDoc) {
      for (const blk of targetStaffDoc.blockedSlots ?? []) {
        allDates.add(blk.date);
      }
    } else if (activeStaffCount > 0) {
      for (const st of activeStaff as any[]) {
        for (const blk of st.blockedSlots ?? []) {
          allDates.add(blk.date);
        }
      }
    }

    const bookedDates = new Set<string>();
    const bookedSlots: {
      date: string;
      timeSlot: string;
      bookingItemId: string;
    }[] = [];
    const slotAvailability: SlotAvailabilityWindow[] = [];

    for (const dateKey of Array.from(allDates).sort()) {
      const dayOccupancies = occupancies.filter((o) => o.dateKey === dateKey);
      const boundaries = new Set<number>();

      for (const occ of dayOccupancies) {
        boundaries.add(occ.startMin);
        boundaries.add(occ.endMin);
      }
      const staffForBlocks = targetStaffDoc
        ? [targetStaffDoc]
        : (activeStaff as any[]);
      for (const st of staffForBlocks) {
        for (const blk of st.blockedSlots ?? []) {
          if (blk.date !== dateKey) continue;
          boundaries.add(blk.startTime ? toMinutesOfHHmm(blk.startTime) : 0);
          boundaries.add(blk.endTime ? toMinutesOfHHmm(blk.endTime) : 24 * 60);
        }
      }

      const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
      if (sortedPoints.length < 2) continue;

      let currentBusySegment: {
        startMin: number;
        endMin: number;
        bookingItemId: string;
      } | null = null;

      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const t0 = sortedPoints[i];
        const t1 = sortedPoints[i + 1];
        if (t0 >= t1) continue;

        const overlapping = dayOccupancies.filter(
          (o) => o.startMin < t1 && t0 < o.endMin,
        );

        let isSaturated = false;
        let segmentCapacity = configuredCapacity;
        let segmentRemaining = 0;

        if (activeStaffCount === 0) {
          segmentCapacity = 1;
          segmentRemaining = Math.max(0, 1 - overlapping.length);
          isSaturated = segmentRemaining <= 0;
        } else {
          const workingStaff = activeStaff.filter(
            (st: any) => !getStaffBlockReason(st, dateKey, t0, t1).blocked,
          );
          const busyStaffIds = new Set(
            overlapping
              .map((o) => o.assignedStaffId)
              .filter((id): id is string => Boolean(id)),
          );
          const legacyUnassignedCount = overlapping.filter(
            (o) => !o.assignedStaffId,
          ).length;
          const freeWorkingStaff = workingStaff.filter(
            (st: any) => !busyStaffIds.has(st._id.toString()),
          );

          const slotEffCap = Math.min(configuredCapacity, workingStaff.length);
          const poolRemaining = Math.max(
            0,
            Math.min(
              slotEffCap - overlapping.length,
              freeWorkingStaff.length - legacyUnassignedCount,
            ),
          );

          if (targetStaffDoc) {
            const targetIdStr = targetStaffDoc._id.toString();
            const isTargetBlocked = getStaffBlockReason(
              targetStaffDoc,
              dateKey,
              t0,
              t1,
            ).blocked;
            const isTargetBusy = busyStaffIds.has(targetIdStr);
            isSaturated = isTargetBlocked || isTargetBusy || poolRemaining <= 0;
            segmentCapacity = 1;
            segmentRemaining = isSaturated ? 0 : 1;
          } else {
            segmentCapacity = slotEffCap;
            segmentRemaining = poolRemaining;
            isSaturated = segmentRemaining <= 0;
          }
        }

        if (
          (overlapping.length > 0 || segmentCapacity < configuredCapacity) &&
          !isSaturated
        ) {
          slotAvailability.push({
            date: dateKey,
            timeSlot: `${formatMinutesToHHmm(t0)}-${formatMinutesToHHmm(t1)}`,
            occupiedCount: overlapping.length,
            capacity: segmentCapacity,
            remainingSlots: segmentRemaining,
          });
        }

        if (isSaturated) {
          const refItemId =
            overlapping[0]?.bookingItemId ||
            overlapping[0]?.scheduleId ||
            `capacity_${dateKey}`;
          if (currentBusySegment && currentBusySegment.endMin === t0) {
            currentBusySegment.endMin = t1;
          } else {
            if (currentBusySegment) {
              bookedSlots.push({
                date: dateKey,
                timeSlot: `${formatMinutesToHHmm(currentBusySegment.startMin)}-${formatMinutesToHHmm(currentBusySegment.endMin)}`,
                bookingItemId: currentBusySegment.bookingItemId,
              });
              bookedDates.add(dateKey);
            }
            currentBusySegment = {
              startMin: t0,
              endMin: t1,
              bookingItemId: refItemId,
            };
          }
        } else if (currentBusySegment) {
          bookedSlots.push({
            date: dateKey,
            timeSlot: `${formatMinutesToHHmm(currentBusySegment.startMin)}-${formatMinutesToHHmm(currentBusySegment.endMin)}`,
            bookingItemId: currentBusySegment.bookingItemId,
          });
          bookedDates.add(dateKey);
          currentBusySegment = null;
        }
      }

      if (currentBusySegment) {
        bookedSlots.push({
          date: dateKey,
          timeSlot: `${formatMinutesToHHmm(currentBusySegment.startMin)}-${formatMinutesToHHmm(currentBusySegment.endMin)}`,
          bookingItemId: currentBusySegment.bookingItemId,
        });
        bookedDates.add(dateKey);
      }
    }

    return {
      bookedDates: Array.from(bookedDates).sort(),
      bookedSlots,
      totalActiveStaff: activeStaffCount,
      maxConcurrentSessions,
      effectiveCapacity: configuredCapacity,
      slotAvailability,
    };
  }

  async getAvailableStaffForSchedule(
    bookingIdStr: string,
    scheduleIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
  ) {
    if (
      !Types.ObjectId.isValid(bookingIdStr) ||
      !Types.ObjectId.isValid(scheduleIdStr)
    ) {
      throw new BadRequestException('Mã đơn hoặc mã lịch chụp không hợp lệ.');
    }
    const schedule = await this.bookingScheduleModel
      .findOne({
        _id: new Types.ObjectId(scheduleIdStr),
        bookingId: new Types.ObjectId(bookingIdStr),
        scheduleType: BookingScheduleType.Photoshoot,
      })
      .lean()
      .exec();
    if (!schedule || !schedule.providerId) {
      throw new NotFoundException('Không tìm thấy lịch chụp phù hợp.');
    }

    await this.assertCanManageProvider(
      schedule.providerId,
      actorUserId,
      actorRoles,
    );

    const dateKey =
      schedule.providerLocalDate ||
      (schedule.startsAt
        ? toIctDateKey(new Date(schedule.startsAt))
        : schedule.scheduledDate
          ? toIctDateKey(new Date(schedule.scheduledDate))
          : null);
    let startMin = 0;
    let endMin = 24 * 60;
    if (schedule.startsAt && schedule.endsAt) {
      startMin = toIctMinutes(new Date(schedule.startsAt));
      const rawEnd = toIctMinutes(new Date(schedule.endsAt));
      endMin =
        rawEnd === 0 &&
        new Date(schedule.endsAt).getTime() >
          new Date(schedule.startsAt).getTime()
          ? 24 * 60
          : rawEnd;
    } else if (schedule.timeSlot) {
      const parsed = parseTimeRangeToMinutes(schedule.timeSlot);
      if (parsed) {
        startMin = parsed.startMin;
        endMin = parsed.endMin;
      }
    }

    const [ctx, occupancies] = await Promise.all([
      this.loadProviderCapacityContext(schedule.providerId),
      dateKey
        ? this.loadActiveOccupancies(schedule.providerId, [dateKey], undefined, {
            excludeScheduleId: schedule._id,
          })
        : Promise.resolve([]),
    ]);

    const overlappingBusyIds = new Set(
      occupancies
        .filter((o) => o.startMin < endMin && startMin < o.endMin)
        .map((o) => o.assignedStaffId)
        .filter((id): id is string => Boolean(id)),
    );

    const currentStaffIdStr = schedule.assignedStaffId?.toString() ?? null;

    return ctx.activeStaff.map((st: any) => {
      const id = st._id.toString();
      const block = dateKey
        ? getStaffBlockReason(st, dateKey, startMin, endMin)
        : { blocked: false };
      const isBusy = overlappingBusyIds.has(id);
      const available = !block.blocked && !isBusy;
      const unavailableReason = block.blocked
        ? block.reason || 'Đang nghỉ phép'
        : isBusy
          ? 'Đang bận đơn chụp khác cùng giờ'
          : null;

      return {
        _id: id,
        name: st.name,
        phone: st.phone,
        avatarUrl: st.avatarUrl ?? null,
        specialty: st.specialty ?? null,
        isCurrentlyAssigned: currentStaffIdStr === id,
        available,
        unavailableReason,
      };
    });
  }

  async assignStaffToBooking(
    bookingIdStr: string,
    staffIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
    reason?: string,
  ) {
    if (
      !Types.ObjectId.isValid(bookingIdStr) ||
      !Types.ObjectId.isValid(staffIdStr)
    ) {
      throw new BadRequestException('Mã đơn hoặc mã thợ chụp không hợp lệ.');
    }

    const schedules = await this.bookingScheduleModel
      .find({
        bookingId: new Types.ObjectId(bookingIdStr),
        scheduleType: BookingScheduleType.Photoshoot,
        status: {
          $in: [
            BookingScheduleStatus.Confirmed,
            BookingScheduleStatus.Held,
            BookingScheduleStatus.Scheduled,
          ],
        },
      })
      .select('_id')
      .lean()
      .exec();

    if (!schedules.length) {
      throw new NotFoundException(
        'Đơn hàng không có lịch chụp đang hoạt động để phân công thợ.',
      );
    }

    const results = [];
    for (const sch of schedules) {
      const updated = await this.assignStaffToSchedule(
        bookingIdStr,
        sch._id.toString(),
        staffIdStr,
        actorUserId,
        actorRoles,
        reason,
      );
      results.push(updated);
    }
    return results[0];
  }

  async assignStaffToSchedule(
    bookingIdStr: string,
    scheduleIdStr: string,
    newStaffIdStr: string,
    actorUserId: string,
    actorRoles?: string[],
    reason?: string,
  ) {
    if (
      !Types.ObjectId.isValid(bookingIdStr) ||
      !Types.ObjectId.isValid(scheduleIdStr) ||
      !Types.ObjectId.isValid(newStaffIdStr)
    ) {
      throw new BadRequestException('ID không hợp lệ.');
    }

    const bookingId = new Types.ObjectId(bookingIdStr);
    const scheduleId = new Types.ObjectId(scheduleIdStr);
    const newStaffId = new Types.ObjectId(newStaffIdStr);

    const lockedStatuses: BookingStatus[] = [
      BookingStatus.InProgress,
      BookingStatus.AwaitingReview,
      BookingStatus.ComboPhotosApproved,
      BookingStatus.Completed,
      BookingStatus.Cancelled,
      BookingStatus.Returned,
      BookingStatus.Refunded,
      BookingStatus.PartiallyRefunded,
    ];

    const updatedResult = await this.withTransactionRetry(async (session) => {
      const booking = await this.bookingModel
        .findById(bookingId)
        .session(session)
        .exec();
      if (!booking) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (lockedStatuses.includes(booking.status)) {
        throw new BadRequestException(
          `Không thể đổi thợ chụp khi đơn đã ở trạng thái ${booking.status}.`,
        );
      }

      const schedule = await this.bookingScheduleModel
        .findOne({
          _id: scheduleId,
          bookingId,
          scheduleType: BookingScheduleType.Photoshoot,
        })
        .session(session)
        .exec();
      if (!schedule || !schedule.providerId) {
        throw new NotFoundException('Không tìm thấy lịch chụp phù hợp.');
      }

      await this.assertCanManageProvider(
        schedule.providerId,
        actorUserId,
        actorRoles,
        session,
      );

      const dateKey =
        schedule.providerLocalDate ||
        (schedule.startsAt
          ? toIctDateKey(new Date(schedule.startsAt))
          : schedule.scheduledDate
            ? toIctDateKey(new Date(schedule.scheduledDate))
            : null);

      if (!dateKey) {
        throw new BadRequestException('Lịch chụp thiếu thông tin ngày thực hiện.');
      }

      await this.acquireScheduleLock(schedule.providerId, dateKey, session);

      let startMin = 0;
      let endMin = 24 * 60;
      if (schedule.startsAt && schedule.endsAt) {
        startMin = toIctMinutes(new Date(schedule.startsAt));
        const rawEnd = toIctMinutes(new Date(schedule.endsAt));
        endMin =
          rawEnd === 0 &&
          new Date(schedule.endsAt).getTime() >
            new Date(schedule.startsAt).getTime()
            ? 24 * 60
            : rawEnd;
      } else if (schedule.timeSlot) {
        const parsed = parseTimeRangeToMinutes(schedule.timeSlot);
        if (parsed) {
          startMin = parsed.startMin;
          endMin = parsed.endMin;
        }
      }

      const evaluation = await this.evaluateSessions(
        schedule.providerId,
        [{ clientId: 'reassign', dateKey, startMin, endMin }],
        {
          preferredStaffId: newStaffIdStr,
          excludeScheduleId: schedule._id,
          session,
        },
      );

      if (!evaluation.valid) {
        throw new ConflictException(
          evaluation.errors[0]?.message ||
            'Thợ chụp được chọn không khả dụng trong khung giờ này.',
        );
      }

      const decision = evaluation.assignmentsByClientId.get('reassign');
      const prevSnapshot = schedule.assignedStaffSnapshot ?? null;
      const prevStaffName = prevSnapshot?.name ?? null;
      const prevLinkedUserId = prevSnapshot?.linkedUserId ?? null;

      schedule.assignedStaffId = newStaffId;
      schedule.assignedStaffSnapshot = decision?.assignedStaffSnapshot ?? null;
      await schedule.save({ session });

      const newStaffName =
        decision?.assignedStaffSnapshot?.name ?? 'Thợ phụ trách mới';
      const timelineNote = prevStaffName
        ? `Studio đổi thợ chụp từ ${prevStaffName} sang ${newStaffName}${reason?.trim() ? ` (${reason.trim()})` : ''}.`
        : `Studio phân công thợ chụp phụ trách: ${newStaffName}${reason?.trim() ? ` (${reason.trim()})` : ''}.`;

      await this.bookingModel.updateOne(
        { _id: bookingId },
        {
          $push: {
            statusTimeline: {
              status: booking.status,
              changedAt: new Date(),
              note: timelineNote,
            },
          },
        },
        { session },
      );

      return {
        booking,
        schedule: schedule.toObject(),
        providerIdStr: schedule.providerId.toString(),
        newSnapshot: decision?.assignedStaffSnapshot ?? null,
        prevStaffName,
        prevLinkedUserId,
      };
    });

    bumpProviderAvailabilityVersion(updatedResult.providerIdStr);

    // Notify Customer & involved Staff (best effort outside lock/transaction)
    try {
      const custIdRaw =
        (updatedResult.booking.customerId as any)?._id ||
        updatedResult.booking.customerId;
      const custId = custIdRaw?.toString?.();
      const staffName = updatedResult.newSnapshot?.name ?? 'Nhân sự mới';
      const staffPhone = updatedResult.newSnapshot?.phone;
      const isReassign = Boolean(updatedResult.prevStaffName);
      if (custId) {
        await this.notificationsService.createNotification(
          custId,
          isReassign
            ? 'Studio đã cập nhật thợ chụp phụ trách'
            : 'Studio đã phân công thợ chụp cho đơn của bạn',
          isReassign
            ? `Đơn ${updatedResult.booking.bookingCode} đã được điều phối sang thợ chụp ${staffName}${staffPhone ? ` (SĐT: ${staffPhone})` : ''}.`
            : `Đơn ${updatedResult.booking.bookingCode} do thợ chụp ${staffName}${staffPhone ? ` (SĐT: ${staffPhone})` : ''} phụ trách.`,
          NotificationType.Booking,
          { bookingId: updatedResult.booking._id },
        );
      }

      const newLinkedUserId = updatedResult.newSnapshot?.linkedUserId;
      if (newLinkedUserId) {
        await this.notificationsService.createNotification(
          newLinkedUserId,
          'Bạn được phân công lịch chụp mới',
          `Bạn vừa được phân công phụ trách đơn ${updatedResult.booking.bookingCode} ngày ${updatedResult.schedule.providerLocalDate ?? ''}.`,
          NotificationType.Booking,
          { bookingId: updatedResult.booking._id },
        );
      }

      if (
        updatedResult.prevLinkedUserId &&
        updatedResult.prevLinkedUserId !== newLinkedUserId
      ) {
        await this.notificationsService.createNotification(
          updatedResult.prevLinkedUserId,
          'Điều chuyển lịch chụp',
          `Đơn ${updatedResult.booking.bookingCode} đã được Studio điều phối lại cho thợ khác.`,
          NotificationType.Booking,
          { bookingId: updatedResult.booking._id },
        );
      }
    } catch {
      // ignore notification failure
    }

    return updatedResult.schedule;
  }

  invalidateCache(providerId?: string | null): void {
    bumpProviderAvailabilityVersion(providerId);
  }

  private async assertCanManageProvider(
    providerId: Types.ObjectId,
    actorUserId: string,
    actorRoles?: string[],
    session?: ClientSession,
  ): Promise<void> {
    const isAdmin =
      actorRoles?.includes('ADMIN') || actorRoles?.includes('admin');
    if (isAdmin) return;
    if (!Types.ObjectId.isValid(actorUserId)) {
      throw new ForbiddenException('Không có quyền thao tác lịch chụp này.');
    }
    const q = this.providerModel.exists({
      _id: providerId,
      userId: new Types.ObjectId(actorUserId),
    });
    if (session) q.session(session);
    const owns = await q.exec();
    if (!owns) {
      throw new ForbiddenException(
        'Bạn không có quyền điều phối thợ chụp của Studio khác.',
      );
    }
  }

  private async acquireScheduleLock(
    providerId: Types.ObjectId,
    providerLocalDate: string,
    session: ClientSession,
  ): Promise<void> {
    await this.scheduleLockModel
      .findOneAndUpdate(
        { providerId, providerLocalDate },
        {
          $setOnInsert: { providerId, providerLocalDate },
          $inc: { version: 1 },
        },
        { upsert: true, new: true, session },
      )
      .exec();
  }

  private async withTransactionRetry<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
      const session = await this.bookingModel.db.startSession();
      try {
        let result!: T;
        await session.withTransaction(async () => {
          result = await work(session);
        });
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === MAX_TRANSACTION_RETRIES || !this.isTransientTx(error)) {
          throw error;
        }
      } finally {
        await session.endSession();
      }
    }
    throw lastError;
  }

  private isTransientTx(error: unknown): boolean {
    const candidate = error as {
      code?: number;
      codeName?: string;
      errorLabels?: string[];
      hasErrorLabel?: (label: string) => boolean;
    };
    const labels = candidate?.errorLabels ?? [];
    return Boolean(
      candidate?.hasErrorLabel?.('TransientTransactionError') ||
        candidate?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
        labels.includes('TransientTransactionError') ||
        labels.includes('UnknownTransactionCommitResult') ||
        candidate?.code === 112 ||
        candidate?.codeName === 'WriteConflict',
    );
  }
}
