import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProductModerationStatus } from '../../products/schemas/product.schema';

export type PortfolioItemDocument = HydratedDocument<PortfolioItem>;

@Schema({ collection: 'portfolio_items', timestamps: true })
export class PortfolioItem {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  description?: string | null;

  @Prop({ type: [String], required: true, default: [] })
  images: string[];

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  taggingRevision: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  taggingDecisionVersion: number;

  @Prop({
    type: String,
    enum: Object.values(ProductModerationStatus),
    default: ProductModerationStatus.PendingReview,
    index: true,
  })
  moderationStatus: ProductModerationStatus;

  @Prop({ type: String, default: null, trim: true, maxlength: 300 })
  moderationReason?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  moderatedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  moderatedAt?: Date | null;
}

export const PortfolioItemSchema = SchemaFactory.createForClass(PortfolioItem);
PortfolioItemSchema.index({
  providerId: 1,
  moderationStatus: 1,
  updatedAt: -1,
});
