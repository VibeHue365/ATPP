import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;

export enum DiscountType {
  Percentage = 'PERCENTAGE',
  FixedAmount = 'FIXED_AMOUNT',
}

export enum PromotionStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Expired = 'EXPIRED',
}

@Schema({ collection: 'promotions', timestamps: true })
export class Promotion {
  @Prop({ type: Types.ObjectId, ref: 'Provider', default: null, index: true })
  providerId?: Types.ObjectId | null;

  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({
    type: String,
    enum: Object.values(DiscountType),
    required: true,
  })
  discountType: DiscountType;

  @Prop({ required: true, min: 0 })
  discountValue: number;

  @Prop({ type: Number, default: null, min: 0 })
  maxDiscountAmount?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  minOrderValue: number;

  @Prop({ type: Number, default: null, min: 1 })
  usageLimit?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  usedCount: number;

  @Prop({ required: true, type: Date, index: true })
  startDate: Date;

  @Prop({ required: true, type: Date, index: true })
  endDate: Date;

  @Prop({
    type: String,
    enum: Object.values(PromotionStatus),
    default: PromotionStatus.Active,
    index: true,
  })
  status: PromotionStatus;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
