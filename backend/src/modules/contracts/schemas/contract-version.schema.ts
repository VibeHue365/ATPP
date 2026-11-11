import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ContractVersionDocument = HydratedDocument<ContractVersion>;

export enum ContractVersionState {
  Draft = 'DRAFT',
  PendingProvider = 'PENDING_PROVIDER',
  Offered = 'OFFERED',
  Accepted = 'ACCEPTED',
  Effective = 'EFFECTIVE',
  Superseded = 'SUPERSEDED',
  Declined = 'DECLINED',
  Expired = 'EXPIRED',
  Terminated = 'TERMINATED',
}

export enum ContractDocumentStatus {
  Pending = 'PENDING',
  Generating = 'GENERATING',
  Ready = 'READY',
  Failed = 'FAILED',
}

/** The snapshot is completed and validated by the Phase 3 server-side builder. */
export interface ContractVersionSnapshot {
  bookingId: string;
  customerId: string;
  providerId: string;
  bookingType: 'AODAI_RENTAL' | 'COMBO';
  bookingItemIds: string[];
  booking: Record<string, unknown>;
  customer: Record<string, unknown>;
  provider: Record<string, unknown>;
  providerItems: Record<string, unknown>[];
  pricing: Record<string, unknown>;
  policies: Record<string, unknown>;
  template: Record<string, unknown>;
}

export interface ContractDocumentMetadata {
  status: ContractDocumentStatus;
  storageProvider?: string | null;
  bucket?: string | null;
  storageKey?: string | null;
  sha256?: string | null;
  generatedAt?: Date | null;
  retryCount: number;
  lastError?: string | null;
  claimToken?: string | null;
  leaseExpiresAt?: Date | null;
}

export function isContractVersionSnapshot(
  value: unknown,
): value is ContractVersionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    ['bookingId', 'customerId', 'providerId'].every(
      (key) => typeof snapshot[key] === 'string' && !!snapshot[key],
    ) &&
    (snapshot.bookingType === 'AODAI_RENTAL' ||
      snapshot.bookingType === 'COMBO') &&
    Array.isArray(snapshot.bookingItemIds) &&
    snapshot.bookingItemIds.length > 0 &&
    snapshot.bookingItemIds.every(
      (itemId) => typeof itemId === 'string' && !!itemId,
    ) &&
    new Set(snapshot.bookingItemIds).size === snapshot.bookingItemIds.length &&
    Array.isArray(snapshot.providerItems) &&
    snapshot.providerItems.length > 0 &&
    [
      'booking',
      'customer',
      'provider',
      'pricing',
      'policies',
      'template',
    ].every(
      (key) =>
        !!snapshot[key] &&
        typeof snapshot[key] === 'object' &&
        !Array.isArray(snapshot[key]),
    )
  );
}

@Schema({
  collection: 'contract_versions',
  timestamps: true,
  autoIndex: false,
  optimisticConcurrency: true,
})
export class ContractVersion {
  @Prop({
    type: Types.ObjectId,
    ref: 'DigitalContract',
    required: true,
    immutable: true,
  })
  contractId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    immutable: true,
    validate: Number.isInteger,
  })
  version: number;

  @Prop({ type: String, required: true, trim: true, immutable: true })
  templateVersion: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'ProviderContractAcceptance',
    default: null,
    immutable: true,
  })
  providerAcceptanceId?: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    immutable: true,
    validate: isContractVersionSnapshot,
  })
  snapshot: ContractVersionSnapshot;

  /** Exact text accepted for this version, retained even if templates change. */
  @Prop({ type: String, required: true, immutable: true })
  renderedText: string;

  @Prop({
    type: String,
    required: true,
    immutable: true,
    match: /^[a-f0-9]{64}$/,
  })
  contentHash: string;

  @Prop({
    type: String,
    required: true,
    immutable: true,
    match: /^[a-f0-9]{64}$/,
  })
  bookingFingerprint: string;

  @Prop({
    type: String,
    enum: Object.values(ContractVersionState),
    default: ContractVersionState.Draft,
  })
  state: ContractVersionState;

  @Prop({
    type: String,
    enum: ['QUICK', 'DETAILED'],
    default: 'DETAILED',
    immutable: true,
  })
  presentationMode: 'QUICK' | 'DETAILED';

  @Prop({ type: Number, default: null, min: 1, immutable: true })
  configVersion?: number | null;

  @Prop({ type: String, default: null, trim: true, immutable: true })
  riskRulesVersion?: string | null;

  @Prop({ type: [String], default: [], immutable: true })
  riskTriggers: string[];

  @Prop({ type: String, default: null, trim: true, immutable: true })
  appliedRule?: string | null;

  @Prop({ type: Date, default: null })
  offeredAt?: Date | null;

  @Prop({ type: Date, default: null })
  customerAcceptedAt?: Date | null;

  @Prop({ type: Date, default: null })
  formedAt?: Date | null;

  @Prop({ type: Date, default: null })
  effectiveAt?: Date | null;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({
    type: {
      status: {
        type: String,
        enum: Object.values(ContractDocumentStatus),
        default: ContractDocumentStatus.Pending,
      },
      storageProvider: { type: String, default: null },
      bucket: { type: String, default: null },
      storageKey: { type: String, default: null },
      sha256: { type: String, default: null, match: /^[a-f0-9]{64}$/ },
      generatedAt: { type: Date, default: null },
      retryCount: { type: Number, default: 0, min: 0 },
      lastError: { type: String, default: null },
      claimToken: { type: String, default: null },
      leaseExpiresAt: { type: Date, default: null },
    },
    default: () => ({ status: ContractDocumentStatus.Pending, retryCount: 0 }),
  })
  document: ContractDocumentMetadata;
}

export const ContractVersionSchema =
  SchemaFactory.createForClass(ContractVersion);
ContractVersionSchema.index(
  { contractId: 1, version: 1 },
  { unique: true, name: 'contract_version_unique' },
);
ContractVersionSchema.index({ contractId: 1, state: 1 });
