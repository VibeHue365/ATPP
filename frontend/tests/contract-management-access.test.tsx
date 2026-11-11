import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BookingContractsSection } from '../src/components/contracts/BookingContractsSection';
import { ContractDetailViewerModal } from '../src/components/contracts/ContractDetailViewerModal';
import { ProfileContractsTab } from '../src/features/profile/components/tabs/ProfileContractsTab';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

// Mock Toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    listContractsForBooking: vi.fn(),
    getContractDetail: vi.fn(),
    getEvidence: vi.fn(),
    downloadPdfBlob: vi.fn(),
    triggerPdfDownload: vi.fn(),
    getBookingReadiness: vi.fn(),
    submitConsent: vi.fn(),
    getProviderMechanism: vi.fn(),
    getProviderAcceptanceStatus: vi.fn(),
  },
}));

// Mock httpClient
vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock feature flag to ON by default for management suite
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
}));

describe('Phase 7B: Contract Management & Document Access UI Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. Customer Contract Management & Booking Section', () => {
    it('renders list of contracts associated with rental booking', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: '64b0f0000000000000000001',
          bookingId: 'booking_123',
          providerId: 'provider_ao_dai_hue',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_01',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_canonical_standard_01',
          bookingFingerprint: 'bp_123',
        },
      ]);

      render(<BookingContractsSection bookingId="booking_123" viewerRole="customer" />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-contracts-section')).toBeTruthy();
      });

      expect(screen.getByText(/Hợp đồng điện tử/i)).toBeTruthy();
      expect(screen.getByText(/Mã HĐ: 00000001/i)).toBeTruthy();
      expect(screen.getByText(/v1/i)).toBeTruthy();
      expect(screen.getByText(/provider_ao_dai_hue/i)).toBeTruthy();
      expect(screen.getByText(/Đã ghi nhận chấp thuận/i)).toBeTruthy();
      expect(screen.getByTestId('view-contract-btn-64b0f0000000000000000001')).toBeTruthy();
      expect(screen.getByTestId('download-contract-btn-64b0f0000000000000000001')).toBeTruthy();
    });

    it('strictly uses neutral legal phrasing and prevents misleading claims', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_neutral_check',
          bookingId: 'booking_neutral',
          providerId: 'provider_test',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_neutral',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_neutral',
          bookingFingerprint: 'bfp_neutral',
        },
      ]);

      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce({
        contractId: 'contract_neutral_check',
        bookingId: 'booking_neutral',
        providerId: 'provider_test',
        scope: 'PROVIDER',
        legacyStatus: 'ACCEPTED',
        versionId: 'ver_neutral',
        version: 1,
        state: 'ACCEPTED',
        contentHash: 'hash_neutral',
        bookingFingerprint: 'bfp_neutral',
        renderedText: 'Nội dung hợp đồng...',
        versionState: 'ACCEPTED',
        expiresAt: null,
      });

      render(<BookingContractsSection bookingId="booking_neutral" viewerRole="customer" />);

      await waitFor(() => {
        expect(screen.getByTestId('view-contract-btn-contract_neutral_check')).toBeTruthy();
      });

      // Must NOT claim "Hiệu lực", "xác lập", or "chữ ký số"
      expect(screen.queryByText(/Đã chấp thuận & Hiệu lực/i)).toBeNull();
      expect(screen.queryByText(/chữ ký số/i)).toBeNull();
      expect(screen.queryByText(/Đã xác lập/i)).toBeNull();

      fireEvent.click(screen.getByTestId('view-contract-btn-contract_neutral_check'));

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail-viewer-modal')).toBeTruthy();
      });

      // Modal must also use neutral wording
      expect(screen.getAllByText(/Đã ghi nhận chấp thuận/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/Đã chấp thuận & Hiệu lực/i)).toBeNull();
    });

    it('renders empty message or hides when no contracts exist', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([]);

      const { container } = render(
        <BookingContractsSection bookingId="booking_no_contracts" viewerRole="customer" hideWhenEmpty={true} />,
      );

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('opens ContractDetailViewerModal on "Xem" click and displays rendered text and evidence', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_view_test',
          bookingId: 'booking_456',
          providerId: 'provider_viet_phuc',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_456',
          version: 2,
          state: 'ACCEPTED',
          contentHash: 'content_sha256_canonical_abc123',
          bookingFingerprint: 'bfp_456',
        },
      ]);

      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce({
        contractId: 'contract_view_test',
        bookingId: 'booking_456',
        providerId: 'provider_viet_phuc',
        scope: 'PROVIDER',
        legacyStatus: 'ACCEPTED',
        versionId: 'ver_456',
        version: 2,
        state: 'ACCEPTED',
        contentHash: 'content_sha256_canonical_abc123',
        bookingFingerprint: 'bfp_456',
        renderedText: 'ĐIỀU KHOẢN HỢP ĐỒNG THUÊ ÁO DÀI VIỆT PHỤC\nBên A đồng ý cho Bên B thuê trang phục...',
        versionState: 'ACCEPTED',
        expiresAt: null,
      });

      vi.mocked(contractService.getEvidence).mockResolvedValueOnce({
        contractId: 'contract_view_test',
        contractCode: 'HD-20261029-0099',
        versionId: 'ver_456',
        versionNumber: 2,
        contentHash: 'content_sha256_canonical_abc123',
        bookingFingerprint: 'bfp_456',
        documentStatus: 'READY',
        pdfSha256: 'pdf_sha256_immutable_file_789xyz',
        generatedAt: new Date('2026-10-29T10:00:00Z'),
        integrityVerified: true,
        customerConsent: {
          consentedAt: new Date('2026-10-29T09:59:00Z'),
          authMethod: 'JWT_BEARER',
          userId: 'user_cust_01',
        },
      });

      render(<BookingContractsSection bookingId="booking_456" viewerRole="customer" />);

      await waitFor(() => {
        expect(screen.getByTestId('view-contract-btn-contract_view_test')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('view-contract-btn-contract_view_test'));

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail-viewer-modal')).toBeTruthy();
      });

      expect(screen.getByText(/Hợp đồng Điện tử: HD-20261029-0099/i)).toBeTruthy();
      expect(screen.getByTestId('contract-rendered-text').textContent).toContain('Bên A đồng ý cho Bên B thuê trang phục');
      expect(screen.getByText('content_sha256_canonical_abc123')).toBeTruthy();
      expect(screen.getByText('pdf_sha256_immutable_file_789xyz')).toBeTruthy();
      expect(screen.getByText(/JWT_BEARER/i)).toBeTruthy();
    });
  });

  describe('2. Provider Contract Isolation & Auto-acceptance', () => {
    it('displays isolated provider contract with auto-acceptance note and no unapproved actions', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_provider_isolated_01',
          bookingId: 'booking_multi_01',
          providerId: 'provider_a',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_prov_01',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_prov_a',
          bookingFingerprint: 'fp_prov_a',
        },
      ]);

      render(<BookingContractsSection bookingId="booking_multi_01" viewerRole="provider" />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-contracts-section')).toBeTruthy();
      });

      // Provider badge & disclaimer
      expect(screen.getByText(/Phạm vi đối tác \(Isolated\)/i)).toBeTruthy();
      expect(
        screen.getByText(/Đối tác chấp thuận trước cơ chế theo quy chế nền tảng VibeHue khi công bố sản phẩm/i),
      ).toBeTruthy();

      // Ensure NO unauthorized signing or revocation buttons exist in viewer
      expect(screen.queryByText(/Ký hợp đồng/i)).toBeNull();
      expect(screen.queryByText(/Hủy hợp đồng/i)).toBeNull();
      expect(screen.queryByText(/Chỉnh sửa điều khoản/i)).toBeNull();
    });
  });

  describe('3. PDF Download & Evidence Integrity', () => {
    it('triggers authenticated PDF download and shows success toast when status is READY', async () => {
      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce({
        contractId: 'contract_pdf_ready',
        bookingId: 'booking_pdf_01',
        providerId: 'provider_test',
        scope: 'PROVIDER',
        legacyStatus: 'ACCEPTED',
        versionId: 'ver_ready',
        version: 1,
        state: 'ACCEPTED',
        contentHash: 'hash_content_ready',
        bookingFingerprint: 'bfp_ready',
        renderedText: 'Nội dung hợp đồng...',
        versionState: 'ACCEPTED',
        expiresAt: null,
      });

      vi.mocked(contractService.getEvidence).mockResolvedValueOnce({
        contractId: 'contract_pdf_ready',
        contractCode: 'HD-20261029-READY',
        versionId: 'ver_ready',
        versionNumber: 1,
        contentHash: 'hash_content_ready',
        bookingFingerprint: 'bfp_ready',
        documentStatus: 'READY',
        pdfSha256: 'pdf_sha256_full_valid',
        generatedAt: new Date(),
        integrityVerified: true,
        customerConsent: null,
      });

      vi.mocked(contractService.triggerPdfDownload).mockResolvedValueOnce({
        filename: 'HD-20261029-READY-v1.pdf',
        sha256: 'pdf_sha256_full_valid',
      });

      render(
        <ContractDetailViewerModal
          contractId="contract_pdf_ready"
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('download-contract-pdf-btn')).toBeTruthy();
      });

      const downloadBtn = screen.getByTestId('download-contract-pdf-btn') as HTMLButtonElement;
      expect(downloadBtn.disabled).toBe(false);
      expect(downloadBtn.textContent).toContain('Tải PDF Hợp đồng');

      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(contractService.triggerPdfDownload).toHaveBeenCalledWith('contract_pdf_ready', undefined);
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('HD-20261029-READY-v1.pdf'));
      });
    });

    it('disables download button and handles 422 CONTRACT_PDF_NOT_READY gracefully', async () => {
      vi.mocked(contractService.getContractDetail).mockResolvedValueOnce({
        contractId: 'contract_pdf_pending',
        bookingId: 'booking_pdf_02',
        providerId: 'provider_test',
        scope: 'PROVIDER',
        legacyStatus: 'ACCEPTED',
        versionId: 'ver_pending',
        version: 1,
        state: 'ACCEPTED',
        contentHash: 'hash_content_pending',
        bookingFingerprint: 'bfp_pending',
        renderedText: 'Nội dung hợp đồng...',
        versionState: 'ACCEPTED',
        expiresAt: null,
      });

      vi.mocked(contractService.getEvidence).mockResolvedValueOnce({
        contractId: 'contract_pdf_pending',
        contractCode: 'HD-20261029-PENDING',
        versionId: 'ver_pending',
        versionNumber: 1,
        contentHash: 'hash_content_pending',
        bookingFingerprint: 'bfp_pending',
        documentStatus: 'GENERATING',
        pdfSha256: null,
        generatedAt: null,
        integrityVerified: false,
        customerConsent: null,
      });

      render(
        <ContractDetailViewerModal
          contractId="contract_pdf_pending"
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('download-contract-pdf-btn')).toBeTruthy();
      });

      const downloadBtn = screen.getByTestId('download-contract-pdf-btn') as HTMLButtonElement;
      expect(downloadBtn.disabled).toBe(true);
      expect(downloadBtn.textContent).toContain('PDF đang khởi tạo');
    });

    it('shows warning toast when direct download encounters 422 CONTRACT_PDF_NOT_READY', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_direct_download',
          bookingId: 'booking_direct',
          providerId: 'provider_direct',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_direct',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_direct',
          bookingFingerprint: 'bfp_direct',
        },
      ]);

      const err422 = new Error('CONTRACT_PDF_NOT_READY') as Error & { status: number };
      err422.status = 422;
      vi.mocked(contractService.triggerPdfDownload).mockRejectedValueOnce(err422);

      render(<BookingContractsSection bookingId="booking_direct" viewerRole="customer" />);

      await waitFor(() => {
        expect(screen.getByTestId('download-contract-btn-contract_direct_download')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('download-contract-btn-contract_direct_download'));

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining('Tài liệu PDF đang được hệ thống tạo'),
        );
      });
    });

    it('shows error toast when download fails with 403 Forbidden', async () => {
      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_forbidden',
          bookingId: 'booking_forbidden',
          providerId: 'provider_other',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'ver_forbidden',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_forbidden',
          bookingFingerprint: 'bfp_forbidden',
        },
      ]);

      const err403 = new Error('FORBIDDEN_CONTRACT_READER') as Error & { status: number };
      err403.status = 403;
      vi.mocked(contractService.triggerPdfDownload).mockRejectedValueOnce(err403);

      render(<BookingContractsSection bookingId="booking_forbidden" viewerRole="customer" />);

      await waitFor(() => {
        expect(screen.getByTestId('download-contract-btn-contract_forbidden')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('download-contract-btn-contract_forbidden'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Bạn không có quyền truy cập'),
        );
      });
    });
  });

  describe('4. Profile Contracts Tab & Multi-Booking Management', () => {
    it('loads rental bookings and displays contracts sections', async () => {
      vi.mocked(httpClient.get).mockResolvedValueOnce([
        {
          _id: 'booking_cust_01',
          bookingCode: 'DH-001',
          createdAt: '2026-10-29T10:00:00Z',
          status: 'PAID',
          items: [{ itemType: 'PRODUCT', productId: 'p1' }],
        },
      ]);

      vi.mocked(contractService.listContractsForBooking).mockResolvedValueOnce([
        {
          contractId: 'contract_cust_01',
          bookingId: 'booking_cust_01',
          providerId: 'tiem_ao_dai_xua',
          scope: 'PROVIDER',
          legacyStatus: 'ACCEPTED',
          versionId: 'v1',
          version: 1,
          state: 'ACCEPTED',
          contentHash: 'hash_01',
          bookingFingerprint: 'fp_01',
        },
      ]);

      render(<ProfileContractsTab />);

      await waitFor(() => {
        expect(screen.getByTestId('profile-contracts-tab')).toBeTruthy();
      });

      expect(screen.getByText(/Hợp đồng Điện tử của tôi/i)).toBeTruthy();
      expect(screen.getByText(/Đơn hàng #DH-001/i)).toBeTruthy();
    });

    it('shows empty message when customer has no rental bookings', async () => {
      vi.mocked(httpClient.get).mockResolvedValueOnce([
        {
          _id: 'booking_photo_only',
          bookingCode: 'DH-PHOTO',
          createdAt: '2026-10-29T10:00:00Z',
          status: 'PAID',
          items: [{ itemType: 'PHOTOSHOOT', photographyPackageId: 'pkg1' }],
        },
      ]);

      render(<ProfileContractsTab />);

      await waitFor(() => {
        expect(screen.getByTestId('no-contracts-message')).toBeTruthy();
      });

      expect(screen.getByText(/Chưa có hợp đồng điện tử nào/i)).toBeTruthy();
    });
  });
});
