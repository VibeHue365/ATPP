import type { PublicSmartTagBadge } from "../../../../features/smart-tagging/types/smartTag.types";

export interface ProductProviderAddress {
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
}

export interface ProductProvider {
  _id: string;
  businessName: string;
  contact?: {
    email: string;
    phone: string;
    website?: string | null;
  };
  address?: ProductProviderAddress;
}

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
  rentedCount?: number;
  providerId: ProductProvider;
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate: string;
  } | null;
  discountedPrice?: number;
  badges?: PublicSmartTagBadge[];
}

export interface RentalCalendarDay {
  day: number;
  dateStr: string;
  isWeekend: boolean;
  isAvailable: boolean;
  isEmpty: boolean;
}

export interface RentalTimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface ProductAvailabilityView {
  state: "idle" | "checking" | "available" | "unavailable" | "error";
  result: {
    available: boolean;
    availableQuantity: number;
    requestedQuantity: number;
    message?: string;
  } | null;
}
