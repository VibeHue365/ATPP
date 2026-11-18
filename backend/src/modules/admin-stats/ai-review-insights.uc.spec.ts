import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminAiAnalyticsService } from './admin-ai-analytics.service';
import { AdminStatsController } from './admin-stats.controller';

type Row = Record<string, any>;

function chain(result: unknown) {
  const q: Row = {};
  for (const method of ['select', 'populate', 'sort', 'limit'])
    q[method] = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
}

function createService(
  options: {
    reviews?: Row[];
    shopAgg?: Row[];
    disputes?: Row[];
    providers?: Row[];
    negatives?: Row[];
    ai?: unknown;
  } = {},
) {
  const reviewModel = {
    find: jest.fn((filter: Row) =>
      chain(
        filter.rating ? (options.negatives ?? []) : (options.reviews ?? []),
      ),
    ),
    aggregate: jest.fn().mockResolvedValue(options.shopAgg ?? []),
  };
  const aiService = {
    analyzeAdminInsights: jest.fn().mockResolvedValue(options.ai ?? null),
  };
  const service = Object.create(
    AdminAiAnalyticsService.prototype,
  ) as AdminAiAnalyticsService;
  Object.assign(service, {
    logger: { warn: jest.fn() },
    reviewModel,
    disputeModel: {
      aggregate: jest.fn().mockResolvedValue(options.disputes ?? []),
    },
    providerModel: { find: jest.fn(() => chain(options.providers ?? [])) },
    bookingModel: { aggregate: jest.fn().mockResolvedValue([]) },
    userModel: {},
    aiService,
  });
  return { service: service as any, aiService };
}

const shop = (overrides: Row = {}) => ({
  _id: new Types.ObjectId(),
  totalReviews: 10,
  averageRating: 4.6,
  badReviewCount: 0,
  positiveReviewCount: 9,
  reportedCount: 0,
  badReviewPercentage: 0,
  ...overrides,
});

const cluster = (clusters: Row[], topic: string) =>
  clusters.find((c) => c.topic === topic);

describe('UC-32 AI Review Summary & Sentiment Insights (DaiBLL)', () => {
  it('UT-32 UTCID01 groups a positive outfit review into the outfit topic', async () => {
    const { service } = createService({
      reviews: [{ rating: 5, comment: 'Áo đẹp, vải mịn' }],
    });

    const clusters = await service.aggregateSentimentClusters();

    expect(cluster(clusters, 'Trang phục & Phụ kiện')).toEqual({
      topic: 'Trang phục & Phụ kiện',
      sentiment: 'POSITIVE',
      count: 1,
      sampleQuotes: ['Áo đẹp, vải mịn'],
    });
  });

  it('UT-32 UTCID02 counts a low-rated review in every topic it mentions', async () => {
    const { service } = createService({
      reviews: [{ rating: 1, comment: 'Thợ chụp trễ giờ, thái độ khó chịu' }],
    });

    const clusters = await service.aggregateSentimentClusters();

    expect(cluster(clusters, 'Kỹ năng thợ ảnh & Thái độ')).toMatchObject({
      sentiment: 'NEGATIVE',
      count: 1,
    });
    expect(cluster(clusters, 'Đúng giờ & Giao nhận trả đồ')).toMatchObject({
      sentiment: 'NEGATIVE',
      count: 1,
    });
  });

  it('UT-32 UTCID03 returns four neutral topics when there is no review', async () => {
    const { service } = createService();

    const clusters = await service.aggregateSentimentClusters();

    expect(clusters).toHaveLength(4);
    expect(
      clusters.every((c: Row) => c.sentiment === 'NEUTRAL' && c.count === 0),
    ).toBe(true);
  });

  it('UT-32 UTCID04 keeps at most two sample quotes per topic', async () => {
    const reviews = ['Tiền cọc hoàn nhanh', 'Giá hợp lý', 'Không phụ thu'].map(
      (comment) => ({ rating: 5, comment }),
    );
    const { service } = createService({ reviews });

    const clusters = await service.aggregateSentimentClusters();

    expect(cluster(clusters, 'Chi phí & Tiền cọc hoàn trả')).toMatchObject({
      count: 3,
      sampleQuotes: ['Tiền cọc hoàn nhanh', 'Giá hợp lý'],
    });
  });

  it('UT-32 UTCID05 flags a shop with two bad reviews as high risk with the issues customers raised', async () => {
    const risky = shop({
      badReviewCount: 2,
      averageRating: 2.5,
      badReviewPercentage: 20,
    });
    const { service } = createService({
      shopAgg: [risky],
      providers: [{ _id: risky._id, businessName: 'Hue Shop' }],
      negatives: [
        {
          providerId: risky._id,
          rating: 1,
          comment: 'Áo bị rách',
          createdAt: new Date('2026-11-01'),
        },
      ],
    });

    const [profile] = await service.aggregateShopRiskProfiles();

    expect(profile).toMatchObject({
      businessName: 'Hue Shop',
      riskLevel: 'HIGH_RISK',
      primaryIssues: ['Trang phục dính rách / hỏng khóa'],
    });
    expect(profile.recentNegativeComments[0]).toMatchObject({
      rating: 1,
      customerName: 'Khách hàng',
    });
  });

  it('UT-32 UTCID06 puts a shop with one dispute and no bad review on the warning list', async () => {
    const watched = shop();
    const { service } = createService({
      shopAgg: [watched],
      disputes: [{ _id: watched._id, disputeCount: 1 }],
    });

    const [profile] = await service.aggregateShopRiskProfiles();

    expect(profile).toMatchObject({
      riskLevel: 'WARNING',
      disputeCount: 1,
      businessName: 'Nhà cung cấp',
    });
  });

  it('UT-32 UTCID07 marks a shop with good reviews and no dispute as healthy', async () => {
    const { service } = createService({ shopAgg: [shop()] });

    const [profile] = await service.aggregateShopRiskProfiles();

    expect(profile).toMatchObject({
      riskLevel: 'HEALTHY',
      averageRating: 4.6,
      primaryIssues: ['Phản hồi không hài lòng chung'],
    });
  });

  it('UT-32 UTCID08 warns about a shop whose average rating is below 3.8', async () => {
    const { service } = createService({
      shopAgg: [shop({ averageRating: 3.7 })],
    });

    await expect(service.aggregateShopRiskProfiles()).resolves.toMatchObject([
      { riskLevel: 'WARNING' },
    ]);
  });

  it('UT-32 UTCID09 returns no shop profile when there is no review', async () => {
    const { service } = createService();

    await expect(service.aggregateShopRiskProfiles()).resolves.toEqual([]);
  });

  it('UT-32 UTCID10 weights the platform rating by review count and maps the AI answer', async () => {
    const { service, aiService } = createService({
      ai: {
        executive_summary: 'Tóm tắt',
        top_recommendations: ['Nhắc shop'],
        copilot_answer: 'Trả lời',
        source: 'gemini',
      },
    });
    jest.spyOn(service, 'aggregateUserShopInteractions').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateShopRiskProfiles').mockResolvedValue([
      {
        totalReviews: 3,
        averageRating: 5,
        riskLevel: 'HEALTHY',
        badReviewCount: 0,
        primaryIssues: [],
        recentNegativeComments: [],
      },
      {
        totalReviews: 1,
        averageRating: 1,
        riskLevel: 'HIGH_RISK',
        badReviewCount: 1,
        primaryIssues: [],
        recentNegativeComments: [],
      },
    ]);
    jest.spyOn(service, 'aggregateSentimentClusters').mockResolvedValue([]);

    const result = await service.getAiAnalytics('Shop nào bị phàn nàn?');

    expect(result.summary).toMatchObject({
      totalReviewsAnalyzed: 4,
      averagePlatformRating: 4,
      highRiskShopsCount: 1,
    });
    expect(result.aiAnalysis).toMatchObject({
      executiveSummary: 'Tóm tắt',
      topRecommendations: ['Nhắc shop'],
      copilotAnswer: 'Trả lời',
      source: 'gemini',
    });
    expect(aiService.analyzeAdminInsights.mock.calls[0][0].question).toBe(
      'Shop nào bị phàn nàn?',
    );
  });

  it('UT-32 UTCID11 builds the report locally when the AI service is unavailable', async () => {
    const { service } = createService();
    jest.spyOn(service, 'aggregateUserShopInteractions').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateShopRiskProfiles').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateSentimentClusters').mockResolvedValue([]);

    const result = await service.getAiAnalytics();

    expect(result.summary).toMatchObject({
      totalReviewsAnalyzed: 0,
      averagePlatformRating: 5,
      highRiskShopsCount: 0,
    });
    expect(result.summary.worstRatedShop).toBeUndefined();
    expect(result.aiAnalysis.source).toBe('domain_heuristic_engine');
    expect(result.aiAnalysis.topRecommendations).toHaveLength(3);
  });

  it('UT-32 UTCID12 answers the admin question about the worst shop from local data', async () => {
    const { service } = createService();
    jest.spyOn(service, 'aggregateUserShopInteractions').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateShopRiskProfiles').mockResolvedValue([
      {
        businessName: 'Hue Shop',
        totalReviews: 5,
        averageRating: 2.4,
        badReviewCount: 3,
        badReviewPercentage: 60,
        riskLevel: 'HIGH_RISK',
        disputeCount: 0,
        primaryIssues: ['Áo chưa giặt sạch / có vết bẩn'],
        recentNegativeComments: [],
      },
    ]);
    jest.spyOn(service, 'aggregateSentimentClusters').mockResolvedValue([]);

    const result = await service.getAiAnalytics('Shop nào tệ nhất?');

    expect(result.aiAnalysis.copilotAnswer).toContain(
      '**Hue Shop** là shop có nhiều đánh giá xấu nhất',
    );
    expect(result.summary.worstRatedShop).toEqual({
      name: 'Hue Shop',
      badReviewCount: 3,
      avgRating: 2.4,
    });
  });

  it('UT-32 UTCID13 tells the admin when no shop has bad reviews', async () => {
    const { service } = createService();
    jest.spyOn(service, 'aggregateUserShopInteractions').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateShopRiskProfiles').mockResolvedValue([]);
    jest.spyOn(service, 'aggregateSentimentClusters').mockResolvedValue([]);

    const result = await service.getAiAnalytics('Shop nào bị phàn nàn nhiều?');

    expect(result.aiAnalysis.copilotAnswer).toBe(
      'Không có shop nào có nhiều đánh giá xấu. Hiện tại các đối tác đều đạt điểm hài lòng tốt trên 4.0★.',
    );
  });

  it('UT-32 UTCID14 forbids a non-admin from opening AI analytics or asking the copilot', async () => {
    const ai = { getAiAnalytics: jest.fn() };
    const controller = new AdminStatsController({} as any, ai as any);
    const provider = { sub: 'p1', roles: ['PROVIDER'] } as any;

    await expect(controller.getAiAnalytics(provider)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      controller.askAiCopilot(provider, 'Shop nào tệ nhất?'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ai.getAiAnalytics).not.toHaveBeenCalled();
  });

  it('UT-32 UTCID15 passes the admin question to the analytics service', async () => {
    const ai = { getAiAnalytics: jest.fn().mockResolvedValue({ summary: {} }) };
    const controller = new AdminStatsController({} as any, ai as any);

    await controller.askAiCopilot(
      { sub: 'a1', roles: ['ADMIN'] } as any,
      'Khách nào đặt nhiều nhất?',
    );

    expect(ai.getAiAnalytics).toHaveBeenCalledWith('Khách nào đặt nhiều nhất?');
  });
});
