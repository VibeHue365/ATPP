export type ReportAction = 'DELETE' | 'DISMISS' | 'HIDE' | 'UNDER_REVIEW' | 'CONFIRM';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type ReportReasonType =
  | 'OFFENSIVE_LANGUAGE'
  | 'SPAM'
  | 'FALSE_CONTENT'
  | 'COMPETITOR_BIAS'
  | 'DEFAMATION'
  | 'VULGAR';

export interface TimelineEvent {
  timestamp: string | Date;
  title: string;
  description: string;
}

export interface ReportedReview {
  _id: string;
  rating?: number;
  comment?: string;
  images?: string[];
  reportReason?: string;
  reportReasonType?: string;
  reportCode?: string;
  reportStatus?: ReportStatus;
  reportDescription?: string;
  reporterName?: string;
  reporterCode?: string;
  reporterAvatar?: string;
  isHidden?: boolean;
  reportedAt?: string;
  createdAt?: string;
  bookingId?: {
    _id?: string;
    bookingCode?: string;
    createdAt?: string;
  };
  bookingItemId?: {
    _id?: string;
    name?: string;
    coverImage?: string;
  };
  providerId?: {
    _id?: string;
    businessName?: string;
    partnerCode?: string;
    profile?: {
      avatarUrl?: string;
    };
  };
  customerId?: {
    _id?: string;
    profile?: {
      fullName?: string;
      avatarUrl?: string;
    };
    auth?: {
      email?: string;
    };
  };
  historyTimeline?: TimelineEvent[];
}

export interface ReportMetrics {
  total: number;
  pending: number;
  underReview: number;
  resolved: number;
  hidden: number;
}

export interface ReportedReviewsResponse {
  metrics: ReportMetrics;
  reviews: ReportedReview[];
}