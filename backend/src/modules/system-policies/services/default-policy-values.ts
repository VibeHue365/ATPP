import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyType } from '../constants/policy-type.enum';

export interface BookingHoldPolicyValue {
  holdMinutes: number;
  autoExpireEnabled: boolean;
}

export interface CommissionPolicyValue {
  defaultCommissionRate: number;
  sameProviderComboCommissionRate: number;
  crossProviderComboCommissionRate: number;
  fixedPlatformFee: number;
  minCommissionAmount: number;
}

export interface CancellationPolicyValue {
  freeCancelBeforeHours: number;
  urgentBookingBeforeHours: number;
  gracePeriodMinutesNormal: number;
  gracePeriodMinutesUrgent: number;
  productLateCancelPenaltyRate: number;
  photographyLateCancelPenaltyRate: number;
}

export interface RefundPolicyValue {
  autoApproveFreeCancelRefund: boolean;
  manualReviewThresholdAmount: number;
  refundProcessingMode: 'SIMULATED' | 'MANUAL' | 'GATEWAY';
}

export interface ProviderViolationPolicyValue {
  maxWarningsBeforeSuspend: number;
  lateCancelViolationPoint: number;
  noShowViolationPoint: number;
  autoSuspendEnabled: boolean;
}

export interface DisputePolicyValue {
  allowDisputeAfterCompletedHours: number;
  requireEvidence: boolean;
  holdSettlementWhenDisputed: boolean;
}

export type PolicyValue =
  | BookingHoldPolicyValue
  | CommissionPolicyValue
  | CancellationPolicyValue
  | RefundPolicyValue
  | ProviderViolationPolicyValue
  | DisputePolicyValue;

export const POLICY_CODE_TYPE_MAP: Record<PolicyCode, PolicyType> = {
  [PolicyCode.BookingHoldPolicy]: PolicyType.Booking,
  [PolicyCode.CommissionPolicy]: PolicyType.Commission,
  [PolicyCode.CancellationPolicy]: PolicyType.Cancellation,
  [PolicyCode.RefundPolicy]: PolicyType.Refund,
  [PolicyCode.ProviderViolationPolicy]: PolicyType.ProviderViolation,
  [PolicyCode.DisputePolicy]: PolicyType.Dispute,
};

export const DEFAULT_POLICY_VALUES: Record<PolicyCode, PolicyValue> = {
  [PolicyCode.BookingHoldPolicy]: {
    holdMinutes: 15,
    autoExpireEnabled: true,
  },
  [PolicyCode.CommissionPolicy]: {
    defaultCommissionRate: 0.1,
    sameProviderComboCommissionRate: 0.08,
    crossProviderComboCommissionRate: 0.1,
    fixedPlatformFee: 0,
    minCommissionAmount: 0,
  },
  [PolicyCode.CancellationPolicy]: {
    freeCancelBeforeHours: 72,
    urgentBookingBeforeHours: 2,
    gracePeriodMinutesNormal: 60,
    gracePeriodMinutesUrgent: 5,
    productLateCancelPenaltyRate: 1,
    photographyLateCancelPenaltyRate: 0.3,
  },
  [PolicyCode.RefundPolicy]: {
    autoApproveFreeCancelRefund: true,
    manualReviewThresholdAmount: 1000000,
    refundProcessingMode: 'SIMULATED',
  },
  [PolicyCode.ProviderViolationPolicy]: {
    maxWarningsBeforeSuspend: 3,
    lateCancelViolationPoint: 1,
    noShowViolationPoint: 2,
    autoSuspendEnabled: true,
  },
  [PolicyCode.DisputePolicy]: {
    allowDisputeAfterCompletedHours: 72,
    requireEvidence: true,
    holdSettlementWhenDisputed: true,
  },
};

export const DEFAULT_POLICY_NAMES: Record<PolicyCode, string> = {
  [PolicyCode.BookingHoldPolicy]: 'Booking hold policy',
  [PolicyCode.CommissionPolicy]: 'Commission policy',
  [PolicyCode.CancellationPolicy]: 'Cancellation policy',
  [PolicyCode.RefundPolicy]: 'Refund policy',
  [PolicyCode.ProviderViolationPolicy]: 'Provider violation policy',
  [PolicyCode.DisputePolicy]: 'Dispute policy',
};
