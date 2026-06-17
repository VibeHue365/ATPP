import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PhotographyPackageDocument = HydratedDocument<PhotographyPackage>;

export enum PackageStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Draft = 'DRAFT',
}

export interface PackageRating {
  averageRating: number;
  totalReviews: number;
}

@Schema({ collection: 'photography_packages', timestamps: true })
export class PhotographyPackage {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  durationHours: number;

  @Prop({ required: true, min: 0 })
  editedPhotosCount: number;

  @Prop({ type: Number, default: 0 })
  rawPhotosCount: number;

  @Prop({ required: true, min: 0 })
  deliveryDays: number;

  @Prop({ type: String, default: null, trim: true })
  travelFeeNotes?: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  overtimeFeePerHour: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({
    type: String,
    enum: Object.values(PackageStatus),
    default: PackageStatus.Draft,
    index: true,
  })
  status: PackageStatus;

  @Prop({
    type: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    default: { averageRating: 0, totalReviews: 0 },
  })
  rating: PackageRating;
}

export const PhotographyPackageSchema =
  SchemaFactory.createForClass(PhotographyPackage);
