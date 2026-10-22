import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LandingBannerDocument = HydratedDocument<LandingBanner>;

export enum LandingBannerStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

@Schema({ collection: 'landing_banners', timestamps: true })
export class LandingBanner {
  @Prop({ required: true, trim: true })
  imageUrl: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: false, trim: true, default: '' })
  subtitle?: string;

  @Prop({ required: false, trim: true, default: '#rentals' })
  linkUrl?: string;

  @Prop({ type: Number, required: true, default: 0, index: true })
  displayOrder: number;

  @Prop({
    type: String,
    enum: Object.values(LandingBannerStatus),
    default: LandingBannerStatus.Active,
    index: true,
  })
  status: LandingBannerStatus;
}

export const LandingBannerSchema = SchemaFactory.createForClass(LandingBanner);
LandingBannerSchema.index({ status: 1, displayOrder: 1 });
