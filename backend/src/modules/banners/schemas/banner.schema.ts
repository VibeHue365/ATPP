import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BannerDocument = HydratedDocument<Banner>;

export enum BannerPlacement {
  Home = 'HOME',
  AoDai = 'AODAI',
  Photographer = 'PHOTOGRAPHER',
  Combo = 'COMBO',
}

@Schema({ collection: 'banners', timestamps: true })
export class Banner {
  @Prop({
    type: String,
    required: true,
    enum: Object.values(BannerPlacement),
    unique: true,
    index: true,
  })
  placement: BannerPlacement;

  @Prop({ required: true, trim: true })
  imageUrl: string;

  @Prop({ required: false, trim: true, default: '' })
  title?: string;

  @Prop({ required: false, trim: true, default: '' })
  subtitle?: string;

  @Prop({ required: false, trim: true, default: '' })
  linkUrl?: string;

  @Prop({ type: Boolean, required: true, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  updatedBy?: Types.ObjectId | null;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
BannerSchema.index({ placement: 1 }, { unique: true });
BannerSchema.index({ placement: 1, isActive: 1 });
