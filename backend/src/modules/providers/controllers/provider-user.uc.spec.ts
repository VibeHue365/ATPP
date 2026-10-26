import { UsersController } from '../../users/controllers/users.controller';
import { ReviewsController } from '../../reviews/controllers/reviews.controller';
import { ProvidersController } from './providers.controller';
import { ProviderVerificationsController } from './provider-verifications.controller';
import { AdminProviderVerificationsController } from './admin-provider-verifications.controller';

describe('Provider and profile direct use-case contracts', () => {
  const customer = { sub: 'customer-1', email: 'customer@example.com', roles: ['CUSTOMER'] } as any;
  const provider = { sub: 'provider-1', email: 'shop@example.com', roles: ['PROVIDER'] } as any;
  const admin = { sub: 'admin-1', email: 'admin@example.com', roles: ['ADMIN'] } as any;
  const request = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };

  it('UC-08 creates a provider verification application', async () => {
    const service = { createVerification: jest.fn().mockResolvedValue({ verificationId: 'v-1' }) };
    const controller = new ProviderVerificationsController(service as any);
    const dto = { requestedCapabilities: ['AO_DAI_RENTAL'] } as any;
    await expect(controller.create(customer, dto, request)).resolves.toEqual({ verificationId: 'v-1' });
    expect(service.createVerification).toHaveBeenCalledWith(customer, dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-08 submits the completed provider application', async () => {
    const service = { submitVerification: jest.fn().mockResolvedValue({ status: 'SUBMITTED' }) };
    const controller = new ProviderVerificationsController(service as any);
    await controller.submit(customer, 'v-1', request);
    expect(service.submitVerification).toHaveBeenCalledWith(customer, 'v-1', { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it.each([
    ['approve', 'adminApprove'],
    ['reject', 'adminReject'],
    ['requestChanges', 'adminRequestChanges'],
  ])('UC-09 routes Admin %s decisions to provider verification service', async (method, serviceMethod) => {
    const service = { [serviceMethod]: jest.fn().mockResolvedValue({ status: 'DONE' }) } as any;
    const controller = new AdminProviderVerificationsController(service);
    const dto = { reason: 'Reviewed evidence' } as any;
    await (controller as any)[method](admin, 'v-1', dto, request);
    expect(service[serviceMethod]).toHaveBeenCalledWith(admin, 'v-1', dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-10 returns customer trust/profile history for provider review', async () => {
    const service = { getCustomerTrustScore: jest.fn().mockResolvedValue({ averageRating: 4.8, totalReviews: 5 }) };
    const controller = new ReviewsController(service as any, {} as any);
    await expect(controller.getTrustScore('customer-1')).resolves.toEqual({ averageRating: 4.8, totalReviews: 5 });
    expect(service.getCustomerTrustScore).toHaveBeenCalledWith('customer-1');
  });

  it('UC-11 toggles a customer favorite by target type and id', async () => {
    const service = { toggleFavorite: jest.fn().mockResolvedValue({ favorites: [{ targetId: 'product-1' }] }) };
    const controller = new UsersController(service as any);
    await controller.toggleFavorite(customer, 'PRODUCT', 'product-1');
    expect(service.toggleFavorite).toHaveBeenCalledWith('customer-1', 'PRODUCT', 'product-1', ['CUSTOMER']);
  });

  it('UC-13 updates the authenticated customer profile with request metadata', async () => {
    const service = { updateProfile: jest.fn().mockResolvedValue({ fullName: 'DaiBLL' }) };
    const controller = new UsersController(service as any);
    const dto = { fullName: 'DaiBLL' } as any;
    await controller.updateProfile(customer, dto, request);
    expect(service.updateProfile).toHaveBeenCalledWith('customer-1', dto, '127.0.0.1', 'jest', ['CUSTOMER']);
  });

  it('UC-14 creates a portfolio item for the authenticated provider', async () => {
    const service = { createPortfolioItem: jest.fn().mockResolvedValue({ id: 'portfolio-1' }) };
    const controller = new ProvidersController(service as any);
    const dto = { title: 'Hue heritage', images: ['https://cdn.test/photo.jpg'] } as any;
    await controller.createPortfolioItem(provider, dto);
    expect(service.createPortfolioItem).toHaveBeenCalledWith('provider-1', dto);
  });

  it('UC-14 deletes only the provider-owned portfolio item', async () => {
    const service = { removePortfolioItem: jest.fn().mockResolvedValue(undefined) };
    const controller = new ProvidersController(service as any);
    await expect(controller.deletePortfolioItem(provider, 'portfolio-1')).resolves.toEqual({ message: 'Portfolio item deleted' });
    expect(service.removePortfolioItem).toHaveBeenCalledWith('provider-1', 'portfolio-1');
  });

  it('UC-15 updates provider service information', async () => {
    const service = { updateProfile: jest.fn().mockResolvedValue({ businessName: 'DaiBLL Studio' }) };
    const controller = new ProvidersController(service as any);
    const dto = { businessName: 'DaiBLL Studio', photographySettings: { serviceRadiusKm: 20 } } as any;
    await controller.updateMe(provider, dto);
    expect(service.updateProfile).toHaveBeenCalledWith('provider-1', dto);
  });

  it('UC-60 retrieves provider revenue and operational analytics by period', async () => {
    const service = { getProviderAnalytics: jest.fn().mockResolvedValue({ totalRevenue: 1200000 }) };
    const controller = new ProvidersController(service as any);
    await controller.getAnalytics(provider, 'month');
    expect(service.getProviderAnalytics).toHaveBeenCalledWith('provider-1', 'month');
  });

  it('UC-61 exposes popular products and concepts in provider analytics', async () => {
    const result = { popularProducts: [{ id: 'p-1' }], popularConcepts: [{ name: 'Vintage' }] };
    const service = { getProviderAnalytics: jest.fn().mockResolvedValue(result) };
    const controller = new ProvidersController(service as any);
    await expect(controller.getAnalytics(provider, 'year')).resolves.toEqual(result);
  });

  it('UC-62 creates a provider-specific off-day schedule', async () => {
    const service = { updateSpecificDateSchedule: jest.fn().mockResolvedValue({ date: '2026-10-10', isOffDay: true }) };
    const controller = new ProvidersController(service as any);
    const dto = { date: '2026-10-10', isOffDay: true, customSlots: [], capability: 'PHOTOGRAPHY', reason: 'Nghỉ lễ' } as any;
    await controller.updateSpecificDate(provider, dto);
    expect(service.updateSpecificDateSchedule).toHaveBeenCalledWith('provider-1', '2026-10-10', true, [], 'PHOTOGRAPHY', 'Nghỉ lễ');
  });

  it('UC-62 updates recurring working hours for one weekday', async () => {
    const service = { updateRecurringSchedule: jest.fn().mockResolvedValue({ dayOfWeek: 1 }) };
    const controller = new ProvidersController(service as any);
    const dto = { dayOfWeek: 1, workingHours: [{ start: '08:00', end: '17:00' }], capability: 'PHOTOGRAPHY' } as any;
    await controller.updateRecurring(provider, dto);
    expect(service.updateRecurringSchedule).toHaveBeenCalledWith('provider-1', 1, dto.workingHours, 'PHOTOGRAPHY');
  });

  it('UC-W01 returns the authenticated provider wallet balances and history', async () => {
    const wallet = { pendingBalance: 500000, availableBalance: 1200000, transactions: [] };
    const service = { getWallet: jest.fn().mockResolvedValue(wallet) };
    const controller = new ProvidersController(service as any);
    await expect(controller.getWallet(provider)).resolves.toEqual(wallet);
    expect(service.getWallet).toHaveBeenCalledWith('provider-1');
  });
});
