import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CheckoutResultPage from '../src/pages/checkout/CheckoutResultPage';
import { httpClient } from '../src/services/httpClient';

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

const mockRemoveFromCart = vi.fn();
vi.mock('../src/context/CartContext', () => ({
  useCart: () => ({
    removeFromCart: mockRemoveFromCart,
  }),
}));

describe('P0: CheckoutResultPage Terminal States & Anti-Stuck Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithCode = (code = 'PAYV2_6A9C904A98684B253C') => {
    return render(
      <MemoryRouter initialEntries={[`/checkout/result?paymentCode=${code}`]}>
        <Routes>
          <Route path="/checkout/result" element={<CheckoutResultPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('1. SUCCESS + Confirmed Booking (clean, no review flag): Clears cart and provides view order link', async () => {
    localStorage.setItem('vh_pending_checkout_PAYV2_6A9C904A98684B253C', JSON.stringify({ cartItemIds: ['item_1', 'item_2'] }));
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'SUCCESS',
      bookingStatus: 'CONFIRMED',
      confirmed: true,
      needsManualReview: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Thanh toán thành công!')).toBeTruthy();
    expect(screen.getByText('Xem đơn hàng')).toBeTruthy();
    expect(mockRemoveFromCart).toHaveBeenCalledWith('item_1', 0, ['item_1', 'item_2']);
    expect(mockRemoveFromCart).toHaveBeenCalledWith('item_2', 1, ['item_1', 'item_2']);
    expect(localStorage.getItem('vh_pending_checkout_PAYV2_6A9C904A98684B253C')).toBeNull();
  });

  it('2. REVIEW_REQUIRED (SUCCESS captured but unconfirmed booking): Stops spinner, does NOT clear cart, warns against duplicate payment', async () => {
    localStorage.setItem('vh_pending_checkout_PAYV2_6A9C904A98684B253C', JSON.stringify({ cartItemIds: ['item_1'] }));
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'SUCCESS',
      bookingStatus: 'PENDING_PAYMENT',
      confirmed: false,
      needsManualReview: true,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Giao dịch đang được xác thực')).toBeTruthy();
    expect(screen.getByText(/Vui lòng không thực hiện thanh toán lại/)).toBeTruthy();
    expect(screen.queryByText('Quay lại giỏ hàng')).toBeNull();
    expect(screen.getByText('Xem đơn hàng')).toBeTruthy();
    expect(screen.getByText('Kiểm tra lại')).toBeTruthy();
    // Cart is preserved (not deleted prematurely)
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });

  it('3. REVIEW_REQUIRED priority: When needsManualReview=true, even if confirmed=true, stays in REVIEW_REQUIRED', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'SUCCESS',
      bookingStatus: 'CONFIRMED',
      confirmed: true,
      needsManualReview: true, // Triggered review priority
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Giao dịch đang được xác thực')).toBeTruthy();
    expect(screen.queryByText('Thanh toán thành công!')).toBeNull();
    expect(screen.queryByText('Quay lại giỏ hàng')).toBeNull();
  });

  it('4. Payment SUCCESS but booking CANCELLED: Routes to REVIEW_REQUIRED, NOT to retry payment', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'SUCCESS',
      bookingStatus: 'CANCELLED',
      confirmed: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    // Must NOT show Cancelled/Retry cart, must route to review to prevent double charge!
    expect(screen.getByText('Giao dịch đang được xác thực')).toBeTruthy();
    expect(screen.queryByText('Quay lại giỏ hàng')).toBeNull();
    expect(screen.getByText('Xem đơn hàng')).toBeTruthy();
  });

  it('5. FAILED payment: Shows failure message and provides Return to Cart link', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'FAILED',
      bookingStatus: 'PENDING_PAYMENT',
      confirmed: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Thanh toán không thành công')).toBeTruthy();
    expect(screen.getByText('Quay lại giỏ hàng')).toBeTruthy();
    expect(screen.queryByText('Xem đơn hàng')).toBeNull();
  });

  it('6. CANCELLED booking with PENDING payment: Shows cancelled message and provides Return to Cart link', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'PENDING',
      bookingStatus: 'CANCELLED',
      confirmed: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Đơn hàng đã được hủy')).toBeTruthy();
    expect(screen.getByText('Quay lại giỏ hàng')).toBeTruthy();
  });

  it('7. Polling Exhaustion / TIMEOUT: Does NOT claim money is safe, warns against double payment, stops spinner', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'PENDING',
      bookingStatus: 'PENDING_PAYMENT',
      confirmed: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Vui lòng chờ trong giây lát')).toBeTruthy();

    // Fast-forward 30 intervals (30 * 2000ms = 60000ms)
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });
    }

    // Now state must transition to TIMEOUT, spinner stopped
    expect(screen.getByText('Chưa có kết quả giao dịch')).toBeTruthy();
    expect(screen.getByText(/Quá thời gian phản hồi/)).toBeTruthy();
    // Verification: DOES NOT say "số tiền đã được an toàn"
    expect(screen.queryByText(/số tiền đã được an toàn/)).toBeNull();
    // Verification: Warns against duplicate payment
    expect(screen.getByText(/Vui lòng không thực hiện thanh toán lại lúc này/)).toBeTruthy();
    expect(screen.queryByText('Quay lại giỏ hàng')).toBeNull();
    expect(screen.getByText('Kiểm tra lại')).toBeTruthy();
    expect(screen.getByText('Xem đơn hàng')).toBeTruthy();
  });

  it('8. Controlled "Kiểm tra lại" button: Performs a single verification without launching infinite 30-poll loop', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'PENDING',
      bookingStatus: 'PENDING_PAYMENT',
      confirmed: false,
    });

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    // Exhaust timer to timeout
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });
    }

    expect(screen.getByText('Chưa có kết quả giao dịch')).toBeTruthy();
    const callsBefore = vi.mocked(httpClient.get).mock.calls.length;

    // Simulate backend confirmed it on the next single manual check
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      paymentCode: 'PAYV2_6A9C904A98684B253C',
      paymentStatus: 'SUCCESS',
      bookingStatus: 'CONFIRMED',
      confirmed: true,
      needsManualReview: false,
    });

    const recheckButton = screen.getByText('Kiểm tra lại');
    await act(async () => {
      fireEvent.click(recheckButton);
      await Promise.resolve();
    });

    expect(vi.mocked(httpClient.get).mock.calls.length).toBe(callsBefore + 1);
    expect(screen.getByText('Thanh toán thành công!')).toBeTruthy();
  });

  it('9. Network / Server Error: Displays connection issue with single retry button', async () => {
    vi.mocked(httpClient.get).mockRejectedValueOnce(new Error('Network error (500 Internal Server Error)'));

    renderWithCode();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Có lỗi xảy ra')).toBeTruthy();
    expect(screen.getByText('Network error (500 Internal Server Error)')).toBeTruthy();
    expect(screen.getByText('Kiểm tra lại')).toBeTruthy();
  });
});
