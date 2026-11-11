import { httpClient } from './httpClient';
import { API_BASE_URL } from '../config/env';
import { tokenStorage } from './tokenStorage';

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
export type ProviderContractMode = 'AUTO' | 'CUSTOM_ORDER_THRESHOLD' | 'ALWAYS_DETAILED';

export interface ProviderContractConfig {
  _id?: string;
  providerId: string;
  contractMode: ProviderContractMode;
  orderThresholdAmount?: number | null;
  version: number;
  effectiveFrom: string;
  updatedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProviderContractConfigDto {
  contractMode: ProviderContractMode;
  orderThresholdAmount?: number | null;
}

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

export interface ContractConsentResponse {
  consentId: string;
  action: 'ACCEPT' | 'DECLINE';
  decidedAt: string;
  formedAt: string | null;
  effectiveAt: string | null;
}

export interface ProviderMechanismResponse {
  version: string;
  hash: string;
  status: 'DRAFT' | 'APPROVED' | string;
  regulationCode?: string;
  title?: string;
  description?: string;
  approvedAt?: string | null;
  scope?: string;
}

export interface ProviderAcceptanceStatusResponse {
  providerId: string;
  scope: string;
  status?: 'ACTIVE' | 'REVOKED' | 'STALE' | 'NOT_ACCEPTED';
  isStale?: boolean;
  staleReason?: string | null;
  active: {
    id: string;
    mechanismVersion: string;
    templateVersion: string;
    acceptedAt: string;
    policyFingerprint?: string;
  } | null;
  revoked?: {
    id: string;
    revokedAt?: string;
  } | null;
}

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
  // V2 fields:
  minorDamage?: TierCompensationRule | null;
  moderateDamage?: TierCompensationRule | null;
  severeDamage?: TierCompensationRule | null;
  totalLoss?: TierCompensationRule | null;
  incidentNotificationHours?: number | null;
  disputeResolutionTerms?: string | null;

  // Legacy V1 fields:
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
  if (!policy) {
    return {
      minorDamage: { tier: 'minorDamage', method: 'INCIDENT_NEGOTIATION', fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      moderateDamage: { tier: 'moderateDamage', method: 'INCIDENT_NEGOTIATION', fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      severeDamage: { tier: 'severeDamage', method: 'INCIDENT_NEGOTIATION', fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
      totalLoss: { tier: 'totalLoss', method: 'INCIDENT_NEGOTIATION', fixedFeeAmount: null, percentageOfAsset: null, conditionsAndEvidence: null },
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
      method: policy.minorDamage?.method || 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: typeof policy.minorDamage?.fixedFeeAmount === 'number' ? policy.minorDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.minorDamage?.percentageOfAsset === 'number' ? policy.minorDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.minorDamage?.conditionsAndEvidence?.trim() || null,
    };

    const moderate: ResolvedDamageTier = {
      tier: 'moderateDamage',
      method: policy.moderateDamage?.method || 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: typeof policy.moderateDamage?.fixedFeeAmount === 'number' ? policy.moderateDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.moderateDamage?.percentageOfAsset === 'number' ? policy.moderateDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.moderateDamage?.conditionsAndEvidence?.trim() || null,
    };

    const severe: ResolvedDamageTier = {
      tier: 'severeDamage',
      method: policy.severeDamage?.method || 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: typeof policy.severeDamage?.fixedFeeAmount === 'number' ? policy.severeDamage.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.severeDamage?.percentageOfAsset === 'number' ? policy.severeDamage.percentageOfAsset : null,
      conditionsAndEvidence: policy.severeDamage?.conditionsAndEvidence?.trim() || null,
    };

    const loss: ResolvedDamageTier = {
      tier: 'totalLoss',
      method: policy.totalLoss?.method || 'INCIDENT_NEGOTIATION',
      fixedFeeAmount: typeof policy.totalLoss?.fixedFeeAmount === 'number' ? policy.totalLoss.fixedFeeAmount : null,
      percentageOfAsset: typeof policy.totalLoss?.percentageOfAsset === 'number' ? policy.totalLoss.percentageOfAsset : null,
      conditionsAndEvidence: policy.totalLoss?.conditionsAndEvidence?.trim() || null,
    };

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
      incidentNotificationHours: typeof policy.incidentNotificationHours === 'number' ? policy.incidentNotificationHours : null,
      disputeResolutionTerms: policy.disputeResolutionTerms?.trim() || null,
      isLegacyV1: false,
      requiresAssetValue,
    };
  }

  // Legacy V1 interpretation: strictly preserve what was actually approved
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
    method: legacyMinorFee !== null ? 'FIXED_FEE' : 'INCIDENT_NEGOTIATION',
    fixedFeeAmount: legacyMinorFee,
    percentageOfAsset: null,
    conditionsAndEvidence: null,
  };

  const moderate: ResolvedDamageTier = {
    tier: 'moderateDamage',
    method: legacyModeratePct !== null ? 'PERCENTAGE_ON_ASSET' : 'INCIDENT_NEGOTIATION',
    fixedFeeAmount: null,
    percentageOfAsset: legacyModeratePct,
    conditionsAndEvidence: null,
  };

  const severe: ResolvedDamageTier = {
    tier: 'severeDamage',
    method: legacySeverePct !== null ? 'PERCENTAGE_ON_ASSET' : 'INCIDENT_NEGOTIATION',
    fixedFeeAmount: null,
    percentageOfAsset: legacySeverePct,
    conditionsAndEvidence: null,
  };

  const loss: ResolvedDamageTier = {
    tier: 'totalLoss',
    method: legacySeverePct !== null ? 'PERCENTAGE_ON_ASSET' : 'INCIDENT_NEGOTIATION',
    fixedFeeAmount: null,
    percentageOfAsset: legacySeverePct,
    conditionsAndEvidence: null,
  };

  const requiresAssetValue = [moderate, severe, loss].some(
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
    incidentNotificationHours: null,
    disputeResolutionTerms: policy.disputeResolutionNotes?.trim() || null,
    isLegacyV1: true,
    requiresAssetValue,
  };
}

export function sanitizePolicyPayload(payload: SavePolicyPayload): SavePolicyPayload {
  const cleanTier = (rule?: TierCompensationRule | null): TierCompensationRule | null => {
    if (!rule) return null;
    return {
      method: rule.method,
      fixedFeeAmount: typeof rule.fixedFeeAmount === 'number' ? rule.fixedFeeAmount : null,
      percentageOfAsset: typeof rule.percentageOfAsset === 'number' ? rule.percentageOfAsset : null,
      conditionsAndEvidence: rule.conditionsAndEvidence?.trim() || null,
    };
  };

  return {
    ...payload,
    damageCompensation: {
      ...payload.damageCompensation,
      minorDamage: cleanTier(payload.damageCompensation?.minorDamage),
      moderateDamage: cleanTier(payload.damageCompensation?.moderateDamage),
      severeDamage: cleanTier(payload.damageCompensation?.severeDamage),
      totalLoss: cleanTier(payload.damageCompensation?.totalLoss),
    },
  };
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
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
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
  createdAt: string;
  updatedAt: string;
}

export interface CurrentPolicyResponse {
  providerId: string;
  active: ProviderContractPolicyVersion | null;
  pending: ProviderContractPolicyVersion | null;
  draft: ProviderContractPolicyVersion | null;
  totalVersions: number;
}

export interface AdminPendingPolicyItem extends ProviderContractPolicyVersion {
  id: string;
  providerInfo: {
    id: string;
    shopName: string;
    email: string | null;
    phone: string | null;
  };
}

export interface AdminPolicyDetailResponse {
  current: AdminPendingPolicyItem;
  activeApproved: ProviderContractPolicyVersion | null;
  history: Array<{
    id: string;
    versionNumber: number;
    status: string;
    submittedAt?: string;
    approvedAt?: string;
    reviewedAt?: string;
    reviewNote?: string;
  }>;
  providerInfo: {
    id: string;
    shopName: string;
    email: string | null;
    phone: string | null;
  };
}

export type SavePolicyPayload = Omit<
  ProviderContractPolicyVersion,
  | '_id'
  | 'providerId'
  | 'versionNumber'
  | 'status'
  | 'submittedAt'
  | 'reviewedAt'
  | 'reviewNote'
  | 'approvedAt'
  | 'policyFingerprint'
  | 'createdAt'
  | 'updatedAt'
>;

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

export const contractService = {
  /**
   * Evaluates readiness for a booking under Contracts V2.
   * Returns whether contracts are required and whether all required contracts have been ACCEPTED.
   */
  async getBookingReadiness(bookingId: string): Promise<BookingReadinessResponse> {
    return httpClient.get<BookingReadinessResponse>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}/readiness`,
    );
  },

  /**
   * Refreshes / prepares a new contract version for an active booking in PENDING_PAYMENT.
   * Preserves previous versions & consent history, blocks payments on stale versions.
   */
  async refreshContracts(bookingId: string): Promise<BookingReadinessResponse> {
    return httpClient.post<BookingReadinessResponse>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}/refresh-contracts`,
    );
  },

  /**
   * Performs early contract eligibility check before booking creation/hold.
   * Ensures products meet all contract guardrails (e.g., approved replacementValue).
   */
  async checkEligibility(
    items: ContractEligibilityItem[],
  ): Promise<ContractEligibilityResponse> {
    return httpClient.post<ContractEligibilityResponse>(
      '/api/contracts/eligibility/check',
      { items },
    );
  },

  /**
   * Lists contracts associated with a booking.
   */
  async listContractsForBooking(bookingId: string): Promise<ContractSummary[]> {
    return httpClient.get<ContractSummary[]>(
      `/api/contracts/bookings/${encodeURIComponent(bookingId)}`,
    );
  },

  /**
   * Retrieves full details and rendered text for a specific contract.
   */
  async getContractDetail(contractId: string): Promise<ContractDetail> {
    return httpClient.get<ContractDetail>(
      `/api/contracts/${encodeURIComponent(contractId)}`,
    );
  },

  /**
   * Submits customer consent (ACCEPT or DECLINE) for a contract version.
   * Note: The client must pass the exact hashes delivered by the backend.
   */
  async submitConsent(
    contractId: string,
    payload: ContractConsentPayload,
  ): Promise<ContractConsentResponse> {
    return httpClient.post<ContractConsentResponse>(
      `/api/contracts/${encodeURIComponent(contractId)}/consents`,
      payload,
    );
  },

  /**
   * Retrieves provider auto-acceptance mechanism information (read-only draft).
   */
  async getProviderMechanism(): Promise<ProviderMechanismResponse> {
    return httpClient.get<ProviderMechanismResponse>(
      '/api/contracts/provider/mechanism',
    );
  },

  /**
   * Retrieves active auto-acceptance status for the authenticated provider.
   */
  async getProviderAcceptanceStatus(): Promise<ProviderAcceptanceStatusResponse> {
    return httpClient.get<ProviderAcceptanceStatusResponse>(
      '/api/contracts/provider/acceptance',
    );
  },

  /**
   * Submits provider acceptance for an approved mechanism.
   * Sends the exact mechanismHash viewed by the provider.
   */
  async acceptProviderMechanism(
    mechanismHash: string,
  ): Promise<{ acceptanceId: string; reused: boolean }> {
    return httpClient.post<{ acceptanceId: string; reused: boolean }>(
      '/api/contracts/provider/acceptance',
      { mechanismHash },
    );
  },

  /**
   * Revokes existing active auto-acceptance for the authenticated provider.
   */
  async revokeProviderAcceptance(): Promise<{
    revoked: boolean;
    alreadyRevoked: boolean;
  }> {
    return httpClient.post<{
      revoked: boolean;
      alreadyRevoked: boolean;
    }>('/api/contracts/provider/acceptance/revoke', {});
  },

  /**
   * Retrieves the current policy state for the authenticated provider.
   */
  async getProviderCurrentPolicy(): Promise<CurrentPolicyResponse> {
    return httpClient.get<CurrentPolicyResponse>(
      '/api/contracts/provider/policy/current',
    );
  },

  /**
   * Lists all historical policy versions for the authenticated provider.
   */
  async getProviderPolicyVersions(): Promise<ProviderContractPolicyVersion[]> {
    return httpClient.get<ProviderContractPolicyVersion[]>(
      '/api/contracts/provider/policy/versions',
    );
  },

  /**
   * (Public) Retrieves active approved contract policy for a provider.
   */
  async getPublicProviderApprovedPolicy(
    providerId: string,
  ): Promise<ProviderContractPolicyVersion | null> {
    try {
      return await httpClient.get<ProviderContractPolicyVersion | null>(
        `/api/contracts/public/provider/${encodeURIComponent(providerId)}/active-policy`,
      );
    } catch {
      return null;
    }
  },

  /**
   * Saves a draft policy version.
   */
  async saveProviderPolicyDraft(
    payload: SavePolicyPayload,
  ): Promise<ProviderContractPolicyVersion> {
    const sanitized = sanitizePolicyPayload(payload);
    return httpClient.post<ProviderContractPolicyVersion>(
      '/api/contracts/provider/policy/draft',
      sanitized,
    );
  },

  /**
   * Submits a policy version for platform admin review.
   */
  async submitProviderPolicyForReview(
    payload?: SavePolicyPayload,
  ): Promise<ProviderContractPolicyVersion> {
    const sanitized = payload ? sanitizePolicyPayload(payload) : undefined;
    return httpClient.post<ProviderContractPolicyVersion>(
      '/api/contracts/provider/policy/submit',
      sanitized || {},
    );
  },

  /**
   * (Admin) Retrieves all policy versions pending platform approval.
   */
  async getAdminPendingPolicies(): Promise<AdminPendingPolicyItem[]> {
    return httpClient.get<AdminPendingPolicyItem[]>('/api/contracts/admin/policies/pending');
  },

  /**
   * (Admin) Retrieves detailed information and active version for comparison.
   */
  async getAdminPolicyDetail(policyId: string): Promise<AdminPolicyDetailResponse> {
    return httpClient.get<AdminPolicyDetailResponse>(
      `/api/contracts/admin/policies/${encodeURIComponent(policyId)}`,
    );
  },

  /**
   * (Admin) Submits review decision (APPROVE / REJECT) for a pending policy version.
   */
  async reviewAdminPolicy(
    policyId: string,
    payload: { action: 'APPROVE' | 'REJECT'; reviewNote?: string },
  ): Promise<ProviderContractPolicyVersion> {
    return httpClient.post<ProviderContractPolicyVersion>(
      `/api/contracts/admin/policies/${encodeURIComponent(policyId)}/review`,
      payload,
    );
  },

  /**
   * Retrieves immutable evidence and document status for a contract or specific version.
   */
  async getEvidence(
    contractId: string,
    versionId?: string,
  ): Promise<ContractEvidenceSummary> {
    const path = versionId
      ? `/api/contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/evidence`
      : `/api/contracts/${encodeURIComponent(contractId)}/evidence`;
    return httpClient.get<ContractEvidenceSummary>(path);
  },

  /**
   * Downloads the contract PDF as a binary Blob with authenticated headers.
   * - Enforces Bearer token ONLY in Authorization header.
   * - Validates that response is application/pdf (never saves JSON errors as .pdf).
   * - Sanitizes filename to prevent directory traversal.
   * - Verifies client-side SHA-256 of PDF bytes against backend X-Contract-SHA256 header (fail-closed).
   * - Zero writes to localStorage or sessionStorage.
   */
  async downloadPdfBlob(
    contractId: string,
    versionId?: string,
  ): Promise<{ blob: Blob; filename: string; sha256: string | null; verified: boolean }> {
    const token = tokenStorage.getAccessToken();
    const path = versionId
      ? `/api/contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/pdf`
      : `/api/contracts/${encodeURIComponent(contractId)}/pdf`;
    const url = `${API_BASE_URL.replace(/\/$/, '')}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `Tải hợp đồng thất bại (${response.status})`;
      try {
        const text = await response.text();
        try {
          const errorJson = JSON.parse(text);
          if (errorJson && (errorJson.message || errorJson.error)) {
            errorMessage = errorJson.message || errorJson.error;
          } else if (text) {
            errorMessage = text;
          }
        } catch {
          if (text) errorMessage = text;
        }
      } catch {
        // Ignore stream read failure
      }
      const err = new Error(errorMessage) as Error & { status?: number; statusText?: string };
      err.status = response.status;
      err.statusText = response.statusText;
      throw err;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const text = await response.text();
      let errorMsg = 'Máy chủ không trả về định dạng PDF hợp lệ.';
      try {
        const parsed = JSON.parse(text);
        if (parsed.message) errorMsg = parsed.message;
      } catch {
        // not JSON
      }
      const err = new Error(errorMsg) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition');
    let rawFilename = `contract-${contractId}.pdf`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
      if (match && match[1]) {
        rawFilename = decodeURIComponent(match[1]);
      }
    }

    // Sanitize filename to prevent path traversal or unsafe characters
    const sanitizedFilename = rawFilename
      .replace(/[/\\]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    const filename = sanitizedFilename.toLowerCase().endsWith('.pdf')
      ? sanitizedFilename
      : `${sanitizedFilename}.pdf`;

    const expectedSha256 = response.headers.get('x-contract-sha256')?.trim().toLowerCase() || null;
    if (!expectedSha256 || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new Error(
        'HASH_MISSING_OR_INVALID: Máy chủ không cung cấp mã băm X-Contract-SHA256 hợp lệ để xác thực tính toàn vẹn tệp PDF.',
      );
    }

    if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
      throw new Error(
        'CRYPTO_UNAVAILABLE: Môi trường không hỗ trợ Web Crypto API để xác thực tính toàn vẹn tệp PDF.',
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const actualSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `INTEGRITY_MISMATCH: Tệp PDF tải xuống không khớp mã SHA-256 xác thực từ hệ thống (kỳ vọng: ${expectedSha256}, thực tế: ${actualSha256}).`,
      );
    }

    return { blob, filename, sha256: expectedSha256, verified: true };
  },

  /**
   * Triggers a secure browser download of the contract PDF.
   * Cleans up object URLs in a guaranteed finally block.
   */
  async triggerPdfDownload(
    contractId: string,
    versionId?: string,
  ): Promise<{ filename: string; sha256: string | null; verified: boolean }> {
    const { blob, filename, sha256, verified } = await this.downloadPdfBlob(contractId, versionId);
    let downloadUrl: string | null = null;
    try {
      downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      if (downloadUrl) {
        window.URL.revokeObjectURL(downloadUrl);
      }
    }
    return { filename, sha256, verified };
  },

  /**
   * Retrieves the current provider's contract mode and order threshold configuration.
   */
  async getProviderContractConfig(): Promise<ProviderContractConfig> {
    return httpClient.get<ProviderContractConfig>('/api/contracts/provider/config');
  },

  /**
   * Updates the provider's contract mode and order threshold configuration.
   */
  async updateProviderContractConfig(
    data: UpdateProviderContractConfigDto,
  ): Promise<ProviderContractConfig> {
    return httpClient.put<ProviderContractConfig>('/api/contracts/provider/config', data);
  },

  /**
   * Retrieves audit logs of configuration changes for the provider.
   */
  async getProviderContractConfigAudit(): Promise<any[]> {
    return httpClient.get<any[]>('/api/contracts/provider/config/audit');
  },

  /**
   * Retrieves aggregated contracts for the currently authenticated customer.
   * Single-query, avoids N+1 requests, filters out unaccepted drafts on cancelled bookings.
   */
  async getMyContracts(): Promise<CustomerContractItem[]> {
    return httpClient.get<CustomerContractItem[]>('/api/contracts/customer/my-contracts');
  },
};
