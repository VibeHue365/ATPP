import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefundOutboxTaskDocument = HydratedDocument<RefundOutboxTask>;

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NEEDS_MANUAL_REVIEW = 'NEEDS_MANUAL_REVIEW',
}

@Schema({ collection: 'refund_outbox', timestamps: true })
export class RefundOutboxTask {
  @Prop({ required: true, unique: true, index: true })
  sourceEventId: string; // e.g. "refund:late_fee:<id>" or "refund:weather_cancel:<id>"

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({
    type: String,
    enum: Object.values(OutboxStatus),
    default: OutboxStatus.PENDING,
    index: true,
  })
  status: OutboxStatus;

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({ type: Date, default: null })
  lastAttemptAt?: Date | null;

  @Prop({ type: String, default: null })
  lastError?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'RefundRequest', default: null })
  refundRequestId?: Types.ObjectId | null;
}

export const RefundOutboxTaskSchema = SchemaFactory.createForClass(RefundOutboxTask);

RefundOutboxTaskSchema.index({ status: 1, lastAttemptAt: 1 });
RefundOutboxTaskSchema.index({ bookingId: 1, createdAt: -1 });
