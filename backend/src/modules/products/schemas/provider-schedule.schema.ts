import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderScheduleDocument = HydratedDocument<ProviderSchedule>;

export enum ScheduleType {
  Recurring = 'RECURRING',
  SpecificDate = 'SPECIFIC_DATE',
}

/**
 * Which service capability this schedule belongs to.
 * null / undefined = applies to ALL capabilities (backward-compat for legacy single-role providers).
 * Providers with both AODAI_RENTAL + PHOTOGRAPHY can maintain separate schedules per capability.
 */
export enum ScheduleCapability {
  AodaiRental = 'AODAI_RENTAL',
  Photography = 'PHOTOGRAPHY',
}

export interface TimeSlotRange {
  start: string; // e.g. "08:00"
  end: string; // e.g. "12:00"
}

export interface CustomTimeSlot {
  timeSlot: string; // e.g. "14:00-16:00"
  status: string; // e.g. "AVAILABLE", "BLOCKED", "BOOKED"
}

@Schema({ collection: 'provider_schedules', timestamps: true })
export class ProviderSchedule {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ScheduleType),
    default: ScheduleType.Recurring,
    index: true,
  })
  scheduleType: ScheduleType;

  /**
   * Which capability this schedule is for.
   * null = applies to all capabilities (legacy / single-role providers).
   */
  @Prop({
    type: String,
    enum: [...Object.values(ScheduleCapability), null],
    default: null,
    index: true,
  })
  capability: ScheduleCapability | null;

  @Prop({ type: Number, default: null, min: 0, max: 6 })
  dayOfWeek?: number | null; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  @Prop({ type: Date, default: null, index: true })
  specificDate?: Date | null;

  @Prop({
    type: [
      {
        _id: false,
        start: { type: String, required: true },
        end: { type: String, required: true },
      },
    ],
    default: [],
  })
  workingHours: TimeSlotRange[];

  @Prop({ type: [Date], default: [] })
  offDays: Date[];

  @Prop({
    type: [
      {
        _id: false,
        timeSlot: { type: String, required: true },
        status: { type: String, default: 'AVAILABLE' },
      },
    ],
    default: [],
  })
  customSlots: CustomTimeSlot[];
}

export const ProviderScheduleSchema =
  SchemaFactory.createForClass(ProviderSchedule);
ProviderScheduleSchema.index({ providerId: 1, specificDate: 1 });
ProviderScheduleSchema.index({ providerId: 1, dayOfWeek: 1 });
ProviderScheduleSchema.index({ providerId: 1, capability: 1 });
