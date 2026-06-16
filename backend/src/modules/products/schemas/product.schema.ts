import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Draft = 'DRAFT',
}

export interface ProductRating {
  averageRating: number;
  totalReviews: number;
}

@Schema({ collection: 'products', timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, min: 0 })
  basePrice: number;

  @Prop({ required: true, min: 0 })
  depositAmount: number;

  @Prop({ type: [String], default: [] })
  sizes: string[];

  @Prop({ type: [String], default: [] })
  colors: string[];

  @Prop({ type: [String], default: [] })
  materials: string[];

  @Prop({ type: Map, of: String, default: {} })
  specifications: Map<string, string>;

  @Prop({
    type: String,
    enum: Object.values(ProductStatus),
    default: ProductStatus.Draft,
    index: true,
  })
  status: ProductStatus;

  @Prop({
    type: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    default: { averageRating: 0, totalReviews: 0 },
  })
  rating: ProductRating;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
