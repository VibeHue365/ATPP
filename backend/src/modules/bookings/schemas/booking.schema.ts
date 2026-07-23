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
  /** Photography only: provider has started the shoot session */
  InProgress = 'IN_PROGRESS',
  /** Photography only: shoot done, waiting for customer confirmation (48h window) */
  AwaitingReview = 'AWAITING_REVIEW',
  /** Dedicated Combo status: photos delivered & customer approved, awaiting Ao Dai return */
  ComboPhotosApproved = 'COMBO_PHOTOS_APPROVED',
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
  comboDiscountTotal?: number;
  voucherDiscountTotal?: number;
  travelFee: number;
  overtimeFee: number;
  lateFee: number;
  damageFee: number;
  serviceFee?: number;
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
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
  })
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
      comboDiscountTotal: { type: Number, default: 0, min: 0 },
      voucherDiscountTotal: { type: Number, default: 0, min: 0 },
      travelFee: { type: Number, default: 0, min: 0 },
      overtimeFee: { type: Number, default: 0, min: 0 },
      lateFee: { type: Number, default: 0, min: 0 },
      damageFee: { type: Number, default: 0, min: 0 },
      serviceFee: { type: Number, default: 0, min: 0 },
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
    default: {
      totalPaid: 0,
      totalRefunded: 0,
      paymentStatus: PaymentStatus.Unpaid,
    },
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
        status: {
          type: String,
          enum: Object.values(BookingStatus),
          required: true,
        },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Types.ObjectId, ref: 'User', default: null },
        note: { type: String, default: null },
      },
    ],
    default: [],
  })
  statusTimeline: BookingStatusTimelineEntry[];

  @Prop({ type: Date, default: null })
  settlementsGeneratedAt?: Date | null;

  @Prop({ type: Date, default: null })
  settlementGenerationFailedAt?: Date | null;

  /** Key from the client retrying a photography hold request. */
  @Prop({ type: String, default: null, trim: true, maxlength: 160 })
  holdIdempotencyKey?: string | null;

  /** Present only while a photography schedule is temporarily held. */
  @Prop({ type: Date, default: null, index: true })
  holdExpiresAt?: Date | null;

  /** A payment received after expiry must be reviewed/refunded manually. */
  @Prop({ type: Boolean, default: false })
  paymentReviewRequired: boolean;

  @Prop({ type: String, default: null, trim: true })
  paymentReviewReason?: string | null;

  @Prop({ type: String, default: null, trim: true })
  settlementGenerationError?: string | null;

  /**
   * Photography only: timestamp when booking entered AWAITING_REVIEW.
   * Used by the auto-complete cron job to calculate the 48-hour window.
   */
  @Prop({ type: Date, default: null, index: true })
  awaitingReviewSince?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'ComboPromotion', default: null, index: true })
  comboPromotionId?: Types.ObjectId | null;

  /**
   * Photography only: estimated net amount credited to provider's pendingBalance
   * when booking enters CONFIRMED. Used at settlement time to deduct the exact
   * same figure (preventing ghost-balance drift if fees change).
   */
  @Prop({ type: Number, default: null })
  estimatedNetAmount?: number | null;

  /** Store pickup only: timestamp when shop clicks "Bàn giao đồ" (moves to PICKUP_PENDING) */
  @Prop({ type: Date, default: null, index: true })
  handoverInitiatedAt?: Date | null;

  /** Store pickup only: photos uploaded by shop at handover time (when moving to PICKUP_PENDING) */
  @Prop({ type: [String], default: [] })
  handoverPhotos?: string[];

  /** Photography only: result photos delivered by photographer when moving to AWAITING_REVIEW */
  @Prop({ type: [String], default: [] })
  deliveredPhotos?: string[];

  /** Photography only: Google Drive / Dropbox album link delivered by photographer */
  @Prop({ type: String, default: null, trim: true })
  deliveryDriveUrl?: string | null;

  /** Kết quả phán quyết tranh chấp từ Admin */
  @Prop({
    type: {
      decision: { type: String, default: null },
      decisionLabel: { type: String, default: null },
      refundAmount: { type: Number, default: 0 },
      compensationAmount: { type: Number, default: 0 },
      notes: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
    },
    default: null,
  })
  disputeResult?: {
    decision?: string;
    decisionLabel?: string;
    refundAmount?: number;
    compensationAmount?: number;
    notes?: string;
    resolvedAt?: Date;
  } | null;

  /** Pre-existing damage report submitted by customer during pickup (within 30 minutes) */
  @Prop({
    type: {
      reportedAt: { type: Date, default: null },
      description: { type: String, default: null },
      evidencePhotos: { type: [String], default: [] },
    },
    default: null,
  })
  pickupDamageReport?: {
    reportedAt: Date | null;
    description: string | null;
    evidencePhotos: string[];
  } | null;

  /** One booking-level refund request for all finalized Ao Dai item deposits. */
  @Prop({
    type: {
      status: {
        type: String,
        enum: ['PENDING', 'NO_REFUND', 'REQUESTED', 'REFUNDED', 'FAILED'],
        default: 'PENDING',
      },
      amount: { type: Number, min: 0, default: 0 },
      refundRequestId: {
        type: Types.ObjectId,
        ref: 'RefundRequest',
        default: null,
      },
      requestedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      failureReason: { type: String, default: null },
    },
    default: () => ({
      status: 'PENDING',
      amount: 0,
      refundRequestId: null,
      requestedAt: null,
      completedAt: null,
      failureReason: null,
    }),
  })
  rentalDepositRefund?: {
    status: 'PENDING' | 'NO_REFUND' | 'REQUESTED' | 'REFUNDED' | 'FAILED';
    amount: number;
    refundRequestId?: Types.ObjectId | null;
    requestedAt?: Date | null;
    completedAt?: Date | null;
  };
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index(
  { customerId: 1, holdIdempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { holdIdempotencyKey: { $type: 'string' } },
  },
);
