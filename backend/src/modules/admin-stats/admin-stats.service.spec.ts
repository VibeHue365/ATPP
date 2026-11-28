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
    userModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
    };
    providerModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      aggregate: jest.fn(),
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
    reviewModel = { countDocuments: jest.fn(), find: jest.fn() };
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
        .mockResolvedValueOnce([
          { _id: null, orderCount: 5, totalRevenue: 1200000 },
        ])
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
        {
          _id: new Types.ObjectId(),
          rentalCount: 50,
          product: {
            name: 'Áo dài Nhật Bình Đỏ',
            basePrice: 500000,
            images: ['/img1.png'],
          },
        },
        {
          _id: new Types.ObjectId(),
          rentalCount: 40,
          product: {
            name: 'Áo dài Ngũ Thân Vàng',
            basePrice: 450000,
            images: ['/img2.png'],
          },
        },
        {
          _id: new Types.ObjectId(),
          rentalCount: 30,
          product: {
            name: 'Áo dài Hoa Sen',
            basePrice: 350000,
            images: ['/img3.png'],
          },
        },
        {
          _id: new Types.ObjectId(),
          rentalCount: 20,
          product: {
            name: 'Áo dài Gấm Cung Đình',
            basePrice: 600000,
            images: ['/img4.png'],
          },
        },
        {
          _id: new Types.ObjectId(),
          rentalCount: 10,
          product: {
            name: 'Áo dài Lụa Tơ Tằm',
            basePrice: 400000,
            images: ['/img5.png'],
          },
        },
      ];

      bookingItemModel.aggregate.mockResolvedValue(mockItems);

      const result = await service.getTopProducts({}, {
        sub: shopUserId.toString(),
        roles: ['PROVIDER'],
      } as any);

      expect(result.data).toHaveLength(5);
      expect(result.data[0].name).toBe('Áo dài Nhật Bình Đỏ');
      expect(result.data[0].rentalCount).toBe(50);
      expect(result.data[4].name).toBe('Áo dài Lụa Tơ Tằm');
      expect(result.data[4].rentalCount).toBe(10);
      expect(result.data[0].rentalCount).toBeGreaterThan(
        result.data[1].rentalCount,
      );
    });

    it('returns data: [] when a new shop has 0 rentals', async () => {
      const shopUserId = new Types.ObjectId();
      const shopProviderId = new Types.ObjectId();
      providerModel.findOne.mockResolvedValue({ _id: shopProviderId });

      bookingItemModel.aggregate.mockResolvedValue([]);

      const result = await service.getTopProducts({}, {
        sub: shopUserId.toString(),
        roles: ['PROVIDER'],
      } as any);

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

      const result = await service.getInventoryBreakdown({}, {
        sub: shopUserId.toString(),
        roles: ['PROVIDER'],
      } as any);

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

      const availableInBreakdown = result.breakdown.find(
        (b: any) => b.status === 'AVAILABLE',
      );
      expect(availableInBreakdown).toMatchObject({ count: 10, percentage: 50 });
      const rentedInBreakdown = result.breakdown.find(
        (b: any) => b.status === 'RENTED',
      );
      expect(rentedInBreakdown).toMatchObject({ count: 8, percentage: 40 });
      const cleaningInBreakdown = result.breakdown.find(
        (b: any) => b.status === 'CLEANING',
      );
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
        service.getRevenueTrends({ groupBy: 'INVALID' }, {
          sub: 'admin-id',
          roles: ['ADMIN'],
        } as any),
      ).rejects.toThrow('groupBy must be MONTH');
    });
  });

  describe('VS-109: Popular Concept Preference Analytics', () => {
    it('returns the top five concepts with their booking share for a quarter', async () => {
      bookingModel.aggregate.mockResolvedValue([
        {
          concepts: [
            {
              _id: new Types.ObjectId(),
              bookingCount: 40,
              concept: { name: 'Hue Royal Concept' },
            },
            {
              _id: new Types.ObjectId(),
              bookingCount: 20,
              concept: { name: 'Ao Dai Garden' },
            },
          ],
          totals: [{ count: 100 }],
        },
      ]);

      const result = await service.getPopularConcepts({ period: 'Q1/2026' }, {
        sub: 'admin-id',
        roles: ['ADMIN'],
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        name: 'Hue Royal Concept',
        bookingCount: 40,
        percentage: 40,
      });
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
          lean: jest
            .fn()
            .mockResolvedValue([
              { _id: new Types.ObjectId() },
              { _id: new Types.ObjectId() },
            ]),
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

      await expect(
        service.getPhotographersOverview('HUE'),
      ).resolves.toMatchObject({
        totalPhotographers: 1,
        completedShoots: 8,
        location: 'HUE',
      });
      expect(providerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          'address.city': { $regex: 'HUE', $options: 'i' },
        }),
      );
    });
  });

  describe('VS-110: Low-rating Photographer Performance Alert Report', () => {
    it('returns photographers below 3.5 with their negative reviews', async () => {
      providerModel.aggregate.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          businessName: 'Hue Studio',
          city: 'Hue',
          averageRating: 3.2,
          totalReviews: 5,
          negativeReviews: [
            {
              reviewId: new Types.ObjectId(),
              rating: 2,
              comment: 'Ảnh trả chậm',
            },
          ],
        },
      ]);
      const result = await service.getLowRatingPhotographers();
      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        businessName: 'Hue Studio',
        averageRating: 3.2,
      });
      expect(result.data[0].negativeReviews[0]).toMatchObject({
        rating: 2,
        comment: 'Ảnh trả chậm',
      });
      expect(providerModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({ capabilities: 'PHOTOGRAPHY' }),
          }),
          expect.objectContaining({
            $lookup: expect.objectContaining({ from: 'reviews' }),
          }),
        ]),
      );
    });
  });

  describe('VS-112: Customer Growth & Daily Active Users', () => {
    it('returns seven daily new-user points with DAU and a 30-day MAU', async () => {
      userModel.aggregate
        .mockResolvedValueOnce([{ _id: '2026-01-01', count: 4 }])
        .mockResolvedValueOnce([{ _id: '2026-01-01', count: 9 }]);
      userModel.countDocuments.mockResolvedValue(50);

      const result = await service.getUserGrowth({
        from: '2026-01-01',
        to: '2026-01-07',
      });

      expect(result.data).toHaveLength(7);
      expect(result.data[0]).toEqual({
        date: '2026-01-01',
        newUsers: 4,
        dau: 9,
      });
      expect(result.totalNewUsers).toBe(4);
      expect(result.mau).toBe(50);
    });

    it('exports the growth report as an XLSX workbook', async () => {
      userModel.aggregate.mockResolvedValue([]);
      userModel.countDocuments.mockResolvedValue(0);

      const file = await service.exportUserGrowth({
        from: '2026-01-01',
        to: '2026-01-01',
      });

      expect(file.subarray(0, 2).toString()).toBe('PK');
      expect(file.length).toBeGreaterThan(100);
    });
  });

  describe('Overview Chart Periods & GMV Purpose Filter', () => {
    it('supports day (12 two-hour slots) and week (7 days) and filters GMV by PaymentPurpose', async () => {
      paymentModel.aggregate.mockResolvedValue([{ _id: '08', totalAmount: 350000 }]);
      bookingModel.aggregate.mockResolvedValue([{ _id: '09', count: 2 }]);

      const dayPoints = await (service as any).getOverviewChartPoints('day');
      expect(dayPoints).toHaveLength(12);
      expect(dayPoints[4]).toMatchObject({
        day: '08h',
        bookings: 2,
        gmv: 350000,
        gmvMillions: 0.35,
      });

      const matchStage = paymentModel.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.purpose.$in).toEqual(
        expect.arrayContaining([
          'DEPOSIT_PAYMENT',
          'REMAINING_PAYMENT',
          'FULL_PAYMENT',
        ]),
      );

      paymentModel.aggregate.mockResolvedValue([]);
      bookingModel.aggregate.mockResolvedValue([]);
      const weekPoints = await (service as any).getOverviewChartPoints('week');
      expect(weekPoints).toHaveLength(7);
      expect(weekPoints[0].fullLabel).toMatch(/^Ngày \d{2}\/\d{2}\/\d{4}$/);
    });

    it('computes period-over-period growth against previous full period totals', async () => {
      bookingModel.countDocuments.mockResolvedValue(4);
      paymentModel.aggregate.mockResolvedValue([{ _id: null, total: 2_000_000 }]);

      const growth = await (service as any).getOverviewPeriodComparison(
        'day',
        6,
        3_000_000,
      );
      expect(growth).toEqual({
        bookingGrowthPct: 50,
        gmvGrowthPct: 50,
      });

      const bookingRange = bookingModel.countDocuments.mock.calls[0][0].createdAt;
      expect(bookingRange.$gte).toBeInstanceOf(Date);
      expect(bookingRange.$lte).toBeInstanceOf(Date);
      expect(bookingRange.$lte.getTime() - bookingRange.$gte.getTime()).toBe(
        24 * 60 * 60 * 1000 - 1,
      );
    });
  });

  describe('Admin booking filters', () => {
    it('filters bookings by providers in the selected city', async () => {
      const providerId = new Types.ObjectId();
      bookingModel.find
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        });
      bookingModel.countDocuments.mockResolvedValue(0);
      disputeModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      providerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: providerId }]),
      });

      await service.getAllBookings(
        1,
        10,
        undefined,
        undefined,
        undefined,
        'TP. Hồ Chí Minh',
      );

      const cityQuery = providerModel.find.mock.calls[0][0];
      expect(cityQuery['address.city']).toBeInstanceOf(RegExp);
      expect(cityQuery['address.city'].test('Hồ Chí Minh')).toBe(true);
      expect(bookingModel.countDocuments).toHaveBeenCalledWith({
        providerIds: { $in: [providerId] },
      });
    });
  });

  describe('Top partners & provider directory fixes', () => {
    it('aggregates top partners by providerIds without stock avatar fallbacks', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();
      bookingModel.aggregate.mockResolvedValue([
        { _id: p1, count: 16 },
        { _id: p2, count: 8 },
      ]);
      providerModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: p1,
                businessName: 'Áo Dài Cổ Phong Vibe',
                media: { logoUrl: 'https://cdn.vibehue.vn/logo1.png' },
              },
              {
                _id: p2,
                businessName: 'Huế Áo Dài Studio',
                media: { logoUrl: null },
                userId: { profile: { avatarUrl: null } },
              },
            ]),
          }),
        }),
      });

      const result = await (service as any).getTopPartners();

      expect(bookingModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              providerIds: { $exists: true, $ne: [] },
            }),
          }),
          expect.objectContaining({ $unwind: '$providerIds' }),
          expect.objectContaining({
            $group: { _id: '$providerIds', count: { $sum: 1 } },
          }),
        ]),
      );
      expect(result).toEqual([
        {
          rank: 1,
          name: 'Áo Dài Cổ Phong Vibe',
          bookings: 16,
          avatar: 'https://cdn.vibehue.vn/logo1.png',
        },
        {
          rank: 2,
          name: 'Huế Áo Dài Studio',
          bookings: 8,
          avatar: '',
        },
      ]);
    });

    it('sorts providers by bookings_desc, keeps unreviewed rating at 0, and leaves missing avatars empty', async () => {
      const emptyNewProviderId = new Types.ObjectId();
      const activeOldProviderId = new Types.ObjectId();

      providerModel.countDocuments.mockResolvedValue(2);
      providerModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: emptyNewProviderId,
            businessName: 'New Empty Shop',
            createdAt: new Date('2026-11-20T00:00:00.000Z'),
            status: 'ACTIVE',
            rating: { averageRating: 4.9, totalReviews: 0 },
            media: {},
          },
          {
            _id: activeOldProviderId,
            businessName: 'Busy Active Shop',
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
            status: 'ACTIVE',
            rating: { averageRating: 4.8, totalReviews: 5 },
            media: { logoUrl: 'https://cdn.vibehue.vn/busy.png' },
          },
        ]),
      });
      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      bookingModel.aggregate.mockResolvedValue([
        {
          _id: activeOldProviderId,
          totalRevenue: 6000000,
          completedCount: 16,
          totalCount: 16,
        },
      ]);
      providerVerificationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      reviewModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getAllProviders(1, 10, undefined, 'bookings_desc');

      expect(result.items[0]).toMatchObject({
        businessName: 'Busy Active Shop',
        completedBookings: 16,
        rating: 4.8,
        totalReviews: 5,
        avatar: 'https://cdn.vibehue.vn/busy.png',
      });
      expect(result.items[1]).toMatchObject({
        businessName: 'New Empty Shop',
        completedBookings: 0,
        rating: 0,
        totalReviews: 0,
        avatar: '',
      });
    });
  });
});
