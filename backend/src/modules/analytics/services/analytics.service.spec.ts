import { Types } from 'mongoose';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  function chain<T>(result: T) {
    return {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    };
  }

  function create() {
    const searchModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };
    const productViewModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };
    return {
      service: new AnalyticsService(
        searchModel as never,
        productViewModel as never,
      ),
      searchModel,
      productViewModel,
    };
  }

  it('normalizes and increments a meaningful search keyword', async () => {
    const { service, searchModel } = create();
    await service.trackSearch('  Áo Dài Cưới  ');
    expect(searchModel.findOneAndUpdate).toHaveBeenCalledWith(
      { keyword: 'áo dài cưới' },
      expect.objectContaining({ $inc: { count: 1 } }),
      { upsert: true },
    );
  });

  it.each(['', ' ', 'a'])(
    'ignores unusable search keyword %p',
    async (keyword) => {
      const { service, searchModel } = create();
      await service.trackSearch(keyword);
      expect(searchModel.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('records a product view with an ObjectId', async () => {
    const { service, productViewModel } = create();
    const productId = new Types.ObjectId();
    await service.trackProductView(productId.toString());
    expect(productViewModel.findOneAndUpdate).toHaveBeenCalledWith(
      { productId },
      expect.objectContaining({ $inc: { viewCount: 1 } }),
      { upsert: true },
    );
  });

  it('returns top searches in repository order', async () => {
    const { service, searchModel } = create();
    searchModel.find.mockReturnValue(chain([{ keyword: 'áo dài', count: 8 }]));
    await expect(service.getTopSearches(5)).resolves.toEqual([
      { keyword: 'áo dài', count: 8 },
    ]);
  });

  it('maps product IDs to view counts', async () => {
    const { service, productViewModel } = create();
    const first = new Types.ObjectId();
    const second = new Types.ObjectId();
    productViewModel.find.mockReturnValue(
      chain([
        { productId: first, viewCount: 4 },
        { productId: second, viewCount: 9 },
      ]),
    );
    const result = await service.getViewCountMap([first, second]);
    expect(result).toEqual(
      new Map([
        [first.toString(), 4],
        [second.toString(), 9],
      ]),
    );
  });
});
