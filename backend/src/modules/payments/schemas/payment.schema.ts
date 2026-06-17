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
}

export enum PaymentStatus {
  Pending = 'PENDING',
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

@Schema({ collection: 'payments', timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  paymentCode: string;

  @Prop({ required: true, min: 0 })
  amount: number;

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

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
