import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ collection: 'refresh_tokens', timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ type: String, default: null, trim: true, index: true })
  familyId?: string | null;

  @Prop({ type: String, default: null, trim: true, index: true })
  deviceId?: string | null;

  @Prop({ type: String, default: null })
  deviceName?: string | null;

  @Prop({ type: String, default: null })
  ipAddress?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null, index: true })
  revokedAt?: Date | null;

  @Prop({ type: String, default: null })
  revokedReason?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'RefreshToken', default: null })
  replacedByTokenId?: Types.ObjectId | null;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });
RefreshTokenSchema.index({ userId: 1, expiresAt: 1 });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
RefreshTokenSchema.index({ familyId: 1, revokedAt: 1 });
