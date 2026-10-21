import type { PublicSmartTagBadge } from '../../../features/smart-tagging/types/smartTag.types';

export interface ProductDetail {
  _id: string;
  name: string;
  description: string;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  basePrice: number;
  hourlyPrice?: number | null;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  rating: {
    averageRating: number;
    totalReviews: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    contact?: {
      email: string;
      phone: string;
      website?: string | null;
    };
    address?: {
      addressLine: string;
      ward?: string | null;
      district?: string | null;
      city?: string | null;
    };
    comboDiscountPercent?: number;
  };
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate: string;
  } | null;
  discountedPrice?: number;
  badges?: PublicSmartTagBadge[];
  customTags?: Array<{
    label: string;
    normalizedLabel: string;
    mappedTagCode?: string | null;
  }>;
}

export type RentalMode = 'DAILY' | 'HOURLY';

export interface ProductSlot {
  start: string;
  end: string;
  label: string;
}

export interface CalendarDay {
  day: number;
  dateStr: string;
  isWeekend: boolean;
  isAvailable: boolean;
  isEmpty: boolean;
}

export interface ProviderScheduleInfo {
  hasSchedule: boolean;
  workingDays: number[];
  offDays: string[];
}

export interface ReviewStatus {
  canReview: boolean;
  hasCompletedBooking: boolean;
  alreadyReviewed: boolean;
  bookingId?: string;
  bookingItemId?: string;
}

export interface ReviewItem {
  _id?: string;
  id?: string;
  customerId?: {
    profile?: {
      fullName?: string;
      avatarUrl?: string;
      avatar?: string;
    };
  };
  rating: number;
  comment: string;
  images?: string[];
  createdAt?: string;
  date?: string;
  reply?: string;
  repliedAt?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, string>;
}

export interface SuggestedPhotographer {
  id: string;
  name: string;
  rating: number;
  count: number;
  desc: string;
  price: string;
  image: string;
}

export type FitPreference = 'SLIM' | 'COMFORT';
export type InfoTab = 'details' | 'policies' | 'guide';
