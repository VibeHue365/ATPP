export interface AdminTrendPoint {
  label: string;
  value: number;
}

export interface AdminPopularProduct {
  _id?: string;
  name: string;
  basePrice: number;
  viewCount?: number;
  rentCount?: number;
}

export interface AdminUserBehavior {
  topSearches?: Array<{ keyword: string; count: number }>;
  pageViews?: Partial<Record<'homepage' | 'rentals' | 'photographers' | 'productDetails', number>>;
  popularBookings?: Array<{ _id: string; count: number }>;
  popularProducts?: AdminPopularProduct[];
}

export interface AdminMetric {
  total?: number;
  active?: number;
  activeProducts?: number;
  bookings?: number;
  commission?: number;
  growth?: AdminTrendPoint[];
}

export interface OverviewChartPoint {
  day: string;
  bookings: number;
  gmvMillions: number;
}

export interface ServiceShareItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface PartnerRanking {
  rank: number;
  name: string;
  bookings: number;
  avatar: string;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  count: number;
  tab: string;
  variant: 'red' | 'amber';
}

export interface ActivityFeedItem {
  id: string;
  type: 'booking' | 'product' | 'refund' | 'verification' | 'dispute';
  actor: string;
  action: string;
  timeAgo: string;
}

export interface SystemAlertItem {
  id: string;
  title: string;
  count: number;
  severity: 'warning' | 'critical';
}

export interface AdminOverviewKPIs {
  totalBookings: { value: number; growth: number };
  gmv: { value: number; growth: number };
  activePartners: { value: number; growth: number };
  pendingApprovals: {
    total: number;
    growth: number;
    partners: number;
    products: number;
    combos: number;
  };
  pendingRefunds: { value: number; growth: number };
  openDisputes: { value: number; growth: number };
}

export interface AdminStats {
  customers?: AdminMetric;
  shops?: AdminMetric;
  photographers?: AdminMetric;
  bookings?: AdminMetric;
  revenue?: AdminMetric;
  operational?: {
    pendingVerifications: number;
    openDisputes: number;
  };
  userBehavior?: AdminUserBehavior;
  kpis?: AdminOverviewKPIs;
  chart?: {
    period: 'day' | 'week' | 'month';
    summaryBookings: number;
    summaryGmv: number;
    points: OverviewChartPoint[];
  };
  services?: {
    total: number;
    items: ServiceShareItem[];
  };
  tasks?: PendingTaskItem[];
  topPartners?: PartnerRanking[];
  activities?: ActivityFeedItem[];
  alerts?: {
    warnings: SystemAlertItem[];
    critical: SystemAlertItem[];
  };
}

// ─── AI Analytics Types ───────────────────────────────────────────────────────

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
