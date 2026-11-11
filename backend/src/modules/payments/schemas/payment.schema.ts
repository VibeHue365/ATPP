import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentPurpose {
  DepositPayment = 'DEPOSIT_PAYMENT',
  RemainingPayment = 'REMAINING_PAYMENT',
  FullPayment = 'FULL_PAYMENT',
  CancellationFee = 'CANCELLATION_FEE',
  LateReturnFee = 'LATE_RETURN_FEE',
  DamageFee = 'DAMAGE_FEE',
  PlatformCommission = 'PLATFORM_COMMISSION',
  SubscriptionFee = 'SUBSCRIPTION_FEE',
  PromotionFee = 'PROMOTION_FEE',
  DepositRefund = 'DEPOSIT_REFUND',
}

export enum PaymentStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export interface PayOSCheckoutInfo {
  orderCode: number;
  paymentLinkId?: string | null;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
  description?: string | null;
}

export interface ContractPaymentBinding {
  bindingVersion: 1;
  flowVersion: 2;
  bookingId: Types.ObjectId;
  amount: number;
  currency: 'VND';
  purpose: PaymentPurpose;
  bookingFingerprint: string;
  boundAt: Date;
  versions: Array<{
    contractId: Types.ObjectId;
    contractVersionId: Types.ObjectId;
    providerId: Types.ObjectId;
    contentHash: string;
    bookingFingerprint: string;
  }>;
}

@Schema({ collection: 'payments', timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
  })
  paymentCode: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, min: 0, default: 0 })
  refundedAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  refundReservedAmount: number;

  @Prop({
    type: String,
    enum: Object.values(PaymentPurpose),
    required: true,
    index: true,
  })
  purpose: PaymentPurpose;

  @Prop({ type: String, default: 'PAYOS', trim: true, uppercase: true })
  paymentMethod: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.Pending,
    index: true,
  })
  status: PaymentStatus;

  @Prop({
    type: {
      orderCode: { type: Number, required: true },
      paymentLinkId: { type: String, default: null },
      checkoutUrl: { type: String, default: null },
      qrCode: { type: String, default: null },
      returnUrl: { type: String, default: null },
      cancelUrl: { type: String, default: null },
      description: { type: String, default: null },
    },
    default: null,
  })
  payos?: PayOSCheckoutInfo | null;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null, index: true })
  originalPaymentId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  refundReason?: string | null;

  @Prop({ type: Number, default: 0 })
  retryCount?: number;

  @Prop({ type: String, default: null })
  lastError?: string | null;

  @Prop({ type: Boolean, default: false })
  needsManualReview?: boolean;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  // Populated only by the future payment guard. Legacy payments remain null.
  @Prop({
    type: {
      bindingVersion: { type: Number, enum: [1], required: true },
      flowVersion: { type: Number, enum: [2], required: true },
      bookingId: { type: Types.ObjectId, ref: 'Booking', required: true },
      amount: { type: Number, min: 0, required: true },
      currency: { type: String, enum: ['VND'], required: true },
      purpose: {
        type: String,
        enum: Object.values(PaymentPurpose),
        required: true,
      },
      bookingFingerprint: {
        type: String,
        required: true,
        match: /^[a-f0-9]{64}$/,
      },
      boundAt: { type: Date, required: true },
      versions: {
        type: [
          {
            _id: false,
            contractId: {
              type: Types.ObjectId,
              ref: 'DigitalContract',
              required: true,
            },
            contractVersionId: {
              type: Types.ObjectId,
              ref: 'ContractVersion',
              required: true,
            },
            providerId: {
              type: Types.ObjectId,
              ref: 'Provider',
              required: true,
            },
            contentHash: {
              type: String,
              required: true,
              match: /^[a-f0-9]{64}$/,
            },
            bookingFingerprint: {
              type: String,
              required: true,
              match: /^[a-f0-9]{64}$/,
            },
          },
        ],
        required: true,
        validate: {
          validator: (versions: unknown[]) =>
            Array.isArray(versions) && versions.length > 0,
          message: 'Contract binding requires at least one version',
        },
      },
    },
    default: null,
  })
  contractBinding?: ContractPaymentBinding | null;

  /** Stable V2 retry key. The index is created only by a reviewed rollout. */
  @Prop({ type: String, default: null, match: /^[a-f0-9]{64}$/ })
  contractIntentKey?: string | null;

  @Prop({ type: Date, default: null })
  supersededAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null })
  supersededByPaymentId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  supersededReason?: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ 'payos.orderCode': 1 }, { unique: true, sparse: true });
PaymentSchema.index({ status: 1, purpose: 1, createdAt: 1 });
PaymentSchema.index(
  { originalPaymentId: 1, refundReason: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purpose: PaymentPurpose.DepositRefund,
      originalPaymentId: { $type: 'objectId' },
    },
  },
);
PaymentSchema.index(
  { contractIntentKey: 1 },
  {
    unique: true,
    partialFilterExpression: { contractIntentKey: { $type: 'string' } },
  },
);
