import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentRecoveryDocument = HydratedDocument<PaymentRecovery>;

export enum PaymentRecoveryState {
  FinalizationPending = 'FINALIZATION_PENDING',
  Finalizing = 'FINALIZING',
  Completed = 'COMPLETED',
  ReviewRequired = 'REVIEW_REQUIRED',
}

@Schema({
  collection: 'payment_recoveries',
  timestamps: true,
  autoIndex: false,
})
export class PaymentRecovery {
  @Prop({
    type: Types.ObjectId,
    ref: 'Payment',
    required: true,
    immutable: true,
  })
  paymentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
    required: true,
    immutable: true,
  })
  bookingId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  })
  bindingKey: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentRecoveryState),
    required: true,
  })
  state: PaymentRecoveryState;

  @Prop({ type: Number, min: 0, default: 0 })
  attempts: number;

  @Prop({ type: Date, required: true })
  nextAttemptAt: Date;

  @Prop({ type: String, default: null })
  leaseToken?: string | null;

  @Prop({ type: Date, default: null })
  leaseUntil?: Date | null;

  /** Fixed internal error code only; never raw webhook or exception text. */
  @Prop({ type: String, default: null, maxlength: 64, match: /^[A-Z0-9_]+$/ })
  lastErrorCode?: string | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;
}

export const PaymentRecoverySchema =
  SchemaFactory.createForClass(PaymentRecovery);
// Declared for review/test; autoIndex is disabled and application DB is untouched.
PaymentRecoverySchema.index(
  { paymentId: 1 },
  { unique: true, name: 'payment_recovery_payment_unique' },
);
PaymentRecoverySchema.index({ state: 1, nextAttemptAt: 1, leaseUntil: 1 });
