import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WeatherCancellationRequestDocument = HydratedDocument<WeatherCancellationRequest>;

export enum CancellationEligibilityBasis {
  BASIS_A_QUOTA_EXHAUSTED = 'BASIS_A_QUOTA_EXHAUSTED',     // Đã dùng hết quota (count >= 2) + RED_ALERT
  BASIS_B_FORCE_MAJEURE = 'BASIS_B_FORCE_MAJEURE',         // Chưa dùng hết quota (count < 2) + RED_ALERT + Bằng chứng bất khả kháng
}

export enum CancellationReviewStatus {
  PENDING_ADMIN_REVIEW = 'PENDING_ADMIN_REVIEW',
  APPROVED_FULL_REFUND = 'APPROVED_FULL_REFUND',
  APPROVED_PARTIAL_REFUND = 'APPROVED_PARTIAL_REFUND',
  REJECTED = 'REJECTED',
}

@Schema({ collection: 'weather_cancellation_requests', timestamps: true })
export class WeatherCancellationRequest {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CancellationEligibilityBasis),
    required: true,
    index: true,
  })
  eligibilityBasis: CancellationEligibilityBasis;

  @Prop({ type: Number, required: true, default: 0 })
  weatherRescheduleCountAtSubmission: number;

  @Prop({
    type: {
      spotName: { type: String, default: null },
      precipitationMm: { type: Number, default: 0 },
      popPercent: { type: Number, default: 0 },
      wmoCode: { type: Number, default: 0 },
      isRedAlert: { type: Boolean, default: true },
      fetchedAt: { type: Date, default: Date.now },
    },
    required: true,
  })
  weatherSnapshot: {
    spotName?: string | null;
    precipitationMm: number;
    popPercent: number;
    wmoCode: number;
    isRedAlert: boolean;
    fetchedAt: Date;
  };

  @Prop({ required: true, trim: true })
  reason: string; // Lý do khách trình bày

  @Prop({ type: [String], default: [] })
  evidencePhotos: string[]; // Link ảnh vé máy bay/tàu rời Huế, giấy tờ công tác/y tế

  @Prop({
    type: String,
    enum: Object.values(CancellationReviewStatus),
    default: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
    index: true,
  })
  status: CancellationReviewStatus;

  @Prop({
    type: {
      adminId: { type: Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date, default: Date.now },
      approvedRefundAmount: { type: Number, default: 0 },
      penaltyDeducted: { type: Number, default: 0 },
      notes: { type: String, default: null },
    },
    default: null,
  })
  reviewDecision?: {
    adminId: Types.ObjectId;
    reviewedAt: Date;
    approvedRefundAmount: number;
    penaltyDeducted: number;
    notes?: string;
  } | null;

  @Prop({ type: Types.ObjectId, ref: 'RefundRequest', default: null })
  refundRequestId?: Types.ObjectId | null;
}

export const WeatherCancellationRequestSchema = SchemaFactory.createForClass(WeatherCancellationRequest);

WeatherCancellationRequestSchema.index({ status: 1, createdAt: -1 });
