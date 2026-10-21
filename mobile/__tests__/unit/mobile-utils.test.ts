import type { Booking, BookingItem } from '@/types/booking';
import {
  attentionStatuses,
  bookingDate,
  bookingStatus,
  bookingTitle,
  formatDate,
  formatDateTime,
  itemImage,
  itemName,
  itemProvider,
  terminalStatuses,
} from '@/utils/booking';
import { getMediaUrl } from '@/utils/media';
import { safeReturnTo } from '@/utils/navigation';

const provider = { _id: 'provider-1', businessName: 'ATPP Studio' };
const productItem = (overrides: Partial<BookingItem> = {}): BookingItem => ({
  _id: 'item-product',
  itemType: 'PRODUCT',
  productId: { _id: 'product-1', name: 'Áo dài Nhật Bình', images: ['/aodai.jpg'], providerId: provider },
  unitPrice: 400000,
  quantity: 1,
  rentalFrom: '2026-10-01T00:00:00.000Z',
  rentalTo: '2026-10-03T00:00:00.000Z',
  ...overrides,
});
const photoItem = (overrides: Partial<BookingItem> = {}): BookingItem => ({
  _id: 'item-photo',
  itemType: 'PHOTOGRAPHY_PACKAGE',
  photographyPackageId: { _id: 'package-1', name: 'Gói chụp Cố đô', images: ['/photo.jpg'] },
  providerId: provider,
  unitPrice: 1200000,
  quantity: 1,
  shootDate: '2026-10-02T00:00:00.000Z',
  ...overrides,
});
const booking = (items: BookingItem[], bookingType: Booking['bookingType'] = 'AODAI_RENTAL'): Booking => ({
  _id: 'booking-1', bookingCode: 'ATPP-001', bookingType, status: 'CONFIRMED', items,
  createdAt: '2026-09-29T00:00:00.000Z',
});

describe('booking helpers', () => {
  it('maps important statuses to labels and tones', () => {
    expect(bookingStatus.CONFIRMED).toEqual({ label: 'Đã xác nhận', tone: 'success' });
    expect(bookingStatus.DISPUTED.tone).toBe('error');
    expect(terminalStatuses.has('COMPLETED')).toBe(true);
    expect(attentionStatuses.has('RETURN_PENDING')).toBe(true);
  });

  it('resolves product and photography names', () => {
    expect(itemName(productItem())).toBe('Áo dài Nhật Bình');
    expect(itemName(photoItem())).toBe('Gói chụp Cố đô');
    expect(itemName(photoItem({ photographyPackageId: null, packageSnapshot: { name: 'Gói lưu niệm' } }))).toBe('Gói lưu niệm');
  });

  it('resolves item images and providers from populated relations', () => {
    expect(itemImage(productItem())).toBe('/aodai.jpg');
    expect(itemImage(photoItem())).toBe('/photo.jpg');
    expect(itemProvider(productItem())).toEqual(provider);
    expect(itemProvider(photoItem())).toEqual(provider);
  });

  it('prefers the photography date for combo bookings', () => {
    expect(bookingDate(booking([productItem(), photoItem()], 'COMBO'))).toBe('2026-10-02T00:00:00.000Z');
    expect(bookingDate(booking([productItem()]))).toBe('2026-10-01T00:00:00.000Z');
  });

  it('builds titles for combo, single-item and multi-item bookings', () => {
    expect(bookingTitle(booking([productItem(), photoItem()], 'COMBO'))).toBe('Combo áo dài & chụp ảnh');
    expect(bookingTitle(booking([productItem()]))).toBe('Áo dài Nhật Bình');
    expect(bookingTitle(booking([productItem(), productItem({ _id: 'item-2' })]))).toBe('Áo dài Nhật Bình +1');
  });

  it('formats valid dates and preserves invalid values', () => {
    expect(formatDate('2026-10-02T00:00:00.000Z')).toMatch(/02\/10\/2026/);
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate()).toBe('Chưa cập nhật');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime()).toBe('Chưa cập nhật');
  });
});

describe('media URL and safe navigation', () => {
  it.each([
    ['https://cdn.example.test/image.jpg', 'https://cdn.example.test/image.jpg'],
    ['data:image/png;base64,abc', 'data:image/png;base64,abc'],
    ['/uploads/item.jpg', 'http://localhost:3000/uploads/item.jpg'],
    ['uploads/item.jpg', 'http://localhost:3000/uploads/item.jpg'],
  ])('maps %s to %s', (input, expected) => expect(getMediaUrl(input)).toBe(expected));

  it('returns undefined for missing media', () => {
    expect(getMediaUrl('   ')).toBeUndefined();
    expect(getMediaUrl()).toBeUndefined();
  });

  it('allows local application routes', () => {
    expect(safeReturnTo('/booking/abc?tab=payment')).toBe('/booking/abc?tab=payment');
  });

  it.each([undefined, 'https://evil.test', '//evil.test', '/auth/login', '/(auth)/register'])(
    'rejects unsafe or authentication return path %s',
    value => expect(safeReturnTo(value, '/cart')).toBe('/cart'),
  );
});
