import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProviderDocumentType } from './provider-verification.schema';

export type ProviderVerificationOcrOutboxEventDocument = HydratedDocument<ProviderVerificationOcrOutboxEvent>;
export enum OcrOutboxStatus {
  Pending = 'PENDING',
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
  DeadLetter = 'DEAD_LETTER',
}

@Schema({ collection: 'provider_verification_ocr_outbox_events', timestamps: true })
export class ProviderVerificationOcrOutboxEvent {
  @Prop({ type: Types.ObjectId, ref: 'ProviderVerification', required: true, index: true }) verificationId: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(ProviderDocumentType), required: true }) documentType: ProviderDocumentType;
  @Prop({ type: Number, required: true }) versionNo: number;
  @Prop({ type: String, required: true, index: true }) attemptId: string;
  @Prop({ type: String, required: true, index: true }) operationId: string;
  @Prop({ type: String, enum: Object.values(OcrOutboxStatus), default: OcrOutboxStatus.Pending, index: true }) status: OcrOutboxStatus;
  @Prop({ type: Number, default: 0 }) deliveryAttempts: number;
  @Prop({ type: String, default: null }) lastErrorCode?: string | null;
  @Prop({ type: Date, default: null }) nextAttemptAt?: Date | null;
  @Prop({ type: Date, default: null }) deliveredAt?: Date | null;
  @Prop({ type: Date, default: null }) deadLetteredAt?: Date | null;
}
export const ProviderVerificationOcrOutboxEventSchema = SchemaFactory.createForClass(ProviderVerificationOcrOutboxEvent);
ProviderVerificationOcrOutboxEventSchema.index({ status: 1, createdAt: 1 });
ProviderVerificationOcrOutboxEventSchema.index({ status: 1, nextAttemptAt: 1 });
ProviderVerificationOcrOutboxEventSchema.index({ verificationId: 1, documentType: 1, versionNo: 1, attemptId: 1 }, { unique: true });