const mockPost = jest.fn();
jest.mock('@/apis/httpClient', () => ({ __esModule: true, default: { post: (...args: unknown[]) => mockPost(...args) } }));

import { checkoutApi } from '@/apis/checkoutApi';
import { promotionApi, promotionBookingType } from '@/apis/promotionApi';
import type { CartItem } from '@/types/cart';

const photo = {
  id: 'photo-1',
  photographyPackageId: 'package-1',
  shootDate: '2026-12-20',
  shootTimeSlot: '08:00-10:00',
  shootLocation: '1 Le Loi, Hue',
  shootLocationLatitude: 16.46,
  shootLocationLongitude: 107.59,
} as CartItem;
const rental = { productId: 'product-1', size: 'M', color: 'RED', rentalFrom: '2026-12-20', rentalTo: '2026-12-21', quantity: 1 } as CartItem;
const photoItem = { ...photo, itemType: 'PHOTOGRAPHY_PACKAGE', quantity: 1, basePrice: 900000, metadata: { providerId: 'studio-1' } } as CartItem;
const rentalItem = { ...rental, id: 'rental-1', itemType: 'PRODUCT', basePrice: 400000, depositAmount: 300000, metadata: { providerId: 'shop-1' } } as CartItem;
const voucher = (code: string) => ({ code, name: `Voucher ${code}`, discountType: 'FIXED_AMOUNT', discountValue: 150000 });

describe('checking a typed promo code (same endpoint and booking type as web cart)', () => {
  beforeEach(() => mockPost.mockReset());

  it('derives the booking type like the web cart', () => {
    expect(promotionBookingType([photoItem, rentalItem])).toBe('COMBO');
    expect(promotionBookingType([photoItem])).toBe('PHOTOGRAPHY');
    expect(promotionBookingType([rentalItem])).toBe('AODAI_RENTAL');
  });

  it('accepts a code the backend lists as applicable and uses its discount', async () => {
    mockPost.mockResolvedValue({ applicable: [{ promotion: voucher('COMBO150'), discountAmount: 150000 }], ineligible: [] });

    await expect(promotionApi.apply(' combo150 ', [photoItem, rentalItem])).resolves.toEqual({ code: 'COMBO150', name: 'Voucher COMBO150', discountAmount: 150000 });
    const [endpoint, payload] = mockPost.mock.calls[0];
    expect(endpoint).toBe('/promotions/applicable');
    expect(payload.bookingType).toBe('COMBO');
    expect(payload.items).toEqual([
      expect.objectContaining({ itemType: 'PHOTOGRAPHY_PACKAGE', providerId: 'studio-1', unitPrice: 900000 }),
      expect.objectContaining({ itemType: 'PRODUCT', providerId: 'shop-1', unitPrice: 400000, depositAmount: 300000 }),
    ]);
  });

  it('shows the backend reason for an ineligible code and a generic message for an unknown one', async () => {
    mockPost.mockResolvedValue({ applicable: [], ineligible: [{ promotion: voucher('RENT50'), reason: 'Mã không áp dụng cho hình thức đặt lịch này.' }] });

    await expect(promotionApi.apply('RENT50', [photoItem, rentalItem])).rejects.toThrow('Mã không áp dụng cho hình thức đặt lịch này.');
    await expect(promotionApi.apply('NOPE', [photoItem, rentalItem])).rejects.toThrow('Mã ưu đãi không tồn tại hoặc đã hết hạn');
  });
});

describe('promo code on photography / combo checkout (same as web cart)', () => {
  beforeEach(() => mockPost.mockReset().mockResolvedValue({ bookingId: 'booking-1' }));

  it('sends the applied promo code with a combo hold', async () => {
    await checkoutApi.createPhotographyHold(photo, [rental], 'SALE10');

    const [endpoint, payload] = mockPost.mock.calls[0];
    expect(endpoint).toBe('/api/bookings/combo/photography-hold');
    expect(payload).toMatchObject({ packageId: 'package-1', promoCode: 'SALE10', aodaiItems: [expect.objectContaining({ productId: 'product-1' })] });
  });

  it('sends the promo code with a photo-only hold and omits it when none was applied', async () => {
    await checkoutApi.createPhotographyHold(photo, [], 'SALE10');
    await checkoutApi.createPhotographyHold(photo, []);

    expect(mockPost.mock.calls[0][0]).toBe('/api/bookings/photography/hold');
    expect(mockPost.mock.calls[0][1].promoCode).toBe('SALE10');
    expect(mockPost.mock.calls[1][1].promoCode).toBeUndefined();
  });
});
