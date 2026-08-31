export type ProfileTab =
  | 'overview'
  | 'personal'
  | 'schedule'
  | 'favorites'
  | 'addresses'
  | 'payments'
  | 'security'
  | 'notifications';

export interface QuickStatsData {
  photoshootsCount: number;
  favoritesCount: number;
  totalSpent: number;
  membershipTier: string;
  membershipExpiry?: string;
}

export interface UpcomingScheduleItem {
  id: string;
  bookingId: string;
  bookingCode: string;
  type: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO';
  title: string;
  code: string;
  size?: string;
  color?: string;
  timeSlot?: string;
  dateStr: string;
  countdownText: string;
  badgeStatus: 'URGENT' | 'OVERDUE' | 'UPCOMING' | 'ACTIVE';
  badgeLabel: string;
  booking: any;
}

export interface RecentOrderItem {
  id: string;
  bookingId: string;
  bookingCode: string;
  title: string;
  dateStr: string;
  amount: number;
  status: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  image?: string;
  booking: any;
}

export interface MonthlySpending {
  month: string; // T1, T2...
  monthNumber: number;
  amount: number;
  heightPercent: number;
}

export interface SpecialOfferItem {
  id: string;
  code: string;
  title: string;
  description: string;
  expiryDate: string;
  type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'TIER_VIP';
  discountValue: string;
}
