import { BadRequestException, Injectable } from '@nestjs/common';

export const ALLOWED_SLOT_HOURS = [7, 9, 11, 13, 15, 17, 19, 21];

export interface TimeSlotDefinition {
  slotIndex: number; // 1 to 7
  startHour: number; // 7, 9, 11, 13, 15, 17, 19
  startMinute: number;
  endHour: number; // 9, 11, 13, 15, 17, 19, 21
  endMinute: number;
  timeSlotString: string; // e.g. "07:00-09:00"
}

export interface SlotAllocation {
  dateStr: string; // "YYYY-MM-DD" in Asia/Ho_Chi_Minh
  slotIndex: number; // 1 to 7
  start: Date;
  end: Date;
  timeSlotString: string;
}

export interface UpfrontBlockCalculation {
  rentalSlots: SlotAllocation[];
  turnaroundSlots: SlotAllocation[];
  rentalTo: Date;
  availableFrom: Date;
}

export interface ShopScheduleConfig {
  offDays?: (Date | string)[]; // Specific dates e.g. "2026-11-22"
  weeklyOffDays?: number[]; // e.g. [0] for Sunday
}

export const FIXED_TIME_SLOTS: TimeSlotDefinition[] = [
  {
    slotIndex: 1,
    startHour: 7,
    startMinute: 0,
    endHour: 9,
    endMinute: 0,
    timeSlotString: '07:00-09:00',
  },
  {
    slotIndex: 2,
    startHour: 9,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
    timeSlotString: '09:00-11:00',
  },
  {
    slotIndex: 3,
    startHour: 11,
    startMinute: 0,
    endHour: 13,
    endMinute: 0,
    timeSlotString: '11:00-13:00',
  },
  {
    slotIndex: 4,
    startHour: 13,
    startMinute: 0,
    endHour: 15,
    endMinute: 0,
    timeSlotString: '13:00-15:00',
  },
  {
    slotIndex: 5,
    startHour: 15,
    startMinute: 0,
    endHour: 17,
    endMinute: 0,
    timeSlotString: '15:00-17:00',
  },
  {
    slotIndex: 6,
    startHour: 17,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    timeSlotString: '17:00-19:00',
  },
  {
    slotIndex: 7,
    startHour: 19,
    startMinute: 0,
    endHour: 21,
    endMinute: 0,
    timeSlotString: '19:00-21:00',
  },
];

const SLOT_BOUNDARIES_MINUTES = [420, 540, 660, 780, 900, 1020, 1140, 1260]; // 07:00 to 21:00

@Injectable()
export class TimeSlotEngineService {
  /**
   * Convert any UTC Date to Vietnam time components (Asia/Ho_Chi_Minh, UTC+7).
   */
  getVnParts(date: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    dayOfWeek: number;
    dateStr: string;
    totalMinutes: number;
  } {
    const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
    const year = vnTime.getUTCFullYear();
    const month = vnTime.getUTCMonth() + 1;
    const day = vnTime.getUTCDate();
    const hour = vnTime.getUTCHours();
    const minute = vnTime.getUTCMinutes();
    const dayOfWeek = vnTime.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const totalMinutes = hour * 60 + minute;
    return { year, month, day, hour, minute, dayOfWeek, dateStr, totalMinutes };
  }

  /**
   * Create a Date object from Vietnam local time components.
   */
  makeVnDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): Date {
    return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
  }

  /**
   * Parse a YYYY-MM-DD dateStr into year, month, day numbers.
   */
  parseDateStr(dateStr: string): { year: number; month: number; day: number } {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { year: y, month: m, day: d };
  }

  /**
   * Check if a specific date in VN time is a shop off-day.
   */
  isOffDay(date: Date, schedule?: ShopScheduleConfig): boolean {
    if (!schedule) return false;
    const parts = this.getVnParts(date);

    if (
      schedule.weeklyOffDays &&
      schedule.weeklyOffDays.includes(parts.dayOfWeek)
    ) {
      return true;
    }

    if (schedule.offDays && schedule.offDays.length > 0) {
      const match = schedule.offDays.some((off) => {
        if (typeof off === 'string') {
          return off.startsWith(parts.dateStr);
        }
        if (off instanceof Date) {
          return this.getVnParts(off).dateStr === parts.dateStr;
        }
        return false;
      });
      if (match) return true;
    }

    return false;
  }

  /**
   * Advance to the next working day's 07:00 if the current day is an off day.
   */
  advanceToNextWorkingDayStart(
    fromDate: Date,
    schedule?: ShopScheduleConfig,
  ): Date {
    let current = new Date(fromDate);
    while (this.isOffDay(current, schedule)) {
      // Add 24 hours to go to the next day
      current = new Date(current.getTime() + 24 * 3600 * 1000);
      const parts = this.getVnParts(current);
      current = this.makeVnDate(parts.year, parts.month, parts.day, 7, 0);
    }
    return current;
  }

  /**
   * Round up time T to the smallest slot boundary B >= T.
   * If T falls outside working hours (>= 21:00), rollovers to 07:00 of the next working day.
   */
  roundUpToSlotBoundary(time: Date, schedule?: ShopScheduleConfig): Date {
    const parts = this.getVnParts(time);

    // If time falls on an off day, advance immediately to next working day at 07:00
    if (this.isOffDay(time, schedule)) {
      const nextDay = new Date(time.getTime() + 24 * 3600 * 1000);
      const nextParts = this.getVnParts(nextDay);
      const startOfNext = this.makeVnDate(
        nextParts.year,
        nextParts.month,
        nextParts.day,
        7,
        0,
      );
      return this.advanceToNextWorkingDayStart(startOfNext, schedule);
    }

    const m = parts.totalMinutes;

    // Before or at opening (07:00 = 420 mins)
    if (m <= 420) {
      return this.makeVnDate(parts.year, parts.month, parts.day, 7, 0);
    }

    // Between 07:00 and 21:00 (1260 mins)
    for (const b of SLOT_BOUNDARIES_MINUTES) {
      if (b >= m) {
        const bHour = Math.floor(b / 60);
        const bMin = b % 60;
        return this.makeVnDate(parts.year, parts.month, parts.day, bHour, bMin);
      }
    }

    // After closing (m > 1260 = after 21:00) -> Rollover to 07:00 of next working day
    const nextDay = new Date(time.getTime() + 24 * 3600 * 1000);
    const nextParts = this.getVnParts(nextDay);
    const startOfNext = this.makeVnDate(
      nextParts.year,
      nextParts.month,
      nextParts.day,
      7,
      0,
    );
    return this.advanceToNextWorkingDayStart(startOfNext, schedule);
  }

  /**
   * Helper to get a slot allocation for a given dateStr and slotIndex (1 to 7).
   */
  getSlotAllocation(dateStr: string, slotIndex: number): SlotAllocation {
    const slotDef = FIXED_TIME_SLOTS.find((s) => s.slotIndex === slotIndex);
    if (!slotDef) {
      throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 1 to 7.`);
    }
    const { year, month, day } = this.parseDateStr(dateStr);
    const start = this.makeVnDate(
      year,
      month,
      day,
      slotDef.startHour,
      slotDef.startMinute,
    );
    const end = this.makeVnDate(
      year,
      month,
      day,
      slotDef.endHour,
      slotDef.endMinute,
    );
    return {
      dateStr,
      slotIndex,
      start,
      end,
      timeSlotString: slotDef.timeSlotString,
    };
  }

  /**
   * Validate and parse a timeSlot string like "07:00 - 11:00" or "07:00-09:00".
   * Accepts only boundary hours: 07, 09, 11, 13, 15, 17, 19, 21 with minute 0.
   * Duration must be a positive multiple of 2 hours.
   */
  parseAndValidateTimeSlot(timeSlot: string): {
    startSlotIndex: number;
    rentalSlotCount: number;
  } {
    if (!timeSlot || !timeSlot.includes('-')) {
      throw new BadRequestException(
        `Khung giờ thuê không hợp lệ: "${timeSlot}". Vui lòng chọn khung giờ dạng "07:00 - 11:00".`,
      );
    }
    const parts = timeSlot.split('-');
    const startStr = parts[0]?.trim();
    const endStr = parts[1]?.trim();
    const [sh, sm] = (startStr || '').split(':').map(Number);
    const [eh, em] = (endStr || '').split(':').map(Number);

    if (
      !Number.isInteger(sh) ||
      !Number.isInteger(eh) ||
      sm !== 0 ||
      em !== 0 ||
      !ALLOWED_SLOT_HOURS.includes(sh) ||
      !ALLOWED_SLOT_HOURS.includes(eh) ||
      eh <= sh ||
      (eh - sh) % 2 !== 0
    ) {
      throw new BadRequestException(
        `Khung giờ thuê theo giờ không hợp lệ: "${timeSlot}". Chỉ chấp nhận các mốc 07:00, 09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00 và thời lượng phải là bội số của 2 giờ.`,
      );
    }

    const startSlotIndex = (sh - 7) / 2 + 1;
    const rentalSlotCount = (eh - sh) / 2;
    return { startSlotIndex, rentalSlotCount };
  }

  /**
   * Parse a timeSlotString like "07:00-09:00" into slotIndex.
   */
  getSlotIndexFromString(timeSlot: string): number {
    const trimmed = timeSlot.trim();
    const found = FIXED_TIME_SLOTS.find((s) => s.timeSlotString === trimmed);
    if (!found) {
      try {
        return this.parseAndValidateTimeSlot(timeSlot).startSlotIndex;
      } catch {
        const startPart = trimmed.split('-')[0]?.trim();
        const matchByStart = FIXED_TIME_SLOTS.find((s) =>
          s.timeSlotString.startsWith(startPart),
        );
        if (matchByStart) return matchByStart.slotIndex;
        throw new BadRequestException(
          `Invalid time slot string: "${timeSlot}". Allowed: 07:00-09:00, 09:00-11:00, etc.`,
        );
      }
    }
    return found.slotIndex;
  }

  /**
   * Calculate consecutive slots for rental and subsequent turnaround slots.
   * Total turnaround = turnaroundSlots * 2h (no extra boundary slot).
   */
  calculateUpfrontBlock(
    startDateStr: string,
    startSlotIndex: number,
    rentalSlotCount: number,
    turnaroundSlotsCount: number,
    schedule?: ShopScheduleConfig,
  ): UpfrontBlockCalculation {
    const rentalSlots: SlotAllocation[] = [];
    let curDateStr = startDateStr;
    let curSlotIdx = startSlotIndex;

    // 1. Allocate rental slots
    for (let i = 0; i < rentalSlotCount; i++) {
      if (curSlotIdx > 7) {
        // Advance to next working day
        const { year, month, day } = this.parseDateStr(curDateStr);
        let nextDay = new Date(
          this.makeVnDate(year, month, day, 7, 0).getTime() + 24 * 3600 * 1000,
        );
        nextDay = this.advanceToNextWorkingDayStart(nextDay, schedule);
        curDateStr = this.getVnParts(nextDay).dateStr;
        curSlotIdx = 1;
      }
      rentalSlots.push(this.getSlotAllocation(curDateStr, curSlotIdx));
      curSlotIdx++;
    }

    const lastRentalSlot = rentalSlots[rentalSlots.length - 1];
    const rentalTo = lastRentalSlot.end;

    // 2. Allocate turnaround slots
    const turnaroundSlots: SlotAllocation[] = [];
    if (turnaroundSlotsCount > 0) {
      for (let j = 0; j < turnaroundSlotsCount; j++) {
        if (curSlotIdx > 7) {
          // Rollover to 07:00 of next working day
          const { year, month, day } = this.parseDateStr(curDateStr);
          let nextDay = new Date(
            this.makeVnDate(year, month, day, 7, 0).getTime() +
              24 * 3600 * 1000,
          );
          nextDay = this.advanceToNextWorkingDayStart(nextDay, schedule);
          curDateStr = this.getVnParts(nextDay).dateStr;
          curSlotIdx = 1;
        }
        turnaroundSlots.push(this.getSlotAllocation(curDateStr, curSlotIdx));
        curSlotIdx++;
      }
    }

    const availableFrom =
      turnaroundSlots.length > 0
        ? turnaroundSlots[turnaroundSlots.length - 1].end
        : rentalTo;

    return {
      rentalSlots,
      turnaroundSlots,
      rentalTo,
      availableFrom,
    };
  }

  /**
   * Calculate availableFrom upon actual return (supports early return, on-time return, late return).
   * Formula:
   *   availableFrom = max(contractualRentalTo, roundUpToSlotBoundary(actualReturnedAt + turnaroundDuration))
   */
  calculateReturnAvailableFrom(
    contractualRentalTo: Date,
    actualReturnedAt: Date,
    turnaroundSlotsCount: number,
    schedule?: ShopScheduleConfig,
  ): Date {
    if (turnaroundSlotsCount === 0) {
      const rounded = this.roundUpToSlotBoundary(actualReturnedAt, schedule);
      return contractualRentalTo.getTime() > rounded.getTime()
        ? contractualRentalTo
        : rounded;
    }

    // Advance actualReturnedAt by turnaroundSlotsCount * 2 hours in working hours
    let remainingMinutes = turnaroundSlotsCount * 120;
    let current = new Date(actualReturnedAt);

    while (remainingMinutes > 0) {
      // If current is off-day, advance to next working day 07:00
      if (this.isOffDay(current, schedule)) {
        current = this.advanceToNextWorkingDayStart(current, schedule);
      }

      const parts = this.getVnParts(current);
      const m = parts.totalMinutes;

      if (m < 420) {
        // Before 07:00 -> Jump to 07:00
        current = this.makeVnDate(parts.year, parts.month, parts.day, 7, 0);
      } else if (m >= 1260) {
        // At or after 21:00 -> Rollover to next day 07:00
        const nextDay = new Date(current.getTime() + 24 * 3600 * 1000);
        const nextParts = this.getVnParts(nextDay);
        current = this.makeVnDate(
          nextParts.year,
          nextParts.month,
          nextParts.day,
          7,
          0,
        );
        current = this.advanceToNextWorkingDayStart(current, schedule);
      } else {
        // Inside working hours: available minutes until 21:00
        const availableTodayMinutes = 1260 - m;
        if (remainingMinutes <= availableTodayMinutes) {
          current = new Date(current.getTime() + remainingMinutes * 60 * 1000);
          remainingMinutes = 0;
        } else {
          remainingMinutes -= availableTodayMinutes;
          // Rollover to next day 07:00
          const nextDay = new Date(current.getTime() + 24 * 3600 * 1000);
          const nextParts = this.getVnParts(nextDay);
          current = this.makeVnDate(
            nextParts.year,
            nextParts.month,
            nextParts.day,
            7,
            0,
          );
          current = this.advanceToNextWorkingDayStart(current, schedule);
        }
      }
    }

    const roundedCleanEnd = this.roundUpToSlotBoundary(current, schedule);
    return contractualRentalTo.getTime() > roundedCleanEnd.getTime()
      ? contractualRentalTo
      : roundedCleanEnd;
  }
}
