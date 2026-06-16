import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

export enum BookingType {
  AoDaiRental = 'AODAI_RENTAL',
  Photography = 'PHOTOGRAPHY',
  Combo = 'COMBO',
}

export enum BookingStatus {
  Draft = 'DRAFT',
  PendingPayment = 'PENDING_PAYMENT',
  DepositPaid = 'DEPOSIT_PAID',
  Confirmed = 'CONFIRMED',
  PickupPending = 'PICKUP_PENDING',
  PickedUp = 'PICKED_UP',
  ReturnPending = 'RETURN_PENDING',
  Returned = 'RETURNED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  Disputed = 'DISPUTED',
  PartiallyRefunded = 'PARTIALLY_REFUNDED',
  Refunded = 'REFUNDED',
}

export enum PaymentStatus {
  Unpaid = 'UNPAID',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
  Refunded = 'REFUNDED',
}

export interface BookingPricingSummary {
  subTotal: number;
  depositTotal: number;
  discountAmount: number;
  travelFee: number;
  overtimeFee: number;
  lateFee: number;
  damageFee: number;
  grandTotal: number;
}

export interface BookingPaymentSummary {
  totalPaid: number;
  totalRefunded: number;
  paymentStatus: PaymentStatus;
}

export interface BookingCancellation {
  cancelledBy?: Types.ObjectId | null;
  reason?: string | null;
  cancelledAt?: Date | null;
  refundAmount?: number | null;
}

export interface BookingStatusTimelineEntry {
  status: BookingStatus;
  changedAt: Date;
  changedBy?: Types.ObjectId | null;
  note?: string | null;
}

@Schema({ collection: 'bookings', timestamps: true })
export class Booking {
  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  bookingCode: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Provider', default: [] })
  providerIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(BookingType),
    required: true,
  })
  bookingType: BookingType;

  @Prop({
    type: String,
    enum: Object.values(BookingStatus),
    default: BookingStatus.Draft,
    index: true,
  })
  status: BookingStatus;

  @Prop({
    type: {
      subTotal: { type: Number, required: true, min: 0 },
      depositTotal: { type: Number, default: 0, min: 0 },
      discountAmount: { type: Number, default: 0, min: 0 },
      travelFee: { type: Number, default: 0, min: 0 },
      overtimeFee: { type: Number, default: 0, min: 0 },
      lateFee: { type: Number, default: 0, min: 0 },
      damageFee: { type: Number, default: 0, min: 0 },
      grandTotal: { type: Number, required: true, min: 0 },
    },
    required: true,
  })
  pricingSummary: BookingPricingSummary;

  @Prop({
    type: {
      totalPaid: { type: Number, default: 0, min: 0 },
      totalRefunded: { type: Number, default: 0, min: 0 },
      paymentStatus: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.Unpaid,
      },
    },
    default: { totalPaid: 0, totalRefunded: 0, paymentStatus: PaymentStatus.Unpaid },
  })
  paymentSummary: BookingPaymentSummary;

  @Prop({ type: Types.ObjectId, ref: 'DigitalContract', default: null })
  contractId?: Types.ObjectId | null;

  @Prop({
    type: {
      cancelledBy: { type: Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: null },
      cancelledAt: { type: Date, default: null },
      refundAmount: { type: Number, default: 0 },
    },
    default: {},
  })
  cancellation: BookingCancellation;

  @Prop({
    type: [
      {
        _id: false,
        status: { type: String, enum: Object.values(BookingStatus), required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Types.ObjectId, ref: 'User', default: null },
        note: { type: String, default: null },
      },
    ],
    default: [],
  })
  statusTimeline: BookingStatusTimelineEntry[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
