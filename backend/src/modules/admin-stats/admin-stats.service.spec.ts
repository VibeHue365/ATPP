import { Types } from 'mongoose';
import { AdminStatsService } from './admin-stats.service';

describe('AdminStatsService (VS-103, VS-104, VS-105)', () => {
  let service: AdminStatsService;
  let userModel: any;
  let providerModel: any;
  let productModel: any;
  let bookingModel: any;
  let bookingItemModel: any;
  let paymentModel: any;
  let refreshTokenModel: any;
  let providerVerificationModel: any;
  let disputeModel: any;
  let reviewModel: any;
  let comboPromotionModel: any;
  let inventoryItemModel: any;
  let analyticsService: any;

  beforeEach(() => {
    userModel = { countDocuments: jest.fn(), find: jest.fn(), aggregate: jest.fn() };
    providerModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    productModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };
    bookingModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
      db: { model: jest.fn() },
    };
    bookingItemModel = {
      aggregate: jest.fn(),
      find: jest.fn(),
    };
    paymentModel = { aggregate: jest.fn(), countDocuments: jest.fn() };
    refreshTokenModel = { updateMany: jest.fn() };
    providerVerificationModel = { countDocuments: jest.fn(), find: jest.fn() };
    disputeModel = { countDocuments: jest.fn(), find: jest.fn() };
    reviewModel = { countDocuments: jest.fn() };
    comboPromotionModel = { countDocuments: jest.fn() };
    inventoryItemModel = { aggregate: jest.fn(), countDocuments: jest.fn() };
    analyticsService = {
      getTopSearches: jest.fn().mockResolvedValue([]),
      getViewCountMap: jest.fn().mockResolvedValue(new Map()),
    };

    service = new AdminStatsService(
      userModel,
      providerModel,
      productModel,
      bookingModel,
      bookingItemModel,
      paymentModel,
      refreshTokenModel,
      providerVerificationModel,
      disputeModel,
      reviewModel,
      comboPromotionModel,
      inventoryItemModel,
      analyticsService,
    );
  });

  describe('VS-103: UC-K04 Rental Bookings & Revenue Analytics Dashboard', () => {
    it('returns order count (50), revenue (15,000,000 VND), and daily chart payload for Shop JWT', async () => {
      const shopUserId = new Types.ObjectId();
      const shopProviderId = new Types.ObjectId();

      providerModel.findOne.mockResolvedValue({ _id: shopProviderId });

      bookingModel.aggregate
        .mockResolvedValueOnce([
          { _id: null, orderCount: 50, totalRevenue: 15000000 },
        ])
        .mockResolvedValueOnce([
          { _id: '2026-01-05', count: 10, revenue: 3000000 },
          { _id: '2026-01-15', count: 20, revenue: 6000000 },
          { _id: '2026-01-25', count: 20, revenue: 6000000 },
        ]);

      const result = await service.getRentalBookings(
        { from: '2026-01-01', to: '2026-01-31' },
        { sub: shopUserId.toString(), roles: ['PROVIDER'] } as any,
      );

      expect(result.orderCount).toBe(50);
      expect(result.revenue).toBe(15000000);
      expect(result.totalOrders).toBe(50);
      expect(result.totalRevenue).toBe(15000000);
      expect(Array.isArray(result.dailyChart)).toBe(true);
      expect(result.dailyChart.length).toBe(3);
      expect(result.dailyChart[0]).toEqual({
        date: '2026-01-05',
        day: '05',
        count: 10,
        orderCount: 10,
        revenue: 3000000,
      });

      // Verify date filter was applied to mongo query
      expect(bookingModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              bookingType: { $in: ['AODAI_RENTAL', 'RENTAL'] },
              status: { $ne: 'CANCELLED' },
              createdAt: {
                $gte: expect.any(Date),
                $lte: expect.any(Date),
              },
            }),
          }),
        ]),
      );
    });

    it('filters precisely by from and to dates', async () => {
      bookingModel.aggregate
        .mockResolvedValueOnce([{ _id: null, orderCount: 5, totalRevenue: 1200000 }])
        .mockResolvedValueOnce([]);

      const result = await service.getRentalBookings(
        { from: '2026-01-01', to: '2026-01-31' },
        { sub: 'admin-id', roles: ['ADMIN'] } as any,
      );

      expect(result.orderCount).toBe(5);
      expect(result.revenue).toBe(1200000);

      const firstCall = bookingModel.aggregate.mock.calls[0][0];
      const matchStage = firstCall[0].$match;
      expect(matchStage.createdAt.$gte.toISOString()).toContain('2026-01-01');
      expect(matchStage.createdAt.$lte.toISOString()).toContain('2026-01-31');
    });
  });

  describe('VS-104: UC-K05 Top Rented Products Analytics Report', () => {
    it('returns Top 5 items ordered by rental count descending', async () => {
      const shopUserId = new Types.ObjectId();
      const shopProviderId = new Types.ObjectId();
      providerModel.findOne.mockResolvedValue({ _id: shopProviderId });

      const mockItems = [
        { _id: new Types.ObjectId(), rentalCount: 50, product: { name: 'Áo dài Nhật Bình Đỏ', basePrice: 500000, images: ['/img1.png'] } },
        { _id: new Types.ObjectId(), rentalCount: 40, product: { name: 'Áo dài Ngũ Thân Vàng', basePrice: 450000, images: ['/img2.png'] } },
        { _id: new Types.ObjectId(), rentalCount: 30, product: { name: 'Áo dài Hoa Sen', basePrice: 350000, images: ['/img3.png'] } },
        { _id: new Types.ObjectId(), rentalCount: 20, product: { name: 'Áo dài Gấm Cung Đình', basePrice: 600000, images: ['/img4.png'] } },
        { _id: new Types.ObjectId(), rentalCount: 10, product: { name: 'Áo dài Lụa Tơ Tằm', basePrice: 400000, images: ['/img5.png'] } },
      ];

      bookingItemModel.aggregate.mockResolvedValue(mockItems);

      const result = await service.getTopProducts(
        {},
        { sub: shopUserId.toString(), roles: ['PROVIDER'] } as any,
      );

      expect(result.data).toHaveLength(5);
      expect(result.data[0].name).toBe('Áo dài Nhật Bình Đỏ');
      expect(result.data[0].rentalCount).toBe(50);
      expect(result.data[4].name).toBe('Áo dài Lụa Tơ Tằm');
      expect(result.data[4].rentalCount).toBe(10);
      expect(result.data[0].rentalCount).toBeGreaterThan(result.data[1].rentalCount);
    });

    it('returns data: [] when a new shop has 0 rentals', async () => {
      const shopUserId = new Types.ObjectId();
      const shopProviderId = new Types.ObjectId();
      providerModel.findOne.mockResolvedValue({ _id: shopProviderId });

      bookingItemModel.aggregate.mockResolvedValue([]);

      const result = await service.getTopProducts(
        {},
        { sub: shopUserId.toString(), roles: ['PROVIDER'] } as any,
      );

      expect(result).toEqual({
        data: [],
        items: [],
        total: 0,
      });
    });
  });

  describe('VS-105: UC-K06 Inventory Breakdown Analytics (State Percentage Chart)', () => {
    it('returns 10 Available (50%), 8 In Use (40%), 2 Cleaning (10%) for a shop with 20 items', async () => {
      const shopUserId = new Types.ObjectId();
      const shopProviderId = new Types.ObjectId();
      providerModel.findOne.mockResolvedValue({ _id: shopProviderId });

      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
        }),
      });

      inventoryItemModel.aggregate.mockResolvedValue([
        { _id: 'AVAILABLE', count: 10 },
        { _id: 'RENTED', count: 8 },
        { _id: 'CLEANING', count: 2 },
      ]);

      const result = await service.getInventoryBreakdown(
        {},
        { sub: shopUserId.toString(), roles: ['PROVIDER'] } as any,
      );

      expect(result.total).toBe(20);
      expect(result.available).toEqual({
        status: 'AVAILABLE',
        name: 'Available',
        count: 10,
        percentage: 50,
        percentageFormatted: '50%',
      });
      expect(result.inUse).toEqual({
        status: 'RENTED',
        name: 'In Use',
        count: 8,
        percentage: 40,
        percentageFormatted: '40%',
      });
      expect(result.cleaning).toEqual({
        status: 'CLEANING',
        name: 'Cleaning',
        count: 2,
        percentage: 10,
        percentageFormatted: '10%',
      });

      const availableInBreakdown = result.breakdown.find((b: any) => b.status === 'AVAILABLE');
      expect(availableInBreakdown).toMatchObject({ count: 10, percentage: 50 });
      const rentedInBreakdown = result.breakdown.find((b: any) => b.status === 'RENTED');
      expect(rentedInBreakdown).toMatchObject({ count: 8, percentage: 40 });
      const cleaningInBreakdown = result.breakdown.find((b: any) => b.status === 'CLEANING');
      expect(cleaningInBreakdown).toMatchObject({ count: 2, percentage: 10 });
    });
  });

  describe('VS-106: UC-K08 Revenue Growth Trends & Wallet Balance', () => {
    it('returns twelve months with month-over-month growth and wallet balance', async () => {
      const providerId = new Types.ObjectId();
      paymentModel.aggregate.mockResolvedValue([
        { _id: '2026-01', revenue: 1000000 },
        { _id: '2026-02', revenue: 1500000 },
      ]);
      providerModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            wallet: { availableBalance: 450000 },
          }),
        }),
      });

      const result = await service.getRevenueTrends(
        { groupBy: 'MONTH', providerId: providerId.toString() },
        { sub: 'admin-id', roles: ['ADMIN'] } as any,
      );

      expect(result.groupBy).toBe('MONTH');
      expect(result.trends).toHaveLength(12);
      expect(result.walletBalance).toBe(450000);
    });

    it('rejects unsupported groupBy values', async () => {
      await expect(
        service.getRevenueTrends(
          { groupBy: 'INVALID' },
          { sub: 'admin-id', roles: ['ADMIN'] } as any,
        ),
      ).rejects.toThrow('groupBy must be MONTH');
    });
  });

  describe('VS-109: Popular Concept Preference Analytics', () => {
    it('returns the top five concepts with their booking share for a quarter', async () => {
      bookingModel.aggregate.mockResolvedValue([
        {
          concepts: [
            { _id: new Types.ObjectId(), bookingCount: 40, concept: { name: 'Hue Royal Concept' } },
            { _id: new Types.ObjectId(), bookingCount: 20, concept: { name: 'Ao Dai Garden' } },
          ],
          totals: [{ count: 100 }],
        },
      ]);

      const result = await service.getPopularConcepts(
        { period: 'Q1/2026' },
        { sub: 'admin-id', roles: ['ADMIN'] } as any,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ name: 'Hue Royal Concept', bookingCount: 40, percentage: 40 });
      expect(result.totalBookings).toBe(100);
    });
  });

  describe('VS-111: Booking Conversion & Cancellation Rate Analytics', () => {
    it('returns completion, cancellation, and dispute rates', async () => {
      bookingModel.aggregate.mockResolvedValue([
        { _id: 'COMPLETED', count: 80 },
        { _id: 'CANCELLED', count: 15 },
        { _id: 'DISPUTED', count: 5 },
      ]);

      await expect(service.getConversionMetrics({})).resolves.toMatchObject({
        totalBookings: 100,
        completionRate: 80,
        cancellationRate: 15,
        disputeRate: 5,
      });
    });

    it('returns zero rates with no bookings', async () => {
      bookingModel.aggregate.mockResolvedValue([]);
      await expect(service.getConversionMetrics({})).resolves.toMatchObject({
        totalBookings: 0,
        completionRate: 0,
        cancellationRate: 0,
        disputeRate: 0,
      });
    });
  });

  describe('VS-113: Active Stores & Listed Products Overview', () => {
    it('returns active rental shops and active product counts', async () => {
      providerModel.countDocuments.mockResolvedValue(30);
      productModel.countDocuments.mockResolvedValue(450);

      await expect(service.getShopsOverview()).resolves.toEqual({
        totalShops: 30,
        totalProducts: 450,
        activeShops: 30,
        listedProducts: 450,
      });
    });
  });

  describe('VS-114: Photographer Partner Network & Completed Shoots Count', () => {
    it('returns active photography partners and their completed shoots', async () => {
      providerModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }]),
        }),
      });
      bookingModel.countDocuments.mockResolvedValue(120);

      await expect(service.getPhotographersOverview()).resolves.toEqual({
        totalPhotographers: 2,
        completedShoots: 120,
        location: null,
      });
    });

    it('filters photographer partners by city when location is supplied', async () => {
      providerModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
        }),
      });
      bookingModel.countDocuments.mockResolvedValue(8);

      await expect(service.getPhotographersOverview('HUE')).resolves.toMatchObject({
        totalPhotographers: 1,
        completedShoots: 8,
        location: 'HUE',
      });
      expect(providerModel.find).toHaveBeenCalledWith(expect.objectContaining({
        'address.city': { $regex: 'HUE', $options: 'i' },
      }));
    });
  });
});
