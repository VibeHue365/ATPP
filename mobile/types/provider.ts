export interface ProviderProfile {
  _id: string;
  userId?: string | null;
  businessName: string;
  brandName?: string;
  providerCode?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  media?: {
    logoUrl?: string;
    coverUrl?: string;
    images?: string[];
  };
  address?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  rating?: {
    averageRating?: number;
    reviewCount?: number;
    totalReviews?: number;
  };
  isAcceptingBookings?: boolean;
  status?: string;
  isVerified?: boolean;
  verificationStatus?: string;
}

export interface ProviderKpis {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueChangePct: number | null;
  selectedMonth?: string;
  selectedMonthLabel?: string;
  isCurrentMonth?: boolean;
  pendingConfirmCount: number;
  oldestPendingAt?: string | null;
  upcomingSchedulesCount: number;
  todaySchedulesCount: number;
  activeRentalsCount: number;
  returnsDueTodayCount: number;
  overdueReturnsCount: number;
}

export interface ProviderScheduleItem {
  id: string;
  bookingId: string;
  bookingCode: string;
  type: 'PHOTOSHOOT' | 'PICKUP' | 'RETURN';
  startsAt: string;
  endsAt: string | null;
  timeLabel: string;
  customer: {
    name: string;
    avatarUrl: string | null;
    phone?: string;
  };
  serviceName: string;
  status: string;
  statusTone: 'amber' | 'blue' | 'green' | 'gray';
  locationName?: string;
  locationAddress?: string;
  photographerName?: string;
  packageTitle?: string;
  guestCount?: number;
  isVip?: boolean;
}

export interface ProviderTask {
  id: string;
  type:
    | 'CONFIRM_BOOKING'
    | 'RETURN_OVERDUE'
    | 'RETURN_DUE'
    | 'PICKUP_TODAY'
    | 'SHOOT_TODAY'
    | 'UNREAD_NOTIFICATIONS'
    | string;
  count: number;
  title: string;
  description: string;
  urgency: 'urgent' | 'today' | 'normal';
  targetView: string;
}

export interface ProviderPerformance {
  averageRating: number;
  totalReviews: number;
  completionRate: number | null;
  cancelRate: number | null;
  cancelRatePrev?: number | null;
  isVerified: boolean;
}

export interface ProviderRecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  bookingId?: string;
}

export interface ProviderOverviewResponse {
  generatedAt?: string;
  kpis: ProviderKpis;
  tasks: ProviderTask[];
  todaySchedules: ProviderScheduleItem[];
  performance: ProviderPerformance;
  recentActivities?: ProviderRecentActivity[];
}

export interface ProviderWalletResponse {
  wallet: {
    pendingBalance: number;
    availableBalance: number;
    totalEarned: number;
    lastUpdatedAt: string | null;
  };
  recentSettlements: Array<{
    settlementCode: string;
    bookingCode: string;
    bookingType: string;
    netAmount: number;
    payableAmount: number;
    status: string;
    createdAt: string;
  }>;
}

export interface InventorySummaryItem {
  productId: string;
  productName: string;
  size: string;
  color: string;
  material: string | null;
  total: number;
  available: number;
  rented: number;
  maintenance: number;
}

export interface InventoryOverview {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  availablePct: number;
  rentedPct: number;
  maintenancePct: number;
}

export interface WeatherLocationChangeAlert {
  bookingId: string;
  scheduleId: string;
  currentLocationName: string;
  suggestedLocation: string;
  rainStopDuration: string;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
}
