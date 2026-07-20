import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RefundMode } from './refund-request.schema';

export type RefundAttemptDocument = HydratedDocument<RefundAttempt>;

export enum RefundAttemptStatus {
  Initiated = 'INITIATED',
  Succeeded = 'SUCCEEDED',
  Failed = 'FAILED',
}

@Schema({ collection: 'refund_attempts', timestamps: true })
export class RefundAttempt {
  @Prop({ type: Types.ObjectId, ref: 'RefundRequest', required: true, index: true })
  refundRequestId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  attemptNo: number;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey: string;

  @Prop({ type: String, enum: Object.values(RefundMode), required: true })
  mode: RefundMode;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: Object.values(RefundAttemptStatus), required: true })
  status: RefundAttemptStatus;

  @Prop({ type: String, default: null })
  reference?: string | null;

  @Prop({ type: String, default: null })
  failureReason?: string | null;
}

export const RefundAttemptSchema = SchemaFactory.createForClass(RefundAttempt);
RefundAttemptSchema.index({ refundRequestId: 1, attemptNo: 1 }, { unique: true });
