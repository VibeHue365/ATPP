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
import {
  getMediaUrl,
  isRenderableImageUrl,
  resolveProviderAvatarUri,
  resolveProviderCoverUri,
  resolveProviderLogoUri,
} from '@/utils/media';
import {
  buildCleanProviderMediaUpdate,
  buildCleanProviderUpdatePayload,
} from '@/utils/providerProfile';
import {
  buildLoginHref,
  clearPendingOAuthReturnTo,
  isPartnerPortalUser,
  peekPendingOAuthReturnTo,
  resolvePostAuthDestination,
  safeReturnTo,
  savePendingOAuthReturnTo,
} from '@/utils/navigation';

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

describe('post-auth role and returnTo routing', () => {
  beforeEach(async () => {
    await clearPendingOAuthReturnTo();
  });

  it('recognizes PROVIDER and PHOTOGRAPHER roles for partner portal auto-entry', () => {
    expect(isPartnerPortalUser({ roles: ['PROVIDER'] })).toBe(true);
    expect(isPartnerPortalUser({ roles: ['photographer'] })).toBe(true);
    expect(isPartnerPortalUser({ roles: ['CUSTOMER'] })).toBe(false);
    expect(isPartnerPortalUser({ roles: ['ADMIN'] })).toBe(false);
    expect(isPartnerPortalUser(null)).toBe(false);
  });

  it('routes CUSTOMER from profile/logout/default to home tabs instead of /profile', () => {
    expect(resolvePostAuthDestination({ roles: ['CUSTOMER'], hasCompletedOnboarding: true })).toBe(
      '/(tabs)',
    );
    expect(
      resolvePostAuthDestination({ roles: ['CUSTOMER'], hasCompletedOnboarding: true }, '/profile'),
    ).toBe('/(tabs)');
    expect(
      resolvePostAuthDestination(
        { roles: ['CUSTOMER'], hasCompletedOnboarding: true },
        '/(tabs)/profile',
      ),
    ).toBe('/(tabs)');
  });

  it('returns CUSTOMER back to the feature screen they triggered auth from', () => {
    expect(
      resolvePostAuthDestination({ roles: ['CUSTOMER'], hasCompletedOnboarding: true }, '/checkout'),
    ).toBe('/checkout');
    expect(
      resolvePostAuthDestination(
        { roles: ['CUSTOMER'], hasCompletedOnboarding: true },
        '/product/ao-dai-1',
      ),
    ).toBe('/product/ao-dai-1');
  });

  it('keeps onboarding destination pointing home when login originated from profile', () => {
    expect(
      resolvePostAuthDestination(
        { roles: ['CUSTOMER'], hasCompletedOnboarding: false },
        '/profile',
      ),
    ).toEqual({
      pathname: '/preferences',
      params: { onboarding: '1', returnTo: '/(tabs)' },
    });
  });

  it('routes PROVIDER and PHOTOGRAPHER directly to /provider regardless of returnTo', () => {
    expect(
      resolvePostAuthDestination(
        { roles: ['PROVIDER'], hasCompletedOnboarding: false },
        '/profile',
      ),
    ).toBe('/provider');
    expect(
      resolvePostAuthDestination(
        { roles: ['PHOTOGRAPHER'], hasCompletedOnboarding: true },
        '/checkout',
      ),
    ).toBe('/provider');
  });

  it('builds login href without /profile returnTo but preserves real feature targets', () => {
    expect(buildLoginHref()).toBe('/(auth)/login');
    expect(buildLoginHref('/profile')).toBe('/(auth)/login');
    expect(buildLoginHref('/(tabs)/profile')).toBe('/(auth)/login');
    expect(buildLoginHref('/favorites')).toEqual({
      pathname: '/(auth)/login',
      params: { returnTo: '/favorites' },
    });
  });

  it('persists and clears pending OAuth returnTo while ignoring /profile', async () => {
    await savePendingOAuthReturnTo('/profile');
    expect(await peekPendingOAuthReturnTo()).toBeUndefined();

    await savePendingOAuthReturnTo('/checkout');
    expect(await peekPendingOAuthReturnTo()).toBe('/checkout');

    await clearPendingOAuthReturnTo();
    expect(await peekPendingOAuthReturnTo()).toBeUndefined();
  });
});

describe('provider media resolution and profile payload sanitization', () => {
  it('filters out SVG and non-upload root-relative Web paths', () => {
    expect(isRenderableImageUrl('/avatar_co_phong.svg')).toBe(false);
    expect(isRenderableImageUrl('/partner_cover.jpg')).toBe(false);
    expect(isRenderableImageUrl('/hong_lien_hoa.webp')).toBe(false);
    expect(isRenderableImageUrl('data:image/svg+xml;utf8,<svg></svg>')).toBe(false);
    expect(isRenderableImageUrl('/uploads/avatars/shop.jpg')).toBe(true);
    expect(isRenderableImageUrl('https://res.cloudinary.com/demo/image/upload/v1/shop.jpg')).toBe(true);
  });

  it('resolves valid top-level Cloudinary logo/cover when legacy media paths are invalid and prefers new uploaded media.logoUrl', () => {
    const legacySeedProfile = {
      _id: '6a5ca04a2e25fb0befb0be4a',
      businessName: 'Áo Dài Cổ Phong Vibe',
      logoUrl: 'https://res.cloudinary.com/dwmjt25mf/image/upload/v1784555141/vibehue/ao_dai/vang1.jpg',
      coverUrl: 'https://res.cloudinary.com/dwmjt25mf/image/upload/v1784555126/vibehue/ao_dai/hong1.jpg',
      media: {
        logoUrl: '/avatar_co_phong.svg',
        coverUrl: '/partner_cover.jpg',
      },
    };

    expect(resolveProviderLogoUri(legacySeedProfile)).toBe(
      'https://res.cloudinary.com/dwmjt25mf/image/upload/v1784555141/vibehue/ao_dai/vang1.jpg',
    );
    expect(resolveProviderAvatarUri(legacySeedProfile)).toBe(
      'https://res.cloudinary.com/dwmjt25mf/image/upload/v1784555141/vibehue/ao_dai/vang1.jpg',
    );
    expect(resolveProviderCoverUri(legacySeedProfile)).toBe(
      'https://res.cloudinary.com/dwmjt25mf/image/upload/v1784555126/vibehue/ao_dai/hong1.jpg',
    );

    const updatedProfile = {
      ...legacySeedProfile,
      media: {
        ...legacySeedProfile.media,
        logoUrl: 'https://res.cloudinary.com/dwmjt25mf/image/upload/v2/new_logo.jpg',
      },
    };
    expect(resolveProviderLogoUri(updatedProfile)).toBe(
      'https://res.cloudinary.com/dwmjt25mf/image/upload/v2/new_logo.jpg',
    );
    expect(resolveProviderAvatarUri(updatedProfile)).toBe(
      'https://res.cloudinary.com/dwmjt25mf/image/upload/v2/new_logo.jpg',
    );
  });

  it('builds strictly whitelisted UpdateProviderProfileDto payloads without _id, description, or contactPhone', () => {
    const dirtyProfile = {
      _id: 'p1',
      businessName: 'Cũ',
      logoUrl: 'https://res.cloudinary.com/demo/vang1.jpg',
      coverUrl: 'https://res.cloudinary.com/demo/hong1.jpg',
      contact: {
        _id: 'contact-subdoc-id',
        email: 'huy748566@gmail.com',
        phone: '0901112222',
      },
      address: {
        _id: 'addr-subdoc-id',
        addressLine: '12 Lê Lợi',
        city: 'Thừa Thiên Huế',
      },
      media: {
        _id: 'media-subdoc-id',
        logoUrl: '/avatar_co_phong.svg',
        coverUrl: '/partner_cover.jpg',
        images: ['/partner_cover.jpg'],
      },
      policies: {
        cancellationPolicy: 'Hủy trước 24h hoàn 100%',
        rentalPolicy: null,
      },
    } as any;

    const payload = buildCleanProviderUpdatePayload({
      profile: dirtyProfile,
      businessName: '  Áo Dài Cổ Phong Vibe  ',
      contactPhone: '0905123456',
      addressLine: '179B Phan Đình Phùng',
      city: 'Thừa Thiên Huế',
      storeLat: 16.46,
      storeLng: 107.58,
      serviceRadiusKm: 25,
      logoUrl: 'https://res.cloudinary.com/demo/uploaded_logo.jpg',
      coverUrl: '',
      rentalPolicy: 'Nhận chỉnh sửa số đo miễn phí',
    });

    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('contactPhone');
    expect(payload.address).not.toHaveProperty('_id');
    expect(payload.media).not.toHaveProperty('_id');
    expect(payload.contact).toEqual({
      email: 'huy748566@gmail.com',
      phone: '0905123456',
    });
    expect(payload.media).toEqual({
      logoUrl: 'https://res.cloudinary.com/demo/uploaded_logo.jpg',
      coverUrl: 'https://res.cloudinary.com/demo/hong1.jpg',
      images: ['/partner_cover.jpg'],
    });
    expect(payload.policies).toEqual({
      cancellationPolicy: 'Hủy trước 24h hoàn 100%',
      rentalPolicy: 'Nhận chỉnh sửa số đo miễn phí',
    });

    const mediaOnly = buildCleanProviderMediaUpdate(
      dirtyProfile,
      'https://res.cloudinary.com/demo/uploaded_logo.jpg',
      '',
    );
    expect(mediaOnly.media).not.toHaveProperty('_id');
    expect(mediaOnly.media.logoUrl).toBe('https://res.cloudinary.com/demo/uploaded_logo.jpg');
  });
});
