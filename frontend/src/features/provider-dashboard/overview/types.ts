export interface ProviderOverviewKpis {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueChangePct: number | null;
  selectedMonth?: string;
  selectedMonthLabel?: string;
  isCurrentMonth?: boolean;
  pendingConfirmCount: number;
  oldestPendingAt: string | null;
  upcomingSchedulesCount: number;
  todaySchedulesCount: number;
  activeRentalsCount: number;
  returnsDueTodayCount: number;
  overdueReturnsCount: number;
}

export interface ProviderOverviewChartPoint {
  key: string;
  label: string;
  revenue: number;
  bookings: number;
}

export interface ProviderOverviewChart {
  period: 'week' | 'month' | 'year';
  service: string;
  selectedMonth?: string;
  selectedMonthLabel?: string;
  points: ProviderOverviewChartPoint[];
  totals: {
    revenue: number;
    bookings: number;
  };
}

export interface ProviderOverviewScheduleItem {
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
  };
  serviceName: string;
  status: string;
  statusTone: 'amber' | 'blue' | 'green' | 'gray';
}

export interface ProviderOverviewTask {
  id: string;
  type:
    | 'CONFIRM_BOOKING'
    | 'RETURN_OVERDUE'
    | 'RETURN_DUE'
    | 'PICKUP_TODAY'
    | 'SHOOT_TODAY'
    | 'UNREAD_NOTIFICATIONS';
  count: number;
  title: string;
  description: string;
  urgency: 'urgent' | 'today' | 'normal';
  targetView: string;
}

export interface ProviderOverviewTopService {
  id: string;
  kind: 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';
  name: string;
  image: string | null;
  bookings: number;
  revenue: number;
  sharePct: number;
}

export interface ProviderOverviewRecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  bookingId?: string;
}

export interface ProviderOverviewPerformance {
  averageRating: number;
  totalReviews: number;
  completionRate: number | null;
  cancelRate: number | null;
  cancelRatePrev: number | null;
  isVerified: boolean;
}

export interface ProviderOverviewResponse {
  generatedAt: string;
  kpis: ProviderOverviewKpis;
  chart: ProviderOverviewChart;
  upcomingSchedules: ProviderOverviewScheduleItem[];
  tasks: ProviderOverviewTask[];
  topServices: ProviderOverviewTopService[];
  recentActivities: ProviderOverviewRecentActivity[];
  performance: ProviderOverviewPerformance;
}
