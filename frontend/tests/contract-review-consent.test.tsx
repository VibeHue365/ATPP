import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ContractReviewModal } from '../src/components/contracts/ContractReviewModal';
import { ProviderContractStatusCard } from '../src/features/provider-dashboard/service-profile/ProviderContractStatusCard';
import { contractService } from '../src/services/contractService';

// Mock feedback toast
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getBookingReadiness: vi.fn(),
    listContractsForBooking: vi.fn(),
    getContractDetail: vi.fn(),
    submitConsent: vi.fn(),
    getProviderMechanism: vi.fn(),
    getProviderAcceptanceStatus: vi.fn(),
  },
}));

// Mock feature flag module
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('Phase 7A: Electronic Contract Review & Consent Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockBookingId = 'booking-abc-123';

  const mockReadinessSingle = {
    requirement: 'REQUIRED' as const,
    bookingId: mockBookingId,
    providers: [
      {
        providerId: 'provider-001',
        contractId: 'contract-001',
        versionId: 'version-v1',
        version: 1,
        status: 'AWAITING_CUSTOMER' as const,
      },
    ],
    blockers: ['CONTRACT_NOT_ACCEPTED'],
    ready: false,
  };

  const mockContractDetail1 = {
    contractId: 'contract-001',
    bookingId: mockBookingId,
    providerId: 'provider-001',
    scope: 'AUTO_ACCEPTANCE',
    legacyStatus: 'AWAITING_CUSTOMER',
    versionId: 'version-v1',
    version: 1,
    state: 'PROPOSED',
    versionState: 'PROPOSED',
    contentHash: '38d6bb17f864cf4ebcb07d57df380e55642d659adfa4234032efb686d6786c5f',
    bookingFingerprint: '17b07c2937746522c071ee52899478f7a9322288339c636f3227efd756858e92',
    expiresAt: '2026-11-20T10:00:00.000Z',
    renderedText: 'HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ\nĐiều 1: Bên Cho Thuê VibeHue Shop\nĐiều 2: Thời hạn thuê 3 ngày...',
  };

  it('1. Renders contract review modal with full rendered text and hash evidence', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessSingle);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail1);

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ/)).toBeDefined();
    });
    expect(screen.getByText(/Điều 1: Bên Cho Thuê VibeHue Shop/)).toBeDefined();

    // Verify evidence badges
    expect(screen.getByText(/38d6bb17f864cf/)).toBeDefined();
    expect(screen.getByText(/17b07c29377465/)).toBeDefined();
    expect(screen.getByText('provider-001')).toBeDefined();
  });

  it('2. Enforces INVARIANT: Never auto-accepts on modal render or open', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessSingle);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail1);

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    const acceptBtn = await screen.findByTestId('btn-accept-contract');

    // Verify submitConsent was NEVER called automatically
    expect(contractService.submitConsent).not.toHaveBeenCalled();

    // Verify action buttons require explicit user click & agreement checkbox
    expect(acceptBtn).toBeDefined();
    expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);

    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);
    expect((acceptBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('3. Submits explicit consent with exact hashes and prevents double-clicking', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessSingle);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail1);
    vi.mocked(contractService.submitConsent).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                consentId: 'consent-999',
                action: 'ACCEPT',
                decidedAt: new Date().toISOString(),
                formedAt: new Date().toISOString(),
                effectiveAt: new Date().toISOString(),
              }),
            100,
          ),
        ),
    );

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    const acceptBtn = await screen.findByTestId('btn-accept-contract');
    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);

    // Click accept
    fireEvent.click(acceptBtn);

    // Verify submitConsent called with exact backend hashes, zero client recalculation
    expect(contractService.submitConsent).toHaveBeenCalledWith(
      'contract-001',
      expect.objectContaining({
        contractVersionId: 'version-v1',
        action: 'ACCEPT',
        contentHash: '38d6bb17f864cf4ebcb07d57df380e55642d659adfa4234032efb686d6786c5f',
        bookingFingerprint: '17b07c2937746522c071ee52899478f7a9322288339c636f3227efd756858e92',
        idempotencyKey: expect.stringMatching(/^consent-contract-001-version-v1-/),
      }),
    );

    // Try clicking again while in-flight: should be disabled (double-click protection)
    expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('4. Multi-Provider Booking: Locks payment gate until all providers are accepted', async () => {
    const mockReadinessMulti = {
      requirement: 'REQUIRED' as const,
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-A',
          contractId: 'contract-A',
          versionId: 'version-A1',
          version: 1,
          status: 'ACCEPTED' as const,
        },
        {
          providerId: 'provider-B',
          contractId: 'contract-B',
          versionId: 'version-B1',
          version: 1,
          status: 'AWAITING_CUSTOMER' as const,
        },
      ],
      blockers: ['CONTRACT_NOT_ACCEPTED'],
      ready: false, // Not ready because provider-B has not been accepted!
    };

    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessMulti);
    vi.mocked(contractService.getContractDetail).mockImplementation((contractId: string) => {
      if (contractId === 'contract-A') {
        return Promise.resolve({
          ...mockContractDetail1,
          contractId: 'contract-A',
          providerId: 'provider-A',
          versionState: 'ACCEPTED',
          renderedText: 'HỢP ĐỒNG NHÀ CUNG CẤP A...',
        });
      }
      return Promise.resolve({
        ...mockContractDetail1,
        contractId: 'contract-B',
        providerId: 'provider-B',
        versionState: 'PROPOSED',
        renderedText: 'HỢP ĐỒNG NHÀ CUNG CẤP B...',
      });
    });

    const onAllAcceptedMock = vi.fn();

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={onAllAcceptedMock}
      />,
    );

    // Warning banner is displayed indicating 1 contract remaining
    const banner = await screen.findByText(
      /Cần chấp thuận 1 hợp đồng thuê trước khi thanh toán/i,
    );
    expect(banner).toBeDefined();

    // Payment button must be disabled because ready === false
    const payBtn = screen.getByTestId('btn-proceed-to-payment');
    expect((payBtn as HTMLButtonElement).disabled).toBe(true);

    // Now simulate user accepting Provider B and backend confirming readiness.ready = true
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      ...mockReadinessMulti,
      providers: [
        { ...mockReadinessMulti.providers[0] },
        { ...mockReadinessMulti.providers[1], status: 'ACCEPTED' },
      ],
      blockers: [],
      ready: true, // All accepted!
    });
    vi.mocked(contractService.submitConsent).mockResolvedValue({
      consentId: 'consent-B',
      action: 'ACCEPT',
      decidedAt: new Date().toISOString(),
      formedAt: new Date().toISOString(),
      effectiveAt: new Date().toISOString(),
    });

    // Switch to Provider B tab (tab index 1)
    const tabB = screen.getByTestId('provider-tab-1');
    fireEvent.click(tabB);

    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);

    const acceptBtn = await screen.findByTestId('btn-accept-contract');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      // Payment button is now enabled
      expect((payBtn as HTMLButtonElement).disabled).toBe(false);
    });

    // Clicking payment button triggers onAllAccepted
    fireEvent.click(payBtn);
    expect(onAllAcceptedMock).toHaveBeenCalledTimes(1);
  });

  it('5. Handles Stale Version error gracefully', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessSingle);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail1);
    vi.mocked(contractService.submitConsent).mockRejectedValue(
      new Error('CONTRACT_VERSION_STALE: A new version has been issued'),
    );

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);

    const acceptBtn = await screen.findByTestId('btn-accept-contract');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('Phiên bản hợp đồng đã thay đổi'),
      );
    });
  });

  it('6. Photography-only booking: requirement NOT_REQUIRED bypasses modal', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'NOT_REQUIRED',
      bookingId: 'booking-photo-only',
      providers: [],
      blockers: [],
      ready: true,
    });

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId="booking-photo-only"
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/không yêu cầu ký kết hợp đồng thuê điện tử/i),
      ).toBeDefined();
    });
  });

  it('7. ProviderContractStatusCard: Displays read-only AUTO_ACCEPTANCE platform status without action buttons', async () => {
    vi.mocked(contractService.getProviderAcceptanceStatus).mockResolvedValue({
      providerId: 'provider-123',
      scope: 'AUTO_ACCEPTANCE',
      active: {
        id: 'acc-1',
        mechanismVersion: 'v1.0',
        templateVersion: 'ao-dai-rental-v2',
        acceptedAt: '2026-10-25T08:00:00.000Z',
      },
    });
    vi.mocked(contractService.getProviderMechanism).mockResolvedValue({
      version: 'v1.0',
      hash: 'hash-abc',
      status: 'ACTIVE',
      regulationCode: 'QC-VIBEHUE-2026-V1',
    });

    render(<ProviderContractStatusCard />);

    await waitFor(() => {
      expect(
        screen.getByText('Cơ chế Hợp đồng Điện tử & Cam kết Nền tảng'),
      ).toBeDefined();
    });

    expect(screen.getByText('AUTO_ACCEPTANCE')).toBeDefined();
    expect(screen.getByText('QC-VIBEHUE-2026-V1')).toBeDefined();
    expect(screen.getByText('ao-dai-rental-v2')).toBeDefined();
    expect(screen.getByText(/Đã ghi nhận cơ chế/i)).toBeDefined();

    // Verify STRICT INVARIANT: NO action buttons (no sign, no approve, no revoke)
    expect(screen.queryByRole('button', { name: /Chấp thuận/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hủy bỏ/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ký hợp đồng/i })).toBeNull();
  });

  it('8. Allows customer to decline contract terms explicitly', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue(mockReadinessSingle);
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail1);
    vi.mocked(contractService.submitConsent).mockResolvedValue({
      consentId: 'consent-declined',
      action: 'DECLINE',
      decidedAt: new Date().toISOString(),
      formedAt: null,
      effectiveAt: null,
    });

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    const declineBtn = await screen.findByTestId('btn-decline-contract');
    fireEvent.click(declineBtn);

    expect(contractService.submitConsent).toHaveBeenCalledWith(
      'contract-001',
      expect.objectContaining({
        contractVersionId: 'version-v1',
        action: 'DECLINE',
        contentHash: mockContractDetail1.contentHash,
        bookingFingerprint: mockContractDetail1.bookingFingerprint,
      }),
    );
  });

  it('9. Empty contracts state: Displays warning when no contracts exist for booking', async () => {
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [],
      blockers: ['NO_CONTRACTS_GENERATED'],
      ready: false,
    });

    render(
      <ContractReviewModal
        isOpen={true}
        bookingId={mockBookingId}
        onClose={vi.fn()}
        onAllAccepted={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Chưa có hợp đồng nào được tạo cho đơn hàng này/i),
      ).toBeDefined();
    });
  });
});
