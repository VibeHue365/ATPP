export interface ComboProduct {
  _id: string;
  name: string;
  images?: string[];
  basePrice: number;
  depositAmount?: number;
  sizes?: string[];
  colors?: string[];
  materials?: string[];
}

export interface ComboPhotographyPackage {
  _id: string;
  name: string;
  images?: string[];
  price: number;
  durationHours?: number;
  editedPhotosCount?: number;
  deliveryDays?: number;
  maxPeople?: number;
}

export interface ComboProvider {
  _id: string;
  businessName?: string;
  address?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string;
    geo?: { coordinates?: number[] };
  };
  rating?: { averageRating?: number; totalReviews?: number };
  contact?: { phone?: string; email?: string };
}

export interface ComboDeal {
  _id: string;
  name: string;
  description?: string | null;
  productId: ComboProduct;
  photographyPackageId: ComboPhotographyPackage;
  providerId: ComboProvider;
  discountPercent: number;
  comboPrice?: number | null;
  validFrom: string;
  validTo: string;
  shootDate?: string | null;
  shootTimeSlot?: string | null;
  maxUsage: number;
  usedCount?: number;
  aoDaiQuantity?: number;
  shootPeopleCount?: number;
  image?: string | null;
  images?: string[];
  location?: string | null;
  durationHours?: number | null;
  inclusions?: string[];
  createdAt?: string;
}

export type ComboSort = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'discount_desc';

export const comboOriginalPrice = (combo: ComboDeal) =>
  (combo.productId?.basePrice ?? 0) * (combo.aoDaiQuantity ?? 1) + (combo.photographyPackageId?.price ?? 0);

export const comboPublishedPrice = (combo: ComboDeal) =>
  combo.comboPrice ?? Math.round(comboOriginalPrice(combo) * (1 - (combo.discountPercent ?? 0) / 100));

