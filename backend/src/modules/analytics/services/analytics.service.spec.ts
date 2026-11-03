import { AnalyticsService } from './analytics.service';

describe('AnalyticsService (VS-116)', () => {
  it('returns high-view products with no bookings and the top search terms', async () => {
    const searchLogModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([{ keyword: 'nhat binh ao dai', count: 1000 }]),
            }),
          }),
        }),
      }),
    };
    const productViewLogModel = {
      aggregate: jest.fn().mockResolvedValue([
        { _id: { toString: () => 'product-1' }, name: 'Áo dài Nhật Bình', basePrice: 500000, viewCount: 500 },
      ]),
    };
    const service = new AnalyticsService(searchLogModel as any, productViewLogModel as any);

    await expect(service.getUserBehavior()).resolves.toEqual({
      topSearchTerms: [{ keyword: 'nhat binh ao dai', count: 1000 }],
      highViewZeroBookingProducts: [{
        _id: 'product-1',
        name: 'Áo dài Nhật Bình',
        basePrice: 500000,
        viewCount: 500,
        rentCount: 0,
        recommendation: 'Review Pricing / Photo Quality',
      }],
    });

    expect(productViewLogModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: { viewCount: { $gte: 100 } } }),
      expect.objectContaining({ $lookup: expect.objectContaining({ from: 'booking_items' }) }),
      expect.objectContaining({ $match: { bookingItems: { $eq: [] } } }),
    ]));
  });
});
