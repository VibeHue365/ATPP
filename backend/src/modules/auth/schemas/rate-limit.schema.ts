import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RateLimitDocument = HydratedDocument<RateLimit>;

@Schema({ collection: 'rate_limits', timestamps: true })
export class RateLimit {
  @Prop({ required: true, unique: true, index: true, trim: true })
  key: string;

  @Prop({ required: true, min: 0, default: 0 })
  count: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true })
  lastAttemptAt: Date;
}

export const RateLimitSchema = SchemaFactory.createForClass(RateLimit);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
