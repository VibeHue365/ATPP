import type { CartItem } from '../../context/CartContext';

export interface EnrichedCartItem extends CartItem {
  originalPrice?: number;
  providerCity?: string | null;
  providerAddress?: string | null;
}

export interface ComboGroupEntry {
  comboId: string;
  items: EnrichedCartItem[];
  origTotal: number;
  discountPct: number;
  comboPrice: number;
  depositAmt: number;
}

export interface CartCalendarDay {
  day: number;
  dateStr: string;
  isWeekend: boolean;
  isAvailable: boolean;
  isEmpty: boolean;
}

export interface CartItemGroup {
  id: string;
  title: string;
  type: 'SUCCESS' | 'MISMATCH' | 'OTHERS';
  items: EnrichedCartItem[];
  warning?: string;
  isCityMismatch?: boolean;
  syncDate?: string;
}

export interface CartTotals {
  grandTotal: number;
  depositToPayNow: number;
  totalProductRental: number;
  totalProductDeposit: number;
  totalPhotographerFee: number;
  comboDiscountTotal: number;
  remainingToPayLater: number;
}
