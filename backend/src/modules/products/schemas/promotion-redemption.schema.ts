import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionRedemptionDocument = HydratedDocument<PromotionRedemption>;

export enum RedemptionStatus {
  Reserved = 'RESERVED',
  Redeemed = 'REDEEMED',
  Released = 'RELEASED',
  Refunded = 'REFUNDED',
}

@Schema({ collection: 'promotion_redemptions', timestamps: true })
export class PromotionRedemption {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Promotion', required: true, index: true })
  promotionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: String, default: null, trim: true })
  singleUseKey?: string | null;

  @Prop({
    type: String,
    enum: Object.values(RedemptionStatus),
    default: RedemptionStatus.Reserved,
    index: true,
  })
  status: RedemptionStatus;

  @Prop({ type: Number, required: true, min: 0 })
  discountAmount: number;

  @Prop({ type: Date, default: null, index: true })
  expiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  reservedAt?: Date | null;

  @Prop({ type: Date, default: null })
  redeemedAt?: Date | null;

  @Prop({ type: Date, default: null })
  releasedAt?: Date | null;

  @Prop({ type: Date, default: null })
  refundedAt?: Date | null;
}

export const PromotionRedemptionSchema =
  SchemaFactory.createForClass(PromotionRedemption);

PromotionRedemptionSchema.index({ bookingId: 1, promotionId: 1 });
PromotionRedemptionSchema.index(
  { singleUseKey: 1 },
  { unique: true, sparse: true },
);
