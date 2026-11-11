import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderContractPolicyVersionDocument =
  HydratedDocument<ProviderContractPolicyVersion>;

export enum ProviderPolicyReviewStatus {
  Draft = 'DRAFT',
  PendingReview = 'PENDING_REVIEW',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Superseded = 'SUPERSEDED',
}

@Schema({ _id: false })
export class GarmentCareRules {
  @Prop({ type: Boolean, default: false })
  allowIroning: boolean;

  @Prop({ type: Boolean, default: false })
  allowWashing: boolean;

  @Prop({ type: [String], default: [] })
  prohibitedActions: string[];

  @Prop({ type: String, default: null, trim: true })
  specialNotes?: string | null;
}

@Schema({ _id: false })
export class LateReturnPolicy {
  @Prop({ type: Number, default: 2, min: 0 })
  gracePeriodHours: number;

  @Prop({ type: Number, default: 30000, min: 0 })
  hourlyLateFee: number;

  @Prop({ type: Number, default: 150000, min: 0 })
  dailyLateFee: number;

  @Prop({ type: Number, default: 3, min: 1 })
  maxLateDaysAllowed: number;
}

export enum IncidentCompensationMethod {
  FIXED_FEE = 'FIXED_FEE',
  PERCENTAGE_ON_ASSET = 'PERCENTAGE_ON_ASSET',
  ACTUAL_REPAIR_COST = 'ACTUAL_REPAIR_COST',
  INCIDENT_NEGOTIATION = 'INCIDENT_NEGOTIATION',
}

export enum IncidentTierKey {
  MINOR_DAMAGE = 'minorDamage',
  MODERATE_DAMAGE = 'moderateDamage',
  SEVERE_DAMAGE = 'severeDamage',
  TOTAL_LOSS = 'totalLoss',
}

@Schema({ _id: false })
export class TierCompensationRule {
  @Prop({
    type: String,
    enum: Object.values(IncidentCompensationMethod),
    required: true,
  })
  method: IncidentCompensationMethod;

  @Prop({ type: Number, default: null, min: 0 })
  fixedFeeAmount?: number | null;

  @Prop({ type: Number, default: null, min: 1, max: 100 })
  percentageOfAsset?: number | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  conditionsAndEvidence?: string | null;

  @Prop({
    type: String,
    enum: Object.values(IncidentTierKey),
    default: null,
  })
  tier?: IncidentTierKey | null;
}

@Schema({ _id: false })
export class DamageCompensationPolicy {
  // V2: 4 independent tiers of damage and loss
  @Prop({ type: TierCompensationRule, default: null })
  minorDamage?: TierCompensationRule | null;

  @Prop({ type: TierCompensationRule, default: null })
  moderateDamage?: TierCompensationRule | null;

  @Prop({ type: TierCompensationRule, default: null })
  severeDamage?: TierCompensationRule | null;

  @Prop({ type: TierCompensationRule, default: null })
  totalLoss?: TierCompensationRule | null;

  // Timeframe established by Provider for reporting incidents upon return (hours, e.g. 24, 48)
  @Prop({ type: Number, default: null, min: 1 })
  incidentNotificationHours?: number | null;

  // Dispute resolution & mediation terms
  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  disputeResolutionTerms?: string | null;

  // Legacy V1 fields preserved for 100% backward compatibility
  @Prop({ type: Number, default: null, min: 0 })
  minorDamageFee?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 100 })
  moderateDamagePercent?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 100 })
  severeDamageOrLossPercent?: number | null;

  @Prop({ type: String, default: null, trim: true })
  disputeResolutionNotes?: string | null;
}

export interface ResolvedDamageTier {
  tier: 'minorDamage' | 'moderateDamage' | 'severeDamage' | 'totalLoss';
  method: IncidentCompensationMethod;
  fixedFeeAmount: number | null;
  percentageOfAsset: number | null;
  conditionsAndEvidence: string | null;
}

export interface ResolvedDamageCompensation {
  minorDamage: ResolvedDamageTier;
  moderateDamage: ResolvedDamageTier;
  severeDamage: ResolvedDamageTier;
  totalLoss: ResolvedDamageTier;
  incidentNotificationHours: number | null;
  disputeResolutionTerms: string | null;
  isLegacyV1: boolean;
  requiresAssetValue: boolean;
}

export function resolveDamageCompensationRules(
  policy?: DamageCompensationPolicy | null,
): ResolvedDamageCompensation {
  if (!policy) {
    return {
      minorDamage: { tier: 'minorDamage', method: IncidentCompensationMethod.INCIDENT_NEGOTIATION, fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      moderateDamage: { tier: 'moderateDamage', method: IncidentCompensationMethod.INCIDENT_NEGOTIATION, fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      severeDamage: { tier: 'severeDamage', method: IncidentCompensationMethod.INCIDENT_NEGOTIATION, fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      totalLoss: { tier: 'totalLoss', method: IncidentCompensationMethod.INCIDENT_NEGOTIATION, fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      incidentNotificationHours: null,
      disputeResolutionTerms: null,
      isLegacyV1: false,
      requiresAssetValue: false,
    };
  }

  const hasV2Tiers = Boolean(
    policy.minorDamage?.method ||
    policy.moderateDamage?.method ||
    policy.severeDamage?.method ||
    policy.totalLoss?.method,
  );

  if (hasV2Tiers) {
    const minor: ResolvedDamageTier = {
      tier: 'minorDamage',
      method: policy.minorDamage?.method || IncidentCompensationMethod.INCIDENT_NEGOTIATION,
      fixedFeeAmount: typeof policy.minorDamage?.fixedFeeAmount === 'number' ? policy.minorDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.minorDamage?.percentageOfAsset === 'number' ? policy.minorDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.minorDamage?.conditionsAndEvidence?.trim() || null,
    };

    const moderate: ResolvedDamageTier = {
      tier: 'moderateDamage',
      method: policy.moderateDamage?.method || IncidentCompensationMethod.INCIDENT_NEGOTIATION,
      fixedFeeAmount: typeof policy.moderateDamage?.fixedFeeAmount === 'number' ? policy.moderateDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.moderateDamage?.percentageOfAsset === 'number' ? policy.moderateDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.moderateDamage?.conditionsAndEvidence?.trim() || null,
    };

    const severe: ResolvedDamageTier = {
      tier: 'severeDamage',
      method: policy.severeDamage?.method || IncidentCompensationMethod.INCIDENT_NEGOTIATION,
      fixedFeeAmount: typeof policy.severeDamage?.fixedFeeAmount === 'number' ? policy.severeDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.severeDamage?.percentageOfAsset === 'number' ? policy.severeDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.severeDamage?.conditionsAndEvidence?.trim() || null,
    };

    const loss: ResolvedDamageTier = {
      tier: 'totalLoss',
      method: policy.totalLoss?.method || IncidentCompensationMethod.INCIDENT_NEGOTIATION,
      fixedFeeAmount: typeof policy.totalLoss?.fixedFeeAmount === 'number' ? policy.totalLoss.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.totalLoss?.percentageOfAsset === 'number' ? policy.totalLoss.percentageOfAsset : null,
      conditionsAndEvidence: policy.totalLoss?.conditionsAndEvidence?.trim() || null,
    };

    const requiresAssetValue = [minor, moderate, severe, loss].some(
      (t) =>
        t.method === IncidentCompensationMethod.PERCENTAGE_ON_ASSET &&
        typeof t.percentageOfAsset === 'number' &&
        t.percentageOfAsset > 0,
    );

    return {
      minorDamage: minor,
      moderateDamage: moderate,
      severeDamage: severe,
      totalLoss: loss,
      incidentNotificationHours: typeof policy.incidentNotificationHours === 'number' ? policy.incidentNotificationHours : null,
      disputeResolutionTerms: policy.disputeResolutionTerms?.trim() || null,
      isLegacyV1: false,
      requiresAssetValue,
    };
  }

  // Legacy V1 interpretation: strictly preserve what was actually approved
  // No synthetic 50,000đ, 20%, or 100% injected if missing
  const legacyMinorFee =
    typeof policy.minorDamageFee === 'number' && Number.isFinite(policy.minorDamageFee)
      ? policy.minorDamageFee
      : null;
  const legacyModeratePct =
    typeof policy.moderateDamagePercent === 'number' &&
    Number.isFinite(policy.moderateDamagePercent) &&
    policy.moderateDamagePercent > 0
      ? policy.moderateDamagePercent
      : null;
  const legacySeverePct =
    typeof policy.severeDamageOrLossPercent === 'number' &&
    Number.isFinite(policy.severeDamageOrLossPercent) &&
    policy.severeDamageOrLossPercent > 0
      ? policy.severeDamageOrLossPercent
      : null;

  const minor: ResolvedDamageTier = {
    tier: 'minorDamage',
    method: legacyMinorFee !== null ? IncidentCompensationMethod.FIXED_FEE : IncidentCompensationMethod.INCIDENT_NEGOTIATION,
    fixedFeeAmount: legacyMinorFee,
    percentageOfAsset: null,
    conditionsAndEvidence: null,
  };

  const moderate: ResolvedDamageTier = {
    tier: 'moderateDamage',
    method: legacyModeratePct !== null ? IncidentCompensationMethod.PERCENTAGE_ON_ASSET : IncidentCompensationMethod.INCIDENT_NEGOTIATION,
    fixedFeeAmount: null,
    percentageOfAsset: legacyModeratePct,
    conditionsAndEvidence: null,
  };

  const severe: ResolvedDamageTier = {
    tier: 'severeDamage',
    method: legacySeverePct !== null ? IncidentCompensationMethod.PERCENTAGE_ON_ASSET : IncidentCompensationMethod.INCIDENT_NEGOTIATION,
    fixedFeeAmount: null,
    percentageOfAsset: legacySeverePct,
    conditionsAndEvidence: null,
  };

  const loss: ResolvedDamageTier = {
    tier: 'totalLoss',
    method: legacySeverePct !== null ? IncidentCompensationMethod.PERCENTAGE_ON_ASSET : IncidentCompensationMethod.INCIDENT_NEGOTIATION,
    fixedFeeAmount: null,
    percentageOfAsset: legacySeverePct,
    conditionsAndEvidence: null,
  };

  const requiresAssetValue = [moderate, severe, loss].some(
    (t) =>
      t.method === IncidentCompensationMethod.PERCENTAGE_ON_ASSET &&
      typeof t.percentageOfAsset === 'number' &&
      t.percentageOfAsset > 0,
  );

  return {
    minorDamage: minor,
    moderateDamage: moderate,
    severeDamage: severe,
    totalLoss: loss,
    incidentNotificationHours: null,
    disputeResolutionTerms: policy.disputeResolutionNotes?.trim() || null,
    isLegacyV1: true,
    requiresAssetValue,
  };
}

@Schema({ _id: false })
export class CancellationRefundRule {
  @Prop({ type: Number, required: true, min: 0 })
  daysBeforeRental: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  refundPercentage: number;
}

@Schema({ _id: false })
export class CancellationPolicy {
  @Prop({
    type: [
      {
        daysBeforeRental: { type: Number, required: true },
        refundPercentage: { type: Number, required: true },
      },
    ],
    default: [
      { daysBeforeRental: 3, refundPercentage: 100 },
      { daysBeforeRental: 1, refundPercentage: 50 },
      { daysBeforeRental: 0, refundPercentage: 0 },
    ],
  })
  refundRules: CancellationRefundRule[];

  @Prop({
    type: String,
    default: 'Tiền cọc luôn được hoàn 100% nếu hủy trước khi nhận đồ. Phí hủy chỉ tính trên tiền thuê.',
    trim: true,
  })
  cancellationNotes?: string | null;
}

@Schema({ _id: false })
export class ProviderSupportContact {
  @Prop({ type: String, required: true, trim: true })
  hotline: string;

  @Prop({ type: String, default: '08:00 - 21:00', trim: true })
  supportWorkingHours: string;

  @Prop({ type: String, default: null, trim: true })
  contactNote?: string | null;
}

@Schema({
  collection: 'provider_contract_policies',
  timestamps: true,
  autoIndex: false,
})
export class ProviderContractPolicyVersion {
  @Prop({
    type: Types.ObjectId,
    ref: 'Provider',
    required: true,
    immutable: true,
    index: true,
  })
  providerId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  versionNumber: number;

  @Prop({
    type: String,
    enum: Object.values(ProviderPolicyReviewStatus),
    default: ProviderPolicyReviewStatus.Draft,
    index: true,
  })
  status: ProviderPolicyReviewStatus;

  @Prop({ type: GarmentCareRules, required: true })
  garmentCare: GarmentCareRules;

  @Prop({ type: LateReturnPolicy, required: true })
  lateReturn: LateReturnPolicy;

  @Prop({ type: DamageCompensationPolicy, required: true })
  damageCompensation: DamageCompensationPolicy;

  @Prop({ type: CancellationPolicy, required: true })
  cancellationPolicy: CancellationPolicy;

  @Prop({ type: ProviderSupportContact, required: true })
  supportContact: ProviderSupportContact;

  @Prop({ type: String, default: null, maxlength: 1000, trim: true })
  customTermsText?: string | null;

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedByUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  reviewNote?: string | null;

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  @Prop({ type: String, default: null, match: /^[a-f0-9]{64}$/ })
  policyFingerprint?: string | null;

  @Prop({ type: Boolean, default: false })
  businessApprovalRequired: boolean;
}

export const ProviderContractPolicyVersionSchema =
  SchemaFactory.createForClass(ProviderContractPolicyVersion);

// Indexes
ProviderContractPolicyVersionSchema.index(
  { providerId: 1, versionNumber: -1 },
  { unique: true },
);
ProviderContractPolicyVersionSchema.index(
  { providerId: 1, status: 1 },
);
