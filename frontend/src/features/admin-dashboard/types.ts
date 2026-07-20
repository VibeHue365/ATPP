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

export interface AdminStats {
  customers?: AdminMetric;
  shops?: AdminMetric;
  photographers?: AdminMetric;
  bookings?: AdminMetric;
  revenue?: AdminMetric;
  userBehavior?: AdminUserBehavior;
}
