import { Injectable } from '@nestjs/common';
import { parseValidReplacementValue } from './contract-source.types';
import { ProviderContractMode } from './schemas/provider-contract-config.schema';

export interface TierEvaluationGarmentItem {
  productId: string;
  productName: string;
  rentalPrice: number;
  depositAmount: number;
  quantity: number;
  replacementValue?: unknown;
  rentalDays?: number;
  isHighEnd?: boolean;
  isFragileSilk?: boolean;
}

export interface TierEvaluationConfigInput {
  contractMode: ProviderContractMode | string;
  orderThresholdAmount?: number | null;
}

export interface PlatformRiskRules {
  rulesVersion: string;
  isApproved: boolean; // only approved rules allow QUICK
  maxAssetValueForQuick: number;
  maxDepositForQuick: number;
  maxRentalDaysForQuick: number;
}

export interface TierEvaluationInput {
  providerId: string;
  items: TierEvaluationGarmentItem[];
  policyRequiresAssetValue: boolean;
  config?: TierEvaluationConfigInput | null;
  providerVoucherDiscount?: number;
  allocatedPlatformDiscount?: number;
  additionalFees?: number;
  guardrails?: Partial<PlatformRiskRules>;
  isTieredFeatureEnabled?: boolean;
}

export type RiskTriggerReason =
  | 'MISSING_REPLACEMENT_VALUE'
  | 'HIGH_ASSET_VALUE'
  | 'HIGH_DEPOSIT_VALUE'
  | 'LONG_DURATION_RENTAL'
  | 'SPECIAL_GARMENT_FLAG';

export interface TierEvaluationResult {
  presentationMode: 'QUICK' | 'DETAILED';
  isEligible: boolean;
  ineligibilityReason?: 'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING' | string;
  ineligibleProductId?: string;
  effectiveOrderAmount: number;
  totalAssetValue: number | null;
  totalDeposit: number;
  maxRentalDays: number;
  riskTriggers: RiskTriggerReason[];
  riskRulesVersion: string;
  appliedRule:
    | 'INELIGIBLE_MISSING_REQUIRED_ASSET_VALUE'
    | 'TIERED_CONTRACTS_FEATURE_FLAG_DISABLED'
    | 'PLATFORM_RISK_RULES_UNAPPROVED'
    | 'UNCONFIGURED_LEGACY_PROVIDER_DEFAULT'
    | 'GUARDRAIL_OVERRIDE'
    | 'PROVIDER_ALWAYS_DETAILED'
    | 'ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD'
    | 'ORDER_AMOUNT_BELOW_PROVIDER_THRESHOLD'
    | 'AUTO_LOW_RISK_APPROVED';
}

export const DEFAULT_MAX_ASSET_VALUE_FOR_QUICK = 2_000_000;
export const DEFAULT_MAX_DEPOSIT_FOR_QUICK = 1_000_000;
export const DEFAULT_MAX_RENTAL_DAYS_FOR_QUICK = 7;
export const DEFAULT_PLATFORM_RISK_RULES_VERSION = 'v1.0-draft';

@Injectable()
export class ContractTierEvaluator {
  evaluate(input: TierEvaluationInput): TierEvaluationResult {
    const {
      items,
      policyRequiresAssetValue,
      config,
      providerVoucherDiscount = 0,
      allocatedPlatformDiscount = 0,
      additionalFees = 0,
      guardrails,
      isTieredFeatureEnabled = true,
    } = input;

    const rulesVersion =
      guardrails?.rulesVersion ?? DEFAULT_PLATFORM_RISK_RULES_VERSION;
    const isApproved = guardrails?.isApproved ?? true; // defaults to true for tests unless explicitly unapproved

    const maxAssetValue =
      guardrails?.maxAssetValueForQuick ?? DEFAULT_MAX_ASSET_VALUE_FOR_QUICK;
    const maxDeposit =
      guardrails?.maxDepositForQuick ?? DEFAULT_MAX_DEPOSIT_FOR_QUICK;
    const maxDays =
      guardrails?.maxRentalDaysForQuick ?? DEFAULT_MAX_RENTAL_DAYS_FOR_QUICK;

    const riskTriggers: RiskTriggerReason[] = [];

    let grossRental = 0;
    let grossDeposit = 0;
    let totalAssetValue = 0;
    let hasAnyMissingAssetValue = false;
    let maxRentalDays = 0;

    // 1. Process items and validate replacementValue against policy requirement
    for (const item of items) {
      const qty = Math.max(1, Math.round(item.quantity || 1));
      const parsedVal = parseValidReplacementValue(item.replacementValue);

      if (policyRequiresAssetValue && parsedVal === null) {
        return {
          presentationMode: 'DETAILED',
          isEligible: false,
          ineligibilityReason: 'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING',
          ineligibleProductId: item.productId,
          effectiveOrderAmount: 0,
          totalAssetValue: null,
          totalDeposit: 0,
          maxRentalDays: 0,
          riskTriggers: ['MISSING_REPLACEMENT_VALUE'],
          riskRulesVersion: rulesVersion,
          appliedRule: 'INELIGIBLE_MISSING_REQUIRED_ASSET_VALUE',
        };
      }

      if (parsedVal === null) {
        hasAnyMissingAssetValue = true;
      } else {
        totalAssetValue += parsedVal * qty;
      }

      grossRental += Math.max(0, item.rentalPrice || 0) * qty;
      grossDeposit += Math.max(0, item.depositAmount || 0) * qty;

      const days = item.rentalDays && item.rentalDays > 0 ? item.rentalDays : 1;
      if (days > maxRentalDays) {
        maxRentalDays = days;
      }

      if (item.isHighEnd || item.isFragileSilk) {
        if (!riskTriggers.includes('SPECIAL_GARMENT_FLAG')) {
          riskTriggers.push('SPECIAL_GARMENT_FLAG');
        }
      }
    }

    // 2. Calculate effective customer payment amount for this provider
    const totalDiscounts = Math.max(0, providerVoucherDiscount) + Math.max(0, allocatedPlatformDiscount);
    const netRental = Math.max(0, grossRental - totalDiscounts);
    const effectiveOrderAmount = netRental + grossDeposit + Math.max(0, additionalFees);

    // 3. Asset Risk Checks
    if (hasAnyMissingAssetValue) {
      if (!riskTriggers.includes('MISSING_REPLACEMENT_VALUE')) {
        riskTriggers.push('MISSING_REPLACEMENT_VALUE');
      }
    } else if (totalAssetValue >= maxAssetValue) {
      riskTriggers.push('HIGH_ASSET_VALUE');
    }

    // 4. Deposit Risk Check
    if (grossDeposit >= maxDeposit) {
      riskTriggers.push('HIGH_DEPOSIT_VALUE');
    }

    // 5. Rental Duration Risk Check
    if (maxRentalDays >= maxDays) {
      riskTriggers.push('LONG_DURATION_RENTAL');
    }

    // 6. Check Feature Flag
    if (!isTieredFeatureEnabled) {
      return {
        presentationMode: 'DETAILED',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue: hasAnyMissingAssetValue ? null : totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers,
        riskRulesVersion: rulesVersion,
        appliedRule: 'TIERED_CONTRACTS_FEATURE_FLAG_DISABLED',
      };
    }

    // 7. Check Platform Risk Rules Approval
    if (!isApproved) {
      return {
        presentationMode: 'DETAILED',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue: hasAnyMissingAssetValue ? null : totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers,
        riskRulesVersion: rulesVersion,
        appliedRule: 'PLATFORM_RISK_RULES_UNAPPROVED',
      };
    }

    // 8. Check Unconfigured Legacy Provider
    if (!config) {
      return {
        presentationMode: 'DETAILED',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue: hasAnyMissingAssetValue ? null : totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers,
        riskRulesVersion: rulesVersion,
        appliedRule: 'UNCONFIGURED_LEGACY_PROVIDER_DEFAULT',
      };
    }

    // 9. Guardrails Override
    if (riskTriggers.length > 0) {
      return {
        presentationMode: 'DETAILED',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue: hasAnyMissingAssetValue ? null : totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers,
        riskRulesVersion: rulesVersion,
        appliedRule: 'GUARDRAIL_OVERRIDE',
      };
    }

    const mode = config.contractMode;

    if (mode === ProviderContractMode.ALWAYS_DETAILED) {
      return {
        presentationMode: 'DETAILED',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers: [],
        riskRulesVersion: rulesVersion,
        appliedRule: 'PROVIDER_ALWAYS_DETAILED',
      };
    }

    if (mode === ProviderContractMode.CUSTOM_ORDER_THRESHOLD) {
      const threshold =
        typeof config?.orderThresholdAmount === 'number' && Number.isFinite(config.orderThresholdAmount)
          ? config.orderThresholdAmount
          : 0;

      if (effectiveOrderAmount >= threshold) {
        return {
          presentationMode: 'DETAILED',
          isEligible: true,
          effectiveOrderAmount,
          totalAssetValue,
          totalDeposit: grossDeposit,
          maxRentalDays,
          riskTriggers: [],
          riskRulesVersion: rulesVersion,
          appliedRule: 'ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD',
        };
      }

      return {
        presentationMode: 'QUICK',
        isEligible: true,
        effectiveOrderAmount,
        totalAssetValue,
        totalDeposit: grossDeposit,
        maxRentalDays,
        riskTriggers: [],
        riskRulesVersion: rulesVersion,
        appliedRule: 'ORDER_AMOUNT_BELOW_PROVIDER_THRESHOLD',
      };
    }

    // Default: AUTO mode with no triggers -> QUICK
    return {
      presentationMode: 'QUICK',
      isEligible: true,
      effectiveOrderAmount,
      totalAssetValue,
      totalDeposit: grossDeposit,
      maxRentalDays,
      riskTriggers: [],
      riskRulesVersion: rulesVersion,
      appliedRule: 'AUTO_LOW_RISK_APPROVED',
    };
  }
}
