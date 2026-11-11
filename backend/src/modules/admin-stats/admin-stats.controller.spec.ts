import { AdminStatsController } from './admin-stats.controller';

describe('AdminStatsController (VS-103, VS-104, VS-105)', () => {
  let controller: AdminStatsController;
  let adminStatsService: any;

  beforeEach(() => {
    adminStatsService = {
      getRentalBookings: jest.fn(),
      getTopProducts: jest.fn(),
      getInventoryBreakdown: jest.fn(),
      getAdminStats: jest.fn(),
    };
    controller = new AdminStatsController(adminStatsService);
  });

  describe('VS-103: GET /api/v1/admin-stats/rental-bookings', () => {
    it('delegates to adminStatsService.getRentalBookings with query and user', async () => {
      const mockResult = { orderCount: 50, revenue: 15000000, dailyChart: [] };
      adminStatsService.getRentalBookings.mockResolvedValue(mockResult);

      const user = { sub: 'shop-user-id', roles: ['PROVIDER'] } as any;
      const res = await controller.getRentalBookings(
        user,
        '2026-01-01',
        '2026-01-31',
        undefined,
        undefined,
        'shop-123',
        undefined,
      );

      expect(res).toBe(mockResult);
      expect(adminStatsService.getRentalBookings).toHaveBeenCalledWith(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          shopId: 'shop-123',
          providerId: undefined,
        },
        user,
      );
    });
  });

  describe('VS-104: GET /api/v1/admin-stats/top-products', () => {
    it('delegates to adminStatsService.getTopProducts with limit and shopId', async () => {
      const mockResult = { data: [{ name: 'Ao Dai 1', rentalCount: 10 }] };
      adminStatsService.getTopProducts.mockResolvedValue(mockResult);

      const user = { sub: 'shop-user-id', roles: ['PROVIDER'] } as any;
      const res = await controller.getTopProducts(user, 'shop-123', undefined, 5);

      expect(res).toBe(mockResult);
      expect(adminStatsService.getTopProducts).toHaveBeenCalledWith(
        { shopId: 'shop-123', providerId: undefined, limit: 5 },
        user,
      );
    });
  });

  describe('VS-105: GET /api/v1/admin-stats/inventory-breakdown', () => {
    it('delegates to adminStatsService.getInventoryBreakdown', async () => {
      const mockResult = {
        total: 20,
        available: { count: 10, percentage: 50 },
        inUse: { count: 8, percentage: 40 },
        cleaning: { count: 2, percentage: 10 },
      };
      adminStatsService.getInventoryBreakdown.mockResolvedValue(mockResult);

      const user = { sub: 'shop-user-id', roles: ['PROVIDER'] } as any;
      const res = await controller.getInventoryBreakdown(user, 'shop-123', undefined);

      expect(res).toBe(mockResult);
      expect(adminStatsService.getInventoryBreakdown).toHaveBeenCalledWith(
        { shopId: 'shop-123', providerId: undefined },
        user,
      );
    });
  });
});
