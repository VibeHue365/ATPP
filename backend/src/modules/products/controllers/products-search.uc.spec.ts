import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { ProductsService } from '../services/products.service';
import { ProductsController } from './products.controller';

type Row = Record<string, any>;
type GetAllArgs = Parameters<ProductsController['getAll']>;

function createController() {
  const service = {
    getAllActiveProducts: jest.fn().mockResolvedValue([]),
    getActiveProductsPage: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  };
  const controller = new ProductsController(
    service as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { controller, service };
}

/** Builds the positional query arguments of GET /products from named values. */
function queryArgs(
  values: Partial<
    Record<
      | 'search'
      | 'minPrice'
      | 'maxPrice'
      | 'minRating'
      | 'colors'
      | 'sizes'
      | 'materials'
      | 'categoryId'
      | 'styleCategoryIds'
      | 'eventCategoryIds'
      | 'providerId'
      | 'providerLocation'
      | 'types'
      | 'page'
      | 'limit'
      | 'sort',
      string
    >
  >,
): GetAllArgs {
  return [
    values.search,
    values.minPrice,
    values.maxPrice,
    values.minRating,
    values.colors,
    values.sizes,
    values.materials,
    values.categoryId,
    values.styleCategoryIds,
    values.eventCategoryIds,
    values.providerId,
    values.providerLocation,
    values.types,
    values.page,
    values.limit,
    values.sort as any,
  ];
}

function createRepository(locationProviders: Row[] = []) {
  const listQuery: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'populate',
    'sort',
    'skip',
    'limit',
    'lean',
  ]) {
    listQuery[method] = jest.fn().mockReturnValue(listQuery);
  }
  listQuery.exec = jest.fn().mockResolvedValue([]);
  const productModel = {
    find: jest.fn().mockReturnValue(listQuery),
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
  };
  const providerModel = {
    find: jest.fn((filter: Row) =>
      filter.$or
        ? {
            select: () => ({
              lean: () => ({ exec: () => Promise.resolve(locationProviders) }),
            }),
          }
        : { distinct: () => ({ exec: () => Promise.resolve([]) }) },
    ),
  };
  const repository = new ProductsRepository(
    productModel as any,
    providerModel as any,
    {} as any,
  );
  return { repository, productModel, providerModel, listQuery };
}

describe('UC-21 Search by Budget (DaiBLL)', () => {
  it('UT-21 UTCID01 converts both budget boundaries to numbers', async () => {
    const { controller, service } = createController();

    await controller.getAll(
      ...queryArgs({ minPrice: '300000', maxPrice: '900000' }),
    );

    expect(service.getAllActiveProducts).toHaveBeenCalledWith(
      expect.objectContaining({ minPrice: 300000, maxPrice: 900000 }),
    );
  });

  it('UT-21 UTCID02 searches with only a lower budget boundary', async () => {
    const { controller, service } = createController();

    await controller.getAll(...queryArgs({ minPrice: '300000' }));

    expect(service.getAllActiveProducts.mock.calls[0][0]).toMatchObject({
      minPrice: 300000,
      maxPrice: undefined,
    });
  });

  it('UT-21 UTCID03 searches with only an upper budget boundary', async () => {
    const { controller, service } = createController();

    await controller.getAll(...queryArgs({ maxPrice: '900000' }));

    expect(service.getAllActiveProducts.mock.calls[0][0]).toMatchObject({
      minPrice: undefined,
      maxPrice: 900000,
    });
  });

  it('UT-21 UTCID04 does not add a price filter when no budget is supplied', async () => {
    const { repository, productModel } = createRepository();

    await repository.findAllActive({});

    expect(productModel.find.mock.calls[0][0]).not.toHaveProperty('basePrice');
  });

  it('UT-21 UTCID05 builds an inclusive price range when both boundaries are equal', async () => {
    const { repository, productModel } = createRepository();

    await repository.findAllActive({ minPrice: 500000, maxPrice: 500000 });

    expect(productModel.find.mock.calls[0][0].basePrice).toEqual({
      $gte: 500000,
      $lte: 500000,
    });
  });

  it('UT-21 UTCID06 clamps paginated budget results to page 1 and 24 items', async () => {
    const { controller, service } = createController();

    await controller.getAll(
      ...queryArgs({ minPrice: '300000', page: '0', limit: '100' }),
    );

    expect(service.getActiveProductsPage).toHaveBeenCalledWith(
      expect.objectContaining({ minPrice: 300000 }),
      1,
      24,
      undefined,
    );
  });

  // Known defect UT-DEF-21-01: a non-numeric budget is forwarded as NaN.
  it.failing(
    'UT-21 UTCID07 does not forward a non-numeric budget as NaN',
    async () => {
      const { controller, service } = createController();

      await controller.getAll(...queryArgs({ minPrice: 'abc' }));

      expect(
        Number.isNaN(service.getAllActiveProducts.mock.calls[0][0].minPrice),
      ).toBe(false);
    },
  );

  // Known defect UT-DEF-21-02: an inverted budget range is accepted silently.
  it.failing(
    'UT-21 UTCID08 rejects a lower boundary greater than the upper boundary',
    async () => {
      const { controller } = createController();

      await expect(
        controller.getAll(
          ...queryArgs({ minPrice: '900000', maxPrice: '300000' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('UC-22 Search AoDai (DaiBLL)', () => {
  it('UT-22 UTCID06 escapes regular-expression characters in the keyword', async () => {
    const { repository, productModel } = createRepository();

    await repository.findAllActive({ search: 'Lụa (đỏ)+' });

    const nameRegex: RegExp = productModel.find.mock.calls[0][0].$or[0].name;
    expect(nameRegex.test('Áo dài Lụa (đỏ)+ cao cấp')).toBe(true);
    expect(nameRegex.test('Lụa đỏ')).toBe(false);
  });

  it('UT-22 UTCID07 matches colors and sizes exactly without case sensitivity', async () => {
    const { repository, productModel } = createRepository();

    await repository.findAllActive({ colors: ['red'], sizes: ['m'] });

    const query = productModel.find.mock.calls[0][0];
    const [colorRegex] = query.colors.$in as RegExp[];
    const [sizeRegex] = query.sizes.$in as RegExp[];
    expect([colorRegex.test('RED'), colorRegex.test('DARK RED')]).toEqual([
      true,
      false,
    ]);
    expect([sizeRegex.test('M'), sizeRegex.test('XM')]).toEqual([true, false]);
  });

  it('UT-22 UTCID08 trims comma-separated filters and drops empty values', async () => {
    const { controller, service } = createController();

    await controller.getAll(
      ...queryArgs({
        colors: ' red , ,pink ',
        sizes: 'M,,L ',
        types: 'female, ',
      }),
    );

    expect(service.getAllActiveProducts.mock.calls[0][0]).toMatchObject({
      colors: ['red', 'pink'],
      sizes: ['M', 'L'],
      productTypes: ['female'],
    });
  });

  it('UT-22 UTCID09 returns no provider match when the location matches no active shop', async () => {
    const { repository, productModel } = createRepository([]);

    await repository.findAllActive({ providerLocation: 'Ca Mau' });

    expect(productModel.find.mock.calls[0][0].providerId).toEqual({ $in: [] });
  });

  it('UT-22 UTCID10 restricts results to shops located in the requested city', async () => {
    const shopId = new Types.ObjectId();
    const { repository, productModel, providerModel } = createRepository([
      { _id: shopId },
    ]);

    await repository.findAllActive({ providerLocation: ' Hue ' });

    const providerFilter = providerModel.find.mock.calls.find(
      ([filter]) => filter.$or,
    )![0];
    expect(providerFilter.$or[1]['address.city'].test('Thành phố Hue')).toBe(
      true,
    );
    expect(productModel.find.mock.calls[0][0].providerId).toEqual({
      $in: [shopId],
    });
  });

  it('UT-22 UTCID11 sorts by price and clamps the page size in paginated search', async () => {
    const { repository, listQuery } = createRepository();

    await repository.findActivePage({ search: 'lua' }, 3, 100, 'price_asc');

    expect(listQuery.sort).toHaveBeenCalledWith({ basePrice: 1, _id: 1 });
    expect(listQuery.skip).toHaveBeenCalledWith(48);
    expect(listQuery.limit).toHaveBeenCalledWith(24);
  });

  it('UT-22 UTCID12 serves an identical search page from cache', async () => {
    const productsRepository = {
      findActivePage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new ProductsService(
      productsRepository as any,
      {} as any,
      {} as any,
      { projectProductBadges: jest.fn().mockResolvedValue(new Map()) } as any,
      {} as any,
      {} as any,
      {
        getActiveCampaignsForProviders: jest.fn().mockResolvedValue({}),
      } as any,
      {} as any,
      {} as any,
    );

    await service.getActiveProductsPage({ search: 'lua' }, 1, 12, 'newest');
    await service.getActiveProductsPage({ search: 'lua' }, 1, 12, 'newest');

    expect(productsRepository.findActivePage).toHaveBeenCalledTimes(1);
  });

  // Known defect UT-DEF-22-01: special characters in the location filter are not escaped.
  it.failing(
    'UT-22 UTCID13 accepts a location containing regular-expression characters',
    async () => {
      const { repository } = createRepository([]);

      await expect(
        repository.findAllActive({ providerLocation: 'Huế (' }),
      ).resolves.toEqual([]);
    },
  );
});
