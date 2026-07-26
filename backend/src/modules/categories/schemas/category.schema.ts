import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

export enum CategoryStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export enum ServiceCategoryType {
  AodaiCategory = 'AODAI_CATEGORY',
  PhotographyCategory = 'PHOTOGRAPHY_CATEGORY',
  Concept = 'CONCEPT',
  Style = 'STYLE',
  Event = 'EVENT',
}

export interface CategoryMetadata {
  color?: string | null;
  occasion?: string | null;
  season?: string | null;
}

@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
  })
  slug: string;

  @Prop({
    type: String,
    enum: Object.values(ServiceCategoryType),
    required: true,
    default: ServiceCategoryType.AodaiCategory,
    index: true,
  })
  type: ServiceCategoryType;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: String, default: null, trim: true })
  iconUrl?: string | null;

  @Prop({ type: String, default: null, trim: true })
  coverImageUrl?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(CategoryStatus),
    default: CategoryStatus.Active,
    index: true,
  })
  status: CategoryStatus;

  @Prop({ type: Number, default: 0, min: 0, index: true })
  displayOrder: number;

  @Prop({
    type: {
      color: { type: String, default: null, trim: true },
      occasion: { type: String, default: null, trim: true },
      season: { type: String, default: null, trim: true },
    },
    default: {},
  })
  metadata?: CategoryMetadata;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  updatedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: undefined, index: true })
  deletedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
CategorySchema.index({ type: 1, status: 1, displayOrder: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ name: 'text', slug: 'text' });
