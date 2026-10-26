import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { CampaignType } from '../utils/campaign-pricing.util';

export type DiscountCampaignDocument = HydratedDocument<DiscountCampaign>;

@Schema({ collection: 'discount_campaigns', timestamps: true })
export class DiscountCampaign {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  occasion: string;

  // DISCOUNT: giảm giá; SURCHARGE: phụ thu dịp lễ. Chiến dịch cũ không có trường này = DISCOUNT.
  @Prop({ type: String, enum: ['DISCOUNT', 'SURCHARGE'], default: 'DISCOUNT' })
  type: CampaignType;

  // Phần trăm giảm (1-90) hoặc phụ thu (1-100) tuỳ theo `type`.
  @Prop({ required: true, min: 1, max: 100 })
  discountPercent: number;

  @Prop({ required: true, type: Date, index: true })
  startDate: Date;

  @Prop({ required: true, type: Date, index: true })
  endDate: Date;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const DiscountCampaignSchema = SchemaFactory.createForClass(DiscountCampaign);
