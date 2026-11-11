import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Provider, ProviderDocument } from '../providers/schemas/provider.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { Dispute, DisputeDocument } from '../disputes/schemas/dispute.schema';
import { AiService } from '../ai/services/ai.service';

export interface UserShopInteraction {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  reviewCount: number;
  averageRatingGiven: number;
  recentComment?: string;
  loyaltyTier: 'VIP' | 'REGULAR' | 'NEW';
}

export interface NegativeCommentItem {
  rating: number;
  comment: string;
  customerName: string;
  createdAt: string;
}

export interface ShopRiskProfile {
  providerId: string;
  businessName: string;
  avatarUrl?: string;
  totalReviews: number;
  averageRating: number;
  badReviewCount: number;
  badReviewPercentage: number;
  positiveReviewCount: number;
  reportedReviewsCount: number;
  disputeCount: number;
  riskLevel: 'HIGH_RISK' | 'WARNING' | 'HEALTHY';
  primaryIssues: string[];
  recentNegativeComments: NegativeCommentItem[];
}

export interface SentimentCluster {
  topic: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  count: number;
  sampleQuotes: string[];
}

export interface AdminAiInsightsResponse {
  summary: {
    totalReviewsAnalyzed: number;
    averagePlatformRating: number;
    highRiskShopsCount: number;
    totalUserShopInteractions: number;
    mostActiveCustomer?: { name: string; email: string; bookingCount: number };
    worstRatedShop?: { name: string; badReviewCount: number; avgRating: number };
  };
  userShopInteractions: UserShopInteraction[];
  shopRiskProfiles: ShopRiskProfile[];
  sentimentClusters: SentimentCluster[];
  aiAnalysis: {
    executiveSummary: string;
    badShopsAnalysis: string;
    userBehaviorAnalysis: string;
    topRecommendations: string[];
    copilotAnswer?: string;
    source: string;
  };
}

@Injectable()
export class AdminAiAnalyticsService {
  private readonly logger = new Logger(AdminAiAnalyticsService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private readonly providerModel: Model<ProviderDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Dispute.name) private readonly disputeModel: Model<DisputeDocument>,
    private readonly aiService: AiService,
  ) {}

  async getAiAnalytics(question?: string): Promise<AdminAiInsightsResponse> {
    const [interactions, shopProfiles, sentimentClusters] = await Promise.all([
      this.aggregateUserShopInteractions(),
      this.aggregateShopRiskProfiles(),
      this.aggregateSentimentClusters(),
    ]);

    const totalReviews = shopProfiles.reduce((acc, s) => acc + s.totalReviews, 0);
    const avgPlatformRating =
      totalReviews > 0
        ? Number(
            (
              shopProfiles.reduce((acc, s) => acc + s.averageRating * s.totalReviews, 0) /
              totalReviews
            ).toFixed(2),
          )
        : 5.0;

    const highRiskCount = shopProfiles.filter((s) => s.riskLevel === 'HIGH_RISK').length;

    const mostActive = interactions[0]
      ? {
          name: interactions[0].customerName,
          email: interactions[0].customerEmail,
          bookingCount: interactions[0].totalBookings,
        }
      : undefined;

    const worstShop = shopProfiles[0] && shopProfiles[0].badReviewCount > 0
      ? {
          name: shopProfiles[0].businessName,
          badReviewCount: shopProfiles[0].badReviewCount,
          avgRating: shopProfiles[0].averageRating,
        }
      : undefined;

    const summary = {
      totalReviewsAnalyzed: totalReviews,
      averagePlatformRating: avgPlatformRating,
      highRiskShopsCount: highRiskCount,
      totalUserShopInteractions: interactions.length,
      mostActiveCustomer: mostActive,
      worstRatedShop: worstShop,
    };

    // Chuẩn bị payload gửi AI
    const aiPayload = {
      summary,
      user_shop_interactions: interactions.slice(0, 5).map((i) => ({
        customer_id: i.customerId,
        customer_name: i.customerName,
        customer_email: i.customerEmail,
        provider_id: i.providerId,
        provider_name: i.providerName,
        total_bookings: i.totalBookings,
        completed_bookings: i.completedBookings,
        total_spent: i.totalSpent,
        review_count: i.reviewCount,
        average_rating_given: i.averageRatingGiven,
        recent_comment: i.recentComment,
        loyalty_tier: i.loyaltyTier,
      })),
      shop_risk_profiles: shopProfiles.slice(0, 5).map((s) => ({
        provider_id: s.providerId,
        business_name: s.businessName,
        total_reviews: s.totalReviews,
        average_rating: s.averageRating,
        bad_review_count: s.badReviewCount,
        bad_review_percentage: s.badReviewPercentage,
        positive_review_count: s.positiveReviewCount,
        reported_reviews_count: s.reportedReviewsCount,
        dispute_count: s.disputeCount,
        risk_level: s.riskLevel,
        primary_issues: s.primaryIssues,
        recent_negative_comments: s.recentNegativeComments.map((c) => ({
          rating: c.rating,
          comment: c.comment,
          customer_name: c.customerName,
          created_at: c.createdAt,
        })),
      })),
      sentiment_clusters: sentimentClusters.map((c) => ({
        topic: c.topic,
        sentiment: c.sentiment,
        count: c.count,
        sample_quotes: c.sampleQuotes,
      })),
      question,
    };

    let aiResult: any = null;
    try {
      aiResult = await this.aiService.analyzeAdminInsights(aiPayload);
    } catch (err: any) {
      this.logger.warn(`AI analysis call failed, using heuristic: ${err?.message}`);
    }

    if (!aiResult) {
      aiResult = this.generateHeuristicAiReport(summary, interactions, shopProfiles, sentimentClusters, question);
    }

    return {
      summary,
      userShopInteractions: interactions,
      shopRiskProfiles: shopProfiles,
      sentimentClusters,
      aiAnalysis: {
        executiveSummary: aiResult.executive_summary || aiResult.executiveSummary || '',
        badShopsAnalysis: aiResult.bad_shops_analysis || aiResult.badShopsAnalysis || '',
        userBehaviorAnalysis: aiResult.user_behavior_analysis || aiResult.userBehaviorAnalysis || '',
        topRecommendations: aiResult.top_recommendations || aiResult.topRecommendations || [],
        copilotAnswer: aiResult.copilot_answer || aiResult.copilotAnswer,
        source: aiResult.source || 'heuristic_engine',
      },
    };
  }

  /**
   * 1. Thống kê tương tác Khách hàng - Shop (User - Shop Affinity)
   * Khách hàng nào vào đặt shop nào nhiều nhất, tổng số tiền, đánh giá ra sao
   */
  private async aggregateUserShopInteractions(): Promise<UserShopInteraction[]> {
    const rawAgg = await this.bookingModel.aggregate([
      {
        $project: {
          customerId: 1,
          providerId: {
            $ifNull: ['$providerId', { $arrayElemAt: ['$providerIds', 0] }],
          },
          status: 1,
          grandTotal: {
            $ifNull: ['$pricingSummary.grandTotal', { $ifNull: ['$grandTotal', 0] }],
          },
        },
      },
      {
        $match: {
          customerId: { $ne: null },
          providerId: { $ne: null },
        },
      },
      {
        $group: {
          _id: { customerId: '$customerId', providerId: '$providerId' },
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: {
              $cond: [{ $in: ['$status', ['COMPLETED', BookingStatus.Completed]] }, 1, 0],
            },
          },
          totalSpent: { $sum: '$grandTotal' },
        },
      },
      { $sort: { totalBookings: -1, totalSpent: -1 } },
      { $limit: 25 },
    ]);

    if (!rawAgg.length) {
      return [];
    }

    const customerIds = Array.from(new Set(rawAgg.map((r) => r._id.customerId)));
    const providerIds = Array.from(new Set(rawAgg.map((r) => r._id.providerId)));

    const [users, providers, reviews] = await Promise.all([
      this.userModel
        .find({ _id: { $in: customerIds } })
        .select('profile.fullName auth.email profile.avatarUrl')
        .lean(),
      this.providerModel
        .find({ _id: { $in: providerIds } })
        .select('businessName media.logoUrl media.avatarUrl avatarUrl')
        .lean(),
      this.reviewModel
        .find({ customerId: { $in: customerIds }, providerId: { $in: providerIds } })
        .select('customerId providerId rating comment createdAt')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const providerMap = new Map(providers.map((p: any) => [p._id.toString(), p]));

    // Map reviews by customerId_providerId
    const reviewMap = new Map<string, any[]>();
    for (const r of reviews) {
      const key = `${r.customerId?.toString()}_${r.providerId?.toString()}`;
      if (!reviewMap.has(key)) reviewMap.set(key, []);
      reviewMap.get(key)!.push(r);
    }

    return rawAgg.map((row) => {
      const cId = row._id.customerId?.toString();
      const pId = row._id.providerId?.toString();
      const user = userMap.get(cId);
      const prov = providerMap.get(pId);
      const pairReviews = reviewMap.get(`${cId}_${pId}`) || [];

      const avgRating =
        pairReviews.length > 0
          ? Number(
              (
                pairReviews.reduce((sum, r) => sum + (r.rating || 5), 0) /
                pairReviews.length
              ).toFixed(1),
            )
          : 0;

      let tier: 'VIP' | 'REGULAR' | 'NEW' = 'REGULAR';
      if (row.totalBookings >= 3 || row.totalSpent >= 2000000) tier = 'VIP';
      else if (row.totalBookings === 1) tier = 'NEW';

      return {
        customerId: cId,
        customerName: user?.profile?.fullName || 'Khách hàng ẩn danh',
        customerEmail: user?.auth?.email || '',
        customerAvatar: user?.profile?.avatarUrl,
        providerId: pId,
        providerName: prov?.businessName || 'Nhà cung cấp',
        providerAvatar: prov?.media?.logoUrl || prov?.avatarUrl,
        totalBookings: row.totalBookings,
        completedBookings: row.completedBookings,
        totalSpent: row.totalSpent,
        reviewCount: pairReviews.length,
        averageRatingGiven: avgRating,
        recentComment: pairReviews[0]?.comment || '',
        loyaltyTier: tier,
      };
    });
  }

  /**
   * 2. Thống kê shop có nhiều đánh giá xấu nhất, tỷ lệ đánh giá tiêu cực & tranh chấp
   */
  private async aggregateShopRiskProfiles(): Promise<ShopRiskProfile[]> {
    const [shopReviewsAgg, disputesAgg] = await Promise.all([
      this.reviewModel.aggregate([
        { $match: { providerId: { $ne: null } } },
        {
          $group: {
            _id: '$providerId',
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            badReviewCount: {
              $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] },
            },
            positiveReviewCount: {
              $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] },
            },
            reportedCount: { $sum: { $cond: ['$isReported', 1, 0] } },
          },
        },
        {
          $addFields: {
            badReviewPercentage: {
              $multiply: [{ $divide: ['$badReviewCount', '$totalReviews'] }, 100],
            },
          },
        },
        // Sắp xếp: Shop nhiều review xấu nhất lên đầu
        { $sort: { badReviewCount: -1, averageRating: 1 } },
      ]),
      this.disputeModel.aggregate([
        { $match: { providerId: { $ne: null } } },
        { $group: { _id: '$providerId', disputeCount: { $sum: 1 } } },
      ]),
    ]);

    if (!shopReviewsAgg.length) {
      return [];
    }

    const providerIds = shopReviewsAgg.map((r) => r._id);
    const disputeMap = new Map(disputesAgg.map((d) => [d._id?.toString(), d.disputeCount]));

    const [providers, negativeReviews] = await Promise.all([
      this.providerModel
        .find({ _id: { $in: providerIds } })
        .select('businessName media.logoUrl media.avatarUrl avatarUrl')
        .lean(),
      this.reviewModel
        .find({ providerId: { $in: providerIds }, rating: { $lte: 2 } })
        .populate('customerId', 'profile.fullName')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const providerMap = new Map(providers.map((p: any) => [p._id.toString(), p]));

    // Nhóm negative reviews theo provider
    const negMap = new Map<string, any[]>();
    for (const r of negativeReviews) {
      const pId = r.providerId?.toString();
      if (!negMap.has(pId)) negMap.set(pId, []);
      negMap.get(pId)!.push(r);
    }

    return shopReviewsAgg.map((agg) => {
      const pId = agg._id.toString();
      const prov = providerMap.get(pId);
      const provNegs = negMap.get(pId) || [];
      const disputeCount = disputeMap.get(pId) || 0;

      // Nhận diện vấn đề chính từ comment tiêu cực
      const issues = this.extractIssuesFromComments(provNegs.map((n) => n.comment || ''));

      let riskLevel: 'HIGH_RISK' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
      if (agg.badReviewCount >= 2 || agg.badReviewPercentage >= 20 || disputeCount >= 2) {
        riskLevel = 'HIGH_RISK';
      } else if (agg.badReviewCount >= 1 || agg.averageRating < 3.8 || disputeCount >= 1) {
        riskLevel = 'WARNING';
      }

      return {
        providerId: pId,
        businessName: prov?.businessName || 'Nhà cung cấp',
        avatarUrl: prov?.media?.logoUrl || prov?.avatarUrl,
        totalReviews: agg.totalReviews,
        averageRating: Number(agg.averageRating.toFixed(1)),
        badReviewCount: agg.badReviewCount,
        badReviewPercentage: Number(agg.badReviewPercentage.toFixed(1)),
        positiveReviewCount: agg.positiveReviewCount,
        reportedReviewsCount: agg.reportedCount || 0,
        disputeCount,
        riskLevel,
        primaryIssues: issues,
        recentNegativeComments: provNegs.slice(0, 3).map((r: any) => ({
          rating: r.rating,
          comment: r.comment,
          customerName: r.customerId?.profile?.fullName || 'Khách hàng',
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
        })),
      };
    });
  }

  /**
   * 3. Phân cụm cảm xúc người dùng (Review Sentiment & Topic Clustering)
   */
  private async aggregateSentimentClusters(): Promise<SentimentCluster[]> {
    const recentReviews = await this.reviewModel
      .find({})
      .select('rating comment')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const clusters: Record<string, { positive: number; negative: number; quotes: string[] }> = {
      'Trang phục & Phụ kiện': { positive: 0, negative: 0, quotes: [] },
      'Kỹ năng thợ ảnh & Thái độ': { positive: 0, negative: 0, quotes: [] },
      'Đúng giờ & Giao nhận trả đồ': { positive: 0, negative: 0, quotes: [] },
      'Chi phí & Tiền cọc hoàn trả': { positive: 0, negative: 0, quotes: [] },
    };

    for (const r of recentReviews) {
      const text = (r.comment || '').toLowerCase();
      const isPositive = (r.rating || 5) >= 4;

      if (text.includes('vải') || text.includes('áo') || text.includes('gấm') || text.includes('rách') || text.includes('bẩn') || text.includes('form') || text.includes('đẹp')) {
        const c = clusters['Trang phục & Phụ kiện'];
        if (isPositive) c.positive++; else c.negative++;
        if (r.comment && c.quotes.length < 2) c.quotes.push(r.comment);
      }

      if (text.includes('thợ') || text.includes('chụp') || text.includes('ảnh') || text.includes('thái độ') || text.includes('nhiệt tình') || text.includes('tạo dáng') || text.includes('cộc')) {
        const c = clusters['Kỹ năng thợ ảnh & Thái độ'];
        if (isPositive) c.positive++; else c.negative++;
        if (r.comment && c.quotes.length < 2) c.quotes.push(r.comment);
      }

      if (text.includes('trễ') || text.includes('chậm') || text.includes('giờ') || text.includes('hẹn') || text.includes('chờ') || text.includes('đúng giờ') || text.includes('giao')) {
        const c = clusters['Đúng giờ & Giao nhận trả đồ'];
        if (isPositive) c.positive++; else c.negative++;
        if (r.comment && c.quotes.length < 2) c.quotes.push(r.comment);
      }

      if (text.includes('cọc') || text.includes('tiền') || text.includes('hoàn') || text.includes('giá') || text.includes('đắt') || text.includes('phụ thu')) {
        const c = clusters['Chi phí & Tiền cọc hoàn trả'];
        if (isPositive) c.positive++; else c.negative++;
        if (r.comment && c.quotes.length < 2) c.quotes.push(r.comment);
      }
    }

    return Object.entries(clusters).map(([topic, stat]) => {
      const total = stat.positive + stat.negative;
      const sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' =
        stat.negative > stat.positive ? 'NEGATIVE' : stat.positive > 0 ? 'POSITIVE' : 'NEUTRAL';
      return {
        topic,
        sentiment,
        count: total,
        sampleQuotes: stat.quotes,
      };
    });
  }

  private extractIssuesFromComments(comments: string[]): string[] {
    const combined = comments.join(' ').toLowerCase();
    const issues: string[] = [];

    if (combined.includes('rách') || combined.includes('hỏng') || combined.includes('đứt')) {
      issues.push('Trang phục dính rách / hỏng khóa');
    }
    if (combined.includes('bẩn') || combined.includes('ố') || combined.includes('mùi') || combined.includes('hôi')) {
      issues.push('Áo chưa giặt sạch / có vết bẩn');
    }
    if (combined.includes('chậm') || combined.includes('trễ') || combined.includes('chờ') || combined.includes('muộn')) {
      issues.push('Chậm trễ giao đồ hoặc trả file ảnh');
    }
    if (combined.includes('thái độ') || combined.includes('cộc cằn') || combined.includes('khó chịu') || combined.includes('bất lịch sự')) {
      issues.push('Thái độ phục vụ chưa niềm nở');
    }
    if (combined.includes('cọc') || combined.includes('hoàn tiền') || combined.includes('trừ tiền')) {
      issues.push('Tranh chấp tiền cọc');
    }
    if (combined.includes('không giống') || combined.includes('sai mẫu') || combined.includes('ảnh khác')) {
      issues.push('Đồ thực tế khác với ảnh chụp mẫu');
    }

    return issues.length > 0 ? issues : ['Phản hồi không hài lòng chung'];
  }

  /**
   * Bộ phân tích AI thông minh nội bộ (Heuristic Engine) - Luôn chạy tốt kể cả khi mất kết nối mạng
   */
  private generateHeuristicAiReport(
    summary: any,
    interactions: UserShopInteraction[],
    shopProfiles: ShopRiskProfile[],
    sentimentClusters: SentimentCluster[],
    question?: string,
  ) {
    const badShops = shopProfiles.filter((s) => s.badReviewCount > 0);
    const worstShop = badShops[0];

    // Executive summary
    const executiveSummary =
      `Hệ thống ghi nhận **${summary.totalReviewsAnalyzed} lượt đánh giá** với điểm hài lòng trung bình toàn sàn là **${summary.averagePlatformRating}/5.0**.\n` +
      `Hiện có **${summary.highRiskShopsCount} đối tác** cần đưa vào danh sách theo dõi chất lượng do có tỷ lệ đánh giá xấu vượt mức chuẩn (≥ 2 lượt 1-2★ hoặc có khiếu nại phát sinh).\n` +
      `Xu hướng trải nghiệm: Khách hàng hài lòng cao về kiểu dáng áo dài cổ phục, tuy nhiên cần kiểm soát chặt chẽ quy trình trả đồ và cam kết thời gian trả ảnh của thợ chụp.`;

    // Bad shops
    let badShopsAnalysis = '';
    if (worstShop) {
      badShopsAnalysis =
        `**${worstShop.businessName}** hiện là shop có nhiều đánh giá tiêu cực nhất trên hệ thống với **${worstShop.badReviewCount} lượt đánh giá 1-2 sao** (chiếm ${worstShop.badReviewPercentage}% tổng đánh giá của shop, rating trung bình: ${worstShop.averageRating}/5.0).\n` +
        `- **Nhóm vấn đề bị phản ánh:** ${worstShop.primaryIssues.join(', ')}.\n` +
        (worstShop.recentNegativeComments[0]
          ? `- **Trích phản hồi thực tế của khách:** "${worstShop.recentNegativeComments[0].comment}" *(bởi ${worstShop.recentNegativeComments[0].customerName})*.\n`
          : '') +
        (worstShop.disputeCount > 0 ? `- Shop này cũng đang ghi nhận **${worstShop.disputeCount} tranh chấp cọc/dịch vụ** đang hoặc đã xử lý.` : '');
    } else {
      badShopsAnalysis = 'Toàn bộ các nhà cung cấp trên sàn đều duy trì điểm đánh giá tích cực (≥ 4.0 sao), không có đơn vị nào bị đánh giá xấu nghiêm trọng.';
    }

    // User behavior
    const topPair = interactions[0];
    let userBehaviorAnalysis = '';
    if (topPair) {
      userBehaviorAnalysis =
        `Khách hàng có tần suất đặt dịch vụ cao nhất là **${topPair.customerName}** (${topPair.customerEmail}) ` +
        `với **${topPair.totalBookings} đơn đặt** tại **${topPair.providerName}** (tổng chi tiêu: ${topPair.totalSpent.toLocaleString('vi-VN')}đ).\n` +
        (topPair.reviewCount > 0
          ? `- Khách hàng này đã để lại **${topPair.reviewCount} đánh giá** với điểm trung bình cho shop là **${topPair.averageRatingGiven}/5.0**` +
            (topPair.recentComment ? `: "${topPair.recentComment}".` : '.')
          : '- Khách hàng chưa để lại nhận xét chi tiết sau các chuyến trải nghiệm.');
    } else {
      userBehaviorAnalysis = 'Chưa ghi nhận đủ đơn hàng hoàn tất để trích xuất hành vi khách hàng thân thiết.';
    }

    // Recommendations
    const topRecommendations = [
      worstShop
        ? `Gửi thông báo nhắc nhở chất lượng dịch vụ đến **${worstShop.businessName}** và yêu cầu giải trình về các phản hồi: ${worstShop.primaryIssues[0] || 'chất lượng phục vụ'}.`
        : 'Tiếp tục duy trì quy trình kiểm duyệt chất lượng đối tác định kỳ.',
      topPair
        ? `Tặng mã ưu đãi VIP cho khách hàng **${topPair.customerName}** để ghi nhận sự gắn bó với nền tảng.`
        : 'Tổ chức chương trình khuyến khích khách hàng để lại đánh giá sau khi hoàn tất đơn.',
      'Rà soát lại quy trình kiểm tra chất lượng đồ trước khi bàn giao và rút ngắn thời gian xử lý hoàn trả cọc dưới 24h.',
    ];

    // Copilot answer
    let copilotAnswer = undefined;
    if (question) {
      const q = question.toLowerCase();
      if (q.includes('xấu nhất') || q.includes('tệ') || q.includes('phàn nàn') || q.includes('kém')) {
        if (worstShop) {
          copilotAnswer =
            `**${worstShop.businessName}** là shop có nhiều đánh giá xấu nhất hiện nay:\n\n` +
            `• **Số lượt 1-2★:** ${worstShop.badReviewCount} lượt (${worstShop.badReviewPercentage}% tổng đánh giá)\n` +
            `• **Điểm trung bình:** ${worstShop.averageRating}/5.0\n` +
            `• **Vấn đề chính:** ${worstShop.primaryIssues.join(', ')}\n` +
            (worstShop.recentNegativeComments[0] ? `• **Ý kiến khách hàng:** "${worstShop.recentNegativeComments[0].comment}"\n\n` : '\n') +
            `💡 **Khuyến nghị Admin:** Nên kiểm tra quy trình của shop này và tạm hoãn ưu tiên hiển thị trên trang chủ cho tới khi điểm số được cải thiện.`;
        } else {
          copilotAnswer = 'Không có shop nào có nhiều đánh giá xấu. Hiện tại các đối tác đều đạt điểm hài lòng tốt trên 4.0★.';
        }
      } else if (q.includes('nhiều nhất') || q.includes('vào shop') || q.includes('thân thiết') || q.includes('khách nào')) {
        if (topPair) {
          copilotAnswer =
            `Khách hàng đặt nhiều nhất tại một shop là **${topPair.customerName}** (${topPair.customerEmail}):\n\n` +
            `• **Shop ruột:** ${topPair.providerName}\n` +
            `• **Số đơn đã đặt:** ${topPair.totalBookings} đơn (${topPair.completedBookings} đơn hoàn thành)\n` +
            `• **Tổng chi tiêu:** ${topPair.totalSpent.toLocaleString('vi-VN')}đ\n` +
            `• **Đánh giá đã cho:** ${topPair.reviewCount} lượt (Điểm TB: ${topPair.averageRatingGiven}/5.0)` +
            (topPair.recentComment ? `\n• **Bình luận:** "${topPair.recentComment}"` : '');
        } else {
          copilotAnswer = 'Chưa có đủ dữ liệu đơn hàng để xác định cặp Khách - Shop nhiều nhất.';
        }
      } else {
        copilotAnswer =
          `Tổng hợp theo yêu cầu của Admin:\n\n` +
          `• **Về đánh giá xấu:** ${worstShop ? `${worstShop.businessName} có ${worstShop.badReviewCount} đánh giá xấu` : 'Không có shop rủi ro cao'}.\n` +
          `• **Về khách hàng thân thiết:** ${topPair ? `${topPair.customerName} đặt nhiều nhất tại ${topPair.providerName}` : 'Chưa đủ dữ liệu'}.\n` +
          `• **Chất lượng toàn sàn:** Đạt ${summary.averagePlatformRating}/5.0 qua ${summary.totalReviewsAnalyzed} đánh giá.`;
      }
    }

    return {
      executive_summary: executiveSummary,
      bad_shops_analysis: badShopsAnalysis,
      user_behavior_analysis: userBehaviorAnalysis,
      top_recommendations: topRecommendations,
      copilot_answer: copilotAnswer,
      source: 'domain_heuristic_engine',
    };
  }
}

