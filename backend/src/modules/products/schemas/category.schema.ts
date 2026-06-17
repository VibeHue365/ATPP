import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

export enum CategoryStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  parentId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(CategoryStatus),
    default: CategoryStatus.Active,
    index: true,
  })
  status: CategoryStatus;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
