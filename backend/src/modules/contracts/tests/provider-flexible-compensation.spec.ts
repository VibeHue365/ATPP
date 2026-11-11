import {
  IncidentCompensationMethod,
  resolveDamageCompensationRules,
  DamageCompensationPolicy,
} from '../schemas/provider-contract-policy.schema';
import { buildContractTermsLines } from '../contract-pdf-generator';

describe('Provider Flexible Compensation Policy (Contracts V2)', () => {
  describe('1. resolveDamageCompensationRules - Legacy V1 interpretation', () => {
    it('strictly preserves what was actually approved in V1 without injecting synthetic 50k, 20%, 100%', () => {
      // Legacy policy with actual values
      const legacyWithValues: DamageCompensationPolicy = {
        minorDamageFee: 30000,
        moderateDamagePercent: 15,
        severeDamageOrLossPercent: 80,
        disputeResolutionNotes: 'Hòa giải theo quy chế sàn.',
      };

      const resolved = resolveDamageCompensationRules(legacyWithValues);
      expect(resolved.isLegacyV1).toBe(true);
      expect(resolved.minorDamage.method).toBe(IncidentCompensationMethod.FIXED_FEE);
      expect(resolved.minorDamage.fixedFeeAmount).toBe(30000);
      expect(resolved.moderateDamage.method).toBe(IncidentCompensationMethod.PERCENTAGE_ON_ASSET);
      expect(resolved.moderateDamage.percentageOfAsset).toBe(15);
      expect(resolved.severeDamage.method).toBe(IncidentCompensationMethod.PERCENTAGE_ON_ASSET);
      expect(resolved.severeDamage.percentageOfAsset).toBe(80);
      expect(resolved.totalLoss.method).toBe(IncidentCompensationMethod.PERCENTAGE_ON_ASSET);
      expect(resolved.totalLoss.percentageOfAsset).toBe(80);
      expect(resolved.incidentNotificationHours).toBeNull(); // NO hardcoded 24h!
      expect(resolved.requiresAssetValue).toBe(true);
    });

    it('does NOT inject numbers if fields are null or empty in legacy data', () => {
      // Legacy policy with missing/null values
      const legacyEmpty: DamageCompensationPolicy = {
        minorDamageFee: null,
        moderateDamagePercent: null,
        severeDamageOrLossPercent: null,
        disputeResolutionNotes: null,
      };

      const resolved = resolveDamageCompensationRules(legacyEmpty);
      expect(resolved.isLegacyV1).toBe(true);
      // Must NOT default to 50000
      expect(resolved.minorDamage.fixedFeeAmount).toBeNull();
      // Must NOT default to 20
      expect(resolved.moderateDamage.percentageOfAsset).toBeNull();
      // Must NOT default to 100
      expect(resolved.severeDamage.percentageOfAsset).toBeNull();
      expect(resolved.totalLoss.percentageOfAsset).toBeNull();
      expect(resolved.requiresAssetValue).toBe(false);
    });
  });

  describe('2. resolveDamageCompensationRules - V2 Four-tier Configuration', () => {
    it('supports 4 distinct compensation methods for 4 incident tiers in a single Shop', () => {
      const v2MixedPolicy: DamageCompensationPolicy = {
        minorDamage: {
          method: IncidentCompensationMethod.FIXED_FEE,
          fixedFeeAmount: 40000,
          conditionsAndEvidence: 'Vết bẩn giặt tẩy được, sút chỉ nhẹ',
        },
        moderateDamage: {
          method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
          fixedFeeAmount: null,
          percentageOfAsset: null,
          conditionsAndEvidence: 'Hóa đơn sửa chữa phục hồi từ tiệm may',
        },
        severeDamage: {
          method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
          fixedFeeAmount: null,
          percentageOfAsset: null,
          conditionsAndEvidence: 'Đối chiếu hình ảnh lúc giao nhận và thương lượng',
        },
        totalLoss: {
          method: IncidentCompensationMethod.PERCENTAGE_ON_ASSET,
          fixedFeeAmount: null,
          percentageOfAsset: 100,
          conditionsAndEvidence: 'Mất đồ tính 100% giá trị bồi hoàn chốt trước',
        },
        incidentNotificationHours: 48, // Provider explicitly established 48h
        disputeResolutionTerms: 'VibeHue hỗ trợ tiếp nhận chứng cứ và hòa giải trung gian.',
      };

      const resolved = resolveDamageCompensationRules(v2MixedPolicy);
      expect(resolved.isLegacyV1).toBe(false);
      expect(resolved.minorDamage.method).toBe(IncidentCompensationMethod.FIXED_FEE);
      expect(resolved.minorDamage.fixedFeeAmount).toBe(40000);
      expect(resolved.moderateDamage.method).toBe(IncidentCompensationMethod.ACTUAL_REPAIR_COST);
      expect(resolved.severeDamage.method).toBe(IncidentCompensationMethod.INCIDENT_NEGOTIATION);
      expect(resolved.totalLoss.method).toBe(IncidentCompensationMethod.PERCENTAGE_ON_ASSET);
      expect(resolved.totalLoss.percentageOfAsset).toBe(100);
      expect(resolved.incidentNotificationHours).toBe(48);
      // Because totalLoss uses PERCENTAGE_ON_ASSET, requiresAssetValue is true:
      expect(resolved.requiresAssetValue).toBe(true);
    });

    it('does NOT require asset value if shop chooses non-percentage methods for all tiers', () => {
      const v2NonPercentagePolicy: DamageCompensationPolicy = {
        minorDamage: {
          method: IncidentCompensationMethod.FIXED_FEE,
          fixedFeeAmount: 50000,
          conditionsAndEvidence: 'Vết bẩn nhỏ',
        },
        moderateDamage: {
          method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
          conditionsAndEvidence: 'Chi phí giặt hấp chuyên nghiệp',
        },
        severeDamage: {
          method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
          conditionsAndEvidence: 'Hai bên cùng thương lượng',
        },
        totalLoss: {
          method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
          conditionsAndEvidence: 'Thương lượng bồi thường sau khi đối chiếu',
        },
        incidentNotificationHours: 24,
      };

      const resolved = resolveDamageCompensationRules(v2NonPercentagePolicy);
      expect(resolved.isLegacyV1).toBe(false);
      expect(resolved.requiresAssetValue).toBe(false);
    });
  });

  describe('3. buildContractTermsLines - Contract Terms rendering', () => {
    it('renders exact approved tier terms and notification timeframe into contract text', () => {
      const mockSnapshot: any = {
        policies: {
          providerDamageCompensation: {
            minorDamage: {
              method: IncidentCompensationMethod.FIXED_FEE,
              fixedFeeAmount: 60000,
              conditionsAndEvidence: 'Vết bẩn giặt được',
            },
            moderateDamage: {
              method: IncidentCompensationMethod.ACTUAL_REPAIR_COST,
              conditionsAndEvidence: 'Hóa đơn giặt hấp ngoài',
            },
            severeDamage: {
              method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
              conditionsAndEvidence: 'Đối chiếu ảnh bàn giao',
            },
            totalLoss: {
              method: IncidentCompensationMethod.INCIDENT_NEGOTIATION,
              conditionsAndEvidence: 'Thương lượng giá trị tài sản',
            },
            incidentNotificationHours: 36,
            disputeResolutionTerms: 'VibeHue hòa giải trung gian.',
          },
        },
        items: [
          {
            productName: 'Áo dài lụa Huế',
            unitPrice: 100000,
            quantity: 1,
            replacementValue: null, // No replacement value!
          },
        ],
      };

      const lines = buildContractTermsLines(mockSnapshot.policies, mockSnapshot.items);
      const text = lines.join('\n');

      expect(text).toContain('ĐIỀU 4: TIỀN ĐẶT CỌC VÀ BỒI THƯỜNG HƯ HỎNG, MẤT MÁT');
      expect(text).toContain('Phí xử lý hư hỏng nhẹ (vết bẩn tẩy được, bung chỉ nhẹ, cúc tuột): 60.000 đ/lỗi (Điều kiện: Vết bẩn giặt được).');
      expect(text).toContain('Bồi thường hư hỏng vừa (rách nhỏ dưới 5cm, hỏng phụ liệu cần may vá) (Chi phí thực tế): Bồi thường theo chi phí phục hồi/sửa chữa thực tế căn cứ hóa đơn, chứng từ hợp lệ từ đơn vị chuyên nghiệp. Căn cứ: Hóa đơn giặt hấp ngoài');
      expect(text).toContain('Bồi thường hư hỏng nặng (rách vải lớn, biến dạng phom dáng, cháy xém hoặc biến dạng chất liệu) (Thương lượng sự cố): Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận. Căn cứ: Đối chiếu ảnh bàn giao');
      expect(text).toContain('Mất trang phục hoặc không thể phục hồi (không hoàn trả hoặc hư hỏng toàn bộ không thể tái sử dụng) (Thương lượng sự cố): Hai bên đối chiếu hiện trạng và thương lượng số tiền bồi thường dựa trên chứng cứ giao nhận. Căn cứ: Thương lượng giá trị tài sản');
      expect(text).toContain('Thời hạn thông báo sự cố: Bên A có trách nhiệm kiểm tra và gửi thông báo sự cố kèm chứng cứ trong vòng 36 giờ kể từ thời điểm nhận lại trang phục.');
      expect(text).toContain('Hỗ trợ giải quyết tranh chấp: VibeHue hòa giải trung gian.');
      // Must not contain 20% or 100% since no tier used percentage!
      expect(text).not.toContain('20% Giá trị bồi hoàn');
      expect(text).not.toContain('100% Giá trị bồi hoàn');
    });
  });
});
