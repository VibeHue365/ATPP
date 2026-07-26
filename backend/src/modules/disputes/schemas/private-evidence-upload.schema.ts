import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrivateEvidenceUploadDocument = HydratedDocument<PrivateEvidenceUpload>;

@Schema({ collection: 'private_evidence_uploads', timestamps: true })
export class PrivateEvidenceUpload {
  @Prop({ required: true, unique: true, index: true })
  reference: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploaderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IncidentReport', default: null, index: true })
  incidentId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null, index: true })
  expiresAt?: Date | null;
}

export const PrivateEvidenceUploadSchema = SchemaFactory.createForClass(PrivateEvidenceUpload);