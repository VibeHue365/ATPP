import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderScheduleLockDocument =
  HydratedDocument<ProviderScheduleLock>;

/**
 * Serializes schedule-hold transactions for one provider on one local day.
 * It does not represent availability; it is only a write-conflict boundary.
 */
@Schema({ collection: 'provider_schedule_locks', timestamps: true })
export class ProviderScheduleLock {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, index: true })
  providerLocalDate: string;

  @Prop({ type: Number, required: true, default: 0 })
  version: number;
}

export const ProviderScheduleLockSchema =
  SchemaFactory.createForClass(ProviderScheduleLock);

ProviderScheduleLockSchema.index(
  { providerId: 1, providerLocalDate: 1 },
  { unique: true },
);
