import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IncidentReportDocument = HydratedDocument<IncidentReport>;

export enum IncidentStatus {
  PendingCustomer = 'PENDING_CUSTOMER', // Chờ khách hàng phản hồi
  Accepted = 'ACCEPTED', // Khách hàng đồng ý đền bù
  Disputed = 'DISPUTED', // Khách hàng từ chối, chuyển admin giải quyết
  Resolved = 'RESOLVED', // Admin đã phán quyết xong
}

@Schema({ collection: 'incident_reports', timestamps: true })
export class IncidentReport {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  reportedBy: Types.ObjectId; // Provider ID của Shop

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: [String], default: [] })
  evidencePhotos: string[];

  @Prop({ type: Number, required: true, min: 0 })
  requestedAmount: number;

  @Prop({
    type: String,
    enum: Object.values(IncidentStatus),
    default: IncidentStatus.PendingCustomer,
    index: true,
  })
  status: IncidentStatus;

  @Prop({ type: String, default: null, trim: true })
  adminNotes?: string | null;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date | null;
}

export const IncidentReportSchema = SchemaFactory.createForClass(IncidentReport);
