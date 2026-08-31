export interface ComboProductInfo {
  _id: string;
  name: string;
  images: string[];
  basePrice: number;
  slug?: string;
  depositAmount?: number;
  sizes?: string[];
  colors?: string[];
  materials?: string[];
}

export interface ComboPhotographyPackageInfo {
  _id: string;
  name: string;
  images: string[];
  price: number;
  durationHours: number;
  slug?: string;
  editedPhotosCount?: number;
  deliveryDays?: number;
  maxPeople?: number;
}

export interface ComboProviderInfo {
  _id: string;
  businessName: string;
  avatar?: string;
  address?: {
    addressLine?: string;
    city?: string;
  };
  rating?: {
    averageRating: number;
    totalReviews: number;
  };
}

export interface ComboDeal {
  _id: string;
  name: string;
  description?: string;
  productId: ComboProductInfo;
  photographyPackageId: ComboPhotographyPackageInfo;
  providerId: ComboProviderInfo;
  discountPercent: number;
  comboPrice?: number;
  validFrom?: string;
  validTo?: string;
  shootDate?: string | null;
  shootTimeSlot?: string | null;
  image?: string;
  aoDaiQuantity?: number;
  shootPeopleCount?: number;
  maxUsage?: number;
  usedCount?: number;
  isActive?: boolean;
}

export type ComboSortOption = 'discount_high' | 'price_low' | 'price_high' | 'newest' | 'popular';

export type ComboPriceFilter = 'all' | 'under_1500' | '1500_3000' | 'above_3000';

export type ComboDiscountFilter = 'all' | '15_plus' | '25_plus';

export type ComboPeopleFilter = 'all' | 'single' | 'couple' | 'group';

export interface ComboFilterState {
  searchQuery: string;
  priceRange: ComboPriceFilter;
  discountRange: ComboDiscountFilter;
  peopleRange: ComboPeopleFilter;
  sortBy: ComboSortOption;
}

export interface FigmaComboItem {
  id: string;
  badge: {
    text: string;
    type: 'dark' | 'red' | 'navy' | 'brown' | 'gold' | 'pink' | 'purple' | 'green';
  };
  title: string;
  location: string;
  locationType: 'Ngoại cảnh' | 'Studio' | 'Cặp đôi' | 'Gia đình' | 'Sự kiện';
  region: 'Huế' | 'Đà Nẵng' | 'Hội An' | 'Đà Lạt' | 'Hà Nội' | 'TP.HCM';
  people: string;
  peopleCategory: 'single' | 'couple' | 'group' | 'unlimited';
  description: string;
  price: number;
  oldPrice: number;
  savingsText: string;
  discountPercent: number;
  image: string;
  isFavorite?: boolean;
}
