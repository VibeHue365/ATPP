export type ContractReadinessStatus =
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'AWAITING_CUSTOMER'
  | 'MISSING_CONTRACT'
  | 'MISSING_VERSION'
  | 'PROVIDER_ACCEPTANCE_MISSING'
  | 'STALE_SNAPSHOT'
  | 'SOURCE_NOT_READY';

export type ContractPresentationMode = 'QUICK' | 'DETAILED';

export interface ProviderReadinessEntry {
  providerId: string;
  contractId?: string;
  versionId?: string;
  version?: number;
  status: ContractReadinessStatus;
  presentationMode?: ContractPresentationMode;
}

export interface BookingReadinessResponse {
  requirement: 'REQUIRED' | 'NOT_REQUIRED';
  bookingId: string;
  providers: ProviderReadinessEntry[];
  blockers: string[];
  ready: boolean;
  presentationMode?: ContractPresentationMode;
  overallPresentationMode?: ContractPresentationMode;
  flow?: 'LEGACY' | 'CONTRACT_V2';
}

export interface ContractSummary {
  contractId: string;
  contractCode?: string | null;
  bookingId: string;
  providerId: string;
  providerName?: string | null;
  scope: string | null;
  legacyStatus: string;
  versionId: string | null;
  version: number | null;
  state: string | null;
  contentHash: string | null;
  bookingFingerprint: string | null;
  presentationMode?: ContractPresentationMode | null;
  riskTriggers?: string[] | null;
  appliedRule?: string | null;
  isSigned?: boolean;
  customerAcceptedAt?: string | null;
  hasPdf?: boolean;
  pdfStatus?: string;
}

export interface CustomerContractItem extends ContractSummary {
  bookingCode: string;
  bookingStatus: string;
  bookingCreatedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalAmount?: number;
  depositAmount?: number;
  bookingType?: string;
}

export interface ContractDetail extends ContractSummary {
  renderedText: string | null;
  versionState: string | null;
  expiresAt: string | null;
  snapshot?: any;
}

export interface ContractConsentPayload {
  contractVersionId: string;
  action: 'ACCEPT' | 'DECLINE';
  contentHash: string;
  bookingFingerprint: string;
  idempotencyKey: string;
}

export interface ContractConsentResponse {
  consentId: string;
  action: 'ACCEPT' | 'DECLINE';
  decidedAt: string;
  formedAt: string | null;
  effectiveAt: string | null;
  emailDelivery?: {
    status: 'SENT' | 'FAILED' | 'IN_PROGRESS';
    recipient: string;
    sentAt: string | null;
  } | null;
}

export interface ContractEligibilityItem {
  productId: string;
  providerId?: string;
}

export interface IneligibleItemDetail {
  productId: string;
  productName: string;
  providerId: string;
  providerName: string;
  reason: string;
  message: string;
}

export interface ContractEligibilityResponse {
  eligible: boolean;
  ineligibleItems: IneligibleItemDetail[];
  flow?: 'LEGACY' | 'CONTRACT_V2' | 'MIXED' | 'BLOCKED';
}

export interface ContractEvidenceSummary {
  contractId: string;
  contractCode: string;
  versionId: string;
  versionNumber: number;
  contentHash: string;
  bookingFingerprint: string;
  documentStatus: 'READY' | 'PENDING' | 'GENERATING' | 'FAILED';
  pdfSha256?: string | null;
  storageProvider?: string | null;
  storageKey?: string | null;
  generatedAt?: string | null;
  customerConsent?: {
    consentedAt: string;
    authMethod: string;
    userId: string;
  } | null;
  integrityVerified: boolean;
}

export type IncidentCompensationMethod =
  | 'FIXED_FEE'
  | 'PERCENTAGE_ON_ASSET'
  | 'ACTUAL_REPAIR_COST'
  | 'INCIDENT_NEGOTIATION';

export interface TierCompensationRule {
  method: IncidentCompensationMethod;
  fixedFeeAmount?: number | null;
  percentageOfAsset?: number | null;
  conditionsAndEvidence?: string | null;
}

export interface DamageCompensationPolicy {
  minorDamage?: TierCompensationRule | null;
  moderateDamage?: TierCompensationRule | null;
  severeDamage?: TierCompensationRule | null;
  totalLoss?: TierCompensationRule | null;
  incidentNotificationHours?: number | null;
  disputeResolutionTerms?: string | null;
  minorDamageFee?: number | null;
  moderateDamagePercent?: number | null;
  severeDamageOrLossPercent?: number | null;
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
  const emptyTier = (
    tier: ResolvedDamageTier['tier'],
  ): ResolvedDamageTier => ({
    tier,
    method: 'INCIDENT_NEGOTIATION',
    fixedFeeAmount: null,
    percentageOfAsset: null,
    conditionsAndEvidence: null,
  });

  if (!policy) {
    return {
      minorDamage: emptyTier('minorDamage'),
      moderateDamage: emptyTier('moderateDamage'),
      severeDamage: emptyTier('severeDamage'),
      totalLoss: emptyTier('totalLoss'),
      incidentNotificationHours: null,
      disputeResolutionTerms: null,
      isLegacyV1: false,
      requiresAssetValue: false,
    };
  }

  const hasV2 = Boolean(
    policy.minorDamage?.method ||
      policy.moderateDamage?.method ||
      policy.severeDamage?.method ||
      policy.totalLoss?.method,
  );

  if (hasV2) {
    const parseTier = (
      tier: ResolvedDamageTier['tier'],
      raw?: TierCompensationRule | null,
    ): ResolvedDamageTier => ({
      tier,
      method: raw?.method || 'INCIDENT_NEGOTIATION',
      fixedFeeAmount:
        typeof raw?.fixedFeeAmount === 'number' ? raw.fixedFeeAmount : null,
      percentageOfAsset:
        typeof raw?.percentageOfAsset === 'number' ? raw.percentageOfAsset : null,
      conditionsAndEvidence: raw?.conditionsAndEvidence?.trim() || null,
    });

    const minor = parseTier('minorDamage', policy.minorDamage);
    const moderate = parseTier('moderateDamage', policy.moderateDamage);
    const severe = parseTier('severeDamage', policy.severeDamage);
    const loss = parseTier('totalLoss', policy.totalLoss);
    const requiresAssetValue = [minor, moderate, severe, loss].some(
      (t) =>
        t.method === 'PERCENTAGE_ON_ASSET' &&
        typeof t.percentageOfAsset === 'number' &&
        t.percentageOfAsset > 0,
    );

    return {
      minorDamage: minor,
      moderateDamage: moderate,
      severeDamage: severe,
      totalLoss: loss,
      incidentNotificationHours:
        typeof policy.incidentNotificationHours === 'number'
          ? policy.incidentNotificationHours
          : null,
      disputeResolutionTerms: policy.disputeResolutionTerms?.trim() || null,
      isLegacyV1: false,
      requiresAssetValue,
    };
  }

  const legacyMinor =
    typeof policy.minorDamageFee === 'number' &&
    Number.isFinite(policy.minorDamageFee)
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

  return {
    minorDamage: {
      tier: 'minorDamage',
      method: legacyMinor !== null ? 'FIXED_FEE' : 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: legacyMinor,
      percentageOfAsset: null,
      conditionsAndEvidence: null,
    },
    moderateDamage: {
      tier: 'moderateDamage',
      method:
        legacyModeratePct !== null
          ? 'PERCENTAGE_ON_ASSET'
          : 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: legacyModeratePct,
      conditionsAndEvidence: null,
    },
    severeDamage: {
      tier: 'severeDamage',
      method:
        legacySeverePct !== null
          ? 'PERCENTAGE_ON_ASSET'
          : 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: legacySeverePct,
      conditionsAndEvidence: null,
    },
    totalLoss: {
      tier: 'totalLoss',
      method:
        legacySeverePct !== null
          ? 'PERCENTAGE_ON_ASSET'
          : 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: null,
      percentageOfAsset: legacySeverePct,
      conditionsAndEvidence: null,
    },
    incidentNotificationHours: null,
    disputeResolutionTerms: policy.disputeResolutionNotes?.trim() || null,
    isLegacyV1: true,
    requiresAssetValue:
      (legacyModeratePct ?? 0) > 0 || (legacySeverePct ?? 0) > 0,
  };
}

export type ProviderContractMode =
  | 'AUTO'
  | 'CUSTOM_ORDER_THRESHOLD'
  | 'ALWAYS_DETAILED';

export type ProviderPolicyReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export interface GarmentCarePolicy {
  allowIroning: boolean;
  allowWashing: boolean;
  prohibitedActions: string[];
  specialNotes?: string | null;
}

export interface LateReturnPolicy {
  gracePeriodHours: number;
  hourlyLateFee: number;
  dailyLateFee: number;
  maxLateDaysAllowed: number;
}

export interface CancellationRefundRule {
  daysBeforeRental: number;
  refundPercentage: number;
}

export interface CancellationPolicy {
  refundRules: CancellationRefundRule[];
  cancellationNotes?: string | null;
}

export interface ProviderSupportContact {
  hotline: string;
  supportWorkingHours: string;
  contactNote?: string | null;
}

export interface ProviderContractPolicyVersion {
  _id: string;
  providerId: string;
  versionNumber: number;
  status: ProviderPolicyReviewStatus;
  garmentCare: GarmentCarePolicy;
  lateReturn: LateReturnPolicy;
  damageCompensation: DamageCompensationPolicy;
  cancellationPolicy: CancellationPolicy;
  supportContact: ProviderSupportContact;
  customTermsText?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  approvedAt?: string | null;
  policyFingerprint?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrentPolicyResponse {
  providerId: string;
  active: ProviderContractPolicyVersion | null;
  pending: ProviderContractPolicyVersion | null;
  draft: ProviderContractPolicyVersion | null;
  totalVersions: number;
}

export interface SavePolicyPayload {
  garmentCare: GarmentCarePolicy;
  lateReturn: LateReturnPolicy;
  damageCompensation: DamageCompensationPolicy;
  cancellationPolicy: CancellationPolicy;
  supportContact: ProviderSupportContact;
  customTermsText?: string | null;
}

export interface ProviderMechanismResponse {
  version: string;
  status: 'DRAFT' | 'APPROVED';
  approvedAt: string | null;
  scope: string;
  description: string;
  regulationCode?: string;
  hash: string;
}

export interface ProviderAcceptanceStatusResponse {
  providerId: string;
  scope: string;
  status: 'ACTIVE' | 'REVOKED' | 'STALE' | 'NOT_ACCEPTED';
  isStale?: boolean;
  staleReason?: string | null;
  active: {
    id: string;
    mechanismVersion: string;
    templateVersion: string;
    acceptedAt: string;
    policyFingerprint?: string | null;
  } | null;
  revoked: {
    id: string;
    revokedAt: string;
  } | null;
}

export interface ProviderContractConfig {
  providerId: string;
  contractMode: ProviderContractMode;
  orderThresholdAmount: number | null;
  version: number;
  effectiveFrom: string;
  updatedByUserId?: string;
  isDefault?: boolean;
}

export interface UpdateProviderContractConfigPayload {
  contractMode: ProviderContractMode;
  orderThresholdAmount?: number | null;
  changeNote?: string | null;
}
