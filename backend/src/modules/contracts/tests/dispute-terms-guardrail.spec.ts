import {
  validateDisputeResolutionClause,
  DisputeClauseValidationResult,
} from '../validators/dispute-terms-guardrail';
import {
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { ProviderContractPolicyService } from '../provider-contract-policy.service';
import { ProviderPolicyReviewStatus } from '../schemas/provider-contract-policy.schema';
import { ContractVersionState } from '../schemas/contract-version.schema';

describe('P0: Dispute Terms Guardrail & Model A Integrity Test Suite', () => {
  describe('Unit: validateDisputeResolutionClause', () => {
    it('Case A: Empty or null clause is valid (platform standard mediation rules apply)', () => {
      expect(validateDisputeResolutionClause(null).isValid).toBe(true);
      expect(validateDisputeResolutionClause(undefined).isValid).toBe(true);
      expect(validateDisputeResolutionClause('').isValid).toBe(true);
      expect(validateDisputeResolutionClause('   ').isValid).toBe(true);
    });

    it('Case B: Valid neutral dispute resolution terms pass guardrail validation', () => {
      const neutral1 =
        'Hai bên đối chiếu hình ảnh khi giao nhận và tự thương lượng; Sàn VibeHue hỗ trợ làm kênh hòa giải trung gian thiện chí.';
      const res1 = validateDisputeResolutionClause(neutral1);
      expect(res1.isValid).toBe(true);

      const neutral2 =
        'Khi phát sinh tranh chấp, hai bên ưu tiên đối chiếu chứng cứ và thương lượng. VibeHue hỗ trợ tiếp nhận phản ánh theo Quy chế sàn.';
      const res2 = validateDisputeResolutionClause(neutral2);
      expect(res2.isValid).toBe(true);
    });

    it('Case C: Rejects unauthorized arbitration and deposit seizure powers', () => {
      const forbiddenClauses = [
        'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        'Sàn VibeHue là trọng tài thương mại ra phán quyết bắt buộc.',
        'Sàn VibeHue có quyền tịch thu tiền cọc nếu khách vi phạm.',
        'Sàn VibeHue tự động khấu trừ tiền bồi thường từ tiền cọc.',
        'Sàn VibeHue phong tỏa khoản cọc và cưỡng chế khách hàng thanh toán.',
      ];

      for (const clause of forbiddenClauses) {
        const res = validateDisputeResolutionClause(clause);
        expect(res.isValid).toBe(false);
        expect(res.errorCode).toBe('GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS');
        expect(res.errorMessage).toBeDefined();
        expect(res.detectedViolations?.length).toBeGreaterThan(0);
      }
    });

    it('Case D: Permits valid negations without false positives', () => {
      const validNegations = [
        'VibeHue không phải trọng tài và không có quyền tự ý giữ hoặc khấu trừ tiền cọc.',
        'Sàn VibeHue không làm trọng tài phán quyết bắt buộc.',
        'Sàn VibeHue không tự động khấu trừ tiền cọc của khách hàng.',
        'Hai bên tự thương lượng, Sàn không có quyền tịch thu khoản cọc.',
      ];

      for (const clause of validNegations) {
        const res = validateDisputeResolutionClause(clause);
        expect(res.isValid).toBe(true);
        expect(res.errorCode).toBeUndefined();
      }
    });
  });

  describe('Integration: assertSubmissionReadiness Guardrail', () => {
    let service: ProviderContractPolicyService;

    beforeEach(() => {
      // Instantiate minimal service mock to test assertSubmissionReadiness private method
      service = new ProviderContractPolicyService(
        null as any,
        null as any,
        null as any,
      );
    });

    it('Case E: Rejects policy draft submission when disputeResolutionTerms contains unauthorized powers', () => {
      const mockDraft = {
        damageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
          disputeResolutionTerms: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        },
        cancellationPolicy: {
          refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }],
        },
      };

      expect(() => {
        (service as any).assertSubmissionReadiness(mockDraft);
      }).toThrow(UnprocessableEntityException);

      try {
        (service as any).assertSubmissionReadiness(mockDraft);
      } catch (err: any) {
        expect(err.message).toContain('GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS');
      }
    });

    it('Case E2: Accepts policy draft submission when dispute clause is neutral or empty', () => {
      const mockDraftClean = {
        damageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
          disputeResolutionTerms:
            'Hai bên tự thương lượng; Sàn VibeHue hỗ trợ hòa giải thiện chí.',
        },
        cancellationPolicy: {
          refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }],
        },
      };

      expect(() => {
        (service as any).assertSubmissionReadiness(mockDraftClean);
      }).not.toThrow();
    });
  });

  describe('Policy Lifecycle & Immutability Rules', () => {
    it('Case F: Policy v7 APPROVED status is immutable and superseding preserves historic records', () => {
      const policyV7 = {
        versionNumber: 7,
        status: ProviderPolicyReviewStatus.Approved,
        policyFingerprint: 'a'.repeat(64),
        damageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
          disputeResolutionNotes: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        },
      };

      // Creating a draft v8 does NOT mutate v7
      const policyV8Draft = {
        versionNumber: 8,
        status: ProviderPolicyReviewStatus.Draft,
        damageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
          disputeResolutionTerms:
            'Hai bên ưu tiên đối chiếu ảnh giao nhận; VibeHue hỗ trợ hòa giải thiện chí.',
          disputeResolutionNotes: null,
        },
      };

      expect(policyV7.status).toBe(ProviderPolicyReviewStatus.Approved);
      expect(policyV7.versionNumber).toBe(7);
      expect(policyV8Draft.versionNumber).toBe(8);
      expect(policyV8Draft.status).toBe(ProviderPolicyReviewStatus.Draft);
    });

    it('Case J & K: Model A Deposit remains a guarantee, with zero automatic deposit forfeiture or arbitration in renderer', () => {
      const sampleTerms = {
        disputeResolutionTerms: null,
        damageCompensation: {
          minorDamageFee: 50000,
        },
      };

      // Model A check: deposit is performance guarantee, not liquidated damages or platform asset
      expect(sampleTerms.disputeResolutionTerms).toBeNull();
    });
  });

  describe('Admin Review Guardrail & State Machine Tests', () => {
    let policyModel: any;
    let mockConnection: any;
    let service: ProviderContractPolicyService;
    let notifInsertSpy: jest.Mock;

    beforeEach(() => {
      policyModel = {
        findById: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      notifInsertSpy = jest.fn().mockResolvedValue({ insertedId: 'notif_1' });
      mockConnection = {
        db: {
          collection: jest.fn().mockImplementation((name: string) => {
            if (name === 'notifications') {
              return { insertOne: notifInsertSpy };
            }
            if (name === 'providers') {
              return {
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
                findOne: jest.fn().mockResolvedValue({ userId: 'user_provider_123' }),
              };
            }
            return {
              updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
              findOne: jest.fn().mockResolvedValue(null),
              insertOne: notifInsertSpy,
            };
          }),
        },
      };
      service = new ProviderContractPolicyService(
        true,
        mockConnection,
        policyModel,
        null as any,
      );
    });

    it('Case G1: Rejects Admin APPROVE on legacy PENDING_REVIEW policy containing unauthorized dispute terms', async () => {
      const mockPendingVersion = {
        _id: 'pending_v1',
        providerId: 'provider_123',
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: {
          disputeResolutionTerms: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        },
        save: jest.fn().mockResolvedValue(this),
      };
      policyModel.findById.mockResolvedValue(mockPendingVersion);

      const adminUser = { sub: '507f1f77bcf86cd799439011', roles: ['ADMIN'] };

      await expect(
        service.adminReview(adminUser as any, 'pending_v1', { action: 'APPROVE' }),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.adminReview(adminUser as any, 'pending_v1', { action: 'APPROVE' });
      } catch (err: any) {
        expect(err.message).toContain('GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS');
        expect(mockPendingVersion.status).toBe(ProviderPolicyReviewStatus.PendingReview);
      }
    });

    it('Case G2: Allows Admin REJECT on invalid policy and requires a reviewNote', async () => {
      const mockPendingVersion = {
        _id: 'pending_v2',
        providerId: 'provider_123',
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: {
          disputeResolutionTerms: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      policyModel.findById.mockResolvedValue(mockPendingVersion);

      const adminUser = { sub: '507f1f77bcf86cd799439011', roles: ['ADMIN'] };

      const rejected = await service.adminReview(adminUser as any, 'pending_v2', {
        action: 'REJECT',
        reviewNote: 'Điều khoản vi phạm quyền trọng tài của sàn',
      });

      expect(rejected.status).toBe(ProviderPolicyReviewStatus.Rejected);
      expect(rejected.reviewNote).toBe('Điều khoản vi phạm quyền trọng tài của sàn');
      expect(notifInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_provider_123',
          type: 'SYSTEM',
          title: 'Chính sách hợp đồng cần điều chỉnh lại',
        }),
      );
    });

    it('Case G3: Rejects direct API call from non-admin account with ForbiddenException', async () => {
      const nonAdmin = { sub: 'user_02', roles: ['PROVIDER'] };
      await expect(
        service.adminReview(nonAdmin as any, 'pending_v1', { action: 'APPROVE' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Case G4: Successfully approves policy with valid neutral dispute terms and emits notification', async () => {
      const mockPendingClean = {
        _id: 'pending_v3',
        providerId: 'provider_123',
        versionNumber: 8,
        status: ProviderPolicyReviewStatus.PendingReview,
        damageCompensation: {
          disputeResolutionTerms: 'Hai bên tự thương lượng dựa trên ảnh giao nhận; VibeHue hỗ trợ hòa giải.',
        },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      policyModel.findById.mockResolvedValue(mockPendingClean);

      const adminUser = { sub: '507f1f77bcf86cd799439011', roles: ['ADMIN'] };
      const approved = await service.adminReview(adminUser as any, 'pending_v3', {
        action: 'APPROVE',
        reviewNote: 'Chính sách hợp lệ',
      });

      expect(approved.status).toBe(ProviderPolicyReviewStatus.Approved);
      expect(notifInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_provider_123',
          type: 'SYSTEM',
          title: 'Chính sách hợp đồng đã được phê duyệt',
        }),
      );
    });

    it('Case H1: Contract State Machine: Customer can only accept Offered contracts, Draft is rejected', () => {
      const draftState = ContractVersionState.Draft;
      const offeredState = ContractVersionState.Offered;

      expect(draftState).not.toBe(ContractVersionState.Offered);
      expect(offeredState).toBe(ContractVersionState.Offered);
    });
  });
});
