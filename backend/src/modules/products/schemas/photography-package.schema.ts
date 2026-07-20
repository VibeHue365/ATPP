import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PhotographyPackageDocument = HydratedDocument<PhotographyPackage>;

export enum PackageStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Draft = 'DRAFT',
}

export enum PhotographyPricingUnit {
  PerSession = 'PER_SESSION',
  PerDay = 'PER_DAY',
  PerBooking = 'PER_BOOKING',
}
export interface PackageRating {
  averageRating: number;
  totalReviews: number;
}

@Schema({ collection: 'photography_packages', timestamps: true })
export class PhotographyPackage {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  categoryId?: Types.ObjectId | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  conceptCategoryIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  styleCategoryIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  eventCategoryIds: Types.ObjectId[];
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  durationHours: number;

  @Prop({
    type: String,
    enum: Object.values(PhotographyPricingUnit),
    default: PhotographyPricingUnit.PerSession,
  })
  pricingUnit: PhotographyPricingUnit;

  @Prop({ type: Number, default: null, min: 30 })
  includedDurationMinutes?: number | null;

  @Prop({ type: Number, default: null, min: 1 })
  includedSessionCount?: number | null;

  @Prop({ type: Number, default: null, min: 1 })
  includedDayCount?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  additionalSessionFee: number;
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

  @Prop({ type: Number, default: 30, min: 30 })
  overtimeIncrementMinutes: number;

  @Prop({ type: Number, default: 240, min: 0 })
  maxOvertimeMinutes: number;

  @Prop({ type: Number, default: 0, min: 0 })
  bufferBeforeMinutes: number;

  @Prop({ type: Number, default: 0, min: 0 })
  bufferAfterMinutes: number;

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
