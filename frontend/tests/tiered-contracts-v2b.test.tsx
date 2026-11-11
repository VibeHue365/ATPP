import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ContractQuickConsentCard } from '../src/components/contracts/ContractQuickConsentCard';
import { ProviderThresholdSettingsCard } from '../src/features/provider-dashboard/service-profile/ProviderThresholdSettingsCard';
import { ContractReviewModal } from '../src/components/contracts/ContractReviewModal';
import { BookingCheckoutModal } from '../src/features/rentals/components/BookingCheckoutModal';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

// Mock httpClient
vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

// Mock Toast
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

// Mock contractService
vi.mock('../src/services/contractService', () => ({
  contractService: {
    getBookingReadiness: vi.fn(),
    getContractDetail: vi.fn(),
    submitConsent: vi.fn(),
    getProviderContractConfig: vi.fn(),
    updateProviderContractConfig: vi.fn(),
  },
  resolveDamageCompensationRules: vi.fn().mockReturnValue({
    minorDamage: { method: 'FIXED_FEE', fixedFeeAmount: 50000 },
    moderateDamage: { method: 'INCIDENT_NEGOTIATION' },
    severeDamage: { method: 'INCIDENT_NEGOTIATION' },
    totalLoss: { method: 'INCIDENT_NEGOTIATION' },
  }),
}));

// Mock feature flag
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
  CONTRACTS_TIERED_ENABLED: true,
}));

describe('Phase 2B: Tiered Contracts Frontend Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockContractDetailQuick: any = {
    contractId: 'contract-quick-123',
    versionId: 'version-v1',
    version: 1,
    bookingId: 'booking-abc',
    providerId: 'provider-001',
    contentHash: 'hash-abc-1234567890123456789012345678901234567890123456789012345678901234',
    bookingFingerprint: 'bp-abc-123',
    presentationMode: 'QUICK',
    snapshot: {
      provider: { storeName: 'Áo Dài Huế Xưa' },
      pricing: { rentalFee: 150000, depositAmount: 100000, totalAmount: 250000 },
      policies: {
        lateReturn: { gracePeriodHours: 2, hourlyLateFee: 20000, dailyLateFee: 100000 },
        providerDamageCompensation: {},
      },
      items: [{ productName: 'Áo dài truyền thống gấm đỏ', quantity: 1 }],
      booking: { bookingCode: 'BK-QUICK-01' },
    },
  };

  const mockContractDetailDetailed: any = {
    ...mockContractDetailQuick,
    contractId: 'contract-detailed-456',
    presentationMode: 'DETAILED',
    renderedText: 'TOÀN VĂN ĐIỀU KHOẢN HỢP ĐỒNG ĐIỆN TỬ CHI TIẾT A4...',
  };

  describe('1. ContractQuickConsentCard Component', () => {
    it('renders quick badge, concise terms, and checkbox initially unchecked', () => {
      render(
        <ContractQuickConsentCard
          contract={mockContractDetailQuick}
          bookingId="booking-abc"
          onConsented={vi.fn()}
        />,
      );

      // Verify QUICK badge
      expect(screen.getByTestId('presentation-mode-quick-badge')).toBeDefined();
      expect(screen.getByText('QUICK')).toBeDefined();

      // Verify terms content
      expect(screen.getByText(/Áo Dài Huế Xưa/)).toBeDefined();
      expect(screen.getByText(/150.000 đ/)).toBeDefined();
      expect(screen.getAllByText(/100.000 đ/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2 giờ/)).toBeDefined();

      // Checkbox must be unchecked initially
      const checkbox = screen.getByTestId('quick-consent-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      // Submit button must be disabled
      const submitBtn = screen.getByTestId('quick-consent-submit-button') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });

    it('enables submit button only when checkbox is checked, and calls submitConsent with exact hashes', async () => {
      const onConsentedMock = vi.fn();
      vi.mocked(contractService.submitConsent).mockResolvedValue({
        consentId: 'consent-1',
        action: 'ACCEPT',
        decidedAt: new Date().toISOString(),
        formedAt: new Date().toISOString(),
        effectiveAt: new Date().toISOString(),
      });

      render(
        <ContractQuickConsentCard
          contract={mockContractDetailQuick}
          bookingId="booking-abc"
          onConsented={onConsentedMock}
        />,
      );

      const checkbox = screen.getByTestId('quick-consent-checkbox');
      const submitBtn = screen.getByTestId('quick-consent-submit-button');

      // Check the checkbox
      fireEvent.click(checkbox);
      expect((checkbox as HTMLInputElement).checked).toBe(true);
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

      // Click submit
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(contractService.submitConsent).toHaveBeenCalledTimes(1);
        expect(contractService.submitConsent).toHaveBeenCalledWith(
          'contract-quick-123',
          expect.objectContaining({
            contractVersionId: 'version-v1',
            action: 'ACCEPT',
            contentHash: mockContractDetailQuick.contentHash,
            bookingFingerprint: mockContractDetailQuick.bookingFingerprint,
          }),
        );
        expect(onConsentedMock).toHaveBeenCalledTimes(1);
        expect(mockToast.success).toHaveBeenCalledWith('Đã xác nhận điều khoản thuê trang phục!');
      });
    });

    it('handles consent submission failure gracefully without crashing', async () => {
      const onErrorMock = vi.fn();
      vi.mocked(contractService.submitConsent).mockRejectedValue(
        new Error('CONTRACT_VERSION_EXPIRED'),
      );

      render(
        <ContractQuickConsentCard
          contract={mockContractDetailQuick}
          bookingId="booking-abc"
          onConsented={vi.fn()}
          onError={onErrorMock}
        />,
      );

      const checkbox = screen.getByTestId('quick-consent-checkbox');
      const submitBtn = screen.getByTestId('quick-consent-submit-button');

      fireEvent.click(checkbox);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onErrorMock).toHaveBeenCalledTimes(1);
        expect(mockToast.error).toHaveBeenCalled();
      });
    });
  });

  describe('2. ProviderThresholdSettingsCard Component', () => {
    it('loads existing config on mount and displays active mode', async () => {
      vi.mocked(contractService.getProviderContractConfig).mockResolvedValue({
        providerId: 'provider-001',
        contractMode: 'AUTO',
        orderThresholdAmount: null,
        version: 1,
        effectiveFrom: new Date().toISOString(),
      });

      render(<ProviderThresholdSettingsCard />);

      await waitFor(() => {
        const autoRadio = screen.getByTestId('radio-mode-auto') as HTMLInputElement;
        expect(autoRadio.checked).toBe(true);
        expect(screen.getByText(/Cấu hình phiên bản v1/)).toBeDefined();
      });
    });

    it('selecting CUSTOM_ORDER_THRESHOLD displays threshold input, validates range, and saves successfully', async () => {
      vi.mocked(contractService.getProviderContractConfig).mockResolvedValue({
        providerId: 'provider-001',
        contractMode: 'AUTO',
        orderThresholdAmount: null,
        version: 1,
        effectiveFrom: new Date().toISOString(),
      });

      vi.mocked(contractService.updateProviderContractConfig).mockResolvedValue({
        providerId: 'provider-001',
        contractMode: 'CUSTOM_ORDER_THRESHOLD',
        orderThresholdAmount: 500000,
        version: 2,
        effectiveFrom: new Date().toISOString(),
      });

      render(<ProviderThresholdSettingsCard />);

      await waitFor(() => {
        expect(screen.getByTestId('radio-mode-custom')).toBeDefined();
      });

      // Select Custom Threshold Mode
      fireEvent.click(screen.getByTestId('radio-mode-custom'));

      // Threshold input should be visible
      const thresholdInput = screen.getByTestId('input-threshold-amount') as HTMLInputElement;
      expect(thresholdInput).toBeDefined();

      // Change value to 500,000
      fireEvent.change(thresholdInput, { target: { value: '500000' } });

      // Click Save
      const saveBtn = screen.getByTestId('save-threshold-config-button');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(contractService.updateProviderContractConfig).toHaveBeenCalledWith({
          contractMode: 'CUSTOM_ORDER_THRESHOLD',
          orderThresholdAmount: 500000,
        });
        expect(mockToast.success).toHaveBeenCalledWith('Cập nhật cấu hình ngưỡng hợp đồng thành công!');
        expect(screen.getByText(/Phiên bản v2/)).toBeDefined();
      });
    });

    it('rejects invalid threshold amount (e.g. 0 or > 100M)', async () => {
      vi.mocked(contractService.getProviderContractConfig).mockResolvedValue({
        providerId: 'provider-001',
        contractMode: 'CUSTOM_ORDER_THRESHOLD',
        orderThresholdAmount: 500000,
        version: 1,
        effectiveFrom: new Date().toISOString(),
      });

      render(<ProviderThresholdSettingsCard />);

      await waitFor(() => {
        expect(screen.getByTestId('input-threshold-amount')).toBeDefined();
      });

      const thresholdInput = screen.getByTestId('input-threshold-amount');
      const saveBtn = screen.getByTestId('save-threshold-config-button');

      // Set invalid value 0
      fireEvent.change(thresholdInput, { target: { value: '0' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByTestId('threshold-validation-error')).toBeDefined();
        expect(contractService.updateProviderContractConfig).not.toHaveBeenCalled();
      });
    });
  });

  describe('3. ContractReviewModal Tiered Mode Adaptation', () => {
    it('renders ContractQuickConsentCard when contract presentationMode is QUICK', async () => {
      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: 'booking-abc',
        providers: [
          {
            providerId: 'provider-001',
            contractId: 'contract-quick-123',
            versionId: 'version-v1',
            version: 1,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'QUICK',
          },
        ],
        blockers: [],
        ready: false,
        presentationMode: 'QUICK',
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetailQuick);

      render(
        <ContractReviewModal
          isOpen={true}
          bookingId="booking-abc"
          onClose={vi.fn()}
          onAllAccepted={vi.fn()}
        />,
      );

      await waitFor(() => {
        // Quick Consent Card should be rendered
        expect(screen.getByTestId('contract-quick-consent-card')).toBeDefined();
        expect(screen.getByTestId('presentation-mode-quick-badge')).toBeDefined();
        // Duplicate footer buttons must not appear in QUICK mode
        expect(screen.queryByTestId('checkbox-agree-terms')).toBeNull();
      });
    });

    it('renders full ContractDocumentPreview when contract presentationMode is DETAILED', async () => {
      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: 'booking-abc',
        providers: [
          {
            providerId: 'provider-001',
            contractId: 'contract-detailed-456',
            versionId: 'version-v1',
            version: 1,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'DETAILED',
          },
        ],
        blockers: [],
        ready: false,
        presentationMode: 'DETAILED',
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetailDetailed);

      render(
        <ContractReviewModal
          isOpen={true}
          bookingId="booking-abc"
          onClose={vi.fn()}
          onAllAccepted={vi.fn()}
        />,
      );

      await waitFor(() => {
        // Full Document preview should be rendered
        expect(screen.getByTestId('contract-terms-reader')).toBeDefined();
        // Quick card should NOT be rendered
        expect(screen.queryByTestId('contract-quick-consent-card')).toBeNull();
        // Footer checkbox should be present for DETAILED mode
        expect(screen.getByTestId('checkbox-agree-terms')).toBeDefined();
      });
    });
  });

  describe('4. Inline Quick Checkout Integration (BookingCheckoutModal)', () => {
    it('renders Quick Consent Card INLINE inside checkout modal without opening secondary ContractReviewModal', async () => {
      const mockBookingId = 'booking-quick-001';
      vi.mocked(httpClient.post).mockImplementation((url: string) => {
        if (url === '/bookings') {
          return Promise.resolve({ _id: mockBookingId, bookingCode: 'BK-Q1' });
        }
        if (url === '/payments/create-link') {
          return Promise.resolve({ payos: { checkoutUrl: 'https://payos.demo/checkout' } });
        }
        return Promise.resolve({});
      });

      vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
        requirement: 'REQUIRED',
        bookingId: mockBookingId,
        providers: [
          {
            providerId: 'provider-001',
            contractId: 'contract-quick-123',
            versionId: 'version-v1',
            version: 1,
            status: 'AWAITING_CUSTOMER',
            presentationMode: 'QUICK',
          },
        ],
        blockers: [],
        ready: false,
        presentationMode: 'QUICK',
      });

      vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetailQuick);
      vi.mocked(contractService.submitConsent).mockResolvedValue({
        consentId: 'consent-quick-1',
        action: 'ACCEPT',
        decidedAt: new Date().toISOString(),
        formedAt: new Date().toISOString(),
        effectiveAt: new Date().toISOString(),
      });

      const { container } = render(
        <BookingCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          item={{
            id: 'product-001',
            name: 'Áo dài lụa Huế',
            price: 150000,
            providerId: 'provider-001',
          }}
          bookingType="AODAI_RENTAL"
        />,
      );

      // Select date
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-12-01' } });

      // Click proceed
      const checkoutBtn = screen.getByText(/TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i);
      fireEvent.click(checkoutBtn);

      // Verify inline quick consent card appears WITHOUT opening ContractReviewModal
      await waitFor(() => {
        expect(screen.getByTestId('inline-quick-consent-section')).toBeDefined();
        expect(screen.getByTestId('contract-quick-consent-card')).toBeDefined();
        expect(screen.queryByTestId('contract-review-modal')).toBeNull();
      });

      // Customer checks quick agreement checkbox and confirms
      const checkbox = screen.getByTestId('quick-consent-checkbox');
      fireEvent.click(checkbox);

      const confirmBtn = screen.getByTestId('quick-consent-submit-button');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(contractService.submitConsent).toHaveBeenCalledWith(
          'contract-quick-123',
          expect.objectContaining({ action: 'ACCEPT' }),
        );
        expect(httpClient.post).toHaveBeenCalledWith('/payments/create-link', {
          bookingId: mockBookingId,
          purpose: 'FULL_PAYMENT',
        });
      });
    });
  });
});
