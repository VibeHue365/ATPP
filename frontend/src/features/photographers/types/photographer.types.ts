export interface PhotographerPackage {
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
  pricingUnit?: 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';
  includedDurationMinutes?: number | null;
  overtimeFeePerHour?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
}

export interface LocationSelection {
  address: string;
  latitude: number;
  longitude: number;
}
export interface PhotographyQuoteBreakdownItem {
  type: 'BASE_PACKAGE' | 'OVERTIME' | 'SURCHARGE';
  label: string;
  amount: number;
  clientIds?: string[];
}

export interface PhotographyQuoteError {
  clientId: string;
  code: string;
  message: string;
}

export interface PhotographyQuote {
  valid: boolean;
  quotedAt: string;
  currency: 'VND';
  package: {
    id: string;
    name: string;
    pricingUnit?: 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';
    includedDurationMinutes?: number;
    overtimeIncrementMinutes?: number;
    maxOvertimeMinutes?: number;
  };
  sessions: Array<{
    clientId: string;
    startsAt: string;
    endsAt: string;
    providerLocalDate: string;
    durationMinutes: number;
    overtimeMinutes: number;
    locationAddress: string | null;
  }>;
  errors: PhotographyQuoteError[];
  breakdown: PhotographyQuoteBreakdownItem[];
  totals: {
    baseAmount: number;
    overtimeAmount: number;
    surchargeAmount: number;
    totalAmount: number;
  } | null;
}

export interface PhotographerPortfolioBadge {
  code?: string;
  label?: string;
  name?: string;
}

export interface PhotographerPortfolioItem {
  _id: string;
  title: string;
  description?: string | null;
  images: string[];
  badges?: PhotographerPortfolioBadge[];
}

export interface PhotographerRating {
  averageRating: number;
  totalReviews: number;
}

export interface PhotographerAddress {
  addressLine?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
}

/** The public response contract returned by `/api/photographers`. */
export interface PhotographerApiResponse {
  _id: string;
  businessName?: string | null;
  quote?: string | null;
  rating?: Partial<PhotographerRating>;
  address?: PhotographerAddress | null;
  media?: {
    coverUrl?: string | null;
    images?: string[];
  } | null;
  coverImage?: string | null;
  equipment?: string[];
  policies?: {
    cancellationPolicy?: string;
  } | null;
  portfolio?: string[];
  portfolioItems?: PhotographerPortfolioItem[];
  packages?: PhotographerPackage[];
  defaultPackage?: PhotographerPackage | null;
  activePackageCount?: number;
  isBookable?: boolean;
}

/** View model consumed by cards, filters and listing UI. */
export interface PhotographerSummary {
  id: string;
  providerId: string;
  name: string;
  rating: number;
  reviewsCount: number;
  quote: string;
  styleTag: string;
  price: number;
  location: string;
  concepts: string[];
  image?: string;
  durationHours: number;
  editedPhotosCount: number;
  rawPhotosCount: number;
  packages: PhotographerPackage[];
  isBookable: boolean;
  equipment: string[];
}

export interface PhotographerDetails {
  id: string;
  _id: string;
  businessName: string;
  quote: string;
  rating: PhotographerRating;
  address: PhotographerAddress;
  media: { coverUrl?: string; images: string[] };
  policies: { cancellationPolicy?: string };
  equipment: string[];
  portfolio: string[];
  portfolioItems: PhotographerPortfolioItem[];
  packages: PhotographerPackage[];
  coverImage?: string;
}

export type PhotographerDiscoverySort =
  | 'rating_desc'
  | 'reviews_desc'
  | 'price_asc'
  | 'price_desc';

export interface PhotographerDiscoveryParams {
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
  /** Customer-only search point. It is sent for filtering and never displayed. */
  latitude?: number;
  longitude?: number;
  searchRadiusKm?: number;
  sort?: PhotographerDiscoverySort;
  page?: number;
  limit?: number;
}

export interface PhotographerDiscoveryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PhotographerDiscoveryResponse {
  data: PhotographerApiResponse[];
  meta: PhotographerDiscoveryMeta;
}

export interface PhotographerConcept {
  code: string;
  label: string;
  photographerCount: number;
  coverImage: string | null;
}