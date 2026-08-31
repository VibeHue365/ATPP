import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../../bookings/services/bookings.service';
import {
  PackageStatus,
  PhotographyPackage,
} from '../../products/schemas/photography-package.schema';
import {
  ProviderSchedule,
  ScheduleCapability,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';

export type MonthlyAvailabilityStatus =
  | 'AVAILABLE'
  | 'FULL'
  | 'NO_SCHEDULE'
  | 'OFF_DAY'
  | 'PAST';

export interface MonthlyAvailabilityDay {
  date: string;
  status: MonthlyAvailabilityStatus;
}

type TimeRange = { start: string; end: string };

@Injectable()
export class PhotographerMonthlyAvailabilityService {
  private readonly monthlyCache = new Map<
    string,
    { value: { month: string; days: MonthlyAvailabilityDay[] }; expiresAt: number }
  >();

  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel: Model<ProviderSchedule>,
    private readonly bookingsService: BookingsService,
  ) {}

  async findForMonth(
    providerId: string,
    month: string,
    packageId?: string,
  ): Promise<{ month: string; days: MonthlyAvailabilityDay[] }> {
    if (!Types.ObjectId.isValid(providerId) || !/^\d{4}-\d{2}$/.test(month)) {
      throw new NotFoundException('Thông tin lịch làm việc không hợp lệ');
    }

    const [year, monthIndex] = month.split('-').map(Number);
    if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) {
      throw new NotFoundException('Tháng cần kiểm tra không hợp lệ');
    }

    const cacheKey = `${providerId}:${packageId ?? ''}:${month}`;
    const cached = this.monthlyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const providerObjectId = new Types.ObjectId(providerId);
    const provider = await this.providerModel.exists({
      _id: providerObjectId,
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy nhiếp ảnh gia đang hoạt động');
    }

    const durationMinutes = await this.getDurationMinutes(providerObjectId, packageId);
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const nextMonthStart = new Date(Date.UTC(year, monthIndex, 1));
    const [recurringSchedules, specificSchedules, busySchedule] = await Promise.all([
      this.providerScheduleModel
        .find({
          providerId: providerObjectId,
          scheduleType: ScheduleType.Recurring,
          $or: [{ capability: null }, { capability: ScheduleCapability.Photography }],
        })
        .lean()
        .exec(),
      this.providerScheduleModel
        .find({
          providerId: providerObjectId,
          scheduleType: ScheduleType.SpecificDate,
          specificDate: { $gte: monthStart, $lt: nextMonthStart },
          $or: [{ capability: null }, { capability: ScheduleCapability.Photography }],
        })
        .lean()
        .exec(),
      this.bookingsService.getBusySchedulesForProvider(providerId),
    ]);

    const recurringByDay = new Map(
      recurringSchedules
        .filter((schedule) => schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined)
        .map((schedule) => [schedule.dayOfWeek as number, schedule.workingHours as TimeRange[]]),
    );
    const specificByDate = new Map(
      specificSchedules
        .filter((schedule) => schedule.specificDate)
        .map((schedule) => [this.toDateKey(schedule.specificDate as Date), schedule]),
    );
    const busySlotsByDate = new Map<string, string[]>();
    busySchedule.bookedSlots.forEach((slot) => {
      const current = busySlotsByDate.get(slot.date) ?? [];
      current.push(slot.timeSlot);
      busySlotsByDate.set(slot.date, current);
    });

    const today = this.toDateKey(new Date());
    const daysInMonth = new Date(year, monthIndex, 0).getDate();
    const days: MonthlyAvailabilityDay[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (date < today) {
        days.push({ date, status: 'PAST' });
        continue;
      }

      const selectedDate = new Date(`${date}T00:00:00`);
      const specificSchedule = specificByDate.get(date);
      const isOffDay = specificSchedule?.offDays?.some(
        (offDay) => this.toDateKey(new Date(offDay)) === date,
      );
      if (isOffDay) {
        days.push({ date, status: 'OFF_DAY' });
        continue;
      }

      const ranges = specificSchedule?.customSlots?.length
        ? specificSchedule.customSlots
          .filter((slot) => slot.status === 'AVAILABLE')
          .map((slot) => this.toRange(slot.timeSlot))
          .filter((range): range is TimeRange => Boolean(range))
        : recurringByDay.get(selectedDate.getDay()) ?? [];

      if (!ranges.length) {
        days.push({ date, status: 'NO_SCHEDULE' });
        continue;
      }

      const hasSlot = this.hasBookableSlot(
        ranges,
        durationMinutes,
        busySlotsByDate.get(date) ?? [],
      );
      days.push({ date, status: hasSlot ? 'AVAILABLE' : 'FULL' });
    }

    const value = { month, days };
    this.monthlyCache.set(cacheKey, {
      value,
      // The final booking flow revalidates availability, so this short TTL
      // only removes repeated month-navigation queries.
      expiresAt: Date.now() + 30_000,
    });
    return value;
  }

  private async getDurationMinutes(
    providerId: Types.ObjectId,
    packageId?: string,
  ): Promise<number> {
    const query = {
      providerId,
      status: PackageStatus.Active,
      ...(packageId && Types.ObjectId.isValid(packageId)
        ? { _id: new Types.ObjectId(packageId) }
        : {}),
    };
    const photographyPackage = await this.packageModel.findOne(query).lean().exec();
    if (!photographyPackage) {
      throw new NotFoundException('Không tìm thấy gói chụp ảnh đang hoạt động');
    }
    return Math.max(
      photographyPackage.includedDurationMinutes ??
        Math.round(photographyPackage.durationHours * 60),
      30,
    );
  }

  private hasBookableSlot(
    ranges: TimeRange[],
    durationMinutes: number,
    busySlots: string[],
  ): boolean {
    return ranges.some((range) => {
      const start = this.toMinutes(range.start);
      const end = this.toMinutes(range.end);
      if (start === null || end === null) return false;

      for (let candidateStart = start; candidateStart + durationMinutes <= end; candidateStart += 30) {
        const candidateEnd = candidateStart + durationMinutes;
        const overlapsBusySlot = busySlots.some((slot) => {
          const busyRange = this.toRange(slot);
          if (!busyRange) return false;
          const busyStart = this.toMinutes(busyRange.start);
          const busyEnd = this.toMinutes(busyRange.end);
          return busyStart !== null && busyEnd !== null
            && candidateStart < busyEnd && busyStart < candidateEnd;
        });
        if (!overlapsBusySlot) return true;
      }
      return false;
    });
  }

  private toRange(value: string): TimeRange | null {
    const [start, end] = value.split('-').map((item) => item.trim());
    return start && end ? { start, end } : null;
  }

  private toMinutes(value: string): number | null {
    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return hour * 60 + minute;
  }

  private toDateKey(value: Date): string {
    return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
}
