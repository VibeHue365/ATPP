import type { Product } from '@/types/product';

export interface ProviderStore {
  _id: string;
  userId?: string | null;
  businessName: string;
  capabilities?: string[];
  contact?: { email?: string; phone?: string; website?: string };
  address?: { addressLine?: string; ward?: string; district?: string; city?: string };
  media?: { logoUrl?: string; coverUrl?: string; images?: string[] };
  rating?: { averageRating?: number; reviewCount?: number; totalReviews?: number };
  policies?: { cancellationPolicy?: string; rentalPolicy?: string };
  rentalSettings?: { pickupLocation?: { addressLine?: string; ward?: string; district?: string; city?: string } };
  comboDiscountPercent?: number;
  activeCampaign?: { occasion: string; discountPercent: number; endDate: string } | null;
}

export interface ProviderStoreData { store: ProviderStore; products: Product[] }

