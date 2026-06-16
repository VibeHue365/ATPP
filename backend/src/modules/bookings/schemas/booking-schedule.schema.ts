import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingScheduleDocument = HydratedDocument<BookingSchedule>;

export enum BookingScheduleType {
  RentalPeriod = 'RENTAL_PERIOD',
  Pickup = 'PICKUP',
  Return = 'RETURN',
  Photoshoot = 'PHOTOSHOOT',
}

export enum BookingScheduleStatus {
  Scheduled = 'SCHEDULED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  Rescheduled = 'RESCHEDULED',
}

@Schema({ collection: 'booking_schedules', timestamps: true })
export class BookingSchedule {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(BookingScheduleType),
    required: true,
    index: true,
  })
  scheduleType: BookingScheduleType;

  @Prop({ required: true, type: Date, index: true })
  scheduledDate: Date;

  @Prop({ type: String, default: null })
  timeSlot?: string | null;

  @Prop({ type: Date, default: null })
  actualTime?: Date | null;

  @Prop({
    type: String,
    enum: Object.values(BookingScheduleStatus),
    default: BookingScheduleStatus.Scheduled,
    index: true,
  })
  status: BookingScheduleStatus;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;
}

export const BookingScheduleSchema =
  SchemaFactory.createForClass(BookingSchedule);
BookingScheduleSchema.index({ bookingId: 1, scheduleType: 1 });
