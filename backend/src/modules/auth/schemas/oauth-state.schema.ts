import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OAuthStateDocument = HydratedDocument<OAuthState>;

@Schema({ collection: 'oauth_states', timestamps: true })
export class OAuthState {
  @Prop({ required: true })
  stateHash: string;

  @Prop({ type: String, default: null })
  ipAddress?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null, index: true })
  usedAt?: Date | null;
}

export const OAuthStateSchema = SchemaFactory.createForClass(OAuthState);
OAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OAuthStateSchema.index({ usedAt: 1, expiresAt: 1 });
