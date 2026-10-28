import { Types } from 'mongoose';
import { ProvidersService } from './providers.service';

describe('ProvidersService.getProviderAnalytics (VS-103, VS-104, VS-105)', () => {
  let service: ProvidersService;
  let providersRepository: any;
  let productModel: any;
  let bookingModel: any;
  let bookingItemModel: any;
  let reviewModel: any;
  let paymentModel: any;
  let portfolioItemModel: any;
  let smartTaggingService: any;

  const providerId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  beforeEach(() => {
    providersRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        _id: providerId,
        businessName: 'Áo Dài Huế Cố Đô',
        capabilities: ['AODAI_RENTAL'],
        rating: { averageRating: 4.8 },
      }),
    };

    productModel = {
      countDocuments: jest.fn().mockResolvedValue(10),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
      }),
      findById: jest.fn().mockImplementation((id) =>
        Promise.resolve({
          _id: id,
          name: `Sản phẩm ${id}`,
          images: ['/img.jpg'],
        }),
      ),
    };

    bookingModel = {
      find: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
      db: {
        model: jest.fn().mockReturnValue({
          aggregate: jest.fn().mockResolvedValue([]),
          find: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      },
    };

    bookingItemModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    reviewModel = {};
    paymentModel = {};
    portfolioItemModel = {};
    smartTaggingService = {};

    service = new ProvidersService(
      providersRepository,
      productModel,
      bookingModel,
      bookingItemModel,
      reviewModel,
      paymentModel,
      portfolioItemModel,
      smartTaggingService,
    );
  });

  describe('VS-103: Rental specific stats and date range filter', () => {
    it('separates rental statistics and respects date range filter', async () => {
      const rentalBookingId = new Types.ObjectId();
      const photoBookingId = new Types.ObjectId();

      bookingModel.find.mockResolvedValue([
        {
          _id: rentalBookingId,
          bookingType: 'AODAI_RENTAL',
          createdAt: new Date('2026-01-10'),
        },
        {
          _id: photoBookingId,
          bookingType: 'PHOTOGRAPHY',
          createdAt: new Date('2026-01-12'),
        },
      ]);

      bookingItemModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { bookingId: rentalBookingId, unitPrice: 300000, quantity: 2 },
          { bookingId: photoBookingId, unitPrice: 1000000, quantity: 1 },
        ]),
      });

      const res = await service.getProviderAnalytics(
        userId.toString(),
        'month',
        '2026-01-01',
        '2026-01-31',
      );

      // Total revenue = 600,000 + 1,000,000 = 1,600,000
      expect(res.totalRevenue).toBe(1600000);
      // Rental specific revenue = 600,000, order count = 1
      expect(res.rentalStats).toEqual({
        orderCount: 1,
        revenue: 600000,
      });
      expect(res.rentalOrderCount).toBe(1);
      expect(res.rentalRevenue).toBe(600000);

      // Verify date filter was passed to bookingModel.find
      expect(bookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        }),
      );
    });
  });

  describe('VS-104: Top 5 products by rental count', () => {
    it('returns Top 5 products and requests limit 5 from aggregation', async () => {
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();
      const p3 = new Types.ObjectId();
      const p4 = new Types.ObjectId();
      const p5 = new Types.ObjectId();

      bookingItemModel.aggregate.mockResolvedValue([
        { _id: p1, count: 50 },
        { _id: p2, count: 40 },
        { _id: p3, count: 30 },
        { _id: p4, count: 20 },
        { _id: p5, count: 10 },
      ]);

      const res = await service.getProviderAnalytics(userId.toString());

      expect(bookingItemModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([{ $limit: 5 }]),
      );
      expect(res.popularProducts).toHaveLength(5);
      expect(res.popularProducts[0].rentalCount).toBe(50);
      expect(res.popularProducts[4].rentalCount).toBe(10);
    });
  });

  describe('VS-105: Inventory percentage breakdown', () => {
    it('computes percentage for inventory items status', async () => {
      const invAggregateMock = jest.fn().mockResolvedValue([
        { _id: 'AVAILABLE', count: 10 },
        { _id: 'RENTED', count: 8 },
        { _id: 'CLEANING', count: 2 },
      ]);

      bookingModel.db.model = jest.fn().mockReturnValue({
        aggregate: invAggregateMock,
        find: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await service.getProviderAnalytics(userId.toString());

      expect(res.inventoryStatus).toEqual([
        {
          name: 'Available',
          status: 'AVAILABLE',
          count: 10,
          percentage: 50,
          percentageFormatted: '50%',
          detail: '',
          color: 'available',
        },
        {
          name: 'In Use',
          status: 'RENTED',
          count: 8,
          percentage: 40,
          percentageFormatted: '40%',
          detail: '',
          color: 'rental',
        },
        {
          name: 'Cleaning',
          status: 'CLEANING',
          count: 2,
          percentage: 10,
          percentageFormatted: '10%',
          detail: '',
          color: 'maintenance',
        },
      ]);
    });
  });
});
