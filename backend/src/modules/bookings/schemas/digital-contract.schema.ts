import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DigitalContractDocument = HydratedDocument<DigitalContract>;

export enum ContractStatus {
  Draft = 'DRAFT',
  Signed = 'SIGNED',
  Void = 'VOID',
}

export enum ContractScope {
  AoDaiRental = 'AO_DAI_RENTAL',
}

export enum ContractApprovalMode {
  AutoAcceptance = 'AUTO_ACCEPTANCE',
  ManualBilateral = 'MANUAL_BILATERAL',
}

export interface ContractPolicySnapshot {
  cancellationPolicy: string;
  refundPolicy: string;
  lateFeeRate: number; // e.g. percent per hour/day or fixed rate
  damagePolicy: string;
}

export interface ContractSignature {
  signedBy: Types.ObjectId;
  signedAt: Date;
  ipAddress?: string | null;
  signatureUrl?: string | null;
}

// Indexes for the v2 model are applied only by a reviewed migration. The
// existing bookingId_1 unique index must remain untouched during Phase 2.
@Schema({ collection: 'digital_contracts', timestamps: true, autoIndex: false })
export class DigitalContract {
  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  })
  bookingId: Types.ObjectId;

  // Null on historical contracts. New contracts must explicitly opt into v2.
  @Prop({ type: Number, enum: [1, 2], default: null })
  flowVersion?: 1 | 2 | null;

  @Prop({ type: String, enum: Object.values(ContractScope), default: null })
  scope?: ContractScope | null;

  @Prop({
    type: String,
    enum: Object.values(ContractApprovalMode),
    default: null,
  })
  approvalMode?: ContractApprovalMode | null;

  @Prop({ type: Types.ObjectId, ref: 'ContractVersion', default: null })
  currentVersionId?: Types.ObjectId | null;

  @Prop({ type: Number, min: 0, default: null })
  currentRevision?: number | null;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
  })
  contractCode: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  // Historical fields stay readable. V2 terms and evidence live in versions.
  @Prop({ type: String, trim: true, default: null })
  contractTerms?: string | null;

  @Prop({
    type: {
      cancellationPolicy: { type: String, required: true },
      refundPolicy: { type: String, required: true },
      lateFeeRate: { type: Number, required: true, min: 0 },
      damagePolicy: { type: String, required: true },
    },
    default: null,
  })
  policySnapshot?: ContractPolicySnapshot | null;

  @Prop({
    type: [
      {
        _id: false,
        signedBy: { type: Types.ObjectId, ref: 'User', required: true },
        signedAt: { type: Date, default: Date.now },
        ipAddress: { type: String, default: null },
        signatureUrl: { type: String, default: null },
      },
    ],
    default: [],
  })
  signatures: ContractSignature[];

  @Prop({
    type: String,
    enum: Object.values(ContractStatus),
    default: ContractStatus.Draft,
    index: true,
  })
  status: ContractStatus;
}

export const DigitalContractSchema =
  SchemaFactory.createForClass(DigitalContract);

// Declared for review and test only: autoIndex is disabled on this schema.
DigitalContractSchema.index(
  { bookingId: 1, providerId: 1, scope: 1 },
  { unique: true, name: 'booking_provider_scope_unique' },
);
DigitalContractSchema.path('scope').validate(function (
  this: DigitalContract,
  value: ContractScope | null,
) {
  return this.flowVersion !== 2 || value === ContractScope.AoDaiRental;
}, 'V2 contracts require an explicit rental scope');
DigitalContractSchema.path('approvalMode').validate(function (
  this: DigitalContract,
  value: ContractApprovalMode | null,
) {
  return this.flowVersion !== 2 || value != null;
}, 'V2 contracts require an approval mode');
