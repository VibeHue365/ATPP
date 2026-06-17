import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ collection: 'reviews', timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, default: '', trim: true })
  comment: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String, default: null, trim: true })
  reply?: string | null;

  @Prop({ type: Date, default: null })
  repliedAt?: Date | null;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ providerId: 1, rating: -1 });
