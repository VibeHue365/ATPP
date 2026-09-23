import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ collection: 'reviews', timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'BookingItem',
    required: true,
    index: true,
  })
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

  @Prop({ type: Boolean, default: false })
  isReported?: boolean;

  @Prop({ type: String, default: null })
  reportReason?: string | null;

  @Prop({ type: Date, default: null })
  reportedAt?: Date | null;

  @Prop({ type: String, default: null })
  reportCode?: string | null;

  @Prop({ type: String, default: 'PENDING' })
  reportStatus?: string | null;

  @Prop({ type: String, default: null })
  reportReasonType?: string | null;

  @Prop({ type: String, default: null })
  reportDescription?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reporterId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  reporterName?: string | null;

  @Prop({ type: String, default: null })
  reporterCode?: string | null;

  @Prop({ type: String, default: null })
  reporterAvatar?: string | null;

  @Prop({ type: Boolean, default: false })
  isHidden?: boolean;

  @Prop({
    type: [
      {
        timestamp: { type: Date, default: Date.now },
        title: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    default: [],
  })
  historyTimeline?: Array<{
    timestamp: Date;
    title: string;
    description: string;
  }>;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ providerId: 1, rating: -1 });
ReviewSchema.index({ isReported: 1, reportedAt: -1 });
ReviewSchema.index({ isReported: 1, reportStatus: 1 });

@Schema({ collection: 'customer_reviews', timestamps: true })
export class CustomerReview {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, default: '', trim: true })
  comment: string;
}

export const CustomerReviewSchema =
  SchemaFactory.createForClass(CustomerReview);
CustomerReviewSchema.index({ customerId: 1 });
