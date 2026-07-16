import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProviderDocumentType } from './provider-verification.schema';

export type ProviderVerificationOcrAttemptDocument = HydratedDocument<ProviderVerificationOcrAttempt>;

export enum OcrAttemptOutcome {
  Succeeded = 'SUCCEEDED',
  FailedRetryable = 'FAILED_RETRYABLE',
  FailedTerminal = 'FAILED_TERMINAL',
  TimedOut = 'TIMED_OUT',
  StaleDiscarded = 'STALE_DISCARDED',
  Cancelled = 'CANCELLED',
}

@Schema({ collection: 'provider_verification_ocr_attempts', timestamps: true })
export class ProviderVerificationOcrAttempt {
  @Prop({ type: Types.ObjectId, ref: 'ProviderVerification', required: true, index: true }) verificationId: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(ProviderDocumentType), required: true }) documentType: ProviderDocumentType;
  @Prop({ type: Number, required: true }) versionNo: number;
  @Prop({ type: String, required: true, unique: true, index: true }) attemptId: string;
  @Prop({ type: String, required: true, index: true }) operationId: string;
  @Prop({ type: String, enum: Object.values(OcrAttemptOutcome), default: null }) outcome?: OcrAttemptOutcome | null;
  @Prop({ type: String, default: null }) errorCode?: string | null;
  @Prop({ type: Boolean, default: false }) retryable: boolean;
  @Prop({ type: String, default: 'TESSERACT' }) engine: string;
  @Prop({ type: String, default: null }) engineVersion?: string | null;
  @Prop({ type: String, default: null }) language?: string | null;
  @Prop({ type: Number, default: null }) psmMode?: number | null;
  @Prop({ type: Date, required: true }) startedAt: Date;
  @Prop({ type: Date, default: null }) heartbeatAt?: Date | null;
  @Prop({ type: Date, default: null }) completedAt?: Date | null;
  @Prop({ type: Number, default: null }) durationMs?: number | null;
}
export const ProviderVerificationOcrAttemptSchema = SchemaFactory.createForClass(ProviderVerificationOcrAttempt);
ProviderVerificationOcrAttemptSchema.index({ verificationId: 1, documentType: 1, versionNo: 1, startedAt: -1 });
ProviderVerificationOcrAttemptSchema.index({ outcome: 1, startedAt: -1 });