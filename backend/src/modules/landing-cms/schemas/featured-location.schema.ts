import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeaturedLocationDocument = HydratedDocument<FeaturedLocation>;

export enum FeaturedLocationStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

@Schema({ collection: 'featured_locations', timestamps: true })
export class FeaturedLocation {
  @Prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ required: true, trim: true })
  destination: string;

  @Prop({ type: Number, required: true, default: 0, index: true })
  displayOrder: number;

  @Prop({
    type: String,
    enum: Object.values(FeaturedLocationStatus),
    default: FeaturedLocationStatus.Active,
    index: true,
  })
  status: FeaturedLocationStatus;
}

export const FeaturedLocationSchema = SchemaFactory.createForClass(FeaturedLocation);
FeaturedLocationSchema.index({ status: 1, displayOrder: 1 });
