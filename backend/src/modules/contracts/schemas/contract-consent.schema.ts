import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractConsentDocument = HydratedDocument<ContractConsent>;

export enum ContractConsentAction {
  Accept = 'ACCEPT',
  Decline = 'DECLINE',
}

export enum ContractConsentRole {
  Customer = 'CUSTOMER',
  Provider = 'PROVIDER',
}

export enum ContractEmailDeliveryStatus {
  Pending = 'PENDING',
  Sending = 'SENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
}

export interface ContractEmailDeliveryMetadata {
  status: ContractEmailDeliveryStatus;
  recipient?: string | null;
  sentAt?: Date | null;
  lastAttemptAt?: Date | null;
  lastError?: string | null;
  claimToken?: string | null;
  leaseExpiresAt?: Date | null;
}

@Schema({ collection: 'contract_consents', timestamps: true, autoIndex: false })
export class ContractConsent {
  @Prop({
    type: Types.ObjectId,
    ref: 'DigitalContract',
    required: true,
    immutable: true,
  })
  contractId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ContractVersion',
    required: true,
    immutable: true,
  })
  contractVersionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, immutable: true })
  actorUserId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ContractConsentRole),
    required: true,
    immutable: true,
  })
  actorRole: ContractConsentRole;

  @Prop({
    type: String,
    enum: Object.values(ContractConsentAction),
    required: true,
    immutable: true,
  })
  action: ContractConsentAction;

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

  @Prop({ type: String, required: true, immutable: true, maxlength: 160 })
  idempotencyKey: string;

  @Prop({ type: Date, required: true, immutable: true })
  occurredAt: Date;

  @Prop({
    type: String,
    enum: ['APP_SESSION'],
    required: true,
    immutable: true,
  })
  authenticationMethod: 'APP_SESSION';

  @Prop({ type: String, default: null, immutable: true })
  ipAddress?: string | null;

  @Prop({ type: String, default: null, immutable: true })
  userAgent?: string | null;

  @Prop({
    type: String,
    enum: ['QUICK', 'DETAILED'],
    default: 'DETAILED',
    immutable: true,
  })
  presentationMode: 'QUICK' | 'DETAILED';

  @Prop({
    type: {
      status: {
        type: String,
        enum: Object.values(ContractEmailDeliveryStatus),
        default: ContractEmailDeliveryStatus.Pending,
      },
      recipient: { type: String, default: null },
      sentAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
      lastError: { type: String, default: null },
      claimToken: { type: String, default: null },
      leaseExpiresAt: { type: Date, default: null },
    },
    default: () => ({ status: ContractEmailDeliveryStatus.Pending }),
  })
  emailDelivery: ContractEmailDeliveryMetadata;
}

export const ContractConsentSchema =
  SchemaFactory.createForClass(ContractConsent);
ContractConsentSchema.index(
  { contractVersionId: 1, actorUserId: 1 },
  { unique: true, name: 'contract_consent_actor_version_unique' },
);
ContractConsentSchema.index(
  { actorUserId: 1, idempotencyKey: 1 },
  { unique: true, name: 'contract_consent_idempotency_unique' },
);
