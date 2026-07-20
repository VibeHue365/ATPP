import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RentalEvidenceUploadDocument = HydratedDocument<RentalEvidenceUpload>;

/** Private evidence metadata. The object-storage key is never exposed by public APIs. */
@Schema({ collection: 'rental_evidence_uploads', timestamps: true })
export class RentalEvidenceUpload {
  @Prop({ required: true, unique: true, index: true, trim: true })
  fileId: string;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploadedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  bucket: string;

  @Prop({ required: true, trim: true })
  storageKey: string;

  @Prop({ required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] })
  mimeType: string;

  /** An upload can be attached to exactly one handover step. */
  @Prop({ type: Date, default: null, index: true })
  consumedAt?: Date | null;

  @Prop({ type: String, enum: ['PICKUP', 'RETURN'], default: null })
  consumedFor?: 'PICKUP' | 'RETURN' | null;
}

export const RentalEvidenceUploadSchema = SchemaFactory.createForClass(RentalEvidenceUpload);