import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SecurityEventDocument = HydratedDocument<SecurityEvent>;

export enum SecurityEventType {
  LoginFailed = 'LOGIN_FAILED',
  LoginSuccess = 'LOGIN_SUCCESS',
  OtpFailed = 'OTP_FAILED',
  OtpMaxAttemptsExceeded = 'OTP_MAX_ATTEMPTS_EXCEEDED',
  PasswordChanged = 'PASSWORD_CHANGED',
  PasswordResetRequested = 'PASSWORD_RESET_REQUESTED',
  PasswordResetSuccess = 'PASSWORD_RESET_SUCCESS',
  RefreshTokenReused = 'REFRESH_TOKEN_REUSED',
  AccountLocked = 'ACCOUNT_LOCKED',
  AccountUnlocked = 'ACCOUNT_UNLOCKED',
}

@Schema({ collection: 'security_events', timestamps: { createdAt: true, updatedAt: false } })
export class SecurityEvent {
  @Prop({ enum: SecurityEventType, required: true, index: true })
  type: SecurityEventType;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true, lowercase: true, index: true })
  email?: string | null;

  @Prop({ type: Object, default: null })
  metadata?: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  ip?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  createdAt?: Date;
}

export const SecurityEventSchema =
  SchemaFactory.createForClass(SecurityEvent);
SecurityEventSchema.index({ createdAt: -1 });
SecurityEventSchema.index({ type: 1, createdAt: -1 });
SecurityEventSchema.index({ userId: 1, createdAt: -1 });
SecurityEventSchema.index({ email: 1, createdAt: -1 });
