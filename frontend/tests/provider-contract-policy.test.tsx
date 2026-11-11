import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ProviderPolicyForm } from '../src/features/provider-dashboard/service-profile/ProviderPolicyForm';
import { contractService } from '../src/services/contractService';

// Mock contractService
vi.mock('../src/services/contractService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/contractService')>();
  return {
    ...actual,
    contractService: {
      getProviderCurrentPolicy: vi.fn(),
      saveProviderPolicyDraft: vi.fn(),
      submitProviderPolicyForReview: vi.fn(),
    },
  };
});

// Mock feature flag module
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('P1B — Provider Policy Management Form Suite (No Accessories)', () => {
  const mockInitialPolicy = {
    providerId: 'provider_123',
    active: null,
    pending: null,
    draft: {
      _id: 'policy_draft_1',
      providerId: 'provider_123',
      versionNumber: 1,
      status: 'DRAFT' as const,
      garmentCare: {
        allowIroning: true,
        allowWashing: false,
        prohibitedActions: ['Cắt chỉ', 'Ủi nhiệt độ cao'],
        specialNotes: 'Lụa tơ tằm',
      },
      lateReturn: {
        gracePeriodHours: 2,
        hourlyLateFee: 30000,
        dailyLateFee: 150000,
        maxLateDaysAllowed: 3,
      },
      damageCompensation: {
        minorDamageFee: 50000,
        moderateDamagePercent: 20,
        severeDamageOrLossPercent: 100,
        disputeResolutionNotes: 'Sàn VibeHue hòa giải.',
      },
      cancellationPolicy: {
        refundRules: [
          { daysBeforeRental: 3, refundPercentage: 100 },
          { daysBeforeRental: 1, refundPercentage: 50 },
        ],
        cancellationNotes: 'Tiền cọc luôn hoàn 100%.',
      },
      supportContact: {
        hotline: '0901234567',
        supportWorkingHours: '08:00 - 21:00',
        contactNote: 'Hỗ trợ đổi size.',
      },
      customTermsText: 'Đồng kiểm khi nhận đồ.',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
    totalVersions: 1,
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1. Renders 4 core groups and explicitly DOES NOT contain any accessory fields', async () => {
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(mockInitialPolicy);

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      // 4 groups present
      expect(screen.getByText(/Quy định Bảo quản Áo dài/i)).toBeTruthy();
      expect(screen.getByText(/Quy định Trả trễ & Phí phát sinh/i)).toBeTruthy();
      expect(screen.getByText(/Quy định Bồi thường Hư hỏng & Mất đồ/i)).toBeTruthy();
      expect(screen.getByText(/Chính sách Hủy thuê & Hoàn tiền cọc/i)).toBeTruthy();

      // STRICT CHECK: NO accessories/phụ kiện fields or headings anywhere in the form
      expect(screen.queryByText(/Phụ kiện/i)).toBeNull();
      expect(screen.queryByText(/accessory/i)).toBeNull();
      expect(screen.queryByText(/mấn/i)).toBeNull();
      expect(screen.queryByText(/guốc/i)).toBeNull();
    });
  });

  it('2. Displays DRAFT status badge correctly', async () => {
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(mockInitialPolicy);

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      expect(screen.getByTestId('policy-status-draft')).toBeTruthy();
      expect(screen.getByTestId('policy-status-draft').textContent).toContain('v1');
    });
  });

  it('3. Displays PENDING_REVIEW badge and banner when policy is pending admin review', async () => {
    const pendingPolicy = {
      ...mockInitialPolicy,
      draft: null,
      pending: {
        ...mockInitialPolicy.draft!,
        status: 'PENDING_REVIEW' as const,
      },
    };
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(pendingPolicy);

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      expect(screen.getByTestId('policy-status-pending')).toBeTruthy();
      expect(screen.getByText(/Chính sách đang chờ Ban Quản trị Sàn duyệt/i)).toBeTruthy();
    });
  });

  it('4. Displays REJECTED badge and reviewNote when policy was rejected by admin', async () => {
    const rejectedPolicy = {
      ...mockInitialPolicy,
      draft: {
        ...mockInitialPolicy.draft!,
        status: 'REJECTED' as const,
        reviewNote: 'Mức phạt trễ chưa phù hợp quy chuẩn sàn.',
      },
    };
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(rejectedPolicy);

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      expect(screen.getByTestId('policy-status-rejected')).toBeTruthy();
      expect(screen.getByText(/Mức phạt trễ chưa phù hợp quy chuẩn sàn/i)).toBeTruthy();
    });
  });

  it('5. Provider clicks "Lưu bản thảo (Save Draft)": calls saveProviderPolicyDraft API', async () => {
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(mockInitialPolicy);
    vi.mocked(contractService.saveProviderPolicyDraft).mockResolvedValue(mockInitialPolicy.draft!);

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      expect(screen.getByTestId('save-draft-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('save-draft-btn'));

    await waitFor(() => {
      expect(contractService.saveProviderPolicyDraft).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Đã lưu bản thảo chính sách thành công!/i)).toBeTruthy();
    });
  });

  it('6. Provider clicks "Gửi duyệt chính sách (Submit for Review)": calls submitProviderPolicyForReview API', async () => {
    vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValue(mockInitialPolicy);
    vi.mocked(contractService.submitProviderPolicyForReview).mockResolvedValue({
      ...mockInitialPolicy.draft!,
      status: 'PENDING_REVIEW',
    });

    render(<ProviderPolicyForm />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-review-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('submit-review-btn'));

    await waitFor(() => {
      expect(contractService.submitProviderPolicyForReview).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Đã gửi chính sách lên Ban Quản trị Sàn VibeHue để kiểm duyệt!/i)).toBeTruthy();
    });
  });
});
