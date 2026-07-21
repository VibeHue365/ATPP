import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ComboPromotionDocument = HydratedDocument<ComboPromotion>;

export enum ComboPromotionStatus {
  PendingReview = 'PENDING_REVIEW',
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Expired = 'EXPIRED',
  Rejected = 'REJECTED',
}

@Schema({ collection: 'combo_promotions', timestamps: true })
export class ComboPromotion {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PhotographyPackage', required: true, index: true })
  photographyPackageId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 80 })
  discountPercent: number;

  @Prop({ type: Number, default: null, min: 0 })
  comboPrice?: number | null;

  @Prop({ type: Date, required: true, index: true })
  validFrom: Date;

  @Prop({ type: Date, required: true, index: true })
  validTo: Date;

  @Prop({ required: false, type: Date, index: true, default: null })
  shootDate?: Date | null;

  @Prop({ required: false, type: String, trim: true, default: null })
  shootTimeSlot?: string | null;

  @Prop({
    type: String,
    enum: Object.values(ComboPromotionStatus),
    default: ComboPromotionStatus.Active,
    index: true,
  })
  status: ComboPromotionStatus;

  @Prop({ type: Number, required: true, min: 1, default: 10 })
  maxUsage: number;

  @Prop({ type: Number, default: 1, min: 1 })
  aoDaiQuantity: number;

  @Prop({ type: Number, default: 1, min: 1 })
  shootPeopleCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  usedCount: number;

  @Prop({ type: String, default: null })
  image?: string | null;
}

export const ComboPromotionSchema = SchemaFactory.createForClass(ComboPromotion);
ComboPromotionSchema.index({ status: 1, shootDate: 1 });
ComboPromotionSchema.index({ providerId: 1, status: 1 });
