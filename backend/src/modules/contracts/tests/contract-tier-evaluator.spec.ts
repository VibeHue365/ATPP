import {
  ContractTierEvaluator,
  DEFAULT_MAX_ASSET_VALUE_FOR_QUICK,
  DEFAULT_MAX_DEPOSIT_FOR_QUICK,
  DEFAULT_MAX_RENTAL_DAYS_FOR_QUICK,
  TierEvaluationInput,
} from '../contract-tier-evaluator';
import { ProviderContractMode } from '../schemas/provider-contract-config.schema';

describe('Phase 2A: ContractTierEvaluator Unit Tests', () => {
  let evaluator: ContractTierEvaluator;

  beforeEach(() => {
    evaluator = new ContractTierEvaluator();
  });

  const createBaseInput = (
    overrides?: Partial<TierEvaluationInput>,
  ): TierEvaluationInput => ({
    providerId: '60d5ec49f1b2c8b1f8e4e1a1',
    policyRequiresAssetValue: false,
    config: {
      contractMode: ProviderContractMode.AUTO,
      orderThresholdAmount: null,
    },
    items: [
      {
        productId: 'prod-001',
        productName: 'Áo dài hoa nhí',
        rentalPrice: 100000,
        depositAmount: 50000,
        quantity: 1,
        replacementValue: 500000,
        rentalDays: 2,
      },
    ],
    ...overrides,
  });

  describe('1. Threshold Boundary Tests (CUSTOM_ORDER_THRESHOLD)', () => {
    it('evaluates to QUICK when effectiveOrderAmount < threshold', () => {
      // Rental: 100k, Deposit: 50k -> Effective: 150k
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 200000, // Threshold 200k
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('QUICK');
      expect(result.isEligible).toBe(true);
      expect(result.effectiveOrderAmount).toBe(150000);
      expect(result.appliedRule).toBe('ORDER_AMOUNT_BELOW_PROVIDER_THRESHOLD');
      expect(result.riskTriggers).toHaveLength(0);
    });

    it('evaluates to DETAILED when effectiveOrderAmount == threshold', () => {
      // Rental: 100k, Deposit: 50k -> Effective: 150k
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 150000, // Exact match
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.isEligible).toBe(true);
      expect(result.effectiveOrderAmount).toBe(150000);
      expect(result.appliedRule).toBe('ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD');
      expect(result.riskTriggers).toHaveLength(0);
    });

    it('evaluates to DETAILED when effectiveOrderAmount > threshold', () => {
      // Rental: 100k, Deposit: 50k -> Effective: 150k
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 100000, // Threshold 100k < 150k
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.isEligible).toBe(true);
      expect(result.effectiveOrderAmount).toBe(150000);
      expect(result.appliedRule).toBe('ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD');
    });

    it('evaluates to DETAILED when threshold is 0 (all orders detailed)', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 0,
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.appliedRule).toBe('ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD');
    });
  });

  describe('2. Provider Contract Modes (AUTO & ALWAYS_DETAILED)', () => {
    it('evaluates to DETAILED in ALWAYS_DETAILED mode even for tiny orders', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.ALWAYS_DETAILED,
        },
        items: [
          {
            productId: 'prod-mini',
            productName: 'Khăn vấn',
            rentalPrice: 20000,
            depositAmount: 10000,
            quantity: 1,
            replacementValue: 100000,
            rentalDays: 1,
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.isEligible).toBe(true);
      expect(result.appliedRule).toBe('PROVIDER_ALWAYS_DETAILED');
      expect(result.riskTriggers).toHaveLength(0);
    });

    it('evaluates to QUICK in AUTO mode when no risk triggers present', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.AUTO,
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('QUICK');
      expect(result.isEligible).toBe(true);
      expect(result.appliedRule).toBe('AUTO_LOW_RISK_APPROVED');
      expect(result.riskTriggers).toHaveLength(0);
    });

    it('falls back to DETAILED for unconfigured legacy provider (config is null)', () => {
      const input = createBaseInput({
        config: null,
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.appliedRule).toBe('UNCONFIGURED_LEGACY_PROVIDER_DEFAULT');
    });

    it('falls back to DETAILED when isTieredFeatureEnabled is false', () => {
      const input = createBaseInput({
        isTieredFeatureEnabled: false,
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.appliedRule).toBe('TIERED_CONTRACTS_FEATURE_FLAG_DISABLED');
    });

    it('falls back to DETAILED when platform risk rules are not approved', () => {
      const input = createBaseInput({
        guardrails: {
          isApproved: false,
          rulesVersion: 'v0.9-draft-unapproved',
        },
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.appliedRule).toBe('PLATFORM_RISK_RULES_UNAPPROVED');
      expect(result.riskRulesVersion).toBe('v0.9-draft-unapproved');
    });
  });

  describe('3. Missing replacementValue & Policy Dependency (Condition 1)', () => {
    it('makes order INELIGIBLE when policy requires replacementValue and it is missing (null)', () => {
      const input = createBaseInput({
        policyRequiresAssetValue: true, // Policy uses PERCENTAGE_ON_ASSET
        items: [
          {
            productId: 'prod-no-val',
            productName: 'Áo dài lụa tơ tằm',
            rentalPrice: 150000,
            depositAmount: 50000,
            quantity: 1,
            replacementValue: null, // MISSING!
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.isEligible).toBe(false);
      expect(result.ineligibilityReason).toBe(
        'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING',
      );
      expect(result.ineligibleProductId).toBe('prod-no-val');
      expect(result.appliedRule).toBe('INELIGIBLE_MISSING_REQUIRED_ASSET_VALUE');
      expect(result.riskTriggers).toContain('MISSING_REPLACEMENT_VALUE');
      // Never fabricates rentalPrice or deposit as replacementValue
      expect(result.totalAssetValue).toBeNull();
    });

    it('makes order INELIGIBLE when policy requires replacementValue and value is invalid string', () => {
      const input = createBaseInput({
        policyRequiresAssetValue: true,
        items: [
          {
            productId: 'prod-invalid-val',
            productName: 'Áo dài',
            rentalPrice: 150000,
            depositAmount: 50000,
            quantity: 1,
            replacementValue: 'abc-khong-hop-le',
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.isEligible).toBe(false);
      expect(result.ineligibilityReason).toBe(
        'CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING',
      );
    });

    it('remains ELIGIBLE but forces DETAILED when policy does NOT require replacementValue but value is missing', () => {
      // Condition 1: If policy doesn't require replacementValue, allow proceeding,
      // but do NOT lower protection: force DETAILED because asset risk is unknown!
      const input = createBaseInput({
        policyRequiresAssetValue: false, // Policy uses FIXED_FEE or NEGOTIATION
        items: [
          {
            productId: 'prod-unknown-asset',
            productName: 'Áo dài cách tân',
            rentalPrice: 50000,
            depositAmount: 20000,
            quantity: 1,
            replacementValue: null, // Missing value
            rentalDays: 1,
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.isEligible).toBe(true);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.riskTriggers).toContain('MISSING_REPLACEMENT_VALUE');
      expect(result.appliedRule).toBe('GUARDRAIL_OVERRIDE');
      expect(result.totalAssetValue).toBeNull(); // No fabricated number!
    });
  });

  describe('4. Risk Guardrails (High Asset, Low Deposit / Low Rental)', () => {
    it('forces DETAILED when totalReplacementValue exceeds platform limit even with low rental and low deposit', () => {
      // Rental: 50k, Deposit: 20k -> Effective order is tiny (70k)
      // BUT replacementValue: 3,000,000 VND >= 2,000,000 VND limit!
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 5000000, // Shop set high threshold 5M to try to bypass!
        },
        items: [
          {
            productId: 'prod-expensive',
            productName: 'Cổ phục Nhật Bình Thêu Tay Cao Cấp',
            rentalPrice: 50000,
            depositAmount: 20000,
            quantity: 1,
            replacementValue: 3000000, // High asset value
            rentalDays: 2,
          },
        ],
      });

      const result = evaluator.evaluate(input);
      // Shop cannot bypass minimum platform protection!
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.isEligible).toBe(true);
      expect(result.riskTriggers).toContain('HIGH_ASSET_VALUE');
      expect(result.appliedRule).toBe('GUARDRAIL_OVERRIDE');
      expect(result.totalAssetValue).toBe(3000000);
    });

    it('forces DETAILED when deposit exceeds platform threshold', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.AUTO,
        },
        items: [
          {
            productId: 'prod-high-dep',
            productName: 'Áo dài',
            rentalPrice: 100000,
            depositAmount: DEFAULT_MAX_DEPOSIT_FOR_QUICK + 10000, // Deposit > 1M
            quantity: 1,
            replacementValue: 1000000,
            rentalDays: 2,
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.riskTriggers).toContain('HIGH_DEPOSIT_VALUE');
      expect(result.appliedRule).toBe('GUARDRAIL_OVERRIDE');
    });

    it('forces DETAILED when rental duration exceeds limit (e.g. >= 7 days)', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.AUTO,
        },
        items: [
          {
            productId: 'prod-long-rental',
            productName: 'Áo dài du lịch',
            rentalPrice: 50000,
            depositAmount: 50000,
            quantity: 1,
            replacementValue: 500000,
            rentalDays: DEFAULT_MAX_RENTAL_DAYS_FOR_QUICK, // 7 days
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.riskTriggers).toContain('LONG_DURATION_RENTAL');
      expect(result.appliedRule).toBe('GUARDRAIL_OVERRIDE');
    });

    it('forces DETAILED when item has special garment flags (high-end or fragile silk)', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.AUTO,
        },
        items: [
          {
            productId: 'prod-fragile',
            productName: 'Áo tơ tằm cổ',
            rentalPrice: 80000,
            depositAmount: 50000,
            quantity: 1,
            replacementValue: 800000,
            rentalDays: 2,
            isFragileSilk: true,
          },
        ],
      });

      const result = evaluator.evaluate(input);
      expect(result.presentationMode).toBe('DETAILED');
      expect(result.riskTriggers).toContain('SPECIAL_GARMENT_FLAG');
      expect(result.appliedRule).toBe('GUARDRAIL_OVERRIDE');
    });
  });

  describe('5. Pricing, Discounts, and Multi-Item Calculations', () => {
    it('accurately factors discounts and additional fees into effectiveOrderAmount', () => {
      // 2 items:
      // Item 1: rental 100k x 2 = 200k, deposit 50k x 2 = 100k
      // Item 2: rental 150k x 1 = 150k, deposit 50k x 1 = 50k
      // Gross Rental: 350k, Gross Deposit: 150k
      // Provider discount: 50k, Platform discount: 30k -> Total discounts: 80k
      // Net Rental: 350k - 80k = 270k
      // Additional fees: 20k
      // Effective Order Amount: 270k + 150k + 20k = 440k
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 450000, // Threshold 450k > 440k -> QUICK
        },
        items: [
          {
            productId: 'prod-1',
            productName: 'Áo dài 1',
            rentalPrice: 100000,
            depositAmount: 50000,
            quantity: 2,
            replacementValue: 400000,
            rentalDays: 2,
          },
          {
            productId: 'prod-2',
            productName: 'Áo dài 2',
            rentalPrice: 150000,
            depositAmount: 50000,
            quantity: 1,
            replacementValue: 500000,
            rentalDays: 2,
          },
        ],
        providerVoucherDiscount: 50000,
        allocatedPlatformDiscount: 30000,
        additionalFees: 20000,
      });

      const result = evaluator.evaluate(input);
      expect(result.effectiveOrderAmount).toBe(440000);
      expect(result.totalDeposit).toBe(150000);
      // Total asset value: 400k x 2 + 500k x 1 = 1,300,000 (< 2M)
      expect(result.totalAssetValue).toBe(1300000);
      expect(result.presentationMode).toBe('QUICK');
      expect(result.appliedRule).toBe('ORDER_AMOUNT_BELOW_PROVIDER_THRESHOLD');
    });

    it('clamps discount so net rental does not become negative', () => {
      const input = createBaseInput({
        config: {
          contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
          orderThresholdAmount: 50000,
        },
        items: [
          {
            productId: 'prod-1',
            productName: 'Áo dài',
            rentalPrice: 50000,
            depositAmount: 20000,
            quantity: 1,
            replacementValue: 300000,
          },
        ],
        providerVoucherDiscount: 100000, // Voucher 100k > rental 50k
      });

      const result = evaluator.evaluate(input);
      // Net rental is clamped to 0, effective order amount = 0 + deposit (20k) = 20k
      expect(result.effectiveOrderAmount).toBe(20000);
      expect(result.presentationMode).toBe('QUICK');
    });
  });
});
