import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductViewLogDocument = HydratedDocument<ProductViewLog>;

@Schema({ collection: 'product_view_logs', timestamps: true })
export class ProductViewLog {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, unique: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, default: 1 })
  viewCount: number;

  @Prop({ type: Date, default: Date.now })
  lastViewedAt: Date;
}

export const ProductViewLogSchema = SchemaFactory.createForClass(ProductViewLog);
