import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContractScope } from '../../bookings/schemas/digital-contract.schema';

export type ProviderContractAcceptanceDocument =
  HydratedDocument<ProviderContractAcceptance>;

export enum ProviderAcceptanceStatus {
  Active = 'ACTIVE',
  Revoked = 'REVOKED',
}

@Schema({
  collection: 'provider_contract_acceptances',
  timestamps: true,
  autoIndex: false,
})
export class ProviderContractAcceptance {
  @Prop({
    type: Types.ObjectId,
    ref: 'Provider',
    required: true,
    immutable: true,
  })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, immutable: true })
  acceptedByUserId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ContractScope),
    required: true,
    immutable: true,
  })
  scope: ContractScope;

  @Prop({ type: String, required: true, trim: true, immutable: true })
  mechanismVersion: string;

  @Prop({ type: String, required: true, trim: true, immutable: true })
  templateVersion: string;

  @Prop({
    type: String,
    required: true,
    immutable: true,
    match: /^[a-f0-9]{64}$/,
  })
  mechanismHash: string;

  @Prop({
    type: String,
    required: true,
    immutable: true,
    match: /^[a-f0-9]{64}$/,
  })
  policyFingerprint: string;

  @Prop({
    type: String,
    enum: Object.values(ProviderAcceptanceStatus),
    default: ProviderAcceptanceStatus.Active,
  })
  status: ProviderAcceptanceStatus;

  @Prop({ type: Date, required: true, immutable: true })
  acceptedAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;
}

export const ProviderContractAcceptanceSchema = SchemaFactory.createForClass(
  ProviderContractAcceptance,
);
ProviderContractAcceptanceSchema.index(
  { providerId: 1, scope: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ProviderAcceptanceStatus.Active },
    name: 'provider_active_contract_acceptance_unique',
  },
);
ProviderContractAcceptanceSchema.index({ providerId: 1, acceptedAt: -1 });
