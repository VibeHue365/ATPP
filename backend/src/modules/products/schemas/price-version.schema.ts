import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PriceVersionDocument = HydratedDocument<PriceVersion>;

export enum PriceTargetType {
  Product = 'PRODUCT',
  PhotographyPackage = 'PHOTOGRAPHY_PACKAGE',
}

@Schema({ collection: 'price_versions', timestamps: true })
export class PriceVersion {
  @Prop({
    type: String,
    enum: Object.values(PriceTargetType),
    required: true,
    index: true,
  })
  targetType: PriceTargetType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ type: Number, default: 0, min: 0 })
  depositAmount: number;

  @Prop({ required: true, type: Date, index: true })
  effectiveFrom: Date;

  @Prop({ type: Date, default: null, index: true })
  effectiveTo?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  note?: string | null;
}

export const PriceVersionSchema = SchemaFactory.createForClass(PriceVersion);
PriceVersionSchema.index({ targetType: 1, targetId: 1, effectiveFrom: -1 });
