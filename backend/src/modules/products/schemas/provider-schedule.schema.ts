import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderScheduleDocument = HydratedDocument<ProviderSchedule>;

export enum ScheduleType {
  Recurring = 'RECURRING',
  SpecificDate = 'SPECIFIC_DATE',
}

export interface TimeSlotRange {
  start: string; // e.g. "08:00"
  end: string;   // e.g. "12:00"
}

export interface CustomTimeSlot {
  timeSlot: string; // e.g. "14:00-16:00"
  status: string;   // e.g. "AVAILABLE", "BLOCKED", "BOOKED"
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
