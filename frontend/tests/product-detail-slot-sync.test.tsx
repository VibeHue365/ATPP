import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetailPage from '../src/pages/rentals/ProductDetailPage';
import { httpClient } from '../src/services/httpClient';

// Mock httpClient
vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({}),
  },
}));

// Mock auth hook
vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { _id: 'user1', name: 'Test User' },
  }),
}));

// Mock toast hook
vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock cart context
vi.mock('../src/context/CartContext', () => ({
  useCart: () => ({
    addToCart: vi.fn(),
    cart: [],
  }),
}));

// Mock availability hook
const mockUseProductAvailability = vi.fn().mockReturnValue({
  state: 'available',
  available: true,
  availableQuantity: 1,
  loading: false,
});

vi.mock('../src/features/rentals/hooks/useProductAvailability', () => ({
  useProductAvailability: () => mockUseProductAvailability(),
}));

// Mock availability service
vi.mock('../src/features/rentals/services/productAvailabilityService', () => ({
  checkProductAvailability: vi.fn().mockResolvedValue({
    available: true,
    availableQuantity: 1,
  }),
}));

// Mock photographers api
vi.mock('../src/features/photographers/api/photographers.api', () => ({
  photographersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    getSuggested: vi.fn().mockResolvedValue([]),
  },
}));

const mockProductData = {
  _id: '6aeafbc54dd6bb560f0c0dbc',
  name: 'Ao dai rong',
  title: 'Ao dai rong',
  basePrice: 100000,
  hourlyPrice: 33334,
  depositAmount: 50000,
  sizes: ['XL', 'S'],
  colors: ['RED', 'BLUE'],
  images: ['https://example.com/image.jpg'],
  category: 'Ao dai',
  rating: { averageRating: 5, totalReviews: 10 },
  providerId: {
    _id: '6a5dd0cf48a10617899bf1d6',
    address: { city: 'Thừa Thiên Huế', addressLine: '123 Le Loi' },
    comboDiscountPercent: 0,
  },
};

const mockBusyData = {
  bookedDates: [],
  bookedSlots: [],
  variantBookedDates: {},
  variantBookedSlots: {
    XL_RED: [
      { date: '2026-11-15', timeSlot: '07:00-09:00', purpose: 'RENTAL' },
      { date: '2026-11-15', timeSlot: '09:00-11:00', purpose: 'TURNAROUND' },
    ],
    S_RED: [],
  },
  hasSchedule: true,
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  offDays: [],
};

describe('ProductDetailPage Real Integration Test - Slot Display & Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseProductAvailability.mockReturnValue({
      state: 'available',
      available: true,
      availableQuantity: 1,
      loading: false,
    });

    vi.mocked(httpClient.get).mockImplementation(async (url: string) => {
      if (url.includes('/products/6aeafbc54dd6bb560f0c0dbc')) {
        return mockProductData;
      }
      if (url.includes('/api/bookings/busy-dates/product/')) {
        return mockBusyData;
      }
      if (url.includes('/users/me')) {
        return { _id: 'user1', height: 165, weight: 55 };
      }
      if (url.includes('/reviews/item/')) {
        return [];
      }
      if (url.includes('/reviews/my-status/')) {
        return { canReview: false };
      }
      if (url.includes('/api/photographers')) {
        return [];
      }
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={['/rentals/6aeafbc54dd6bb560f0c0dbc']}>
        <Routes>
          <Route path="/rentals/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders ProductDetailPage, selects XL/RED/15-11-2026, disables 07-09 and 09-11 as "Đã bận" and auto-selects 11-13', async () => {
    renderComponent();

    // 1. Wait for product to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    // 2. Switch to Hourly rental mode
    const hourlyTab = screen.getByRole('button', { name: /Thuê Theo Giờ/i });
    fireEvent.click(hourlyTab);

    // 3. Select Size XL
    const xlBtn = screen.getByRole('button', { name: 'XL' });
    fireEvent.click(xlBtn);

    // 4. Select Day 15 on calendar
    const day15Btn = screen.getByRole('button', { name: '15' });
    fireEvent.click(day15Btn);

    // 5. Verify Slot 07:00 - 09:00 is disabled and shows "Đã bận"
    const slot07Btn = screen.getByText('07:00 - 09:00').closest('button') as HTMLButtonElement;
    expect(slot07Btn.disabled).toBe(true);
    expect(slot07Btn.textContent).toContain('Đã bận');

    // 6. Verify Slot 09:00 - 11:00 (TURNAROUND) is disabled and shows "Đã bận"
    const slot09Btn = screen.getByText('09:00 - 11:00').closest('button') as HTMLButtonElement;
    expect(slot09Btn.disabled).toBe(true);
    expect(slot09Btn.textContent).toContain('Đã bận');

    // 7. Verify Slot 11:00 - 13:00 is available and auto-selected ("Đã chọn")
    const slot11Btn = screen.getAllByText('11:00 - 13:00').find((el) => el.closest('button'))?.closest('button') as HTMLButtonElement;
    expect(slot11Btn.disabled).toBe(false);
    expect(slot11Btn.textContent).toContain('Đã chọn');

    // 8. Verify Slot 13:00 - 15:00 is available ("Trống")
    const slot13Btn = screen.getByText('13:00 - 15:00').closest('button') as HTMLButtonElement;
    expect(slot13Btn.disabled).toBe(false);
    expect(slot13Btn.textContent).toContain('Trống');
  });

  it('updates slot availability immediately when switching variant from XL to S on the real page', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Thuê Theo Giờ/i }));
    fireEvent.click(screen.getByRole('button', { name: 'XL' }));
    fireEvent.click(screen.getByRole('button', { name: '15' }));

    // On XL: 07-09 is busy
    let slot07Btn = screen.getByText('07:00 - 09:00').closest('button') as HTMLButtonElement;
    expect(slot07Btn.disabled).toBe(true);
    expect(slot07Btn.textContent).toContain('Đã bận');

    // Switch to Size S
    const sBtn = screen.getByRole('button', { name: 'S' });
    fireEvent.click(sBtn);

    // On S: 07-09 is immediately free ("Trống" or auto-selected)
    slot07Btn = screen.getByText('07:00 - 09:00').closest('button') as HTMLButtonElement;
    expect(slot07Btn.disabled).toBe(false);
    expect(slot07Btn.textContent).not.toContain('Đã bận');

    // 09-11 is also free on S
    const slot09Btn = screen.getByText('09:00 - 11:00').closest('button') as HTMLButtonElement;
    expect(slot09Btn.disabled).toBe(false);
    expect(slot09Btn.textContent).not.toContain('Đã bận');
  });

  it('handles multi-slot selection and prevents bridging across busy slots on the real page', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Thuê Theo Giờ/i }));
    fireEvent.click(screen.getByRole('button', { name: 'XL' }));
    fireEvent.click(screen.getByRole('button', { name: '15' }));

    // Slot 11:00-13:00 is auto-selected as the first available slot
    const slot11Btn = screen.getAllByText('11:00 - 13:00').find((el) => el.closest('button'))?.closest('button') as HTMLButtonElement;
    expect(slot11Btn.textContent).toContain('Đã chọn');

    // Click on Slot 13:00-15:00 to extend range to 11:00-15:00 (both consecutive available slots)
    const slot13Btn = screen.getByText('13:00 - 15:00').closest('button') as HTMLButtonElement;
    fireEvent.click(slot13Btn);

    // Header shows extended range 11:00 - 15:00
    expect(screen.getByText('11:00 - 15:00')).toBeDefined();

    // Clicking a disabled busy slot (09:00 - 11:00) does nothing and does not corrupt range
    const slot09Btn = screen.getByText('09:00 - 11:00').closest('button') as HTMLButtonElement;
    expect(slot09Btn.disabled).toBe(true);
    fireEvent.click(slot09Btn);
    expect(screen.getByText('11:00 - 15:00')).toBeDefined();
  });

  it('disables Add to Cart and Rent Now buttons when availability state is unavailable', async () => {
    mockUseProductAvailability.mockReturnValue({
      state: 'unavailable',
      available: false,
      availableQuantity: 0,
      loading: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    const rentNowBtn = screen.getByRole('button', { name: 'THUÊ NGAY' });
    expect((rentNowBtn as HTMLButtonElement).disabled).toBe(true);

    const addToCartBtn = screen.getByRole('button', { name: 'THÊM VÀO GIỎ HÀNG' });
    expect((addToCartBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables and blurs dates with hourly bookings when in DAILY rental mode (XL_RED on day 15)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    // Ensure we are in DAILY rental mode
    const dailyTab = screen.getByRole('button', { name: /Thuê Theo Ngày/i });
    expect(dailyTab).toBeDefined();

    // Select Size XL
    const xlBtn = screen.getByRole('button', { name: 'XL' });
    fireEvent.click(xlBtn);

    // On XL_RED, 2026-11-15 has hourly bookings: day 15 MUST be disabled on the DAILY calendar!
    const day15Btn = screen.getByRole('button', { name: '15' }) as HTMLButtonElement;
    expect(day15Btn.disabled).toBe(true);

    // Switch to Size S (which has no bookings on day 15)
    const sBtn = screen.getByRole('button', { name: 'S' });
    fireEvent.click(sBtn);

    // For Size S, day 15 should now be enabled on the calendar
    expect(day15Btn.disabled).toBe(false);
  });

  it('4. Fallback busy slots parity tests (a, b, c)', async () => {
    // 4c: API legacy returns only busySlots, no variantBookedSlots
    vi.mocked(httpClient.get).mockImplementation(async (url: string) => {
      if (url.includes('/products/6aeafbc54dd6bb560f0c0dbc')) {
        return mockProductData;
      }
      if (url.includes('/api/bookings/busy-dates/product/')) {
        return {
          bookedDates: [],
          bookedSlots: [
            { date: '2026-11-15', timeSlot: '07:00-09:00' },
          ],
          // variantBookedSlots is omitted or empty
          variantBookedSlots: {},
          hasSchedule: true,
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          offDays: [],
        };
      }
      if (url.includes('/users/me')) {
        return { _id: 'user1', height: 165, weight: 55 };
      }
      if (url.includes('/reviews/item/')) {
        return [];
      }
      if (url.includes('/reviews/my-status/')) {
        return { canReview: false };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ao dai rong' })).toBeDefined();
    });

    // Switch to HOURLY mode
    const hourlyTab = screen.getByRole('button', { name: /Thuê Theo Giờ/i });
    fireEvent.click(hourlyTab);

    // Select Size XL
    const xlBtn = screen.getByRole('button', { name: 'XL' });
    fireEvent.click(xlBtn);

    // Select Date 15
    const day15Btn = screen.getByRole('button', { name: '15' });
    fireEvent.click(day15Btn);

    // 4c: Even without variantBookedSlots, legacy busySlots locks 07:00 - 09:00!
    await waitFor(() => {
      const slot07Btn = screen.getByText('07:00 - 09:00').closest('button') as HTMLButtonElement;
      expect(slot07Btn.disabled).toBe(true);
      expect(slot07Btn.textContent).toContain('Đã bận');
    });
  });
});
