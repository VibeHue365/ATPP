import { httpClient } from "../../../../services/httpClient";
import type { ProductDetail } from "../types/product-detail.types";

export interface ProductBusyDates {
  bookedDates: string[];
  bookedSlots: { date: string; timeSlot: string }[];
  variantBookedDates?: Record<string, string[]>;
  workingDays?: number[];
  offDays?: string[];
  hasSchedule?: boolean;
}

export interface CurrentUserProfile {
  hasCompletedOnboarding?: boolean;
  preferences?: {
    sizeInfo?: {
      preferredSize?: string;
    };
  };
}

export const fetchProductDetail = (productId: string) =>
  httpClient.get<ProductDetail>(`/products/${productId}`);

export const fetchProductBusyDates = (productId: string) =>
  httpClient.get<ProductBusyDates>(`/api/bookings/busy-dates/product/${productId}`);

export const fetchCurrentUserProfile = () =>
  httpClient.get<CurrentUserProfile>("/users/me");
