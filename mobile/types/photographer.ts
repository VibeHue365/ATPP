export type PhotographyPricingUnit = 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';

export interface PhotographyPackage {
  _id: string;
  name: string;
  price: number;
  durationHours: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  description?: string;
  images?: string[];
  categoryId?: string;
  conceptCategoryIds?: string[];
  styleCategoryIds?: string[];
  eventCategoryIds?: string[];
  pricingUnit?: PhotographyPricingUnit;
  includedDurationMinutes?: number | null;
  overtimeFeePerHour?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
  includedSessionCount?: number;
  includedDayCount?: number;
  maxPeople?: number;
  additionalSessionFee?: number;
  travelFeeNotes?: string | null;
}

export interface PhotographerPortfolioItem {
  _id: string;
  title: string;
  description?: string | null;
  images: string[];
  badges?: Array<{ code?: string; label?: string; name?: string }>;
}

export interface PhotographerAddress {
  addressLine?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  geo?: { coordinates?: number[] | null } | null;
}

export interface Photographer {
  _id: string;
  providerId?: string;
  businessName?: string | null;
  quote?: string | null;
  rating?: { averageRating?: number; totalReviews?: number };
  address?: PhotographerAddress | null;
  media?: { coverUrl?: string | null; images?: string[] } | null;
  coverImage?: string | null;
  equipment?: string[];
  policies?: { cancellationPolicy?: string } | null;
  portfolio?: string[];
  portfolioItems?: PhotographerPortfolioItem[];
  packages?: PhotographyPackage[];
  defaultPackage?: PhotographyPackage | null;
  activePackageCount?: number;
  isBookable?: boolean;
  serviceRadiusKm?: number | null;
}

export type PhotographerSort = 'rating_desc' | 'reviews_desc' | 'price_asc' | 'price_desc';
export interface PhotographerFilters {
  q?: string;
  concept?: string;
  packageCategoryId?: string;
  conceptCategoryIds?: string[];
  styleCategoryIds?: string[];
  eventCategoryIds?: string[];
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: PhotographerSort;
  page?: number;
  limit?: number;
}
export interface PhotographerPage { data: Photographer[]; meta: { page: number; limit: number; total: number; totalPages: number }; }
export interface PhotographerConcept { code: string; label: string; photographerCount: number; coverImage: string | null; }
export interface PhotographerPackageCategory { id: string; name: string; slug: string; packageCount: number; status: 'ACTIVE' | 'INACTIVE'; }

export interface PhotographerReview {
  _id: string;
  rating: number;
  comment?: string;
  reply?: string;
  createdAt: string;
  customerId?: { fullName?: string; email?: string; avatarUrl?: string; profile?: { fullName?: string; avatarUrl?: string } };
}

export interface PhotographySessionPayload {
  clientId: string;
  startsAt: string;
  endsAt: string;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
}
export interface PhotographyQuote {
  valid: boolean;
  quotedAt: string;
  currency: 'VND';
  package: { id: string; name: string; pricingUnit?: PhotographyPricingUnit; includedDurationMinutes?: number; overtimeIncrementMinutes?: number; maxOvertimeMinutes?: number };
  sessions: Array<{ clientId: string; startsAt: string; endsAt: string; providerLocalDate: string; durationMinutes: number; overtimeMinutes: number; locationAddress: string | null }>;
  errors: Array<{ clientId: string; code: string; message: string }>;
  breakdown: Array<{ type: 'BASE_PACKAGE' | 'OVERTIME' | 'SURCHARGE'; label: string; amount: number; clientIds?: string[] }>;
  totals: { baseAmount: number; overtimeAmount: number; surchargeAmount: number; totalAmount: number } | null;
}

export interface MonthlyPhotographyAvailability { month: string; days: Array<{ date: string; status: 'AVAILABLE' | 'FULLY_BOOKED' | 'OFF_DAY' | 'NO_SCHEDULE' }> }
export interface PhotographyTimeRanges { date?: string; timeRanges: Array<{ start: string; end: string }> }
