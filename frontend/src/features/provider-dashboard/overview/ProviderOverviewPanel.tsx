import React from 'react';
import type { Order } from '../types';
import type { AnalyticsData } from '../analytics/AnalyticsPanel';
import { OverviewHeader } from './components/OverviewHeader';
import { OverviewMetricCards } from './components/OverviewMetricCards';
import { OverviewMidSection } from './components/OverviewMidSection';
import { OverviewThreeColumns } from './components/OverviewThreeColumns';
import { OverviewPerformanceSection } from './components/OverviewPerformanceSection';
import './providerOverview.css';

interface ProviderOverviewPanelProps {
  provider?: { _id?: string; businessName?: string } | null;
  orders?: Order[];
  loadingOrders?: boolean;
  analyticsData?: AnalyticsData | null;
  notifications?: Array<any>;
  chartTimeRange?: 'week' | 'month' | 'year';
  onPeriodChange?: (period: 'week' | 'month' | 'year') => void;
  onNavigate?: (view: any) => void;
}

export const ProviderOverviewPanel: React.FC<ProviderOverviewPanelProps> = ({
  provider,
  orders = [],
  loadingOrders: _loadingOrders = false,
  analyticsData,
  notifications = [],
  chartTimeRange = 'month',
  onPeriodChange = () => {},
  onNavigate = () => {},
}) => {
  // Compute numbers from actual live state
  const pendingOrders = orders.filter(
    (o) => ['PENDING', 'DEPOSIT_PAID'].includes(o.rawStatus || '')
  );
  const pendingCount = pendingOrders.length;

  const rentedItemsCount =
    analyticsData?.inventoryStatus?.find((s) => s.status === 'RENTED')?.count ??
    orders.filter((o) => ['PICKED_UP', 'RENTED'].includes(o.rawStatus || '')).length;

  const schedules = analyticsData?.upcomingSchedules || [];

  return (
    <div className="provider-overview-container" data-testid="provider-overview-panel">
      {/* 1. Header with greeting, Vietnamese date, store preview button */}
      <OverviewHeader provider={provider} />

      {/* 2. 4 Gold Standard KPI Metric Cards */}
      <OverviewMetricCards
        totalRevenue={analyticsData?.totalRevenue}
        newBookingsCount={pendingCount}
        unconfirmedCount={pendingCount}
        upcomingCount={schedules.length}
        todaySchedulesCount={schedules.length > 0 ? 1 : 0}
        rentedCount={rentedItemsCount}
        returnsTodayCount={0}
        completionRate={analyticsData?.successRate ?? 95}
        onNavigate={onNavigate}
      />

      {/* 3. Mid Section (Dual-Axis Composite Chart & Upcoming Schedule) */}
      <OverviewMidSection
        period={chartTimeRange}
        onPeriodChange={onPeriodChange}
        schedules={schedules}
        revenueData={analyticsData?.revenueGrowth}
        onNavigate={onNavigate}
      />

      {/* 4. Three Columns (To-Do list, Top Services, Recent Activity) */}
      <OverviewThreeColumns
        pendingOrdersCount={pendingCount}
        rentalsDueCount={0}
        unreadNotisCount={notifications.filter((n) => !n.isRead).length}
        popularProducts={analyticsData?.popularProducts}
        notifications={notifications}
        onNavigate={onNavigate}
      />

      {/* 5. Performance Section (4 Metrics + Trophy Encouragement Banner) */}
      <OverviewPerformanceSection
        averageRating={analyticsData?.averageRating ?? 5.0}
        cancelRate={analyticsData?.cancelRate ?? 0}
        completionRate={analyticsData?.successRate ?? 95}
        onNavigate={onNavigate}
      />
    </div>
  );
};

export default ProviderOverviewPanel;
