import React from 'react';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderDashboard } from '../src/pages/providerdashboard/ProviderDashboard';
// @ts-expect-error Test-only immutable source, resolved by vitest.config.ts.
import { ProviderDashboard as OriginalDashboard } from 'provider-original-reference';

const mocks = vi.hoisted(() => ({
  capabilities: ['AODAI_RENTAL', 'PHOTOGRAPHY'],
  requests: [] as Array<{ method: string; path: string; body?: unknown }>,
  user: { roles: ['PROVIDER'] },
  authenticated: true,
  failProvider: false,
  responses: {} as Record<string, unknown>,
  navigate: vi.fn(),
  logout: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  socket: { on: vi.fn(), off: vi.fn() },
  confirm: vi.fn(async () => ({ isConfirmed: true })),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../src/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, isAuthenticated: mocks.authenticated, logout: mocks.logout }) }));
vi.mock('../src/components/feedback/Toast', () => ({ useToast: () => mocks.toast }));
vi.mock('../src/context/SocketContext', () => ({ useSocket: () => ({ socket: mocks.socket }) }));
vi.mock('sweetalert2', () => ({ default: { fire: mocks.confirm } }));
vi.mock('../src/components/common/BookingDetailModal', () => ({ BookingDetailModal: ({ isOpen, bookingId }: { isOpen: boolean; bookingId: string }) => isOpen ? <div data-testid="booking-detail">{bookingId}</div> : null }));
vi.mock('../src/features/photography-packages/components/PhotographyPackageManager', () => ({ PhotographyPackageManager: () => <div>Photography package manager</div> }));
vi.mock('../src/features/photographers/components/PhotographyLocationPicker', () => ({ PhotographyLocationPicker: () => <div>Location picker</div> }));
vi.mock('../src/features/photographers/components/PortfolioItemFormModal', () => ({ PortfolioItemFormModal: () => null }));
vi.mock('../src/features/smart-tagging/components/SmartTagEditor', () => ({ SmartTagEditor: ({ onActiveTagsChange }: { onActiveTagsChange: (tags: string[]) => void }) => <button onClick={() => onActiveTagsChange(['TRUYEN_THONG'])}>Select fixture tag</button> }));
vi.mock('../src/pages/notifications/NotificationsPage', () => ({ NotificationsPage: () => <div>Notifications page</div> }));
vi.mock('../src/components/common/PrivateEvidenceImage', () => ({ PrivateEvidenceImage: () => <div>Private evidence</div> }));

vi.mock('../src/services/httpClient', () => {
  async function request(method: string, path: string, body?: unknown) {
    mocks.requests.push({ method, path, ...(body === undefined ? {} : { body }) });
    if (Object.hasOwn(mocks.responses, path)) return mocks.responses[path];
    if (Object.hasOwn(mocks.responses, path.split('?')[0])) return mocks.responses[path.split('?')[0]];
    if (path === '/products/upload') return { urls: ['/fixture-photo.jpg'] };
    if (path === '/providers/me') {
      if (mocks.failProvider) throw new Error('Không thể tải dữ liệu kiểm thử');
      return {
        _id: 'provider-test', businessName: 'Provider kiểm thử', capabilities: mocks.capabilities,
        contact: { phone: '0900000000' }, address: { addressLine: 'Địa chỉ kiểm thử', city: 'Huế' },
        policies: {}, photographySettings: {}, rentalSettings: {},
      };
    }
    if (path.startsWith('/providers/me/analytics')) return {
      capabilities: mocks.capabilities, totalRevenue: 2500000, totalProducts: 4,
      successRate: 80, cancelRate: 20, averageRating: 4.5,
      revenueGrowth: [{ label: 'T1', value: 1000000 }, { label: 'T2', value: 1500000 }],
    };
    if (path.startsWith('/products/my-listings')) return { items: [], total: 0 };
    if (path.startsWith('/categories')) return { data: [] };
    if (path === '/campaigns/mine') return null;
    if (path === '/inventory/summary') return [];
    if (path.startsWith('/inventory?')) return { items: [], total: 0 };
    if (path === '/reviews/stats') return { reviews: [], averageRating: 0, totalReviews: 0 };
    if (path === '/provider/settlements') return { items: [] };
    if (path === '/providers/me/wallet') return {};
    if (method !== 'GET') return { _id: 'created-test' };
    return [];
  }
  return { httpClient: {
    get: (path: string) => request('GET', path),
    post: (path: string, body: unknown) => request('POST', path, body),
    patch: (path: string, body: unknown) => request('PATCH', path, body),
    put: (path: string, body: unknown) => request('PUT', path, body),
    delete: (path: string, body: unknown) => request('DELETE', path, body),
    request: (path: string, options?: { method?: string }) => request(options?.method ?? 'GET', path),
  } };
});

const panels = [
  'Thống kê & Hiệu suất', 'Đơn hàng', 'Giao & nhận áo dài', 'Bộ sưu tập',
  'Thông tin dịch vụ', 'Quản lý Portfolio', 'Gói chụp ảnh', 'Lịch làm việc & Chặn',
  'Mã khuyến mãi & Combo', 'Đánh giá & Phản hồi', 'Đánh giá khách hàng',
  'Lịch sử quyết toán', 'Tất cả thông báo', 'Quản lý vai trò',
];
const versions = [['original', OriginalDashboard], ['refactored', ProviderDashboard]] as const;

const sampleBooking = {
  _id: 'booking-fixture-123456', status: 'PENDING', bookingType: 'PHOTOGRAPHY',
  customerId: { _id: 'customer-fixture', email: 'customer@example.test', profile: { fullName: 'Khách kiểm thử' } },
  createdAt: '2026-09-20T02:00:00Z', pricingSummary: { totalAmount: 750000, depositTotal: 100000 },
  items: [{ _id: 'item-fixture', itemType: 'PHOTOGRAPHY_PACKAGE', name: 'Gói chụp kiểm thử', quantity: 1, status: 'PENDING' }],
  schedules: [{ _id: 'schedule-fixture', status: 'CONFIRMED', startsAt: '2026-09-21T06:00:00Z', timeSlot: '13:00 - 15:00' }],
};

const populatedResponses = {
  '/bookings/provider': [sampleBooking],
  '/products/my-listings': { items: [{
    _id: 'product-fixture', name: 'Áo dài mẫu', categoryId: { _id: 'category-test', name: 'Áo dài' },
    images: ['/fixture-photo.jpg'], basePrice: 350000, depositAmount: 100000,
    sizes: ['M'], colors: ['RED'], materials: ['SILK'], status: 'ACTIVE', description: 'Mô tả mẫu',
  }], total: 1 },
  '/providers/me/portfolio-items': [{ _id: 'portfolio-fixture', title: 'Bộ ảnh mẫu', images: ['/fixture-photo.jpg'], moderationStatus: 'APPROVED' }],
  '/provider/settlements': { items: [{ _id: 'payout-fixture', bookingId: 'booking-fixture-123456', payableAmount: 650000, grossAmount: 750000, commissionAmount: 100000, createdAt: '2026-09-20T02:00:00Z', status: 'PAID' }] },
};

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requests = [];
  mocks.capabilities = ['AODAI_RENTAL', 'PHOTOGRAPHY'];
  mocks.authenticated = true;
  mocks.user = { roles: ['PROVIDER'] };
  mocks.failProvider = false;
  mocks.responses = {};
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-21T03:00:00Z'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Provider dashboard: original/refactored parity', () => {
  for (const capabilities of [['AODAI_RENTAL'], ['PHOTOGRAPHY'], ['AODAI_RENTAL', 'PHOTOGRAPHY'], ['COSTUME_RENTAL'], ['RENTAL']]) {
    it(`preserves rendered DOM and API calls across all available panels (${capabilities.join('+')})`, async () => {
      mocks.capabilities = capabilities;
      const results = [];
      for (const [, Dashboard] of versions) {
        mocks.requests = [];
        const view = render(<Dashboard />);
        await settle();
        const snapshots: Record<string, string> = { initial: view.container.innerHTML };
        for (const label of panels) {
          const button = within(view.container.querySelector('aside')!).queryByRole('button', { name: label, exact: true });
          if (!button) continue;
          fireEvent.click(button);
          await settle();
          snapshots[label] = view.container.innerHTML;
        }
        results.push({ snapshots, requests: [...mocks.requests] });
        view.unmount();
      }
      expect(Object.keys(results[0].snapshots).length).toBeGreaterThan(9);
      expect(results[1]).toEqual(results[0]);
    });
  }

  it('preserves populated order, product, portfolio and settlement rendering and API traces', async () => {
    const results = [];
    for (const [, Dashboard] of versions) {
      mocks.responses = structuredClone(populatedResponses);
      mocks.requests = [];
      const view = render(<Dashboard />);
      await settle();
      const snapshots: Record<string, string> = {};
      for (const label of ['Đơn hàng', 'Bộ sưu tập', 'Quản lý Portfolio', 'Lịch sử quyết toán']) {
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: label, exact: true }));
        await settle();
        snapshots[label] = view.container.innerHTML;
      }
      results.push({ snapshots, requests: [...mocks.requests] });
      view.unmount();
    }
    expect(results[0].snapshots['Đơn hàng']).toContain('Khách kiểm thử');
    expect(results[0].snapshots['Bộ sưu tập']).toContain('Áo dài mẫu');
    expect(results[0].snapshots['Quản lý Portfolio']).toContain('Bộ ảnh mẫu');
    expect(results[1]).toEqual(results[0]);
  });

  for (const [version, Dashboard] of versions) {
    describe(version, () => {
      it('keeps inventory filters and pagination on the items-only refresh path', async () => {
        mocks.responses['/inventory'] = { items: [{ _id: 'inventory-test', sku: 'AO-01', productId: { name: 'Áo mẫu' }, size: 'M', color: 'WHITE', status: 'AVAILABLE', conditionStatus: 'GOOD' }], total: 21 };
        const view = render(<Dashboard />);
        await settle();
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Bộ sưu tập', exact: true }));
        await settle();
        fireEvent.click(view.getByRole('button', { name: 'Tồn kho', exact: true }));
        await settle();
        const summaryRequests = mocks.requests.filter(r => r.path === '/inventory/summary').length;
        const productRequests = mocks.requests.filter(r => r.path.startsWith('/products/my-listings')).length;
        fireEvent.change(view.getByPlaceholderText('Tìm theo SKU hoặc tên áo dài...'), { target: { value: '  áo & đỏ  ' } });
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
        await settle();
        fireEvent.change(view.getAllByRole('combobox')[0], { target: { value: 'AVAILABLE' } });
        await settle();
        fireEvent.click(view.getByRole('button', { name: 'Trang sau', exact: true }));
        await settle();
        const latest = mocks.requests.filter(r => r.path.startsWith('/inventory?')).at(-1)!;
        const query = new URLSearchParams(latest.path.split('?')[1]);
        expect(query.get('search')).toBe('áo & đỏ');
        expect(query.get('status')).toBe('AVAILABLE');
        expect(query.get('page')).toBe('2');
        expect(mocks.requests.filter(r => r.path === '/inventory/summary')).toHaveLength(summaryRequests);
        expect(mocks.requests.filter(r => r.path.startsWith('/products/my-listings'))).toHaveLength(productRequests);
      });

      it('confirms a photography booking with the original status payload', async () => {
        mocks.responses['/bookings/provider'] = [{ ...structuredClone(sampleBooking), status: 'DEPOSIT_PAID' }];
        const view = render(<Dashboard />);
        await settle();
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Đơn hàng', exact: true }));
        await settle();
        fireEvent.click(view.getByTitle('Thao tác khác'));
        fireEvent.click(view.getByRole('button', { name: 'Chấp nhận lịch chụp', exact: true }));
        await settle();
        expect(mocks.requests.find(r => r.method === 'PATCH' && r.path === '/bookings/booking-fixture-123456/status')?.body)
          .toEqual({ status: 'CONFIRMED' });
      });

      it('keeps an early photography start disabled before the 30-minute window', async () => {
        mocks.responses['/bookings/provider'] = [{ ...structuredClone(sampleBooking), status: 'CONFIRMED' }];
        const view = render(<Dashboard />);
        await settle();
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Đơn hàng', exact: true }));
        await settle();
        fireEvent.click(view.getByTitle('Thao tác khác'));
        const start = view.getByRole('button', { name: /Có thể bắt đầu từ/ }) as HTMLButtonElement;
        expect(start.disabled).toBe(true);
        expect(mocks.requests.some(r => r.method === 'PATCH')).toBe(false);
      });

      async function openProductWizard() {
        mocks.responses['/products/categories'] = [{ _id: 'category-test', name: 'Áo dài kiểm thử' }];
        const view = render(<Dashboard />);
        await settle();
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Bộ sưu tập', exact: true }));
        await settle();
        const add = within(view.container.querySelector('main')!).getByRole('button', { name: 'Thêm Áo Dài mới', exact: true });
        fireEvent.click(add);
        await settle();
        const modal = view.container.querySelector('.vh-modal-content-wrapper')!;
        expect(modal).not.toBeNull();
        const query = within(modal as HTMLElement);
        fireEvent.change(query.getByPlaceholderText('Ví dụ: Áo Dài Gấm Hoa Đỏ Hỷ Sự'), { target: { value: 'Áo dài kiểm thử' } });
        fireEvent.change(modal.querySelector('select')!, { target: { value: 'category-test' } });
        fireEvent.change(query.getByPlaceholderText('Ví dụ: 350000'), { target: { value: '350000' } });
        fireEvent.change(query.getByPlaceholderText('Ví dụ: 500000'), { target: { value: '100000' } });
        fireEvent.change(modal.querySelector('input[type="file"]')!, { target: { files: [new File(['fixture'], 'fixture.jpg', { type: 'image/jpeg' })] } });
        await settle();
        return { view, query };
      }

      it('creates one hidden draft, updates it on back/next, and removes it on cancel', async () => {
        const { query } = await openProductWizard();
        fireEvent.click(query.getByRole('button', { name: 'Tiếp tục', exact: true }));
        await settle();
        fireEvent.click(query.getByRole('button', { name: 'Lưu & tạo thẻ', exact: true }));
        await settle();
        const created = mocks.requests.filter(r => r.method === 'POST' && r.path === '/products');
        expect(created).toHaveLength(1);
        expect(created[0].body).toMatchObject({ name: 'Áo dài kiểm thử', status: 'DRAFT', basePrice: 350000, depositAmount: 100000 });
        fireEvent.click(query.getByRole('button', { name: 'Quay lại', exact: true }));
        fireEvent.click(query.getByRole('button', { name: 'Lưu & tạo thẻ', exact: true }));
        await settle();
        expect(mocks.requests.filter(r => r.method === 'POST' && r.path === '/products')).toHaveLength(1);
        expect(mocks.requests.some(r => r.method === 'PATCH' && r.path === '/products/created-test')).toBe(true);
        fireEvent.click(query.getByRole('button', { name: 'Hủy', exact: true }));
        await settle();
        expect(mocks.confirm).toHaveBeenCalled();
        expect(mocks.requests.some(r => r.method === 'DELETE' && r.path === '/products/created-test')).toBe(true);
      });

      it('requires a tag before publishing the draft and preserves the publish payload', async () => {
        const { query } = await openProductWizard();
        fireEvent.click(query.getByRole('button', { name: 'Tiếp tục', exact: true }));
        await settle();
        fireEvent.click(query.getByRole('button', { name: 'Lưu & tạo thẻ', exact: true }));
        await settle();
        expect((query.getByRole('button', { name: 'Đăng áo dài', exact: true }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(query.getByRole('button', { name: 'Select fixture tag' }));
        fireEvent.click(query.getByRole('button', { name: 'Đăng áo dài', exact: true }));
        await settle();
        expect(mocks.requests.find(r => r.method === 'PATCH' && r.path === '/products/created-test')?.body)
          .toMatchObject({ name: 'Áo dài kiểm thử', status: 'ACTIVE', style: 'traditional', images: ['/fixture-photo.jpg'] });
      });

      it('preserves unsaved promotion state when switching tabs', async () => {
        const view = render(<Dashboard />);
        await settle();
        const sidebar = within(view.container.querySelector('aside')!);
        fireEvent.click(sidebar.getByRole('button', { name: 'Mã khuyến mãi & Combo', exact: true }));
        await settle();
        const input = view.container.querySelector('main input[type="text"]') as HTMLInputElement;
        expect(input).not.toBeNull();
        fireEvent.change(input, { target: { value: 'KEEP-DRAFT' } });
        fireEvent.click(sidebar.getByRole('button', { name: 'Quản lý vai trò', exact: true }));
        await settle();
        fireEvent.click(sidebar.getByRole('button', { name: 'Mã khuyến mãi & Combo', exact: true }));
        await settle();
        expect((view.container.querySelector('main input[type="text"]') as HTMLInputElement).value).toBe('KEEP-DRAFT');
      });

      it('keeps the socket subscription stable across tabs and removes it on unmount', async () => {
        const view = render(<Dashboard />);
        await settle();
        const handler = mocks.socket.on.mock.calls.find(([event]) => event === 'booking_updated')?.[1];
        expect(handler).toBeTypeOf('function');
        fireEvent.click(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Đơn hàng', exact: true }));
        await settle();
        expect(mocks.socket.on.mock.calls.filter(([event]) => event === 'booking_updated')).toHaveLength(1);
        mocks.requests = [];
        await act(async () => { handler({ bookingId: 'booking-test', status: 'CONFIRMED' }); });
        expect(mocks.requests.filter(item => item.path === '/bookings/provider')).toHaveLength(1);
        view.unmount();
        expect(mocks.socket.off).toHaveBeenCalledWith('booking_updated', handler);
      });

      it('polls notifications every 30 seconds and clears the timer on unmount', async () => {
        const intervals = vi.spyOn(globalThis, 'setInterval');
        const clear = vi.spyOn(globalThis, 'clearInterval');
        const view = render(<Dashboard />);
        await settle();
        const index = intervals.mock.calls.findIndex(([, delay]) => delay === 30000);
        expect(index).toBeGreaterThanOrEqual(0);
        const callback = intervals.mock.calls[index][0] as () => void;
        mocks.requests = [];
        await act(async () => { callback(); });
        expect(mocks.requests).toEqual([{ method: 'GET', path: '/notifications' }]);
        const timer = intervals.mock.results[index].value;
        view.unmount();
        expect(clear).toHaveBeenCalledWith(timer);
      });

      it('redirects unauthenticated users', async () => {
        mocks.authenticated = false;
        render(<Dashboard />);
        await settle();
        expect(mocks.navigate).toHaveBeenCalledWith('/auth/login', { replace: true });
      });

      it('rejects users without the provider role', async () => {
        mocks.user = { roles: ['CUSTOMER'] };
        render(<Dashboard />);
        await settle();
        expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
        expect(mocks.toast.error).toHaveBeenCalled();
      });

      it('reports a provider loading failure', async () => {
        mocks.failProvider = true;
        render(<Dashboard />);
        await settle();
        expect(mocks.toast.error).toHaveBeenCalledWith('Không thể tải dữ liệu kiểm thử');
      });
    });
  }
});
