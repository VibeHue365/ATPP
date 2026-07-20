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
  Held = 'HELD',
  Confirmed = 'CONFIRMED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
  /** @deprecated Legacy schedules remain readable during the migration. */
  Scheduled = 'SCHEDULED',
  /** @deprecated Rescheduling is represented by a cancelled predecessor. */
  Rescheduled = 'RESCHEDULED',
}

export enum BookingScheduleCancellationReason {
  CustomerCancelled = 'CUSTOMER_CANCELLED',
  ProviderCancelled = 'PROVIDER_CANCELLED',
  Rescheduled = 'RESCHEDULED',
}

@Schema({ collection: 'booking_schedules', timestamps: true })
export class BookingSchedule {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'BookingItem',
    required: true,
    index: true,
  })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', default: null, index: true })
  providerId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(BookingScheduleType),
    required: true,
    index: true,
  })
  scheduleType: BookingScheduleType;

  /** Legacy date field. New photography sessions use startsAt/endsAt. */
  @Prop({ type: Date, default: null, index: true })
  scheduledDate?: Date | null;

  /** Legacy time field. New photography sessions use startsAt/endsAt. */
  @Prop({ type: String, default: null })
  timeSlot?: string | null;

  @Prop({ type: Date, default: null, index: true })
  startsAt?: Date | null;

  @Prop({ type: Date, default: null, index: true })
  endsAt?: Date | null;

  /** YYYY-MM-DD in Asia/Ho_Chi_Minh, used for availability queries and locks. */
  @Prop({ type: String, default: null, index: true })
  providerLocalDate?: string | null;

  @Prop({ type: Date, default: null, index: true })
  holdExpiresAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assignedPhotographerId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  locationAddress?: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  includedDurationMinutes?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  overtimeMinutes: number;

  @Prop({
    type: String,
    enum: Object.values(BookingScheduleCancellationReason),
    default: null,
  })
  cancellationReason?: BookingScheduleCancellationReason | null;

  @Prop({ type: Types.ObjectId, ref: 'BookingSchedule', default: null })
  replacedByScheduleId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'BookingSchedule', default: null })
  rescheduledFromScheduleId?: Types.ObjectId | null;

  @Prop({ type: Number, default: 1, min: 1 })
  scheduleSchemaVersion: number;

  /** Identifies the legacy BookingItem that was converted by the v2 migration. */
  @Prop({ type: Types.ObjectId, ref: 'BookingItem', default: null, index: true })
  migratedFromLegacyItemId?: Types.ObjectId | null;

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
BookingScheduleSchema.index({
  providerId: 1,
  providerLocalDate: 1,
  status: 1,
  startsAt: 1,
});