export interface ProductReview {
  _id?: string;
  id?: string;
  rating: number;
  comment?: string;
  images?: string[];
  createdAt?: string;
  date?: string;
  repliedAt?: string;
  reply?: string;
  customerId?: {
    profile?: {
      fullName?: string;
      avatarUrl?: string;
      avatar?: string;
    };
  };
}

export type ReviewSortOrder = "newest" | "highest" | "lowest";

export interface ReviewStatus {
  canReview: boolean;
  hasCompletedBooking: boolean;
  alreadyReviewed: boolean;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, string>;
}
