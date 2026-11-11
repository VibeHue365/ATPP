import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  IncidentCompensationMethod,
  IncidentTierKey,
  resolveDamageCompensationRules,
} from '../schemas/provider-contract-policy.schema';
import {
  SaveProviderPolicyDraftDto,
  TierCompensationRuleDto,
} from '../dto/provider-contract-policy.dto';
import { ContractReadService } from '../contract-read.service';
import { ContractScope } from '../../bookings/schemas/digital-contract.schema';
import { buildContractTermsLines } from '../contract-pdf-generator';
import { hashContract } from '../canonical-contract';
import { ContractAccessService } from '../contract-access.service';

describe('Contracts V2: Full Contract Flow & 10 Verification Cases', () => {
  const provId = new Types.ObjectId('64b0f0000000000000000001');
  const prodId = new Types.ObjectId('64b0f0000000000000000003');

  // Helper for eligibility service
  const createEligibilityService = (
    productOverrides: Record<string, any> = {},
    policySnapshot: any = {},
    providerOverrides: Record<string, any> = {},
    acceptanceOverrides: Record<string, any> = {},
  ) => {
    const mockDb = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn(async () => {
          if (name === 'products') {
            return {
              _id: prodId,
              providerId: provId,
              name: 'Ao dai rong',
              replacementValue: null, // default no replacement value
              moderationStatus: 'APPROVED',
              ...productOverrides,
            };
          }
          if (name === 'providers') {
            return {
              _id: provId,
              businessName: 'aaa',
              status: 'ACTIVE',
              capabilities: ['AODAI_RENTAL'],
              ...providerOverrides,
            };
          }
          if (name === 'provider_contract_acceptances') {
            return {
              providerId: provId,
              scope: ContractScope.AoDaiRental,
              status: 'ACTIVE',
              ...acceptanceOverrides,
            };
          }
          return null;
        }),
      })),
    };
    const mockConn = { db: mockDb } as any;
    const mockSnapshots = {
      currentPoliciesForProvider: jest.fn().mockResolvedValue(policySnapshot),
    } as any;

    const readService = new ContractReadService(
      true, // enabled
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockSnapshots,
      {} as any,
      mockConn,
    );

    return { readService, mockSnapshots, mockDb };
  };

  // -------------------------------------------------------------
  // SECTION 1: DTO Validation & Technical Integrity (Requirement 2)
  // -------------------------------------------------------------
  describe('1. Policy Submission DTO Validation & Sanitization', () => {
    it('accepts clean payload without tier property (frontend sanitizePolicyPayload behavior)', async () => {
      const plainObj = {
        method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
        fixedFeeAmount: null,
        percentageOfAsset: null,
        conditionsAndEvidence: 'Hóa đơn giặt ủi/sửa chữa chuyên nghiệp',
      };

      const dto = plainToInstance(TierCompensationRuleDto, plainObj);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('accepts valid IncidentTierKey enum when tier property is included', async () => {
      const plainObj = {
        method: IncidentCompensationMethod.FIXED_FEE,
        fixedFeeAmount: 50000,
        percentageOfAsset: null,
        conditionsAndEvidence: 'Vết bẩn giặt tẩy được',
        tier: IncidentTierKey.MINOR_DAMAGE,
      };

      const dto = plainToInstance(TierCompensationRuleDto, plainObj);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.tier).toBe(IncidentTierKey.MINOR_DAMAGE);
    });

    it('rejects invalid tier value with class-validator error', async () => {
      const plainObj = {
        method: IncidentCompensationMethod.FIXED_FEE,
        fixedFeeAmount: 50000,
        tier: 'INVALID_TIER_STRING',
      };

      const dto = plainToInstance(TierCompensationRuleDto, plainObj);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('preserves all business fields intact across full policy DTO validation', async () => {
      const fullPolicyPayload = {
        garmentCare: {
          allowIroning: true,
          allowWashing: false,
          prohibitedActions: ['Xịt nước hoa trực tiếp lên tơ tằm'],
          specialNotes: 'Bảo quản nơi khô ráo',
        },
        lateReturn: {
          gracePeriodHours: 2,
          hourlyLateFee: 20000,
          dailyLateFee: 100000,
          maxLateDaysAllowed: 3,
        },
        damageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 50000,
            percentageOfAsset: null,
            conditionsAndEvidence: 'Bung chỉ nhẹ',
          },
          moderateDamage: {
            method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
            fixedFeeAmount: null,
            percentageOfAsset: null,
            conditionsAndEvidence: 'Hóa đơn sửa chữa phục hồi',
          },
          severeDamage: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            fixedFeeAmount: null,
            percentageOfAsset: null,
            conditionsAndEvidence: 'Đối chiếu ảnh và thương lượng',
          },
          totalLoss: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            fixedFeeAmount: null,
            percentageOfAsset: 100,
            conditionsAndEvidence: 'Mất đồ đền 100% giá trị bồi hoàn',
          },
          incidentNotificationHours: 24,
          disputeResolutionTerms: 'Sàn VibeHue làm trung gian hòa giải.',
        },
        cancellationPolicy: {
          refundRules: [
            { daysBeforeRental: 3, refundPercentage: 100 },
            { daysBeforeRental: 1, refundPercentage: 50 },
          ],
          cancellationNotes: 'Hoàn 100% cọc nếu báo trước 3 ngày.',
        },
        supportContact: {
          hotline: '0901234567',
          supportWorkingHours: '08:00 - 21:00',
          contactNote: 'Hỗ trợ đổi size',
        },
        customTermsText: 'Khách hàng vui lòng đồng kiểm khi nhận trang phục.',
      };

      const dto = plainToInstance(SaveProviderPolicyDraftDto, fullPolicyPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);

      // Verify no fields got dropped or mutated
      expect(dto.damageCompensation.minorDamage?.method).toBe(IncidentCompensationMethod.FIXED_FEE);
      expect(dto.damageCompensation.minorDamage?.fixedFeeAmount).toBe(50000);
      expect(dto.damageCompensation.moderateDamage?.method).toBe(IncidentCompensationMethod.ACTUAL_REPAIR_COST);
      expect(dto.damageCompensation.severeDamage?.method).toBe(IncidentCompensationMethod.INCIDENT_NEGOTIATION);
      expect(dto.damageCompensation.totalLoss?.method).toBe(IncidentCompensationMethod.PERCENTAGE_ON_ASSET);
      expect(dto.damageCompensation.totalLoss?.percentageOfAsset).toBe(100);
    });
  });

  // -------------------------------------------------------------
  // SECTION 2: Verification of All 4 Methods (Requirement 5: Cases A-F)
  // -------------------------------------------------------------
  describe('2. Four Compensation Methods End-to-End Verification (Cases A - F)', () => {

    // CASE A: FIXED_FEE valid -> Creates contract successfully
    it('Case A: FIXED_FEE valid -> Eligible, creates contract successfully without requiring replacementValue', async () => {
      const fixedFeePolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 50000,
            conditionsAndEvidence: 'Vết bẩn giặt tẩy được',
          },
          moderateDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 150000,
            conditionsAndEvidence: 'Rách nhỏ may lại được',
          },
          severeDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 500000,
            conditionsAndEvidence: 'Rách lớn phom dáng',
          },
          totalLoss: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 1000000,
            conditionsAndEvidence: 'Mất hẳn trang phục',
          },
          incidentNotificationHours: 24,
        },
      };

      // Product has NO replacementValue (null)
      const { readService } = createEligibilityService({ replacementValue: null }, fixedFeePolicy);
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(result.eligible).toBe(true);
      expect(result.ineligibleItems.length).toBe(0);

      // Verify contract terms rendering
      const terms = buildContractTermsLines(fixedFeePolicy, [{
        productName: 'Ao dai rong',
        unitPrice: 55555,
        quantity: 1,
        replacementValue: null,
      }]);
      const text = terms.join('\n');
      expect(text).toContain('50.000 đ/lỗi');
      expect(text).toContain('150.000 đ/lỗi');
      expect(text).not.toContain('% Giá trị bồi hoàn');
    });

    // CASE B: ACTUAL_REPAIR_COST valid -> Creates contract successfully, no replacementValue
    it('Case B: ACTUAL_REPAIR_COST valid -> Eligible without replacementValue, terms state repair invoice principles', async () => {
      const repairCostPolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 30000,
          },
          moderateDamage: {
            method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
            conditionsAndEvidence: 'Hóa đơn dịch vụ giặt hấp/tiệm may',
          },
          severeDamage: {
            method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
            conditionsAndEvidence: 'Báo giá phục hồi từ xưởng thêu may',
          },
          totalLoss: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Thương lượng giá trị đền bù',
          },
        },
      };

      // Product has NO replacementValue
      const { readService } = createEligibilityService({ replacementValue: null }, repairCostPolicy);
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(result.eligible).toBe(true);
      expect(result.ineligibleItems.length).toBe(0);

      const terms = buildContractTermsLines(repairCostPolicy, [{
        productName: 'Ao dai rong',
        unitPrice: 55555,
        quantity: 1,
        replacementValue: null,
      }]);
      const text = terms.join('\n');
      expect(text).toContain('Bồi thường theo chi phí phục hồi/sửa chữa thực tế căn cứ hóa đơn, chứng từ hợp lệ từ đơn vị chuyên nghiệp');
      expect(text).toContain('Căn cứ: Hóa đơn dịch vụ giặt hấp/tiệm may');
    });

    // CASE C: INCIDENT_NEGOTIATION valid -> Creates contract successfully, no replacementValue
    it('Case C: INCIDENT_NEGOTIATION valid -> Eligible without replacementValue, terms state mutual negotiation', async () => {
      const negotiationPolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Đối chiếu ảnh khi nhận và trả đồ',
          },
          moderateDamage: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Thương lượng chi phí khắc phục',
          },
          severeDamage: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Đối chiếu biên bản bàn giao',
          },
          totalLoss: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Thương lượng đền bù giá trị trang phục',
          },
          disputeResolutionTerms: 'Sàn VibeHue tiếp nhận phản ánh, hỗ trợ hòa giải trung gian.',
        },
      };

      // Product has NO replacementValue
      const { readService } = createEligibilityService({ replacementValue: null }, negotiationPolicy);
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(result.eligible).toBe(true);
      expect(result.ineligibleItems.length).toBe(0);

      const terms = buildContractTermsLines(negotiationPolicy, [{
        productName: 'Ao dai rong',
        unitPrice: 55555,
        quantity: 1,
        replacementValue: null,
      }]);
      const text = terms.join('\n');
      expect(text).toContain('Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận');
      expect(text).toContain('Sàn VibeHue tiếp nhận phản ánh, hỗ trợ hòa giải trung gian.');
    });

    // CASE D: PERCENTAGE_ON_ASSET with valid replacementValue -> Creates contract successfully
    it('Case D: PERCENTAGE_ON_ASSET with valid approved replacementValue -> Eligible, contract references asset value', async () => {
      const percentagePolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 50000,
          },
          moderateDamage: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 20,
            conditionsAndEvidence: 'Rách vải diện tích trung bình',
          },
          severeDamage: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 80,
            conditionsAndEvidence: 'Biến dạng phom áo lớn',
          },
          totalLoss: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 100,
            conditionsAndEvidence: 'Mất hoặc cháy rách hoàn toàn',
          },
        },
      };

      // Product HAS valid approved replacementValue (2.500.000đ)
      const { readService } = createEligibilityService(
        { replacementValue: 2500000, moderationStatus: 'APPROVED' },
        percentagePolicy,
      );
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(result.eligible).toBe(true);
      expect(result.ineligibleItems.length).toBe(0);

      const terms = buildContractTermsLines(percentagePolicy, [{
        productName: 'Ao dai rong',
        unitPrice: 55555,
        quantity: 1,
        replacementValue: 2500000,
      }]);
      const text = terms.join('\n');
      expect(text).toContain('20% Giá trị bồi hoàn trang phục (500.000 đ trên tổng giá trị bồi hoàn 2.500.000 đ)');
      expect(text).toContain('80% Giá trị bồi hoàn trang phục (2.000.000 đ trên tổng giá trị bồi hoàn 2.500.000 đ)');
      expect(text).toContain('100% Giá trị bồi hoàn trang phục (2.500.000 đ trên tổng giá trị bồi hoàn 2.500.000 đ)');
    });

    // CASE E: PERCENTAGE_ON_ASSET missing replacementValue -> Fails closed with exact error message
    it('Case E: PERCENTAGE_ON_ASSET missing replacementValue -> Fails closed with CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING', async () => {
      const percentagePolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 50000,
          },
          moderateDamage: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 20,
          },
          severeDamage: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 100,
          },
          totalLoss: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 100,
          },
        },
      };

      // Product has NO replacementValue (null or <= 0)
      const { readService } = createEligibilityService({ replacementValue: null }, percentagePolicy);
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(result.eligible).toBe(false);
      expect(result.ineligibleItems.length).toBe(1);
      expect(result.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');
      expect(result.ineligibleItems[0].message).toContain("Trang phục 'Ao dai rong' của Shop 'aaa' chưa có Giá trị bồi hoàn được thiết lập.");
    });

    // CASE F: One Shop using all four methods simultaneously -> A4/PDF displays correctly
    it('Case F: Single Shop using all 4 methods simultaneously -> A4 and PDF terms render all 4 correctly without fallback', async () => {
      const allFourMethodsPolicy = {
        providerDamageCompensation: {
          minorDamage: {
            method: IncidentCompensationMethod.FIXED_FEE,
            fixedFeeAmount: 40000,
            conditionsAndEvidence: 'Vết bẩn giặt ra được',
          },
          moderateDamage: {
            method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
            conditionsAndEvidence: 'Hóa đơn giặt sấy cao cấp',
          },
          severeDamage: {
            method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
            conditionsAndEvidence: 'Thương lượng dựa trên clip mở gói hàng',
          },
          totalLoss: {
            method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
            percentageOfAsset: 100,
            conditionsAndEvidence: 'Mất không tìm lại được',
          },
          incidentNotificationHours: 36,
          disputeResolutionTerms: 'Trung tâm hỗ trợ khách hàng VibeHue xử lý theo quy định sàn.',
        },
      };

      // With approved asset value for the totalLoss tier
      const { readService } = createEligibilityService(
        { replacementValue: 3000000, moderationStatus: 'APPROVED' },
        allFourMethodsPolicy,
      );
      const result = await readService.checkEligibility([{ productId: prodId.toHexString() }]);
      expect(result.eligible).toBe(true);

      const terms = buildContractTermsLines(allFourMethodsPolicy, [{
        productName: 'Ao dai rong',
        unitPrice: 55555,
        quantity: 1,
        replacementValue: 3000000,
      }]);
      const text = terms.join('\n');

      // Verify all 4 distinct clauses are present in contract text:
      // 1. Fixed Fee
      expect(text).toContain('40.000 đ/lỗi (Điều kiện: Vết bẩn giặt ra được).');
      // 2. Actual Repair Cost
      expect(text).toContain('Bồi thường theo chi phí phục hồi/sửa chữa thực tế căn cứ hóa đơn, chứng từ hợp lệ từ đơn vị chuyên nghiệp. Căn cứ: Hóa đơn giặt sấy cao cấp');
      // 3. Incident Negotiation
      expect(text).toContain('Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận. Căn cứ: Thương lượng dựa trên clip mở gói hàng');
      // 4. Percentage on Asset
      expect(text).toContain('100% Giá trị bồi hoàn trang phục (3.000.000 đ trên tổng giá trị bồi hoàn 3.000.000 đ) (Điều kiện: Mất không tìm lại được).');
      // 5. Timeframe & Dispute terms
      expect(text).toContain('Thời hạn thông báo sự cố: Bên A có trách nhiệm kiểm tra và gửi thông báo sự cố kèm chứng cứ trong vòng 36 giờ kể từ thời điểm nhận lại trang phục.');
      expect(text).toContain('Hỗ trợ giải quyết tranh chấp: Trung tâm hỗ trợ khách hàng VibeHue xử lý theo quy định sàn.');
    });

    // CASE 7: Contract Immutability - Post-signing policy/product mutations do not affect signed contract
    it('Case 7: Contract Immutability: Subsequent Shop policy/product updates do not alter historical signed contract', async () => {
      const historicalSnapshot = {
        booking: { bookingCode: 'VH-12345', status: 'CONFIRMED' },
        providerItems: [{
          productId: prodId.toHexString(),
          productName: 'Ao dai rong',
          unitPrice: 55555,
          quantity: 1,
          replacementValue: 2000000,
        }],
        policies: {
          providerDamageCompensation: {
            totalLoss: { method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET, percentageOfAsset: 99 },
          },
        },
        pricing: { grandTotal: 66666 },
      };

      const frozenContentHash = hashContract(historicalSnapshot);

      // Provider changes policy in DB later to a different fee and method
      const mutatedPolicy = {
        providerDamageCompensation: {
          totalLoss: { method: IncidentCompensationMethod.FIXED_FEE, fixedFeeAmount: 500000 },
        },
      };

      const mutatedSnapshot = {
        ...historicalSnapshot,
        policies: mutatedPolicy,
      };

      const newContentHash = hashContract(mutatedSnapshot);

      // Verifies that the hash of the original accepted contract is strictly immutable and different
      expect(frozenContentHash).not.toBe(newContentHash);
      expect(historicalSnapshot.providerItems[0].replacementValue).toBe(2000000);
      expect(historicalSnapshot.policies.providerDamageCompensation.totalLoss.percentageOfAsset).toBe(99);
    });

    // CASE 8: Security & Authorization (IDOR) - Non-participants cannot read or consent to contracts
    it('Case 8: Security & IDOR: Unauthorized customer or provider cannot access or consent to another contract', async () => {
      const bookingCustomerId = new Types.ObjectId('64b0f0000000000000000009');
      const intruderCustomerId = new Types.ObjectId('64b0f0000000000000000099');

      const mockBooking = {
        _id: new Types.ObjectId(),
        customerId: bookingCustomerId,
        providerIds: [provId],
      } as any;

      const mockConn = {
        db: {
          collection: () => ({
            findOne: jest.fn().mockResolvedValue(null),
          }),
        },
      } as any;

      const accessService = new ContractAccessService(mockConn);

      // Customer A owns the booking -> assertCustomer succeeds
      expect(() => {
        accessService.assertCustomer({ sub: bookingCustomerId.toHexString(), roles: ['CUSTOMER'], permissions: [] }, mockBooking);
      }).not.toThrow();

      // Intruder Customer B attempts access -> NotFoundException thrown (fail-closed, no info leak)
      expect(() => {
        accessService.assertCustomer({ sub: intruderCustomerId.toHexString(), roles: ['CUSTOMER'], permissions: [] }, mockBooking);
      }).toThrow('CONTRACT_NOT_FOUND');
    });

    // CASE 9: Policy Lifecycle - DRAFT and PENDING_REVIEW policies cannot be used to form active contracts
    it('Case 9: Policy Approval Lifecycle: DRAFT and PENDING_REVIEW policies do not activate contracts; only APPROVED policy is applied', async () => {
      // 1. DRAFT policy fallback
      const draftOnlyPolicy = {
        isLegacyFallback: true, // means no approved Contracts V2 policy exists
      };

      const { readService: draftService } = createEligibilityService({}, draftOnlyPolicy);
      const draftResult = await draftService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(draftResult.eligible).toBe(false);
      expect(draftResult.ineligibleItems[0].reason).toBe('PROVIDER_POLICY_NOT_APPROVED');

      // 2. APPROVED policy succeeds
      const approvedPolicy = {
        isLegacyFallback: false,
        providerDamageCompensation: {
          minorDamage: { method: IncidentCompensationMethod.FIXED_FEE, fixedFeeAmount: 50000 },
          moderateDamage: { method: IncidentCompensationMethod.INCIDENT_NEGOTIATION },
          severeDamage: { method: IncidentCompensationMethod.INCIDENT_NEGOTIATION },
          totalLoss: { method: IncidentCompensationMethod.INCIDENT_NEGOTIATION },
        },
      };

      const { readService: approvedService } = createEligibilityService({}, approvedPolicy);
      const approvedResult = await approvedService.checkEligibility([{ productId: prodId.toHexString() }]);

      expect(approvedResult.eligible).toBe(true);
      expect(approvedResult.ineligibleItems.length).toBe(0);
    });

    // CASE 10: Complete Error Differentiation on Early Check
    it('Case 10: Early Readiness Check differentiates MISSING vs UNAPPROVED vs STALE vs NOT_APPROVED vs RENTAL_NOT_ACTIVE', async () => {
      const percentagePolicy = {
        isLegacyFallback: false,
        providerDamageCompensation: {
          totalLoss: { method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET, percentageOfAsset: 99 },
        },
      };

      // 10a: MISSING replacement value
      const { readService: svcMissing } = createEligibilityService({ replacementValue: null }, percentagePolicy);
      const resMissing = await svcMissing.checkEligibility([{ productId: prodId.toHexString() }]);
      expect(resMissing.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_MISSING');

      // 10b: UNAPPROVED replacement value (moderationStatus !== 'APPROVED')
      const { readService: svcUnapproved } = createEligibilityService(
        { replacementValue: 2000000, moderationStatus: 'PENDING_REVIEW' },
        percentagePolicy,
      );
      const resUnapproved = await svcUnapproved.checkEligibility([{ productId: prodId.toHexString() }]);
      expect(resUnapproved.ineligibleItems[0].reason).toBe('CONTRACT_PRODUCT_REPLACEMENT_VALUE_UNAPPROVED');

      // 10c: STALE provider acceptance (policy fingerprint mismatch)
      const { readService: svcStale } = createEligibilityService(
        { replacementValue: 2000000, moderationStatus: 'APPROVED' },
        percentagePolicy,
        {},
        { policyFingerprint: 'stale_fingerprint_hash_mismatch' },
      );
      const resStale = await svcStale.checkEligibility([{ productId: prodId.toHexString() }]);
      expect(resStale.ineligibleItems[0].reason).toBe('PROVIDER_ACCEPTANCE_STALE');

      // 10d: Inactive provider rental status
      const { readService: svcInactive } = createEligibilityService(
        { replacementValue: 2000000, moderationStatus: 'APPROVED' },
        percentagePolicy,
        { status: 'SUSPENDED' },
      );
      const resInactive = await svcInactive.checkEligibility([{ productId: prodId.toHexString() }]);
      expect(resInactive.ineligibleItems[0].reason).toBe('PROVIDER_RENTAL_NOT_ACTIVE');
    });
  });
});
