import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProviderPolicyForm } from '../src/features/provider-dashboard/service-profile/ProviderPolicyForm';
import { AdminContractPolicyReviewPanel } from '../src/features/admin-contract-policy/components/AdminContractPolicyReviewPanel';
import { contractService } from '../src/services/contractService';
import { validateDisputeResolutionClause } from '../src/features/provider-dashboard/service-profile/disputeTermsGuardrail';

vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

vi.mock('../src/services/contractService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/contractService')>();
  return {
    ...actual,
    contractService: {
      ...actual.contractService,
      getProviderCurrentPolicy: vi.fn(),
      saveProviderPolicyDraft: vi.fn(),
      submitProviderPolicyForReview: vi.fn(),
      getAdminPendingPolicies: vi.fn(),
      getAdminPolicyDetail: vi.fn(),
      adminReviewPolicy: vi.fn(),
    },
  };
});

describe('Frontend Dispute Terms Guardrail & Review Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('disputeTermsGuardrail unit tests', () => {
    it('Case A & B: empty or neutral dispute terms pass', () => {
      expect(validateDisputeResolutionClause(null).isValid).toBe(true);
      expect(validateDisputeResolutionClause('').isValid).toBe(true);
      expect(
        validateDisputeResolutionClause(
          'Hai bên tự thương lượng; VibeHue hỗ trợ hòa giải trung gian.',
        ).isValid,
      ).toBe(true);
    });

    it('Case C: flags forbidden arbitration and deposit seizure assertions', () => {
      const res = validateDisputeResolutionClause(
        'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
      );
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('GUARDRAIL_UNAUTHORIZED_DISPUTE_POWERS');
    });

    it('Case D: accepts valid negations without false alarm', () => {
      const res = validateDisputeResolutionClause(
        'VibeHue không phải là trọng tài và không có quyền tự ý khấu trừ tiền cọc.',
      );
      expect(res.isValid).toBe(true);
    });
  });

  describe('ProviderPolicyForm UI', () => {
    it('Case A: Default form does NOT pre-fill the arbitration clause', async () => {
      vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValueOnce({
        activeApproved: null,
        draft: null,
        pendingReview: null,
      });

      render(<ProviderPolicyForm />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-policy-form')).toBeDefined();
      });

      const disputeInput = screen.getByLabelText(
        /Cơ chế giải quyết tranh chấp/i,
      ) as HTMLInputElement;
      expect(disputeInput.value).toBe('');
      expect(disputeInput.value).not.toContain('làm trọng tài');
      expect(disputeInput.value).not.toContain('bảo lưu');
    });

    it('Case C: Shows real-time guardrail alert when provider types unauthorized clause', async () => {
      vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValueOnce({
        activeApproved: null,
        draft: null,
        pendingReview: null,
      });

      render(<ProviderPolicyForm />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-policy-form')).toBeDefined();
      });

      const disputeInput = screen.getByLabelText(
        /Cơ chế giải quyết tranh chấp/i,
      ) as HTMLInputElement;

      fireEvent.change(disputeInput, {
        target: {
          value: 'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
        },
      });

      expect(screen.getByText(/Cảnh báo guardrail:/i)).toBeDefined();
      expect(screen.getByText(/không được gán quyền 'trọng tài'/i)).toBeDefined();
    });

    it('Case D: Valid negation does not trigger guardrail alert', async () => {
      vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValueOnce({
        activeApproved: null,
        draft: null,
        pendingReview: null,
      });

      render(<ProviderPolicyForm />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-policy-form')).toBeDefined();
      });

      const disputeInput = screen.getByLabelText(
        /Cơ chế giải quyết tranh chấp/i,
      ) as HTMLInputElement;

      fireEvent.change(disputeInput, {
        target: {
          value: 'VibeHue không phải trọng tài và không tự ý giữ cọc.',
        },
      });

      expect(screen.queryByText(/Cảnh báo guardrail:/i)).toBeNull();
    });
  });

  describe('AdminContractPolicyReviewPanel UI', () => {
    it('Case E: Admin modal displays verbatim dispute clause and highlights violation', async () => {
      vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValueOnce([
        {
          _id: 'pending-pol-1',
          id: 'pending-pol-1',
          versionNumber: 8,
          status: 'PENDING_REVIEW',
          submittedAt: new Date().toISOString(),
          providerInfo: { shopName: 'Shop aaa', email: 'aaa@vibehue.test' },
          damageCompensation: {
            minorDamageFee: 50000,
            moderateDamagePercent: 20,
            severeDamageOrLossPercent: 100,
            disputeResolutionTerms:
              'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
          },
          lateReturn: { hourlyLateFee: 40000, dailyLateFee: 150000, gracePeriodHours: 2, maxLateDaysAllowed: 3 },
          cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }] },
        } as any,
      ]);

      vi.mocked(contractService.getAdminPolicyDetail).mockResolvedValueOnce({
        providerInfo: { shopName: 'Shop aaa', email: 'aaa@vibehue.test' } as any,
        activeApproved: {
          versionNumber: 7,
          garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: [] },
          lateReturn: { hourlyLateFee: 40000, dailyLateFee: 150000, gracePeriodHours: 2, maxLateDaysAllowed: 3 },
          damageCompensation: {
            minorDamageFee: 50000,
            moderateDamagePercent: 20,
            severeDamageOrLossPercent: 100,
            disputeResolutionTerms: null,
          },
          cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }] },
        } as any,
        current: {
          versionNumber: 8,
          submittedAt: new Date().toISOString(),
          garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: [] },
          lateReturn: { hourlyLateFee: 40000, dailyLateFee: 150000, gracePeriodHours: 2, maxLateDaysAllowed: 3 },
          damageCompensation: {
            minorDamage: { method: 'FIXED_FEE', fixedFeeAmount: 50000 },
            moderateDamage: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 20 },
            severeDamage: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 100 },
            totalLoss: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 95 },
            disputeResolutionTerms:
              'Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc.',
          },
          cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }] },
        } as any,
        history: [{ versionNumber: 7, status: 'APPROVED' }, { versionNumber: 8, status: 'PENDING_REVIEW' }] as any,
      });

      render(<AdminContractPolicyReviewPanel />);

      await waitFor(() => {
        expect(screen.getByText('Shop aaa')).toBeDefined();
      });

      const reviewBtn = screen.getByTestId('review-policy-btn-8');
      fireEvent.click(reviewBtn);

      await waitFor(() => {
        expect(screen.getByTestId('admin-policy-review-modal')).toBeDefined();
      });

      // Verbatim text must be displayed
      expect(
        screen.getAllByText(/Sàn VibeHue làm trọng tài hòa giải và bảo lưu tiền cọc\./).length,
      ).toBeGreaterThanOrEqual(1);

      // Guardrail warning banner must be shown
      expect(screen.getByText(/CẢNH BÁO VI PHẠM THẨM QUYỀN SÀN:/i)).toBeDefined();
      expect(
        screen.getByText(/Đề nghị Admin BẤM 'TỪ CHỐI CHÍNH SÁCH'/i),
      ).toBeDefined();
    });
  });
});
