import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotographerDetailPage } from '../src/pages/photographers/PhotographerDetailPage';
import { ProfilePhotoshootDetailPage } from '../src/features/profile/components/photoshoot-detail/ProfilePhotoshootDetailPage';
import { PhotographyPackageFormModal } from '../src/features/photography-packages/components/PhotographyPackageFormModal';

const now = new Date();
const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const targetDayNum = 28;
const targetDate = `${targetMonth}-${String(targetDayNum).padStart(2, '0')}`;

const MOCK_CART = { cart: [], addToCart: vi.fn() };
const MOCK_TOAST = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
const MOCK_AUTH = {
  isAuthenticated: true,
  user: { _id: 'u1', favorites: [] },
  toggleFavorite: vi.fn(),
};
const MOCK_PHOTOGRAPHER_DETAIL = {
  isLoading: false,
  error: null,
  photographer: {
    id: 'prov-1',
    _id: 'prov-1',
    providerId: 'prov-1',
    businessName: 'Studio Cố Đô',
    quote: 'Tư vấn tận tâm.',
    rating: { averageRating: 4.9, totalReviews: 12 },
    address: { city: 'Huế', geo: { coordinates: [107.5847, 16.4637] } },
    media: { coverUrl: '', images: [] },
    policies: {},
    equipment: [],
    portfolio: ['https://example.com/1.jpg'],
    portfolioItems: [],
    serviceRadiusKm: 25,
    packages: [
      {
        _id: 'pkg-1',
        name: 'Gói Chụp 1 Giờ',
        price: 500000,
        durationHours: 1,
        pricingUnit: 'PER_SESSION' as const,
        includedDurationMinutes: 60,
        overtimeFeePerHour: 500000,
        overtimeIncrementMinutes: 30,
        maxOvertimeMinutes: 240,
        editedPhotosCount: 15,
        deliveryDays: 2,
        images: ['https://example.com/1.jpg'],
      },
    ],
  },
};

const quoteMock = vi.fn(async (_providerId: string, payload: any) => {
  const sessions = payload.sessions || [];
  let baseAmount = 0;
  let overtimeAmount = 0;
  const breakdown: Array<{ type: 'BASE_PACKAGE' | 'OVERTIME' | 'SURCHARGE'; label: string; amount: number }> = [];

  for (const s of sessions) {
    const startMs = new Date(s.startsAt).getTime();
    const endMs = new Date(s.endsAt).getTime();
    const durationMins = Math.round((endMs - startMs) / 60000);
    const overtimeMins = Math.max(0, durationMins - 60);
    const overtimeFee = Math.round((overtimeMins * 500000) / 60);
    baseAmount += 500000;
    overtimeAmount += overtimeFee;
    breakdown.push({ type: 'BASE_PACKAGE', label: 'Gói Chụp 1 Giờ — buổi chụp', amount: 500000 });
    if (overtimeFee > 0) {
      breakdown.push({ type: 'OVERTIME', label: 'Tăng giờ — Gói Chụp 1 Giờ', amount: overtimeFee });
    }
  }

  return {
    valid: true,
    quotedAt: new Date().toISOString(),
    currency: 'VND' as const,
    package: { id: 'pkg-1', name: 'Gói Chụp 1 Giờ', pricingUnit: 'PER_SESSION' as const },
    sessions: [],
    errors: [],
    breakdown,
    totals: {
      baseAmount,
      overtimeAmount,
      surchargeAmount: 0,
      totalAmount: baseAmount + overtimeAmount,
    },
  };
});

vi.mock('../src/features/photographers/components/PhotographyLocationPicker', () => ({
  PhotographyLocationPicker: () => <div data-testid="location-picker-stub" />,
}));

vi.mock('../src/context/CartContext', () => ({
  useCart: () => MOCK_CART,
}));

vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => MOCK_TOAST,
}));

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => MOCK_AUTH,
}));

vi.mock('../src/features/photographers/hooks/usePhotographerDetail', () => ({
  usePhotographerDetail: () => MOCK_PHOTOGRAPHER_DETAIL,
}));

vi.mock('../src/features/photographers/api/photographers.api', () => ({
  photographersApi: {
    getPublicStaff: vi.fn().mockResolvedValue({
      staff: [
        { _id: 's1', name: 'Thợ 1' },
        { _id: 's2', name: 'Thợ 2' },
      ],
      effectiveCapacity: 2,
    }),
    quote: (...args: any[]) => quoteMock(args[0], args[1]),
  },
}));

vi.mock('../src/features/categories/services/categoryService', () => ({
  categoryService: {
    getPublic: vi.fn(async ({ type }: { type: string }) => {
      if (type === 'PHOTOGRAPHY_CATEGORY') {
        return [{ id: 'cat-1', name: 'Ngoại cảnh Cố Đô', slug: 'ngoai-canh', type }];
      }
      return [];
    }),
  },
}));

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(async (url: string) => {
      if (url.startsWith('/reviews/provider/')) return [];
      if (url.startsWith('/api/bookings/busy-dates/provider/')) {
        return {
          bookedDates: [],
          bookedSlots: [{ date: targetDate, timeSlot: '10:00-11:00' }],
          effectiveCapacity: 2,
          slotAvailability: [
            {
              date: targetDate,
              timeSlot: '08:00-09:00',
              occupiedCount: 1,
              capacity: 2,
              remainingSlots: 1,
            },
          ],
          dailyAvailability: [{ date: targetDate, used: 1, limit: 4, remaining: 3 }],
        };
      }
      if (url.includes('/availability/month')) {
        return {
          month: targetMonth,
          days: [{ date: targetDate, status: 'AVAILABLE' }],
        };
      }
      if (url.includes('/availability?date=')) {
        return {
          timeRanges: [{ start: '08:00', end: '12:00' }],
        };
      }
      return {};
    }),
    post: vi.fn(async () => ({ applicable: [], ineligible: [] })),
  },
}));

describe('Photography schedule, duration, multi-session & overtime detail UX', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lets users select duration inside schedule dialog, dynamically filters slots, and live-quotes overtime without requiring location first', async () => {
    render(
      <MemoryRouter initialEntries={['/photographers/prov-1']}>
        <Routes>
          <Route path="/photographers/:id" element={<PhotographerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const dateBtn = await screen.findByRole('button', { name: /Ngày chụp/i });
    fireEvent.click(dateBtn);

    const dialog = screen.getByRole('dialog');
    const dayBtn = await within(dialog).findByRole('button', { name: String(targetDayNum) });
    await waitFor(() => expect((dayBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(dayBtn);

    // Initially 1-hour slots are displayed
    expect(await within(dialog).findByRole('button', { name: /08:00 – 09:00/i })).toBeTruthy();

    // Pick 2 hours (+500k) chip right inside the same schedule popup
    const twoHourChip = within(dialog).getByRole('radio', { name: /2 giờ.*\+500k/i });
    fireEvent.click(twoHourChip);

    // Slots immediately resize to 2-hour windows; 08:00-10:00 is available while 09:00-11:00 overlaps booked 10:00-11:00
    const twoHourSlot = await within(dialog).findByRole('button', { name: /08:00 – 10:00/i });
    expect((twoHourSlot as HTMLButtonElement).disabled).toBe(false);
    const busyOverlappingSlot = within(dialog).getByRole('button', { name: /09:00 – 11:00/i });
    expect((busyOverlappingSlot as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(twoHourSlot);
    fireEvent.click(within(dialog).getByRole('button', { name: /Xác nhận lịch/i }));

    // Confirm card shows extended range (08:00 - 10:00) AND live quote includes concise overtime breakdown WITHOUT location selected yet
    await waitFor(() => {
      expect(screen.getByText('08:00 - 10:00')).toBeTruthy();
      expect(screen.getByText(/Giá gói cơ bản \(1 giờ\)/i)).toBeTruthy();
      expect(screen.getByText(/Phí tăng giờ \(\+1 giờ\)/i)).toBeTruthy();
      expect(screen.getByText('+500.000đ')).toBeTruthy();
      expect(screen.getByText('1.000.000đ')).toBeTruthy();
    });

    // Re-open schedule dialog and click the SAME selected date: slots must remain available (not wiped)
    fireEvent.click(screen.getByRole('button', { name: /Ngày chụp/i }));
    const reopenedDialog = screen.getByRole('dialog');
    const sameDayBtn = await within(reopenedDialog).findByRole('button', { name: String(targetDayNum) });
    fireEvent.click(sameDayBtn);
    expect(await within(reopenedDialog).findByRole('button', { name: /08:00 – 10:00/i })).toBeTruthy();
  });

  it('opens Multi-Session dialog directly from the booking card tab with pricing-unit guidance', async () => {
    render(
      <MemoryRouter initialEntries={['/photographers/prov-1']}>
        <Routes>
          <Route path="/photographers/:id" element={<PhotographerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const multiTab = await screen.findByRole('tab', { name: /Nhiều buổi \/ Nhiều ngày/i });
    fireEvent.click(multiTab);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Gói tính theo buổi:/i)).toBeTruthy();
    expect(within(dialog).getByText(/Tạo lịch theo ngày/i)).toBeTruthy();
  });

  it('displays separate base package price, overtime fee, and extended duration on customer photoshoot detail', () => {
    const mockBooking = {
      _id: 'bk-1',
      bookingCode: 'PS-1234',
      status: 'CONFIRMED',
      bookingType: 'PHOTOGRAPHY',
      providerIds: [{ businessName: 'Studio Cố Đô', phone: '0905123456' }],
      pricingSummary: {
        subTotal: 500000,
        overtimeFee: 500000,
        voucherDiscountTotal: 0,
        depositTotal: 1000000,
        grandTotal: 1000000,
      },
      items: [
        {
          _id: 'item-1',
          itemType: 'PHOTOGRAPHY_PACKAGE',
          unitPrice: 1000000,
          quantity: 1,
          shootDate: '2026-11-28T01:00:00.000Z',
          shootTimeSlot: '08:00 - 10:00',
          shootLocation: 'Đại Nội Huế, TP. Huế',
          packageSnapshot: { name: 'Gói Chụp 1 Giờ', includedDurationMinutes: 60 },
          priceBreakdown: [
            { type: 'BASE_PACKAGE', label: 'Gói Chụp 1 Giờ — buổi chụp', amount: 500000 },
            { type: 'OVERTIME', label: 'Tăng giờ — Gói Chụp 1 Giờ', amount: 500000 },
          ],
        },
      ],
      schedules: [
        {
          _id: 'sch-1',
          scheduleType: 'PHOTOSHOOT',
          status: 'CONFIRMED',
          startsAt: '2026-11-28T08:00:00+07:00',
          endsAt: '2026-11-28T10:00:00+07:00',
          includedDurationMinutes: 60,
          overtimeMinutes: 60,
        },
      ],
    };

    render(
      <MemoryRouter>
        <ProfilePhotoshootDetailPage booking={mockBooking} onBack={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Giá gói cơ bản:/i)).toBeTruthy();
    expect(screen.getByText(/Phí tăng giờ \(\+1 giờ\):/i)).toBeTruthy();
    expect(screen.getByText(/\+500\.000đ/)).toBeTruthy();
    expect(screen.getByText('1.000.000đ')).toBeTruthy();
    expect(screen.getByText(/2 giờ \(gồm \+1 giờ tăng giờ\)/i)).toBeTruthy();
  });

  it('displays all scheduled sessions on customer photoshoot detail for multi-session bookings', () => {
    const multiBooking = {
      _id: 'bk-2',
      bookingCode: 'PS-5678',
      status: 'CONFIRMED',
      bookingType: 'PHOTOGRAPHY',
      providerIds: [{ businessName: 'Studio Cố Đô', phone: '0905123456' }],
      pricingSummary: {
        subTotal: 1000000,
        overtimeFee: 0,
        voucherDiscountTotal: 0,
        depositTotal: 1000000,
        grandTotal: 1000000,
      },
      items: [
        {
          _id: 'item-2',
          itemType: 'PHOTOGRAPHY_PACKAGE',
          unitPrice: 1000000,
          quantity: 1,
          shootLocation: 'Cung An Định, TP. Huế',
          packageSnapshot: { name: 'Gói Chụp 1 Giờ', includedDurationMinutes: 60 },
        },
      ],
      schedules: [
        {
          _id: 'sch-a',
          scheduleType: 'PHOTOSHOOT',
          status: 'CONFIRMED',
          startsAt: '2026-11-28T08:00:00+07:00',
          endsAt: '2026-11-28T09:00:00+07:00',
          includedDurationMinutes: 60,
          overtimeMinutes: 0,
        },
        {
          _id: 'sch-b',
          scheduleType: 'PHOTOSHOOT',
          status: 'CONFIRMED',
          startsAt: '2026-11-28T14:00:00+07:00',
          endsAt: '2026-11-28T16:00:00+07:00',
          includedDurationMinutes: 60,
          overtimeMinutes: 60,
        },
      ],
    };

    render(
      <MemoryRouter>
        <ProfilePhotoshootDetailPage booking={multiBooking} onBack={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Lịch 2 buổi chụp/i)).toBeTruthy();
    expect(screen.getByText(/Buổi 1:/i)).toBeTruthy();
    expect(screen.getByText(/Buổi 2:/i)).toBeTruthy();
  });

  it('lets studio configure pricingUnit (PER_DAY) and maxOvertimeMinutes in PhotographyPackageFormModal', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PhotographyPackageFormModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const categorySelect = await screen.findByLabelText(/Danh mục nhiếp ảnh chính/i);
    await waitFor(() => expect(categorySelect.querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    fireEvent.change(screen.getByLabelText(/Tên gói chụp/i), {
      target: { value: 'Gói Trọn Ngày Cố Đô' },
    });
    fireEvent.change(screen.getByLabelText(/Hình thức tính giá/i), {
      target: { value: 'PER_DAY' },
    });
    fireEvent.change(screen.getByLabelText(/Cho phép đặt thêm giờ tối đa/i), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByLabelText(/Giá trọn gói/i), {
      target: { value: '2500000' },
    });
    fireEvent.change(screen.getByLabelText(/Thời lượng mỗi ngày/i), {
      target: { value: '8' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gói Trọn Ngày Cố Đô',
          pricingUnit: 'PER_DAY',
          maxOvertimeMinutes: 120,
          durationHours: 8,
          price: 2500000,
          status: 'DRAFT',
        }),
      );
    });
  });
});
