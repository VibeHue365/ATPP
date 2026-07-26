import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefundRequestDocument = HydratedDocument<RefundRequest>;

export enum RefundStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Processing = 'PROCESSING',
  Rejected = 'REJECTED',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum RefundType {
  Cancellation = 'CANCELLATION',
  Dispute = 'DISPUTE',
  CustomerRequest = 'CUSTOMER_REQUEST',
  AdminManual = 'ADMIN_MANUAL',
}

export enum RefundMode {
  Simulated = 'SIMULATED',
  Manual = 'MANUAL',
  Gateway = 'GATEWAY',
}

export interface RefundTransaction {
  transactionId?: string | null;
  amount: number;
  method: string; // e.g. BANK_TRANSFER
  proofUrl?: string | null;
  completedAt?: Date | null;
}

export interface RefundAllocation {
  paymentId: Types.ObjectId;
  amount: number;
}

@Schema({ collection: 'refund_requests', timestamps: true })
export class RefundRequest {
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null, index: true })
  paymentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(RefundType), required: true, index: true })
  type: RefundType;

  @Prop({ required: true, unique: true, index: true })
  sourceEventId: string;

  @Prop({ type: String, enum: Object.values(RefundMode), required: true })
  mode: RefundMode;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, min: 0, default: 0 })
  approvedAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  processedAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  reservedAmount: number;

  @Prop({
    type: [{ _id: false, paymentId: { type: Types.ObjectId, ref: 'Payment', required: true }, amount: { type: Number, required: true, min: 1 } }],
    default: [],
  })
  allocations: RefundAllocation[];

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

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  decidedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  decidedAt?: Date | null;

  @Prop({ type: String, default: null })
  failureReason?: string | null;

  @Prop({ type: Number, required: true, default: 0 })
  version: number;

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
RefundRequestSchema.index({ status: 1, createdAt: -1 });
RefundRequestSchema.index({ bookingId: 1, createdAt: -1 });
RefundRequestSchema.index({ requestedBy: 1, createdAt: -1 });
