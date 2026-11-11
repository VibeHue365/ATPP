import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ContractReviewModal } from '../src/components/contracts/ContractReviewModal';
import { ContractQuickConsentCard } from '../src/components/contracts/ContractQuickConsentCard';
import { BookingContractsSection } from '../src/components/contracts/BookingContractsSection';
import { ProviderPolicyForm } from '../src/features/provider-dashboard/service-profile/ProviderPolicyForm';
import { contractService } from '../src/services/contractService';

// Mock Toast
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

// Mock contractService
vi.mock('../src/services/contractService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/contractService')>();
  return {
    ...actual,
    contractService: {
      getBookingReadiness: vi.fn(),
      listContractsForBooking: vi.fn(),
      getContractDetail: vi.fn(),
      submitConsent: vi.fn(),
      refreshContracts: vi.fn(),
      getProviderCurrentPolicy: vi.fn(),
      getProviderPolicyVersions: vi.fn(),
      saveProviderPolicyDraft: vi.fn(),
      submitProviderPolicyForReview: vi.fn(),
      downloadPdfBlob: vi.fn(),
      triggerPdfDownload: vi.fn(),
    },
  };
});

// Mock feature flag
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('Contracts V2 Enhancements Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockBookingId = 'booking-v2-test';

  describe('Requirement 1: Admin Views Contracts from Order Detail', () => {
    it('displays contracts for all shops in multi-provider order with PDF download and detail viewer', async () => {
      const mockMultiShopContracts = [
        {
          contractId: 'contract-shop-01',
          contractCode: 'V2-B123-SHOP01-FULLCODE',
          bookingId: mockBookingId,
          providerId: 'provider-01',
          providerName: 'Áo Dài Huế Xưa',
          scope: 'AoDaiRental',
          state: 'ACCEPTED',
          presentationMode: 'DETAILED' as const,
          isSigned: true,
          contentHash: 'hash-shop-01',
          bookingFingerprint: 'fp-shop-01',
          rentalFee: 150000,
          depositAmount: 50000,
          replacementValue: 500000,
          agreedAt: '2026-11-10T10:00:00Z',
          evidenceHash: 'evidence-hash-01',
        },
        {
          contractId: 'contract-shop-02',
          contractCode: 'V2-B123-SHOP02-FULLCODE',
          bookingId: mockBookingId,
          providerId: 'provider-02',
          providerName: 'Tiệm Cổ Trang Sen Vàng',
          scope: 'AoDaiRental',
          state: 'ACCEPTED',
          presentationMode: 'QUICK' as const,
          isSigned: true,
          contentHash: 'hash-shop-02',
          bookingFingerprint: 'fp-shop-02',
          rentalFee: 200000,
          depositAmount: 100000,
          replacementValue: 800000,
          agreedAt: '2026-11-10T10:05:00Z',
          evidenceHash: 'evidence-hash-02',
        },
      ];

      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce(mockMultiShopContracts as any);
      vi.mocked(contractService.triggerPdfDownload).mockResolvedValueOnce({
        filename: 'contract-shop-01.pdf',
        sha256: 'hash-pdf-01',
      });

      render(
        <BookingContractsSection
          bookingId={mockBookingId}
          bookingStatus="CONFIRMED"
          viewerRole="admin"
          hideWhenEmpty={false}
        />,
      );

      // Verify both shops are listed
      await waitFor(() => {
        expect(screen.getByText('Áo Dài Huế Xưa')).toBeDefined();
        expect(screen.getByText('Tiệm Cổ Trang Sen Vàng')).toBeDefined();
      });

      // Verify contract code truncation components are rendered
      expect(screen.getByText('Hợp đồng điện tử')).toBeDefined();
      expect(screen.getByText('Thỏa thuận thuê nhanh')).toBeDefined();

      // Find PDF download button and click it
      const downloadButtons = screen.getAllByRole('button', { name: /Tải PDF/i });
      expect(downloadButtons.length).toBe(2);
      fireEvent.click(downloadButtons[0]);

      await waitFor(() => {
        expect(contractService.triggerPdfDownload).toHaveBeenCalledWith('contract-shop-01', undefined);
      });
    });
  });

  describe('Requirement 2: Provider Policy Version History', () => {
    it('renders "Lịch sử phiên bản" button and opens history modal with past versions', async () => {
      vi.mocked(contractService.getProviderCurrentPolicy).mockResolvedValueOnce({
        providerId: 'provider-test',
        active: {
          _id: 'p-v2',
          providerId: 'provider-test',
          versionNumber: 2,
          status: 'APPROVED',
          garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: [], specialNotes: null },
          lateReturn: { gracePeriodHours: 2, hourlyLateFee: 30000, dailyLateFee: 150000, maxLateDaysAllowed: 3 },
          damageCompensation: {} as any,
          cancellationPolicy: { refundRules: [], cancellationNotes: null },
          supportContact: { hotline: '0901234567', supportWorkingHours: '08:00 - 20:00', contactNote: null },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        pending: null,
        draft: null,
        totalVersions: 2,
      });

      const mockVersions = [
        {
          _id: 'ver-2',
          providerId: 'provider-test',
          versionNumber: 2,
          status: 'APPROVED' as const,
          submittedAt: '2026-11-01T10:00:00Z',
          approvedAt: '2026-11-02T15:00:00Z',
          garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: ['Cấm xịt nước hoa'], specialNotes: 'Bảo quản kỹ' },
          lateReturn: { gracePeriodHours: 2, hourlyLateFee: 35000, dailyLateFee: 160000, maxLateDaysAllowed: 3 },
          damageCompensation: {} as any,
          cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }], cancellationNotes: 'Hoàn 100% cọc' },
          supportContact: { hotline: '0909999999', supportWorkingHours: '08:00 - 21:00' },
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-02T15:00:00Z',
        },
        {
          _id: 'ver-1',
          providerId: 'provider-test',
          versionNumber: 1,
          status: 'REJECTED' as const,
          submittedAt: '2026-10-15T09:00:00Z',
          reviewedAt: '2026-10-16T11:00:00Z',
          reviewNote: 'Mức phí bồi thường chưa hợp lý theo quy chuẩn sàn.',
          garmentCare: { allowIroning: false, allowWashing: false, prohibitedActions: [], specialNotes: null },
          lateReturn: { gracePeriodHours: 1, hourlyLateFee: 20000, dailyLateFee: 100000, maxLateDaysAllowed: 2 },
          damageCompensation: {} as any,
          cancellationPolicy: { refundRules: [], cancellationNotes: null },
          supportContact: { hotline: '0909999999', supportWorkingHours: '08:00 - 21:00' },
          createdAt: '2026-10-15T09:00:00Z',
          updatedAt: '2026-10-16T11:00:00Z',
        },
      ];

      vi.mocked(contractService.getProviderPolicyVersions).mockResolvedValueOnce(mockVersions);

      render(<ProviderPolicyForm />);

      // Find "Lịch sử phiên bản" button
      const historyBtn = await screen.findByTestId('btn-policy-history');
      expect(historyBtn).toBeDefined();

      // Click to open history modal
      fireEvent.click(historyBtn);

      // Verify history API was called
      expect(contractService.getProviderPolicyVersions).toHaveBeenCalledTimes(1);

      // Verify versions are listed
      await waitFor(() => {
        expect(screen.getByTestId('policy-history-modal')).toBeDefined();
        expect(screen.getByTestId('history-version-item-2')).toBeDefined();
        expect(screen.getByTestId('history-version-item-1')).toBeDefined();
      });

      // Verify status and rejection reason on v1
      expect(screen.getByTestId('rejection-reason-1').textContent).toContain(
        'Mức phí bồi thường chưa hợp lý theo quy chuẩn sàn.',
      );

      // Open read-only view for v2
      const viewV2Btn = screen.getByTestId('btn-view-version-2');
      fireEvent.click(viewV2Btn);

      await waitFor(() => {
        expect(screen.getByTestId('policy-version-detail-modal')).toBeDefined();
        expect(screen.getByText(/Chính sách Phiên bản v2/)).toBeDefined();
        expect(screen.getByText('Chỉ đọc')).toBeDefined();
        expect(screen.getByText(/Cấm xịt nước hoa/)).toBeDefined();
      });
    });
  });

  describe('Requirement 3: Customer Handles Declined or Stale Contracts', () => {
    it('hides the accept button on a DECLINED version and shows guidance to create a new version', async () => {
      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'shop-01',
            contractId: 'contract-declined-01',
            versionId: 'ver-declined-1',
            version: 1,
            status: 'DECLINED',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: ['CONTRACT_DECLINED'],
        ready: false,
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue({
        contractId: 'contract-declined-01',
        contractCode: 'V2-BOOKING-SHOP01',
        bookingId: mockBookingId,
        providerId: 'shop-01',
        providerName: 'Áo dài Cố Đô',
        versionId: 'ver-declined-1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'DETAILED',
        renderedText: 'HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ',
        contentHash: 'hash-declined-01',
        bookingFingerprint: 'fp-declined-01',
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
          provider: { businessName: 'Áo dài Cố Đô' },
        } as any,
      });

      render(
        <ContractReviewModal
          isOpen={true}
          onClose={vi.fn()}
          bookingId={mockBookingId}
          onAllAccepted={vi.fn()}
        />,
      );

      // Verify DECLINED status badge is rendered
      await waitFor(() => {
        expect(screen.getAllByTestId('status-declined').length).toBeGreaterThan(0);
      });

      // Verify Accept button is NOT rendered on this declined version
      expect(screen.queryByTestId('btn-accept-contract')).toBeNull();
      expect(screen.queryByTestId('checkbox-agree-terms')).toBeNull();

      // Verify guidance banner is displayed
      const guidance = screen.getByTestId('declined-contract-guidance');
      expect(guidance).toBeDefined();
      expect(guidance.textContent).toContain('Bạn đã từ chối điều khoản phiên bản này');

      // Verify "Tạo phiên bản hợp đồng mới" button is available since hold is active
      const requestNewVersionBtn = screen.getByTestId('btn-request-new-version');
      expect(requestNewVersionBtn).toBeDefined();

      // Click "Tạo phiên bản hợp đồng mới"
      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'shop-01',
            contractId: 'contract-declined-01',
            versionId: 'ver-new-2',
            version: 2,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: [],
        ready: false,
      });

      fireEvent.click(requestNewVersionBtn);

      await waitFor(() => {
        expect(contractService.refreshContracts).toHaveBeenCalledWith(mockBookingId);
      });
    });

    it('shows STALE_SNAPSHOT guidance and allows updating to a new version when terms changed', async () => {
      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'shop-01',
            contractId: 'contract-stale-01',
            versionId: 'ver-stale-1',
            version: 1,
            status: 'STALE_SNAPSHOT',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: ['CONTRACT_CONTENT_STALE'],
        ready: false,
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue({
        contractId: 'contract-stale-01',
        contractCode: 'V2-BOOKING-STALE01',
        bookingId: mockBookingId,
        providerId: 'shop-01',
        providerName: 'Áo dài Cố Đô',
        versionId: 'ver-stale-1',
        version: 1,
        presentationMode: 'DETAILED',
        renderedText: 'HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ (CŨ)',
        contentHash: 'hash-stale-01',
        bookingFingerprint: 'fp-stale-01',
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
        } as any,
      });

      render(
        <ContractReviewModal
          isOpen={true}
          onClose={vi.fn()}
          bookingId={mockBookingId}
          onAllAccepted={vi.fn()}
        />,
      );

      // Verify STALE status badge is rendered
      await waitFor(() => {
        expect(screen.getAllByTestId('status-stale').length).toBeGreaterThan(0);
      });

      // Verify accept button is hidden on stale contract
      expect(screen.queryByTestId('btn-accept-contract')).toBeNull();

      // Verify stale guidance banner
      const staleGuidance = screen.getByTestId('stale-contract-guidance');
      expect(staleGuidance.textContent).toContain('Điều khoản hợp đồng đã thay đổi');

      // Click update stale version
      const updateBtn = screen.getByTestId('btn-update-stale-version');
      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [],
        blockers: [],
        ready: true,
      });

      fireEvent.click(updateBtn);
      await waitFor(() => {
        expect(contractService.refreshContracts).toHaveBeenCalledWith(mockBookingId);
      });
    });

    it('ContractQuickConsentCard hides checkbox and accept button when version is DECLINED', () => {
      const mockContract = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'QUICK' as const,
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
          pricing: { rentalFee: 100000, depositAmount: 50000 },
          provider: { storeName: 'Shop Huế Xưa' },
          items: [{ unitPrice: 100000, quantity: 1, depositAmount: 50000, replacementValue: 500000 }],
        } as any,
      };

      render(
        <ContractQuickConsentCard
          contract={mockContract}
          bookingId={mockBookingId}
          onConsented={vi.fn()}
        />,
      );

      // Verify checkbox and accept button are NOT rendered
      expect(screen.queryByTestId('quick-consent-checkbox')).toBeNull();
      expect(screen.queryByTestId('quick-consent-submit-button')).toBeNull();

      // Verify declined guidance is rendered
      expect(screen.getByTestId('quick-declined-guidance')).toBeDefined();
      expect(screen.getByText(/Bạn đã từ chối thỏa thuận thuê nhanh phiên bản này/)).toBeDefined();
      expect(screen.getByTestId('btn-quick-refresh-version')).toBeDefined();
    });

    it('ContractReviewModal reports no new version when terms unchanged and retains declined state', async () => {
      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'shop-01',
            contractId: 'contract-declined-01',
            versionId: 'ver-declined-1',
            version: 1,
            status: 'DECLINED',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: ['CONTRACT_DECLINED'],
        ready: false,
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue({
        contractId: 'contract-declined-01',
        contractCode: 'V2-BOOKING-SHOP01',
        bookingId: mockBookingId,
        providerId: 'shop-01',
        providerName: 'Áo dài Cố Đô',
        versionId: 'ver-declined-1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'DETAILED',
        renderedText: 'HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ',
        contentHash: 'hash-declined-01',
        bookingFingerprint: 'fp-declined-01',
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
        } as any,
      });

      render(
        <ContractReviewModal
          isOpen={true}
          onClose={vi.fn()}
          bookingId={mockBookingId}
          onAllAccepted={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('btn-request-new-version')).toBeDefined();
      });

      // Mock refreshContracts returning SAME versionId (ver-declined-1)
      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'shop-01',
            contractId: 'contract-declined-01',
            versionId: 'ver-declined-1', // Same version!
            version: 1,
            status: 'DECLINED',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: ['CONTRACT_DECLINED'],
        ready: false,
      });

      fireEvent.click(screen.getByTestId('btn-request-new-version'));

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining('Chưa có phiên bản mới do điều khoản chưa thay đổi'),
        );
        expect(screen.getByTestId('refresh-no-change-notice')).toBeDefined();
        expect(screen.getByTestId('refresh-no-change-notice').textContent).toContain(
          'Chưa có phiên bản mới do điều khoản chưa thay đổi',
        );
      });

      // Still in declined state: accept button remains hidden
      expect(screen.queryByTestId('btn-accept-contract')).toBeNull();
    });

    it('Issue 1: Refresh without change keeps version, displays accurate notice, and does NOT call onConsented', async () => {
      const mockContract = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'QUICK' as const,
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        } as any,
      };

      const mockOnConsented = vi.fn();
      const mockOnRefreshed = vi.fn();

      render(
        <ContractQuickConsentCard
          contract={mockContract}
          bookingId={mockBookingId}
          onConsented={mockOnConsented}
          onRefreshed={mockOnRefreshed}
        />,
      );

      const refreshBtn = screen.getByTestId('btn-quick-refresh-version');

      // Backend returns same versionId 'v1'
      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'provider-01',
            contractId: 'quick-contract-01',
            versionId: 'v1',
            version: 1,
            status: 'DECLINED',
            presentationMode: 'QUICK',
          },
        ],
        blockers: [],
        ready: false,
      });

      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining('Chưa có phiên bản mới do điều khoản chưa thay đổi'),
        );
        expect(screen.getByTestId('quick-refresh-no-change-notice')).toBeDefined();
        expect(screen.getByTestId('quick-refresh-no-change-notice').textContent).toContain(
          'Hợp đồng vẫn giữ trạng thái đã từ chối',
        );
      });

      // Crucial: Neither onConsented nor onRefreshed was called!
      expect(mockOnConsented).not.toHaveBeenCalled();
      expect(mockOnRefreshed).not.toHaveBeenCalled();
    });

    it('Issue 1: Refresh creating new version does NOT call onConsented, calls onRefreshed, resets consent, and requires customer agreement before consenting', async () => {
      const mockContract_v1 = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'QUICK' as const,
        contentHash: 'hash-v1',
        bookingFingerprint: 'fp-v1',
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        } as any,
      };

      const mockContract_v2 = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v2',
        version: 2,
        versionState: 'AWAITING_CUSTOMER',
        presentationMode: 'QUICK' as const,
        contentHash: 'hash-v2',
        bookingFingerprint: 'fp-v2',
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
          pricing: { rentalFee: 66666, depositAmount: 11111 },
        } as any,
      };

      const mockOnConsented = vi.fn();
      const mockOnRefreshed = vi.fn();
      const mockOnModeSwitchToDetailed = vi.fn();

      const { rerender } = render(
        <ContractQuickConsentCard
          contract={mockContract_v1}
          bookingId={mockBookingId}
          onConsented={mockOnConsented}
          onRefreshed={mockOnRefreshed}
          onModeSwitchToDetailed={mockOnModeSwitchToDetailed}
        />,
      );

      const refreshBtn = screen.getByTestId('btn-quick-refresh-version');

      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'provider-01',
            contractId: 'quick-contract-01',
            versionId: 'v2', // Upgraded to v2!
            version: 2,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'QUICK',
          },
        ],
        blockers: [],
        ready: false,
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce(mockContract_v2 as any);

      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Đã cập nhật phiên bản mới! Vui lòng xem xét và đồng ý lại.'),
        );
        expect(mockOnRefreshed).toHaveBeenCalledWith(
          expect.objectContaining({ versionId: 'v2' }),
          expect.anything(),
        );
      });

      // CRITICAL REQUIREMENT: onConsented was NOT called upon refresh!
      expect(mockOnConsented).not.toHaveBeenCalled();
      expect(mockOnModeSwitchToDetailed).not.toHaveBeenCalled();

      // Parent updates the contract prop with v2
      rerender(
        <ContractQuickConsentCard
          contract={mockContract_v2}
          bookingId={mockBookingId}
          onConsented={mockOnConsented}
          onRefreshed={mockOnRefreshed}
          onModeSwitchToDetailed={mockOnModeSwitchToDetailed}
        />,
      );

      // Checkbox is reset to unchecked
      const checkbox = screen.getByTestId('quick-consent-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      const submitBtn = screen.getByTestId('quick-consent-submit-button') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);

      // Customer reads and ticks agreement
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      expect(submitBtn.disabled).toBe(false);

      // Submit consent for v2
      vi.mocked(contractService.submitConsent).mockResolvedValueOnce({ success: true } as any);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(contractService.submitConsent).toHaveBeenCalledWith(
          'quick-contract-01',
          expect.objectContaining({
            contractVersionId: 'v2',
            action: 'ACCEPT',
            contentHash: 'hash-v2',
            bookingFingerprint: 'fp-v2',
          }),
        );
        // Only AFTER submitConsent API succeeds is onConsented() finally called!
        expect(mockOnConsented).toHaveBeenCalledTimes(1);
      });
    });

    it('Issue 1: Refreshed version requiring DETAILED mode triggers onModeSwitchToDetailed and does NOT call onConsented', async () => {
      const mockContract_v1 = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v1',
        version: 1,
        versionState: 'DECLINED',
        presentationMode: 'QUICK' as const,
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        } as any,
      };

      const mockContract_v2_detailed = {
        contractId: 'quick-contract-01',
        bookingId: mockBookingId,
        providerId: 'provider-01',
        versionId: 'v2',
        version: 2,
        versionState: 'AWAITING_CUSTOMER',
        presentationMode: 'DETAILED' as const, // Switched to DETAILED!
        snapshot: {
          booking: { holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        } as any,
      };

      const mockOnConsented = vi.fn();
      const mockOnRefreshed = vi.fn();
      const mockOnModeSwitchToDetailed = vi.fn();

      render(
        <ContractQuickConsentCard
          contract={mockContract_v1}
          bookingId={mockBookingId}
          onConsented={mockOnConsented}
          onRefreshed={mockOnRefreshed}
          onModeSwitchToDetailed={mockOnModeSwitchToDetailed}
        />,
      );

      vi.mocked(contractService.refreshContracts).mockResolvedValueOnce({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'provider-01',
            contractId: 'quick-contract-01',
            versionId: 'v2',
            version: 2,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'DETAILED', // DETAILED mode from backend
          },
        ],
        blockers: [],
        ready: false,
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce(mockContract_v2_detailed as any);

      fireEvent.click(screen.getByTestId('btn-quick-refresh-version'));

      await waitFor(() => {
        expect(mockOnModeSwitchToDetailed).toHaveBeenCalled();
      });

      // Does NOT proceed to payment or call onConsented
      expect(mockOnConsented).not.toHaveBeenCalled();
    });
  });
});
