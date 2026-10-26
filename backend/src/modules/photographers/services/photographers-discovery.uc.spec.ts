import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PhotographersService } from './photographers.service';

type Row = Record<string, any>;

const LOCATION_KEY = '__locationForDiscovery';

function photographer(overrides: Row = {}): Row {
  const price = overrides.price ?? 1000000;
  return {
    _id: new Types.ObjectId(),
    businessName: 'Studio',
    address: { city: 'Huế', district: 'Phú Hội' },
    rating: { averageRating: 4.5, totalReviews: 10 },
    packages: [{ price }],
    defaultPackage: { price },
    portfolioItems: [],
    [LOCATION_KEY]: { coordinates: [107.59, 16.46], serviceRadiusKm: 30 },
    ...overrides,
  };
}

function createService(photographers: Row[]) {
  jest
    .spyOn(PhotographersService.prototype as any, 'loadPublicPhotographers')
    .mockResolvedValue(photographers);
  const providerModel = {
    findOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  };
  const service = new PhotographersService(
    providerModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, providerModel };
}

afterEach(() => jest.restoreAllMocks());

describe('UC-23 Search Photographer (DaiBLL)', () => {
  it('UT-23 UTCID01 matches the keyword against name, city and concept without diacritics', async () => {
    const { service } = createService([
      photographer({ businessName: 'Mây Studio', address: { city: 'Huế' } }),
      photographer({
        businessName: 'Nắng Studio',
        address: { city: 'Hà Nội' },
      }),
    ]);

    const result = await service.findAll({ q: 'hue' });

    expect(result.data.map((item: Row) => item.businessName)).toEqual([
      'Mây Studio',
    ]);
  });

  it('UT-23 UTCID02 filters by concept code regardless of letter case', async () => {
    const { service } = createService([
      photographer({
        businessName: 'Vintage Lab',
        portfolioItems: [
          { images: [], badges: [{ code: 'VINTAGE', label: 'Cổ điển' }] },
        ],
      }),
      photographer({
        businessName: 'Modern Lab',
        portfolioItems: [
          { images: [], badges: [{ code: 'MODERN', label: 'Hiện đại' }] },
        ],
      }),
    ]);

    const result = await service.findAll({ concept: ' vintage ' });

    expect(result.data.map((item: Row) => item.businessName)).toEqual([
      'Vintage Lab',
    ]);
  });

  it('UT-23 UTCID03 filters by package price and treats an inverted range as the minimum price', async () => {
    const { service } = createService([
      photographer({ businessName: 'Budget', price: 800000 }),
      photographer({ businessName: 'Standard', price: 1500000 }),
      photographer({ businessName: 'Premium', price: 3000000 }),
    ]);

    const range = await service.findAll({
      minPrice: 1000000,
      maxPrice: 2000000,
    });
    const inverted = await service.findAll({
      minPrice: 1500000,
      maxPrice: 1000000,
    });

    expect(range.data.map((item: Row) => item.businessName)).toEqual([
      'Standard',
    ]);
    expect(inverted.data.map((item: Row) => item.businessName)).toEqual([
      'Standard',
    ]);
  });

  it('UT-23 UTCID04 excludes photographers below the minimum rating and sorts by rating', async () => {
    const { service } = createService([
      photographer({ businessName: 'Three', rating: { averageRating: 3.9 } }),
      photographer({ businessName: 'Four', rating: { averageRating: 4.0 } }),
      photographer({ businessName: 'Five', rating: { averageRating: 5.0 } }),
    ]);

    const result = await service.findAll({ minRating: 4 });

    expect(result.data.map((item: Row) => item.businessName)).toEqual([
      'Five',
      'Four',
    ]);
  });

  it('UT-23 UTCID05 rejects an incomplete proximity filter', async () => {
    const { service } = createService([photographer()]);

    await expect(
      service.findAll({ latitude: 16.46, longitude: 107.59 }),
    ).rejects.toThrow(
      new BadRequestException(
        'latitude, longitude and searchRadiusKm must be supplied together.',
      ),
    );
  });

  it('UT-23 UTCID06 keeps only photographers inside both the search and service radius', async () => {
    const { service } = createService([
      photographer({
        businessName: 'Near',
        [LOCATION_KEY]: { coordinates: [107.6, 16.47], serviceRadiusKm: 20 },
      }),
      photographer({
        businessName: 'Far',
        [LOCATION_KEY]: { coordinates: [108.22, 16.05], serviceRadiusKm: 200 },
      }),
      photographer({
        businessName: 'No coordinates',
        [LOCATION_KEY]: { coordinates: null, serviceRadiusKm: 20 },
      }),
    ]);

    const result = await service.findAll({
      latitude: 16.46,
      longitude: 107.59,
      searchRadiusKm: 10,
    });

    expect(result.data.map((item: Row) => item.businessName)).toEqual(['Near']);
  });

  it('UT-23 UTCID07 clamps a page beyond the last page and the page size to 48', async () => {
    const photographers = Array.from({ length: 50 }, (_, index) =>
      photographer({
        businessName: `Studio ${String(index).padStart(2, '0')}`,
      }),
    );
    const { service } = createService(photographers);

    const result = await service.findAll({ page: 9, limit: 100 });

    expect(result.meta).toEqual({
      page: 2,
      limit: 48,
      total: 50,
      totalPages: 2,
    });
    expect(result.data).toHaveLength(2);
  });

  it('UT-23 UTCID08 returns stable pagination metadata when nothing matches', async () => {
    const { service } = createService([photographer()]);

    const result = await service.findAll({ q: 'khong ton tai' });

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
    });
  });

  it('UT-23 UTCID09 never exposes the private discovery location in public results', async () => {
    const { service } = createService([photographer()]);

    const result = await service.findAll({});

    expect(result.data[0]).not.toHaveProperty(LOCATION_KEY);
  });

  it('UT-23 UTCID10 returns not found for a malformed photographer id', async () => {
    const { service, providerModel } = createService([]);

    await expect(service.findOne('photographer-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(providerModel.findOne).not.toHaveBeenCalled();
  });

  // Known defect UT-DEF-23-01: the "đ" replacement in normalizeText is mis-encoded.
  it.failing(
    'UT-23 UTCID11 matches a city typed without the Vietnamese letter "đ"',
    async () => {
      const { service } = createService([
        photographer({
          businessName: 'Biển Studio',
          address: { city: 'Đà Nẵng' },
        }),
      ]);

      const result = await service.findAll({ location: 'Da Nang' });

      expect(result.data).toHaveLength(1);
    },
  );

  // Known defect UT-DEF-23-02: user-facing error messages in the service are mis-encoded.
  it.failing(
    'UT-23 UTCID12 returns a readable Vietnamese message for a malformed id',
    async () => {
      const { service } = createService([]);

      await expect(service.findOne('photographer-1')).rejects.toThrow(
        'ID nhiếp ảnh gia không hợp lệ',
      );
    },
  );
});

describe('UC-24 View Photography Concept (DaiBLL)', () => {
  it('UT-24 UTCID01 groups portfolio badges into concepts with a cover image', async () => {
    const { service } = createService([
      photographer({
        portfolioItems: [
          {
            images: ['vintage.jpg'],
            badges: [{ code: 'VINTAGE', label: 'Cổ điển' }],
          },
        ],
      }),
    ]);

    await expect(service.findConcepts()).resolves.toEqual({
      data: [
        {
          code: 'VINTAGE',
          label: 'Cổ điển',
          photographerCount: 1,
          coverImage: 'vintage.jpg',
        },
      ],
    });
  });

  it('UT-24 UTCID02 counts each photographer once per concept', async () => {
    const badge = { code: 'AO_DAI', label: 'Áo dài' };
    const { service } = createService([
      photographer({
        portfolioItems: [
          { images: ['a.jpg'], badges: [badge] },
          { images: ['b.jpg'], badges: [badge] },
        ],
      }),
      photographer({
        portfolioItems: [{ images: ['c.jpg'], badges: [badge] }],
      }),
    ]);

    const { data } = await service.findConcepts();

    expect(data).toEqual([
      expect.objectContaining({
        code: 'AO_DAI',
        photographerCount: 2,
        coverImage: 'a.jpg',
      }),
    ]);
  });

  it('UT-24 UTCID03 sorts concepts by photographer count and then by Vietnamese label', async () => {
    const vintage = { code: 'VINTAGE', label: 'Vintage' };
    const { service } = createService([
      photographer({
        portfolioItems: [
          {
            images: ['1.jpg'],
            badges: [vintage, { code: 'PHO_CO', label: 'Phố cổ' }],
          },
        ],
      }),
      photographer({
        portfolioItems: [
          {
            images: ['2.jpg'],
            badges: [vintage, { code: 'BIEN', label: 'Biển' }],
          },
        ],
      }),
    ]);

    const { data } = await service.findConcepts();

    expect(data.map((concept: Row) => concept.code)).toEqual([
      'VINTAGE',
      'BIEN',
      'PHO_CO',
    ]);
  });

  it('UT-24 UTCID04 ignores badges without a code or label', async () => {
    const { service } = createService([
      photographer({
        portfolioItems: [
          {
            images: ['1.jpg'],
            badges: [{ code: 'NO_LABEL' }, { label: 'No code' }],
          },
        ],
      }),
    ]);

    await expect(service.findConcepts()).resolves.toEqual({ data: [] });
  });

  it('UT-24 UTCID05 uses a later portfolio image when the first item has no image', async () => {
    const badge = { code: 'CUOI', label: 'Cưới' };
    const { service } = createService([
      photographer({
        portfolioItems: [
          { images: [], badges: [badge] },
          { images: ['wedding.jpg'], badges: [badge] },
        ],
      }),
    ]);

    const { data } = await service.findConcepts();

    expect(data[0].coverImage).toBe('wedding.jpg');
  });

  it('UT-24 UTCID06 returns an empty concept list when no photographer is public', async () => {
    const { service } = createService([]);

    await expect(service.findConcepts()).resolves.toEqual({ data: [] });
  });
});
