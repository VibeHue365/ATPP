import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InventoryItemSchema } from '../products/schemas/inventory-item.schema';
import { ProvidersService } from '../providers/services/providers.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

type Row = Record<string, any>;

function lean(result: unknown) {
  const q: Row = {};
  for (const method of ['select', 'populate', 'sort', 'skip', 'limit'])
    q[method] = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(result);
  q.then = (
    resolve: (v: unknown) => unknown,
    reject: (r: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return q;
}

// ------------------------------------------------------------------ Provider analytics
function createProviderAnalytics(
  options: {
    provider?: Row | null;
    bookings?: Row[];
    items?: Row[];
    counts?: { all: number; completed: number; cancelled: number };
    popular?: Row[];
    products?: Record<string, Row | null>;
    packages?: Row[];
    packageDocs?: Record<string, Row>;
  } = {},
) {
  const provider =
    options.provider === undefined
      ? {
          _id: new Types.ObjectId(),
          capabilities: ['AODAI_RENTAL'],
          rating: { averageRating: 4.6 },
        }
      : options.provider;
  const counts = options.counts ?? { all: 0, completed: 0, cancelled: 0 };
  const inventoryAggregate = jest
    .fn()
    .mockReturnValue({
      then: (fn: (rows: Row[]) => unknown) => Promise.resolve(fn([])),
    });
  const bookingModel = {
    find: jest.fn().mockResolvedValue(options.bookings ?? []),
    countDocuments: jest.fn(async (filter: Row) =>
      filter.status === 'COMPLETED'
        ? counts.completed
        : filter.status === 'CANCELLED'
          ? counts.cancelled
          : counts.all,
    ),
    db: {
      model: jest.fn((name: string) => {
        if (name === 'InventoryItem') return { aggregate: inventoryAggregate };
        if (name === 'BookingSchedule') return { find: () => lean([]) };
        return {
          findById: (id: Types.ObjectId) =>
            lean(options.packageDocs?.[id.toString()] ?? null),
        };
      }),
    },
  };
  const bookingItemModel = {
    find: jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve(options.items ?? []) }),
    aggregate: jest
      .fn()
      .mockResolvedValueOnce(options.popular ?? [])
      .mockResolvedValueOnce(options.packages ?? []),
  };
  const productModel = {
    findById: jest.fn(
      async (id: Types.ObjectId) => options.products?.[id.toString()] ?? null,
    ),
    countDocuments: jest.fn().mockResolvedValue(3),
  };
  const service = new ProvidersService(
    { findByUserId: jest.fn().mockResolvedValue(provider) } as any,
    productModel as any,
    bookingModel as any,
    bookingItemModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, provider, bookingModel, inventoryAggregate };
}

const providerUser = new Types.ObjectId().toString();

describe('UC-60 View Revenue (DatTT)', () => {
  it('UT-60 UTCID06 sums item revenue per booking and applies the 15% commission', async () => {
    const booking = { _id: new Types.ObjectId(), createdAt: new Date() };
    const { service } = createProviderAnalytics({
      bookings: [booking],
      items: [
        { bookingId: booking._id, unitPrice: 400000, quantity: 2 },
        { bookingId: booking._id, unitPrice: 200000 },
      ],
    });

    const result = await service.getProviderAnalytics(providerUser, 'month');

    expect(result).toMatchObject({
      totalRevenue: 1000000,
      commissionFee: 150000,
    });
  });

  it('UT-60 UTCID07 rounds success and cancellation rates to one decimal', async () => {
    const { service } = createProviderAnalytics({
      counts: { all: 3, completed: 2, cancelled: 1 },
    });

    await expect(
      service.getProviderAnalytics(providerUser),
    ).resolves.toMatchObject({ successRate: 66.7, cancelRate: 33.3 });
  });

  it('UT-60 UTCID08 returns zero revenue and rates for a provider without bookings', async () => {
    const { service } = createProviderAnalytics();

    await expect(
      service.getProviderAnalytics(providerUser),
    ).resolves.toMatchObject({
      totalRevenue: 0,
      commissionFee: 0,
      successRate: 0,
      cancelRate: 0,
    });
  });

  it('UT-60 UTCID09 groups monthly revenue into the last six months', async () => {
    const booking = { _id: new Types.ObjectId(), createdAt: new Date() };
    const { service } = createProviderAnalytics({
      bookings: [booking],
      items: [{ bookingId: booking._id, unitPrice: 500000, quantity: 1 }],
    });

    const { revenueGrowth } = await service.getProviderAnalytics(
      providerUser,
      'month',
    );

    expect(revenueGrowth).toHaveLength(6);
    expect(revenueGrowth.at(-1)).toMatchObject({
      label: `Tháng ${new Date().getMonth() + 1}`,
      value: 500000,
    });
  });

  it('UT-60 UTCID10 returns seven daily buckets for the week and five yearly buckets for the year', async () => {
    const week = await createProviderAnalytics().service.getProviderAnalytics(
      providerUser,
      'week',
    );
    const year = await createProviderAnalytics().service.getProviderAnalytics(
      providerUser,
      'year',
    );

    expect(week.revenueGrowth).toHaveLength(7);
    expect(year.revenueGrowth.map((bucket: Row) => bucket.label).at(-1)).toBe(
      `${new Date().getFullYear()}`,
    );
    expect(year.revenueGrowth).toHaveLength(5);
  });

  it('UT-60 UTCID11 returns not found for a user without a provider profile', async () => {
    const { service } = createProviderAnalytics({ provider: null });

    await expect(service.getProviderAnalytics(providerUser)).rejects.toThrow(
      new NotFoundException('Không tìm thấy thông tin đối tác'),
    );
  });
});

describe('UC-61 View Product / Popular Concept (DatTT)', () => {
  it('UT-61 UTCID02 lists the most rented products with an image fallback', async () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const { service } = createProviderAnalytics({
      popular: [
        { _id: a, count: 5 },
        { _id: b, count: 2 },
      ],
      products: {
        [a.toString()]: { name: 'Áo đỏ', images: ['red.jpg'] },
        [b.toString()]: { name: 'Áo trắng', images: [] },
      },
    });

    const { popularProducts } =
      await service.getProviderAnalytics(providerUser);

    expect(popularProducts).toEqual([
      { name: 'Áo đỏ', image: 'red.jpg', count: 5 },
      { name: 'Áo trắng', image: '/hong_lien_hoa.png', count: 2 },
    ]);
  });

  it('UT-61 UTCID03 skips popular items whose product no longer exists', async () => {
    const { service } = createProviderAnalytics({
      popular: [
        { _id: new Types.ObjectId(), count: 4 },
        { _id: null, count: 1 },
      ],
    });

    await expect(
      service.getProviderAnalytics(providerUser),
    ).resolves.toMatchObject({ popularProducts: [] });
  });

  it('UT-61 UTCID04 converts popular photography packages into concept percentages', async () => {
    const p1 = new Types.ObjectId();
    const p2 = new Types.ObjectId();
    const { service } = createProviderAnalytics({
      packages: [
        { _id: p1, count: 3 },
        { _id: p2, count: 1 },
      ],
      packageDocs: {
        [p1.toString()]: { name: 'Cổ điển' },
        [p2.toString()]: { name: 'Phố cổ' },
      },
    });

    const { popularConcepts } =
      await service.getProviderAnalytics(providerUser);

    expect(popularConcepts).toEqual([
      { name: 'Cổ điển', percentage: 75, color: '#4A0E17' },
      { name: 'Phố cổ', percentage: 25, color: '#706E3B' },
    ]);
  });

  // Known defect UT-DEF-61-01: the inventory status pipeline filters InventoryItem by a field the schema does not have.
  it.failing(
    'UT-61 UTCID05 filters inventory status by a field that exists on inventory items',
    async () => {
      const { service, inventoryAggregate } = createProviderAnalytics();

      await service.getProviderAnalytics(providerUser);

      const [matchStage] = inventoryAggregate.mock.calls[0][0];
      const fields = Object.keys(matchStage.$match);
      expect(
        fields.every((field) => InventoryItemSchema.path(field) !== undefined),
      ).toBe(true);
    },
  );
});

// ------------------------------------------------------------------ Admin statistics
function createAdminStats(options: Row = {}) {
  const userModel = {
    countDocuments: jest.fn(async (filter: Row) =>
      filter.accountStatus === 'BANNED'
        ? 2
        : filter.accountStatus === 'ACTIVE'
          ? 18
          : 20,
    ),
    find: jest.fn().mockReturnValue(lean(options.customers ?? [])),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const providerModel = {
    countDocuments: jest.fn(async (filter: Row) =>
      filter.capabilities === 'PHOTOGRAPHY'
        ? 4
        : filter.capabilities
          ? 6
          : (options.providers ?? []).length,
    ),
    find: jest.fn().mockReturnValue(lean(options.providers ?? [])),
  };
  const bookingModel = {
    countDocuments: jest.fn(async (filter: Row) =>
      filter.bookingType ? 7 : 30,
    ),
    aggregate: jest.fn().mockResolvedValue(options.bookingAggregate ?? []),
    db: {
      model: jest
        .fn()
        .mockReturnValue({
          countDocuments: jest
            .fn()
            .mockResolvedValue((options.transfers ?? []).length),
          find: () => lean(options.transfers ?? []),
        }),
    },
  };
  const service = Object.create(
    AdminStatsService.prototype,
  ) as AdminStatsService;
  Object.assign(service, {
    userModel,
    providerModel,
    productModel: {
      countDocuments: jest.fn().mockResolvedValue(12),
      find: () => lean([]),
    },
    bookingModel,
    bookingItemModel: {
      aggregate: jest.fn().mockReturnValue(Promise.resolve([])),
    },
    paymentModel: {
      aggregate: jest
        .fn()
        .mockResolvedValue(
          options.revenue === undefined
            ? [{ total: 1000000 }]
            : options.revenue,
        ),
    },
    refreshTokenModel: { updateMany: jest.fn().mockResolvedValue(undefined) },
    providerVerificationModel: {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: () => lean([]),
    },
    disputeModel: { countDocuments: jest.fn().mockResolvedValue(0) },
    reviewModel: { find: () => lean([]) },
    analyticsService: {
      getTopSearches: jest.fn().mockResolvedValue([]),
      getViewCountMap: jest.fn().mockResolvedValue(new Map()),
    },
    overviewStatsCache: new Map(),
    inFlightRequests: new Map(),
    CACHE_TTL_MS: 60_000,
  });
  const growth = options.growth ?? [
    { label: 'T9', value: 0 },
    { label: 'T10', value: 0 },
  ];
  for (const method of ['getCustomerGrowth', 'getBookingGrowth'])
    jest.spyOn(service as any, method).mockResolvedValue(growth);
  jest
    .spyOn(service as any, 'getRevenueGrowth')
    .mockResolvedValue(options.revenueGrowth ?? growth);
  jest.spyOn(service as any, 'getOverviewChartPoints').mockResolvedValue([]);
  jest.spyOn(service as any, 'getServiceShare').mockResolvedValue([]);
  jest.spyOn(service as any, 'getTopPartners').mockResolvedValue([]);
  jest.spyOn(service as any, 'getRecentActivities').mockResolvedValue([]);
  jest.spyOn(service as any, 'getPendingTasks').mockResolvedValue({
    counts: {
      pendingVerifications: 1,
      pendingProducts: 2,
      pendingCombos: 0,
      pendingRefunds: 0,
      openDisputes: 0,
    },
    tasks: [],
    alerts: [],
  });
  return { service, userModel, providerModel, bookingModel };
}

afterEach(() => jest.restoreAllMocks());

describe('UC-68 Customer Analysis (DatTT)', () => {
  const customers = [
    {
      _id: new Types.ObjectId(),
      profile: { fullName: 'Lan' },
      auth: { email: 'lan@example.com' },
      accountStatus: 'ACTIVE',
      createdAt: new Date('2026-09-01'),
    },
    { _id: new Types.ObjectId(), profile: {}, auth: {}, createdAt: null },
  ];

  it('UT-68 UTCID04 lists only customers who are not admins or providers, with paging', async () => {
    const { service, userModel } = createAdminStats({ customers });

    const result = await service.getAllCustomers(2, 10);

    expect(userModel.find.mock.calls[0][0]).toEqual({
      $and: [
        { roles: 'CUSTOMER' },
        { roles: { $nin: ['ADMIN', 'admin', 'PROVIDER'] } },
      ],
    });
    expect(userModel.find.mock.results[0].value.skip).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      total: 20,
      page: 2,
      limit: 10,
      totalPages: 2,
    });
  });

  it('UT-68 UTCID05 counts bookings per customer and fills missing profile values', async () => {
    const { service } = createAdminStats({
      customers,
      bookingAggregate: [{ _id: customers[0]._id, count: 4 }],
    });

    const { items } = await service.getAllCustomers(1, 10);

    expect(items[0]).toMatchObject({
      fullName: 'Lan',
      bookings: 4,
      status: 'ACTIVE',
    });
    expect(items[1]).toMatchObject({
      fullName: 'Khách hàng',
      email: '',
      bookings: 0,
      status: 'ACTIVE',
    });
  });

  it('UT-68 UTCID06 bans a customer and revokes all sessions', async () => {
    const { service, userModel } = createAdminStats();
    const id = new Types.ObjectId();

    await expect(service.banCustomer(id.toString())).resolves.toMatchObject({
      success: true,
    });
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: id },
      { $set: { accountStatus: 'BANNED' } },
    );
    expect((service as any).refreshTokenModel.updateMany).toHaveBeenCalledWith(
      { userId: id },
      { $set: { revokedAt: expect.any(Date) } },
    );
  });

  it('UT-68 UTCID07 forbids a non-admin from reading customer analytics', async () => {
    const controller = new AdminStatsController({
      getAllCustomers: jest.fn(),
    } as any);

    await expect(
      controller.getCustomers({ sub: 'u1', roles: ['PROVIDER'] } as any, 1, 10),
    ).rejects.toThrow(
      new ForbiddenException(
        'Admin role is required to access admin statistics',
      ),
    );
  });

  // Known defect UT-DEF-68-01: the customer list always reports 0 spent.
  it.failing(
    'UT-68 UTCID08 reports how much each customer has spent',
    async () => {
      const { service } = createAdminStats({
        customers: [customers[0]],
        bookingAggregate: [{ _id: customers[0]._id, count: 2, spent: 1200000 }],
      });

      const { items } = await service.getAllCustomers(1, 10);

      expect(items[0].spent).toBeGreaterThan(0);
    },
  );

  // Known defect UT-DEF-68-02: page views are derived as fixed multiples of counts instead of recorded analytics.
  it.failing(
    'UT-68 UTCID09 does not fabricate page views from customer counts',
    async () => {
      const { service } = createAdminStats();

      const stats = await service.getAdminStats('month');

      expect(stats.userBehavior.pageViews.homepage).not.toBe(
        stats.customers.total * 6,
      );
    },
  );
});

describe('UC-69 Shop Analysis (DatTT)', () => {
  const provider = (overrides: Row = {}) => ({
    _id: new Types.ObjectId(),
    businessName: 'Hue Shop',
    userId: {
      _id: new Types.ObjectId(),
      profile: { fullName: 'Chủ shop' },
      auth: { email: 'owner@example.com' },
    },
    address: { addressLine: '12 Le Loi', district: 'Phú Hội', city: 'Huế' },
    capabilities: ['AODAI_RENTAL'],
    status: 'ACTIVE',
    rating: { averageRating: 4.56 },
    ...overrides,
  });

  it('UT-69 UTCID04 calculates completion rate and earnings from booking statistics', async () => {
    const shop = provider();
    const { service } = createAdminStats({
      providers: [shop],
      bookingAggregate: [
        {
          _id: shop._id,
          totalRevenue: 2500000,
          completedCount: 2,
          totalCount: 3,
        },
      ],
    });

    const { items } = await service.getAllProviders(1, 10);

    expect(items[0]).toMatchObject({
      completionRate: 67,
      totalEarnings: 2500000,
      rating: 4.6,
      ownerName: 'Chủ shop',
    });
  });

  it('UT-69 UTCID05 shows 100% completion for a shop without bookings', async () => {
    const { service } = createAdminStats({ providers: [provider()] });

    const { items } = await service.getAllProviders(1, 10);

    expect(items[0]).toMatchObject({
      completionRate: 100,
      totalBookings: 0,
      totalEarnings: 0,
    });
  });

  it('UT-69 UTCID06 joins the address and marks missing bank details', async () => {
    const { service } = createAdminStats({ providers: [provider()] });

    const { items } = await service.getAllProviders(1, 10);

    expect(items[0]).toMatchObject({
      address: '12 Le Loi, Phú Hội, Huế',
      bankAccount: 'Chưa liên kết',
      bankName: 'Chưa liên kết',
    });
  });

  it('UT-69 UTCID07 prefers the stored wallet earnings over booking revenue', async () => {
    const shop = provider({ wallet: { totalEarned: 900000 } });
    const { service } = createAdminStats({
      providers: [shop],
      bookingAggregate: [
        {
          _id: shop._id,
          totalRevenue: 2500000,
          completedCount: 1,
          totalCount: 1,
        },
      ],
    });

    const { items } = await service.getAllProviders(1, 10);

    expect(items[0].totalEarnings).toBe(900000);
  });

  it('UT-69 UTCID08 forbids a non-admin from reading shop analytics', async () => {
    const controller = new AdminStatsController({
      getAllProviders: jest.fn(),
    } as any);

    await expect(
      controller.getProviders({ sub: 'u1', roles: ['CUSTOMER'] } as any, 1, 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UC-70 Photographer Analysis (DatTT)', () => {
  it('UT-70 UTCID04 reports photographer and photography booking totals', async () => {
    const { service } = createAdminStats();

    const stats = await service.getAdminStats('month');

    expect(stats.photographers).toEqual({ total: 4, bookings: 7 });
    expect(stats.shops.total).toBe(6);
  });

  it('UT-70 UTCID05 counts shops and photographers as active partners', async () => {
    const { service } = createAdminStats();

    const stats = await service.getAdminStats('month');

    expect(stats.kpis.activePartners.value).toBe(10);
  });

  it('UT-70 UTCID06 reuses cached statistics for the same period', async () => {
    const { service, providerModel } = createAdminStats();

    await service.getAdminStats('month');
    const calls = providerModel.countDocuments.mock.calls.length;
    await service.getAdminStats('month');

    expect(providerModel.countDocuments.mock.calls.length).toBe(calls);
  });

  it('UT-70 UTCID07 shares one computation between concurrent requests', async () => {
    const { service } = createAdminStats();
    const compute = jest.spyOn(service as any, 'computeAdminStats');

    const [a, b] = await Promise.all([
      service.getAdminStats('week'),
      service.getAdminStats('week'),
    ]);

    expect(a).toBe(b);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});

describe('UC-71 Revenue Analysis (DatTT)', () => {
  it('UT-71 UTCID03 totals successful customer payments and the 10% platform commission', async () => {
    const { service } = createAdminStats({ revenue: [{ total: 1000000 }] });

    const stats = await service.getAdminStats('month');

    expect(stats.revenue).toMatchObject({ total: 1000000, commission: 100000 });
    expect(stats.kpis.gmv.value).toBe(1000000);
  });

  it('UT-71 UTCID04 reports zero revenue when there is no successful payment', async () => {
    const { service } = createAdminStats({ revenue: [] });

    await expect(service.getAdminStats('month')).resolves.toMatchObject({
      revenue: { total: 0, commission: 0 },
    });
  });

  it('UT-71 UTCID05 calculates revenue growth from the last two periods', async () => {
    const grown = createAdminStats({
      revenueGrowth: [
        { label: 'T9', value: 100 },
        { label: 'T10', value: 150 },
      ],
    });
    const fromZero = createAdminStats({
      revenueGrowth: [
        { label: 'T9', value: 0 },
        { label: 'T10', value: 80 },
      ],
    });

    await expect(grown.service.getAdminStats('month')).resolves.toMatchObject({
      kpis: { gmv: { growth: 50 } },
    });
    await expect(
      fromZero.service.getAdminStats('month'),
    ).resolves.toMatchObject({ kpis: { gmv: { growth: 100 } } });
  });

  it('UT-71 UTCID06 maps payout transfer statuses and paginates the transaction list', async () => {
    const transfers = ['SUCCESS', 'PENDING', 'FAILED'].map((status, i) => ({
      _id: new Types.ObjectId(),
      transactionReference: `TX-${i}`,
      status,
      amountSent: 100000 * (i + 1),
      providerId: { businessName: 'Hue Shop' },
      bookingId: { bookingCode: `BK-${i}` },
    }));
    const { service } = createAdminStats({ transfers });

    const result = await service.getAllTransactions(1, 10);

    expect(result.items.map((item: Row) => item.status)).toEqual([
      'PAID',
      'PENDING',
      'FAILED',
    ]);
    expect(result).toMatchObject({ total: 3, totalPages: 1 });
  });

  // Known defect UT-DEF-71-01: the admin dashboard (10%) and provider analytics (15%) use different hard-coded commission rates.
  it.failing(
    'UT-71 UTCID07 uses the same commission rate as the provider revenue dashboard',
    async () => {
      const admin = await createAdminStats({
        revenue: [{ total: 1000000 }],
      }).service.getAdminStats('month');
      const booking = { _id: new Types.ObjectId(), createdAt: new Date() };
      const provider = await createProviderAnalytics({
        bookings: [booking],
        items: [{ bookingId: booking._id, unitPrice: 1000000, quantity: 1 }],
      }).service.getProviderAnalytics(providerUser);

      expect(admin.revenue.commission).toBe(provider.commissionFee);
    },
  );
});
