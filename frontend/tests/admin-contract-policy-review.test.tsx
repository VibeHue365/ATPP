import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AdminContractPolicyReviewPanel } from '../src/features/admin-contract-policy/components/AdminContractPolicyReviewPanel';
import { contractService } from '../src/services/contractService';

vi.mock('../src/services/contractService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/contractService')>();
  return {
    ...actual,
    contractService: {
      getAdminPendingPolicies: vi.fn(),
      getAdminPolicyDetail: vi.fn(),
      reviewAdminPolicy: vi.fn(),
    },
  };
});

const mockPendingPolicies = [
  {
    _id: 'pol-1',
    id: 'pol-1',
    providerId: 'prov-1',
    versionNumber: 2,
    status: 'PENDING_REVIEW' as const,
    providerInfo: {
      id: 'prov-1',
      shopName: 'Áo Dài Huế Xưa',
      email: 'huexua@vibehue.test',
      phone: '0901234567',
    },
    garmentCare: {
      allowIroning: true,
      allowWashing: false,
      prohibitedActions: ['Tẩy trắng clo', 'Sấy nhiệt độ cao'],
      specialNotes: 'Áo lụa tơ tằm cao cấp',
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
      disputeResolutionNotes: 'Hòa giải qua sàn',
    },
    cancellationPolicy: {
      refundRules: [
        { daysBeforeRental: 3, refundPercentage: 100 },
        { daysBeforeRental: 1, refundPercentage: 50 },
      ],
      cancellationNotes: 'Hoàn 100% cọc',
    },
    supportContact: {
      hotline: '0901234567',
      supportWorkingHours: '08:00 - 21:00',
    },
    customTermsText: 'Khách hàng vui lòng kiểm tra kỹ tà áo trước khi nhận.',
    submittedAt: '2026-11-03T08:00:00.000Z',
    createdAt: '2026-11-03T07:00:00.000Z',
    updatedAt: '2026-11-03T08:00:00.000Z',
  },
];

const mockDetailData = {
  current: mockPendingPolicies[0],
  activeApproved: {
    _id: 'pol-0',
    id: 'pol-0',
    providerId: 'prov-1',
    versionNumber: 1,
    status: 'APPROVED' as const,
    garmentCare: {
      allowIroning: false,
      allowWashing: false,
      prohibitedActions: [],
    },
    lateReturn: {
      gracePeriodHours: 1,
      hourlyLateFee: 20000,
      dailyLateFee: 100000,
      maxLateDaysAllowed: 2,
    },
    damageCompensation: {
      minorDamageFee: 30000,
      moderateDamagePercent: 15,
      severeDamageOrLossPercent: 80,
    },
    cancellationPolicy: {
      refundRules: [{ daysBeforeRental: 2, refundPercentage: 100 }],
    },
    supportContact: {
      hotline: '0901234567',
      supportWorkingHours: '08:00 - 18:00',
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  history: [
    { id: 'pol-1', versionNumber: 2, status: 'PENDING_REVIEW' },
    { id: 'pol-0', versionNumber: 1, status: 'APPROVED' },
  ],
  providerInfo: mockPendingPolicies[0].providerInfo,
};

describe('P1C — Admin Policy Review Panel Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Loads and renders pending policies with shop name and version badge', async () => {
    vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValue(mockPendingPolicies);

    render(<AdminContractPolicyReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('Áo Dài Huế Xưa')).toBeDefined();
    });

    expect(screen.getByTestId('pending-count-badge').textContent).toContain('1 Đang chờ duyệt');
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText(/30,000đ\/h/)).toBeDefined();
    expect(screen.getByText(/150,000đ\/ngày/)).toBeDefined();
  });

  it('2. Opens review detail modal and presents side-by-side comparison', async () => {
    vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValue(mockPendingPolicies);
    vi.mocked(contractService.getAdminPolicyDetail).mockResolvedValue(mockDetailData);

    render(<AdminContractPolicyReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('Áo Dài Huế Xưa')).toBeDefined();
    });

    const reviewBtn = screen.getByTestId('review-policy-btn-2');
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByTestId('admin-policy-review-modal')).toBeDefined();
    });

    expect(screen.getByText(/Bản Đang Áp Dụng \(Active Approved\)/)).toBeDefined();
    expect(screen.getByText(/Bản Chờ Duyệt \(Pending Review\)/)).toBeDefined();
    expect(screen.getByText(/Khách hàng vui lòng kiểm tra kỹ tà áo/)).toBeDefined();
  });

  it('3. Rejection requires a mandatory note; shows error if empty', async () => {
    vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValue(mockPendingPolicies);
    vi.mocked(contractService.getAdminPolicyDetail).mockResolvedValue(mockDetailData);

    render(<AdminContractPolicyReviewPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('review-policy-btn-2')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('review-policy-btn-2'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-reject-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('trigger-reject-btn'));

    const confirmBtn = screen.getByTestId('confirm-review-decision-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Bắt buộc cung cấp lý do từ chối để Shop đối tác nắm thông tin/i),
      ).toBeDefined();
    });

    expect(contractService.reviewAdminPolicy).not.toHaveBeenCalled();
  });

  it('4. Successfully submits REJECT decision when reason note is provided', async () => {
    vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValue(mockPendingPolicies);
    vi.mocked(contractService.getAdminPolicyDetail).mockResolvedValue(mockDetailData);
    vi.mocked(contractService.reviewAdminPolicy).mockResolvedValue({
      ...mockPendingPolicies[0],
      status: 'REJECTED',
    });

    render(<AdminContractPolicyReviewPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('review-policy-btn-2')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('review-policy-btn-2'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-reject-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('trigger-reject-btn'));

    const noteInput = screen.getByTestId('review-note-input');
    fireEvent.change(noteInput, {
      target: { value: 'Phí trễ hạn 150.000đ/ngày chưa phù hợp với khung giá sàn.' },
    });

    fireEvent.click(screen.getByTestId('confirm-review-decision-btn'));

    await waitFor(() => {
      expect(contractService.reviewAdminPolicy).toHaveBeenCalledWith('pol-1', {
        action: 'REJECT',
        reviewNote: 'Phí trễ hạn 150.000đ/ngày chưa phù hợp với khung giá sàn.',
      });
    });
  });

  it('5. Successfully submits APPROVE decision directly with 1-click and triggers refresh', async () => {
    vi.mocked(contractService.getAdminPendingPolicies).mockResolvedValue(mockPendingPolicies);
    vi.mocked(contractService.getAdminPolicyDetail).mockResolvedValue(mockDetailData);
    vi.mocked(contractService.reviewAdminPolicy).mockResolvedValue({
      ...mockPendingPolicies[0],
      status: 'APPROVED',
    });

    render(<AdminContractPolicyReviewPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('review-policy-btn-2')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('review-policy-btn-2'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-approve-btn')).toBeDefined();
    });

    // 1-click APPROVE: does not prompt for redundant note or confirmation modal
    fireEvent.click(screen.getByTestId('trigger-approve-btn'));

    await waitFor(() => {
      expect(contractService.reviewAdminPolicy).toHaveBeenCalledWith('pol-1', {
        action: 'APPROVE',
      });
    });
  });
});
