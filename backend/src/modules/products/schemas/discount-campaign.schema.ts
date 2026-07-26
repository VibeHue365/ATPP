import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DiscountCampaignDocument = HydratedDocument<DiscountCampaign>;

@Schema({ collection: 'discount_campaigns', timestamps: true })
export class DiscountCampaign {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  occasion: string;

  @Prop({ required: true, min: 1, max: 90 })
  discountPercent: number;

  @Prop({ required: true, type: Date, index: true })
  startDate: Date;

  @Prop({ required: true, type: Date, index: true })
  endDate: Date;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const DiscountCampaignSchema = SchemaFactory.createForClass(DiscountCampaign);
