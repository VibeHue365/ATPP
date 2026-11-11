import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BookingCheckoutModal } from '../src/features/rentals/components/BookingCheckoutModal';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../src/services/contractService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/contractService')>();
  return {
    ...actual,
    contractService: {
      ...actual.contractService,
      checkEligibility: vi.fn(),
      getBookingReadiness: vi.fn(),
      getContractDetail: vi.fn(),
    },
  };
});

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
  CONTRACTS_TIERED_ENABLED: true,
}));

describe('Frontend Dual-Mode Checkout: Legacy vs Contract V2', () => {
  const mockProduct = {
    id: 'prod-64b0f0000000000000000001',
    name: 'Áo Dài Lụa Hà Đông',
    price: 300000,
    depositAmount: 100000,
    images: ['/test.png'],
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1. Legacy Shop Checkout (contractFlowVersion = null): Bypasses contract modals and proceeds directly to payment link', async () => {
    vi.mocked(contractService.checkEligibility).mockResolvedValueOnce({
      eligible: true,
      ineligibleItems: [],
      flow: 'LEGACY',
    });

    const mockBookingId = 'booking-legacy-001';
    vi.mocked(httpClient.post).mockImplementation(async (url: string) => {
      if (url === '/bookings') {
        return {
          _id: mockBookingId,
          bookingCode: 'B_LEGACY_001',
          contractFlowVersion: null, // LEGACY
        };
      }
      if (url === '/payments/create-link') {
        return {
          payos: { checkoutUrl: 'https://pay.os/simulator-legacy' },
        };
      }
      return {};
    });

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockProduct}
        bookingType="AODAI_RENTAL"
      />
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

    const checkoutBtn = screen.getByText(/tiến hành đặt cọc/i);
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith('/bookings', expect.anything());
    });

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith('/payments/create-link', {
        bookingId: mockBookingId,
        purpose: 'FULL_PAYMENT',
      });
    });

    expect(screen.queryByText(/thỏa thuận thuê nhanh/i)).toBeNull();
    expect(screen.queryByTestId('contract-review-modal')).toBeNull();
  });

  it('2. Contract V2 Shop Checkout (contractFlowVersion = 2): Blocks checkout with Quick Consent modal until consented', async () => {
    vi.mocked(contractService.checkEligibility).mockResolvedValueOnce({
      eligible: true,
      ineligibleItems: [],
      flow: 'CONTRACT_V2',
    });

    const mockBookingId = 'booking-v2-001';
    vi.mocked(httpClient.post).mockImplementation(async (url: string) => {
      if (url === '/bookings') {
        return {
          _id: mockBookingId,
          bookingCode: 'B_V2_001',
          contractFlowVersion: 2, // V2
        };
      }
      if (url === '/payments/create-link') {
        return {
          payos: { checkoutUrl: 'https://pay.os/simulator-v2' },
        };
      }
      return {};
    });

    vi.mocked(contractService.getBookingReadiness).mockResolvedValueOnce({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      ready: false,
      presentationMode: 'QUICK',
      providers: [
        {
          providerId: 'prov-1',
          contractId: 'contract-1',
          versionId: 'ver-1',
          version: 1,
          status: 'AWAITING_CUSTOMER',
          presentationMode: 'QUICK',
        },
      ],
      blockers: [],
    });

    vi.mocked(contractService.getContractDetail).mockResolvedValueOnce({
      contractId: 'contract-1',
      versionId: 'ver-1',
      version: 1,
      bookingId: mockBookingId,
      bookingCode: 'B_V2_001',
      providerName: 'Tiệm Hoàng Cung',
      presentationMode: 'QUICK',
      sections: {
        payment: { rentAmount: 300000, depositAmount: 100000 },
        returnLatePolicy: { lateFeePerHour: 40000, lateFeePerDay: 150000, returnGracePeriodHours: 2 },
        damagePolicy: { minorDamageFee: 50000, severeOrLossPolicyText: 'Theo chính sách' },
      },
      audit: {
        templateVersion: '1.0.0',
        contentHash: 'hash-abc',
        canonicalFingerprint: 'canon-abc',
      },
    } as any);

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockProduct}
        bookingType="AODAI_RENTAL"
      />
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

    const checkoutBtn = screen.getByText(/tiến hành đặt cọc/i);
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(contractService.getBookingReadiness).toHaveBeenCalledWith(mockBookingId);
    });

    expect(httpClient.post).not.toHaveBeenCalledWith('/payments/create-link', expect.anything());

    await waitFor(() => {
      expect(screen.getByText(/thỏa thuận thuê nhanh/i)).toBeDefined();
      expect(screen.getAllByText(/cửa hàng/i).length).toBeGreaterThan(0);
    });
  });
});
