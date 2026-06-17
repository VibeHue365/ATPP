import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoginHistoryDocument = HydratedDocument<LoginHistory>;

export enum LoginProvider {
  Local = 'LOCAL',
  Google = 'GOOGLE',
}

export enum LoginStatus {
  Success = 'SUCCESS',
  Failed = 'FAILED',
}

@Schema({ collection: 'login_histories', timestamps: true })
export class LoginHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true, lowercase: true })
  emailOrPhone: string;

  @Prop({ enum: LoginProvider, default: LoginProvider.Local })
  provider: LoginProvider;

  @Prop({ enum: LoginStatus, required: true })
  status: LoginStatus;

  @Prop({ type: String, default: null })
  ipAddress?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  @Prop({ type: String, default: null, trim: true })
  deviceId?: string | null;

  @Prop({ default: Date.now, index: true })
  loggedInAt: Date;

  @Prop({ type: String, default: null })
  failureReason?: string | null;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);
LoginHistorySchema.index({ userId: 1, loggedInAt: -1 });
