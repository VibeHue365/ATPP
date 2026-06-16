import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VerificationTokenDocument = HydratedDocument<VerificationToken>;

export enum VerificationTargetType {
  Email = 'EMAIL',
  Phone = 'PHONE',
}

export enum VerificationPurpose {
  VerifyEmail = 'VERIFY_EMAIL',
  VerifyPhone = 'VERIFY_PHONE',
  PasswordReset = 'PASSWORD_RESET',
  EmailChange = 'EMAIL_CHANGE',
  PhoneChange = 'PHONE_CHANGE',
}

@Schema({ collection: 'verification_tokens', timestamps: true })
export class VerificationToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  target: string;

  @Prop({ enum: VerificationTargetType, required: true })
  targetType: VerificationTargetType;

  @Prop({ enum: VerificationPurpose, required: true, index: true })
  purpose: VerificationPurpose;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  verifiedAt?: Date | null;

  @Prop({ default: 0 })
  attemptCount: number;

  @Prop({ default: 5 })
  maxAttempts: number;
}

export const VerificationTokenSchema =
  SchemaFactory.createForClass(VerificationToken);
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
VerificationTokenSchema.index({
  userId: 1,
  target: 1,
  purpose: 1,
  verifiedAt: 1,
  createdAt: -1,
});
