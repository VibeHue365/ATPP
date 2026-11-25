import { checkoutApi } from '@/apis/checkoutApi';
import httpClient from '@/apis/httpClient';
import {
  isPartnerPortalUser,
  isStaffPortalUser,
  resolvePostAuthDestination,
} from '@/utils/navigation';

jest.mock('@/apis/httpClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('STAFF role isolation & preferredStaffId checkout forwarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recognizes isolated STAFF accounts separately from PROVIDER/CUSTOMER/ADMIN', () => {
    expect(isStaffPortalUser({ roles: ['STAFF'] })).toBe(true);
    expect(isStaffPortalUser({ roles: ['staff'] })).toBe(true);
    expect(isStaffPortalUser({ roles: ['CUSTOMER'] })).toBe(false);
    expect(isStaffPortalUser({ roles: ['PROVIDER'] })).toBe(false);
    expect(isStaffPortalUser({ roles: ['ADMIN'] })).toBe(false);
    expect(isStaffPortalUser({ roles: ['PROVIDER', 'STAFF'] })).toBe(false);
    expect(isPartnerPortalUser({ roles: ['STAFF'] })).toBe(false);
  });

  it('routes isolated STAFF strictly to /staff regardless of onboarding or returnTo', () => {
    expect(
      resolvePostAuthDestination(
        { roles: ['STAFF'], hasCompletedOnboarding: false },
        '/(tabs)/bookings',
      ),
    ).toBe('/staff');
    expect(
      resolvePostAuthDestination(
        { roles: ['PROVIDER'], hasCompletedOnboarding: false },
        '/staff',
      ),
    ).toBe('/provider');
    expect(
      resolvePostAuthDestination(
        { roles: ['CUSTOMER'], hasCompletedOnboarding: true },
        '/photography',
      ),
    ).toBe('/photography');
  });

  it('forwards preferredStaffId on standalone and combo photography holds', async () => {
    (httpClient.post as jest.Mock).mockResolvedValue({ bookingId: 'bk-1' });

    const photoCartItem = {
      id: 'cart-photo-1',
      itemType: 'PHOTOGRAPHY_PACKAGE' as const,
      quantity: 1,
      photographyPackageId: 'pkg-1',
      shootDate: '2026-12-10',
      shootTimeSlot: '09:00-11:00',
      shootLocation: 'Đại Nội Huế',
      shootLocationLatitude: 16.4698,
      shootLocationLongitude: 107.5786,
      preferredStaffId: 'staff-42',
      preferredStaffName: 'Minh Tuấn',
    };

    await checkoutApi.createPhotographyHold(photoCartItem, [], 'HUE10');

    expect(httpClient.post).toHaveBeenCalledWith(
      '/api/bookings/photography/hold',
      expect.objectContaining({
        packageId: 'pkg-1',
        preferredStaffId: 'staff-42',
        promoCode: 'HUE10',
      }),
      expect.any(Object),
    );

    const rentalItem = {
      id: 'cart-rental-1',
      itemType: 'PRODUCT' as const,
      quantity: 1,
      productId: 'prod-9',
      size: 'M',
      color: 'Đỏ',
      rentalFrom: '2026-12-10',
      rentalTo: '2026-12-11',
    };

    await checkoutApi.createPhotographyHold(photoCartItem, [rentalItem]);

    expect(httpClient.post).toHaveBeenLastCalledWith(
      '/api/bookings/combo/photography-hold',
      expect.objectContaining({
        packageId: 'pkg-1',
        preferredStaffId: 'staff-42',
        aodaiItems: expect.arrayContaining([
          expect.objectContaining({ productId: 'prod-9' }),
        ]),
      }),
      expect.any(Object),
    );
  });
});
