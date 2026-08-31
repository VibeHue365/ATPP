import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Draft = 'DRAFT',
}

export enum ProductModerationStatus {
  PendingReview = 'PENDING_REVIEW',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Hidden = 'HIDDEN',
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

  @Prop({ type: [String], default: [] })
  images: string[];

  /**
   * Ảnh gắn theo từng màu, để khách đổi màu thì ảnh đổi theo.
   * CHỈ LÀ CHỈ MỤC: mọi URL ở đây BẮT BUỘC cũng phải nằm trong `images` — `images` vẫn là
   * kho ảnh hợp nhất và `images[0]` vẫn là ảnh bìa. Nhờ vậy toàn bộ code cũ đọc `images`
   * chạy y nguyên, và phép so sánh xoá file khi cập nhật vẫn đúng.
   * Màu nào không có mục ở đây thì tự dùng ảnh chung.
   */
  @Prop({
    type: [
      {
        _id: false,
        color: { type: String, required: true, trim: true, uppercase: true },
        images: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  colorImages: { color: string; images: string[] }[];

  @Prop({ type: [String], default: [] })
  videos: string[];

  @Prop({ required: true, min: 0 })
  basePrice: number;

  @Prop({ required: true, min: 0 })
  depositAmount: number;

  @Prop({ required: false, min: 0 })
  hourlyPrice?: number;

  @Prop({ type: [String], default: [] })
  sizes: string[];

  @Prop({ type: [String], default: [] })
  colors: string[];

  @Prop({ type: [String], default: [] })
  materials: string[];

  @Prop({ type: String, default: null, trim: true })
  style?: string | null;

  @Prop({ type: [String], default: [] })
  occasions: string[];

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  taggingRevision: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  taggingDecisionVersion: number;

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
ProductSchema.index({ status: 1, moderationStatus: 1, categoryId: 1, basePrice: 1 });
ProductSchema.index({ status: 1, moderationStatus: 1, providerId: 1, createdAt: -1 });
ProductSchema.index({ status: 1, moderationStatus: 1, 'rating.averageRating': -1, createdAt: -1 });
ProductSchema.index({ styleCategoryIds: 1 });
ProductSchema.index({ eventCategoryIds: 1 });
