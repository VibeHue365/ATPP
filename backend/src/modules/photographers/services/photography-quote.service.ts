import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../../bookings/services/bookings.service';
import {
  BookingSchedule,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import {
  PackageStatus,
  PhotographyPackage,
} from '../../products/schemas/photography-package.schema';
import {
  ProviderSchedule,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import {
  CreatePhotographyQuoteDto,
  PhotographyQuoteSessionDto,
} from '../dto/photography-quote.dto';
import {
  calculatePhotographyQuote,
  PhotographyPricingPolicyError,
} from './photography-quote.pricing';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MINIMUM_SESSION_MINUTES = 30;

type TimeRange = { start: number; end: number };
type ParsedSession = {
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  providerLocalDate: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  locationAddress?: string;
};

export type PhotographyQuoteSessionError = {
  clientId: string;
  code:
    | 'INVALID_TIME'
    | 'PAST_TIME'
    | 'CROSSES_MIDNIGHT'
    | 'INVALID_DURATION'
    | 'DUPLICATE_CLIENT_ID'
    | 'OVERLAPS_REQUEST'
    | 'OUTSIDE_WORKING_HOURS'
    | 'SLOT_UNAVAILABLE';
  message: string;
};

@Injectable()
export class PhotographyQuoteService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel: Model<ProviderSchedule>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * Read-only quote endpoint. It must never create a booking, hold, payment or
   * inventory reservation; Phase 3 owns those side effects.
   */
  async quote(providerIdValue: string, dto: CreatePhotographyQuoteDto) {
    if (!Types.ObjectId.isValid(providerIdValue)) {
      throw new NotFoundException('Nhiếp ảnh gia không hợp lệ.');
    }

    const providerId = new Types.ObjectId(providerIdValue);
    const [provider, photographyPackage] = await Promise.all([
      this.providerModel.exists({
        _id: providerId,
        capabilities: ProviderCapability.Photography,
        status: ProviderStatus.Active,
      }),
      this.packageModel.findOne({
        _id: new Types.ObjectId(dto.packageId),
        providerId,
        status: PackageStatus.Active,
      }),
    ]);
    if (!provider) {
      throw new NotFoundException('Không tìm thấy nhiếp ảnh gia đang hoạt động.');
    }
    if (!photographyPackage) {
      throw new NotFoundException('Không tìm thấy gói chụp đang hoạt động của nhiếp ảnh gia này.');
    }

    const { sessions, errors } = this.parseAndValidatePayload(dto.sessions);
    if (errors.length) return this.invalidQuote(photographyPackage, errors);

    this.validateSessionTimeStep(photographyPackage, sessions, errors);
    if (errors.length) return this.invalidQuote(photographyPackage, errors);

    const dateKeys = [...new Set(sessions.map((session) => session.providerLocalDate))];
    const [busyRangesByDate, workingRangesByDate] = await Promise.all([
      this.getBusyRanges(providerId, dateKeys),
      this.getWorkingRanges(providerId, dateKeys),
    ]);

    for (const session of sessions) {
      const workingRanges = workingRangesByDate.get(session.providerLocalDate) ?? [];
      if (!workingRanges.some((range) => this.contains(range, session))) {
        errors.push({
          clientId: session.clientId,
          code: 'OUTSIDE_WORKING_HOURS',
          message: 'Khung giờ chụp phải nằm trọn trong một ca làm việc của nhiếp ảnh gia.',
        });
        continue;
      }

      const busyRanges = busyRangesByDate.get(session.providerLocalDate) ?? [];
      if (busyRanges.some((range) => this.overlaps(range, session))) {
        errors.push({
          clientId: session.clientId,
          code: 'SLOT_UNAVAILABLE',
          message: 'Khung giờ này vừa có người khác đặt hoặc đang được giữ chỗ.',
        });
      }
    }

    if (errors.length) return this.invalidQuote(photographyPackage, errors);

    try {
      const quote = calculatePhotographyQuote(
        {
          name: photographyPackage.name,
          price: photographyPackage.price,
          pricingUnit: photographyPackage.pricingUnit,
          includedDurationMinutes:
            photographyPackage.includedDurationMinutes ??
            Math.round(photographyPackage.durationHours * 60),
          includedSessionCount: photographyPackage.includedSessionCount,
          includedDayCount: photographyPackage.includedDayCount,
          additionalSessionFee: photographyPackage.additionalSessionFee,
          overtimeFeePerHour: photographyPackage.overtimeFeePerHour,
          overtimeIncrementMinutes: photographyPackage.overtimeIncrementMinutes,
          maxOvertimeMinutes: photographyPackage.maxOvertimeMinutes,
        },
        sessions,
      );

      return {
        valid: true,
        quotedAt: new Date().toISOString(),
        currency: 'VND',
        package: {
          id: photographyPackage._id.toString(),
          name: photographyPackage.name,
          pricingUnit: quote.pricingUnit,
          includedDurationMinutes:
            photographyPackage.includedDurationMinutes ??
            Math.round(photographyPackage.durationHours * 60),
          overtimeIncrementMinutes:
            photographyPackage.overtimeIncrementMinutes ?? 30,
          maxOvertimeMinutes: photographyPackage.maxOvertimeMinutes ?? 240,
        },
        sessions: sessions.map((session) => ({
          clientId: session.clientId,
          startsAt: session.startsAt.toISOString(),
          endsAt: session.endsAt.toISOString(),
          providerLocalDate: session.providerLocalDate,
          durationMinutes: session.durationMinutes,
          overtimeMinutes: quote.overtimeMinutesByClientId[session.clientId] ?? 0,
          locationAddress: session.locationAddress ?? null,
        })),
        errors: [],
        breakdown: quote.breakdown,
        totals: {
          baseAmount: quote.baseAmount,
          overtimeAmount: quote.overtimeAmount,
          surchargeAmount: quote.surchargeAmount,
          totalAmount: quote.totalAmount,
        },
      };
    } catch (error) {
      if (error instanceof PhotographyPricingPolicyError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private invalidQuote(
    photographyPackage: Pick<PhotographyPackage, 'name'> & { _id: Types.ObjectId },
    errors: PhotographyQuoteSessionError[],
  ) {
    return {
      valid: false,
      quotedAt: new Date().toISOString(),
      currency: 'VND',
      package: {
        id: photographyPackage._id.toString(),
        name: photographyPackage.name,
      },
      sessions: [],
      errors,
      breakdown: [],
      totals: null,
    };
  }

  private parseAndValidatePayload(input: PhotographyQuoteSessionDto[]): {
    sessions: ParsedSession[];
    errors: PhotographyQuoteSessionError[];
  } {
    const sessions: ParsedSession[] = [];
    const errors: PhotographyQuoteSessionError[] = [];
    const clientIds = new Set<string>();
    const now = Date.now();

    for (const item of input) {
      if (clientIds.has(item.clientId)) {
        errors.push({
          clientId: item.clientId,
          code: 'DUPLICATE_CLIENT_ID',
          message: 'Mỗi buổi chụp cần có mã tạm thời riêng.',
        });
        continue;
      }
      clientIds.add(item.clientId);

      if (!this.hasExplicitTimeZone(item.startsAt) || !this.hasExplicitTimeZone(item.endsAt)) {
        errors.push({
          clientId: item.clientId,
          code: 'INVALID_TIME',
          message: 'Thời gian phải dùng ISO-8601 có timezone rõ ràng.',
        });
        continue;
      }

      const startsAt = new Date(item.startsAt);
      const endsAt = new Date(item.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
        errors.push({
          clientId: item.clientId,
          code: 'INVALID_TIME',
          message: 'Giờ kết thúc phải sau giờ bắt đầu.',
        });
        continue;
      }
      if (startsAt.getTime() <= now) {
        errors.push({
          clientId: item.clientId,
          code: 'PAST_TIME',
          message: 'Chỉ có thể đặt lịch trong tương lai.',
        });
        continue;
      }

      const startParts = this.getBusinessTimeParts(startsAt);
      const endParts = this.getBusinessTimeParts(endsAt);
      if (startParts.date !== endParts.date) {
        errors.push({
          clientId: item.clientId,
          code: 'CROSSES_MIDNIGHT',
          message: 'Mỗi buổi chụp hiện chỉ được phép trong một ngày theo giờ Việt Nam.',
        });
        continue;
      }

      const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
      if (durationMinutes < MINIMUM_SESSION_MINUTES) {
        errors.push({
          clientId: item.clientId,
          code: 'INVALID_DURATION',
          message: `Mỗi buổi chụp cần tối thiểu ${MINIMUM_SESSION_MINUTES} phút.`,
        });
        continue;
      }

      sessions.push({
        clientId: item.clientId,
        startsAt,
        endsAt,
        providerLocalDate: startParts.date,
        startMinutes: startParts.minutes,
        endMinutes: endParts.minutes,
        durationMinutes,
        locationAddress: item.locationAddress,
      });
    }

    const sorted = [...sessions].sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
    );
    let latestEnd: ParsedSession | null = null;
    for (const session of sorted) {
      if (latestEnd && session.startsAt < latestEnd.endsAt) {
        errors.push({
          clientId: session.clientId,
          code: 'OVERLAPS_REQUEST',
          message: 'Buổi chụp này đang chồng thời gian với một buổi khác trong cùng yêu cầu.',
        });
      }
      if (!latestEnd || session.endsAt > latestEnd.endsAt) latestEnd = session;
    }

    return { sessions, errors };
  }

  private validateSessionTimeStep(
    photographyPackage: PhotographyPackage,
    sessions: ParsedSession[],
    errors: PhotographyQuoteSessionError[],
  ): void {
    const increment = photographyPackage.overtimeIncrementMinutes ?? 30;
    const includedDurationMinutes =
      photographyPackage.includedDurationMinutes ??
      Math.round(photographyPackage.durationHours * 60);
    const pricingUnit = photographyPackage.pricingUnit ?? 'PER_SESSION';

    for (const session of sessions) {
      if (session.startMinutes % increment !== 0) {
        errors.push({
          clientId: session.clientId,
          code: 'INVALID_TIME',
          message: `Giờ bắt đầu phải theo bước ${increment} phút của gói chụp.`,
        });
      }
      if (session.durationMinutes % increment !== 0) {
        errors.push({
          clientId: session.clientId,
          code: 'INVALID_DURATION',
          message: `Thời lượng chụp phải theo bước ${increment} phút của gói chụp.`,
        });
      }
      if (
        pricingUnit === 'PER_SESSION' &&
        session.durationMinutes < includedDurationMinutes
      ) {
        errors.push({
          clientId: session.clientId,
          code: 'INVALID_DURATION',
          message: `Mỗi buổi chụp cần tối thiểu ${includedDurationMinutes} phút theo gói.`,
        });
      }
    }
  }

  private async getWorkingRanges(
    providerId: Types.ObjectId,
    dateKeys: string[],
  ): Promise<Map<string, TimeRange[]>> {
    const rangesByDate = new Map<string, TimeRange[]>();
    await Promise.all(
      dateKeys.map(async (dateKey) => {
        rangesByDate.set(
          dateKey,
          await this.getWorkingRangesForDate(providerId, dateKey),
        );
      }),
    );
    return rangesByDate;
  }

  private async getWorkingRangesForDate(
    providerId: Types.ObjectId,
    dateKey: string,
  ): Promise<TimeRange[]> {
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
    const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const specificSchedule = await this.providerScheduleModel
      .findOne({
        providerId,
        scheduleType: ScheduleType.SpecificDate,
        specificDate: { $gte: dayStart, $lt: nextDayStart },
      })
      .lean()
      .exec();

    if (
      specificSchedule?.offDays?.some(
        (offDay) => this.getBusinessTimeParts(new Date(offDay)).date === dateKey,
      )
    ) {
      return [];
    }
    if (specificSchedule?.customSlots?.length) {
      return specificSchedule.customSlots
        .filter((slot) => slot.status === 'AVAILABLE')
        .map((slot) => this.parseRange(slot.timeSlot))
        .filter((range): range is TimeRange => Boolean(range));
    }

    const weekday = new Date(`${dateKey}T12:00:00+07:00`).getUTCDay();
    const recurringSchedule = await this.providerScheduleModel
      .findOne({
        providerId,
        scheduleType: ScheduleType.Recurring,
        dayOfWeek: weekday,
      })
      .lean()
      .exec();
    return (recurringSchedule?.workingHours ?? [])
      .map((range) => this.parseRange(`${range.start}-${range.end}`))
      .filter((range): range is TimeRange => Boolean(range));
  }

  private async getBusyRanges(
    providerId: Types.ObjectId,
    dateKeys: string[],
  ): Promise<Map<string, TimeRange[]>> {
    const now = new Date();
    const [v2Schedules, legacyBusySchedules] = await Promise.all([
      this.bookingScheduleModel
        .find({
          providerId,
          providerLocalDate: { $in: dateKeys },
          scheduleType: BookingScheduleType.Photoshoot,
          $or: [
            { status: BookingScheduleStatus.Confirmed },
            { status: BookingScheduleStatus.Held, holdExpiresAt: { $gt: now } },
          ],
        })
        .select('startsAt endsAt providerLocalDate')
        .lean()
        .exec(),
      this.bookingsService.getBusySchedulesForProvider(providerId.toString()),
    ]);

    const rangesByDate = new Map<string, TimeRange[]>();
    const addRange = (dateKey: string, range: TimeRange | null) => {
      if (!range || !dateKeys.includes(dateKey)) return;
      const current = rangesByDate.get(dateKey) ?? [];
      current.push(range);
      rangesByDate.set(dateKey, current);
    };

    for (const schedule of v2Schedules) {
      if (!schedule.startsAt || !schedule.endsAt || !schedule.providerLocalDate) continue;
      const start = this.getBusinessTimeParts(new Date(schedule.startsAt));
      const end = this.getBusinessTimeParts(new Date(schedule.endsAt));
      if (start.date !== schedule.providerLocalDate || start.date !== end.date) continue;
      addRange(start.date, { start: start.minutes, end: end.minutes });
    }
    for (const slot of legacyBusySchedules.bookedSlots) {
      addRange(slot.date, this.parseRange(slot.timeSlot));
    }
    return rangesByDate;
  }

  private contains(range: TimeRange, session: ParsedSession): boolean {
    return range.start <= session.startMinutes && session.endMinutes <= range.end;
  }

  private overlaps(range: TimeRange, session: ParsedSession): boolean {
    return range.start < session.endMinutes && session.startMinutes < range.end;
  }

  private parseRange(value: string): TimeRange | null {
    const [startValue, endValue] = value.split('-').map((part) => part.trim());
    const start = this.toMinutes(startValue);
    const end = this.toMinutes(endValue);
    return start !== null && end !== null && start < end ? { start, end } : null;
  }

  private toMinutes(value: string): number | null {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  private hasExplicitTimeZone(value: string): boolean {
    return /(Z|[+-]\d{2}:\d{2})$/i.test(value);
  }

  private getBusinessTimeParts(value: Date): { date: string; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const hour = Number(part('hour'));
    const minute = Number(part('minute'));
    return {
      date: `${part('year')}-${part('month')}-${part('day')}`,
      minutes: hour * 60 + minute,
    };
  }
}
