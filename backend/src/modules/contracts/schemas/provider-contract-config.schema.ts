import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderRentalContractConfigDocument =
  HydratedDocument<ProviderRentalContractConfig>;

export enum ProviderContractMode {
  AUTO = 'AUTO',
  CUSTOM_ORDER_THRESHOLD = 'CUSTOM_ORDER_THRESHOLD',
  ALWAYS_DETAILED = 'ALWAYS_DETAILED',
}

@Schema({
  collection: 'provider_contract_configs',
  timestamps: true,
  autoIndex: false,
})
export class ProviderRentalContractConfig {
  @Prop({
    type: Types.ObjectId,
    ref: 'Provider',
    required: true,
    unique: true,
    index: true,
    immutable: true,
  })
  providerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProviderContractMode),
    default: ProviderContractMode.AUTO,
    index: true,
  })
  contractMode: ProviderContractMode;

  @Prop({
    type: Number,
    default: null,
    min: 0,
  })
  orderThresholdAmount?: number | null;

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 1,
  })
  version: number;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
  })
  effectiveFrom: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  updatedByUserId: Types.ObjectId;
}

export const ProviderRentalContractConfigSchema =
  SchemaFactory.createForClass(ProviderRentalContractConfig);

ProviderRentalContractConfigSchema.index({ providerId: 1 }, { unique: true });
