import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BookingCheckoutModal } from '../src/features/rentals/components/BookingCheckoutModal';
import { contractService } from '../src/services/contractService';
import { httpClient } from '../src/services/httpClient';

// Mock feedback toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
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
    checkEligibility: vi.fn().mockResolvedValue({ eligible: true, ineligibleItems: [] }),
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

// Default mock feature flag to ON for checkout gate tests
vi.mock('../src/config/features', () => ({
  CONTRACTS_V2_ENABLED: true,
  CONTRACTS_TIERED_ENABLED: true,
}));

describe('Phase 7A.1: Checkout Entry Points Integration & Contract Gate Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '', assign: vi.fn() },
    });
  });

  const mockItem = {
    id: 'product-aodai-001',
    name: 'Áo Dài Nhật Bình Gấm Thượng Hải',
    price: 450000,
    providerId: 'provider-aodai-hanoi',
  };

  const mockBookingId = 'booking-64b0f0000000000000000001';

  const mockContractDetail = {
    contractId: 'contract-v2-101',
    bookingId: mockBookingId,
    providerId: 'provider-aodai-hanoi',
    scope: 'AUTO_ACCEPTANCE',
    legacyStatus: 'AWAITING_CUSTOMER',
    versionId: 'version-v2-1',
    version: 1,
    state: 'PROPOSED',
    versionState: 'PROPOSED',
    contentHash: '38d6bb17f864cf4ebcb07d57df380e55642d659adfa4234032efb686d6786c5f',
    bookingFingerprint: '17b07c2937746522c071ee52899478f7a9322288339c636f3227efd756858e92',
    expiresAt: '2026-11-20T10:00:00.000Z',
    renderedText: 'ĐIỀU KHOẢN HỢP ĐỒNG THUÊ ÁO DÀI ĐIỆN TỬ...',
  };

  it('1. BookingCheckoutModal: When contract is REQUIRED & unaccepted, pauses checkout and does NOT call create-link', async () => {
    // 1. Mock booking creation
    vi.mocked(httpClient.post).mockResolvedValueOnce({ _id: mockBookingId });

    // 2. Mock readiness check returning REQUIRED but NOT ready
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-aodai-hanoi',
          contractId: 'contract-v2-101',
          versionId: 'version-v2-1',
          version: 1,
          status: 'AWAITING_CUSTOMER',
        },
      ],
      blockers: ['CONTRACT_NOT_ACCEPTED'],
      ready: false,
    });

    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail);

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    // Pick rental date
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    // Click Proceed Checkout
    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    // Verify booking was created exactly once
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith(
        '/bookings',
        expect.objectContaining({ bookingType: 'AODAI_RENTAL' }),
      );
    });

    // Verify readiness was evaluated
    expect(contractService.getBookingReadiness).toHaveBeenCalledWith(mockBookingId);

    // CRITICAL: create-link MUST NOT be called because ready is false!
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );

    // Verify ContractReviewModal is displayed
    expect(
      await screen.findByText('Xem xét & Chấp thuận Hợp đồng Điện tử'),
    ).toBeDefined();
  });

  it('2. BookingCheckoutModal: After successful consent, continues with exact initial bookingId and purpose', async () => {
    let isAccepted = false;

    // 1. Mock booking creation and create-link
    vi.mocked(httpClient.post).mockImplementation((url: string) => {
      if (url === '/bookings') {
        return Promise.resolve({ _id: mockBookingId });
      }
      if (url === '/payments/create-link') {
        return Promise.resolve({
          paymentCode: 'PAY-12345',
          payos: { checkoutUrl: 'https://pay.payos.vn/sim-checkout-12345' },
        });
      }
      return Promise.reject(new Error(`Unhandled POST url: ${url}`));
    });

    // 2. Dynamic readiness check: transitions to ready when consent is submitted
    vi.mocked(contractService.getBookingReadiness).mockImplementation(async () => ({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-aodai-hanoi',
          contractId: 'contract-v2-101',
          versionId: 'version-v2-1',
          version: 1,
          status: isAccepted ? 'ACCEPTED' : 'AWAITING_CUSTOMER',
        },
      ],
      blockers: isAccepted ? [] : ['CONTRACT_NOT_ACCEPTED'],
      ready: isAccepted,
    }));

    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail);
    vi.mocked(contractService.submitConsent).mockImplementation(async () => {
      isAccepted = true;
      return {
        consentId: 'consent-ok',
        action: 'ACCEPT',
        decidedAt: new Date().toISOString(),
        formedAt: new Date().toISOString(),
        effectiveAt: new Date().toISOString(),
      };
    });

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    // Wait for modal to open
    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);
    const acceptBtn = await screen.findByTestId('btn-accept-contract');
    fireEvent.click(acceptBtn);

    // Wait for readiness to become ready and payment button to enable
    const payBtn = await screen.findByTestId('btn-proceed-to-payment');
    await waitFor(() => {
      expect((payBtn as HTMLButtonElement).disabled).toBe(false);
    });

    // Click proceed to payment
    fireEvent.click(payBtn);

    // CRITICAL ASSERTION: Calls /payments/create-link with EXACT initial bookingId and FULL_PAYMENT purpose
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith('/payments/create-link', {
        bookingId: mockBookingId,
        purpose: 'FULL_PAYMENT',
      });
    });

    // CRITICAL: Did NOT call /bookings a second time!
    const bookingCalls = vi
      .mocked(httpClient.post)
      .mock.calls.filter(([url]) => url === '/bookings');
    expect(bookingCalls.length).toBe(1);
  });

  it('3. BookingCheckoutModal: When user closes modal, does NOT proceed to payment', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ _id: mockBookingId });
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-aodai-hanoi',
          contractId: 'contract-v2-101',
          versionId: 'version-v2-1',
          version: 1,
          status: 'AWAITING_CUSTOMER',
        },
      ],
      blockers: ['CONTRACT_NOT_ACCEPTED'],
      ready: false,
    });
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail);

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    const closeBtns = await screen.findAllByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtns[0]);

    // create-link must never be called
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );
  });

  it('4. BookingCheckoutModal: When user DECLINES contract, does NOT proceed to payment', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ _id: mockBookingId });
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-aodai-hanoi',
          contractId: 'contract-v2-101',
          versionId: 'version-v2-1',
          version: 1,
          status: 'AWAITING_CUSTOMER',
        },
      ],
      blockers: ['CONTRACT_NOT_ACCEPTED'],
      ready: false,
    });
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail);
    vi.mocked(contractService.submitConsent).mockResolvedValue({
      consentId: 'consent-declined',
      action: 'DECLINE',
      decidedAt: new Date().toISOString(),
      formedAt: null,
      effectiveAt: null,
    });

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    const declineBtn = await screen.findByTestId('btn-decline-contract');
    fireEvent.click(declineBtn);

    // Payment button remains disabled
    const payBtn = screen.getByTestId('btn-proceed-to-payment');
    expect((payBtn as HTMLButtonElement).disabled).toBe(true);

    // create-link must never be called
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );
  });

  it('5. Fail-closed: When readiness API returns error or 503, fails closed and does NOT bypass or fallback to legacy', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ _id: mockBookingId });
    vi.mocked(contractService.getBookingReadiness).mockRejectedValueOnce(
      new Error('503 Service Unavailable: CONTRACTS_V2_DISABLED'),
    );

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/CONTRACTS_V2_DISABLED|Tính năng Hợp đồng điện tử/i),
      );
    });

    // CRITICAL: Must FAIL-CLOSED! create-link must NOT be called as fallback!
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );
  });

  it('6. Legacy rental booking: requirement NOT_REQUIRED proceeds directly without modal pause', async () => {
    const legacyBookingId = 'booking-legacy-999';
    vi.mocked(httpClient.post).mockImplementation((url: string) => {
      if (url === '/bookings') {
        return Promise.resolve({ _id: legacyBookingId });
      }
      if (url === '/payments/create-link') {
        return Promise.resolve({
          paymentCode: 'PAY-LEGACY',
          payos: { checkoutUrl: 'https://pay.payos.vn/sim-legacy' },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'NOT_REQUIRED',
      bookingId: legacyBookingId,
      providers: [],
      blockers: [],
      ready: true,
    });

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    // Directly creates payment link without modal interruption
    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith('/payments/create-link', {
        bookingId: legacyBookingId,
        purpose: 'FULL_PAYMENT',
      });
    });
  });

  it('7. Stale hold expiration: Does not reuse expired booking or proceed to payment', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ _id: mockBookingId });
    vi.mocked(contractService.getBookingReadiness).mockResolvedValue({
      requirement: 'REQUIRED',
      bookingId: mockBookingId,
      providers: [
        {
          providerId: 'provider-aodai-hanoi',
          contractId: 'contract-v2-101',
          versionId: 'version-v2-1',
          version: 1,
          status: 'AWAITING_CUSTOMER',
        },
      ],
      blockers: ['CONTRACT_NOT_ACCEPTED'],
      ready: false,
    });
    vi.mocked(contractService.getContractDetail).mockResolvedValue(mockContractDetail);
    vi.mocked(contractService.submitConsent).mockRejectedValue(
      new Error('BOOKING_HOLD_EXPIRED: The hold has expired and cannot be accepted'),
    );

    const { container } = render(
      <BookingCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        bookingType="AODAI_RENTAL"
      />,
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    const checkoutBtn = screen.getByRole('button', {
      name: /TIẾN HÀNH ĐẶT CỌC & THANH TOÁN/i,
    });
    fireEvent.click(checkoutBtn);

    const agreeBox = await screen.findByTestId('checkbox-agree-terms');
    fireEvent.click(agreeBox);
    const acceptBtn = await screen.findByTestId('btn-accept-contract');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('Thời hạn giữ đơn đã hết hạn'),
      );
    });

    // Payment button is still disabled
    const payBtn = screen.getByTestId('btn-proceed-to-payment');
    expect((payBtn as HTMLButtonElement).disabled).toBe(true);

    // create-link must never be called
    expect(httpClient.post).not.toHaveBeenCalledWith(
      '/payments/create-link',
      expect.anything(),
    );
  });
});
