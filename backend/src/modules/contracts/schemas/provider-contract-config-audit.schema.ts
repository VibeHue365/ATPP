import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProviderContractMode } from './provider-contract-config.schema';

export type ProviderRentalContractConfigAuditDocument =
  HydratedDocument<ProviderRentalContractConfigAudit>;

@Schema({
  collection: 'provider_contract_config_audits',
  timestamps: { createdAt: true, updatedAt: false },
  autoIndex: false,
})
export class ProviderRentalContractConfigAudit {
  @Prop({
    type: Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true,
  })
  providerId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  version: number;

  @Prop({
    type: String,
    enum: Object.values(ProviderContractMode),
    required: true,
  })
  contractMode: ProviderContractMode;

  @Prop({
    type: Number,
    default: null,
  })
  orderThresholdAmount?: number | null;

  @Prop({
    type: Date,
    required: true,
  })
  effectiveFrom: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  updatedByUserId: Types.ObjectId;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  ipAddress?: string | null;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  userAgent?: string | null;

  @Prop({
    type: String,
    default: null,
    trim: true,
    maxlength: 500,
  })
  changeNote?: string | null;
}

export const ProviderRentalContractConfigAuditSchema =
  SchemaFactory.createForClass(ProviderRentalContractConfigAudit);

ProviderRentalContractConfigAuditSchema.index(
  { providerId: 1, version: -1 },
  { unique: true },
);
