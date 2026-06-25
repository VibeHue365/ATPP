import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefundRequestDocument = HydratedDocument<RefundRequest>;

export enum RefundStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

export interface RefundTransaction {
  transactionId?: string | null;
  amount: number;
  method: string; // e.g. BANK_TRANSFER
  proofUrl?: string | null;
  completedAt?: Date | null;
}

@Schema({ collection: 'refund_requests', timestamps: true })
export class RefundRequest {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null, index: true })
  paymentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, default: null, trim: true })
  reason?: string | null;

  @Prop({
    type: String,
    enum: Object.values(RefundStatus),
    default: RefundStatus.Pending,
    index: true,
  })
  status: RefundStatus;

  @Prop({ type: String, default: null, trim: true })
  adminNotes?: string | null;

  @Prop({
    type: [
      {
        _id: false,
        transactionId: { type: String, default: null },
        amount: { type: Number, required: true, min: 0 },
        method: { type: String, required: true },
        proofUrl: { type: String, default: null },
        completedAt: { type: Date, default: null },
      },
    ],
    default: [],
  })
  transactions: RefundTransaction[];
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);
