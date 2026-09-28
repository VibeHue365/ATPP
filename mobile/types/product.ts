export interface ProductProvider {
  _id: string;
  businessName: string;
  address?: { addressLine?: string; ward?: string; district?: string; city?: string };
}

export interface ProductBadge {
  code: string;
  label: string;
  description?: string;
  displayPriority?: number;
  tone?: string;
  displayConfig?: {
    color?: string;
    backgroundColor?: string;
    icon?: string | null;
  };
}

export interface ProductCustomTag {
  label: string;
  normalizedLabel: string;
  mappedTagCode?: string | null;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  basePrice: number;
  discountedPrice?: number;
  hourlyPrice?: number;
  depositAmount?: number;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  sizes: string[];
  colors: string[];
  materials?: string[];
  status?: string;
  style?: string;
  rating?: { averageRating: number; totalReviews: number };
  providerId?: ProductProvider | string;
  badges?: ProductBadge[];
  customTags?: ProductCustomTag[];
  activeCampaign?: { occasion: string; discountPercent: number; endDate?: string } | null;
  recommendation?: { score: number; matchPercent: number; reasons: string[] };
}

export interface ProductPage {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number; personalized?: boolean };
}

export interface ProductFilters {
  search?: string;
  page?: number;
  limit?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  types?: string[];
  providerLocation?: string;
  providerId?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';
}
