export interface ProductProvider {
  _id: string;
  businessName: string;
  address?: { addressLine?: string; ward?: string; district?: string; city?: string };
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
  badges?: { code: string; label: string; tone?: string }[];
  activeCampaign?: { occasion: string; discountPercent: number; endDate?: string } | null;
}

export interface ProductPage {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
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
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';
}
