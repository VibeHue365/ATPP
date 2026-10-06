import React from 'react';
import type { Order } from '../types';
import type { AnalyticsData } from '../analytics/AnalyticsPanel';
import { OverviewHeader } from './components/OverviewHeader';
import { OverviewMetricCards } from './components/OverviewMetricCards';
import { OverviewMidSection } from './components/OverviewMidSection';
import { OverviewThreeColumns } from './components/OverviewThreeColumns';
import { OverviewPerformanceSection } from './components/OverviewPerformanceSection';
import { useProviderOverview } from './hooks/useProviderOverview';
import { AlertCircle, RotateCcw } from 'lucide-react';
import './providerOverview.css';

interface ProviderOverviewPanelProps {
  provider?: { _id?: string; businessName?: string; capabilities?: string[] } | null;
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
  onNavigate = () => {},
}) => {
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    period,
    setPeriod,
    service,
    setService,
    selectedMonth,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
    refresh,
    isConnected,
  } = useProviderOverview();

  return (
    <div
      className="provider-overview-container"
      data-testid="provider-overview-panel"
    >
      {/* 1. Header with greeting, Vietnamese date, real-time indicator, store preview button */}
      <OverviewHeader
        provider={provider}
        lastUpdated={data?.generatedAt}
        isRefreshing={isRefreshing}
        isConnected={isConnected}
        onRefresh={refresh}
      />

      {error && !data ? (
        <div className="po-error-card">
          <AlertCircle size={24} color="#DC2626" />
          <div className="po-error-info">
            <h4>Không thể tải dữ liệu tổng quan</h4>
            <p>{error}</p>
          </div>
          <button className="po-btn-retry" onClick={() => void refresh()} type="button">
            <RotateCcw size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : (
        <>
          {/* 2. 4 Gold Standard KPI Metric Cards (Real Mongo aggregated numbers) */}
          <OverviewMetricCards
            kpis={data?.kpis}
            isLoading={isLoading}
            onNavigate={onNavigate}
          />

          {/* 3. Mid Section (Dual-Axis Composite Chart & Upcoming Schedule) */}
          <OverviewMidSection
            period={period}
            onPeriodChange={setPeriod}
            service={service}
            onServiceChange={setService}
            chart={data?.chart}
            schedules={data?.upcomingSchedules}
            isLoading={isRefreshing}
            onNavigate={onNavigate}
            capabilities={provider?.capabilities}
            selectedMonth={selectedMonth}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            onCurrentMonth={goToCurrentMonth}
            isCurrentMonth={isCurrentMonth}
          />

          {/* 4. Three Columns (To-Do list, Top Services, Recent Activity) */}
          <OverviewThreeColumns
            tasks={data?.tasks}
            topServices={data?.topServices}
            activities={data?.recentActivities}
            isLoading={isLoading}
            onNavigate={onNavigate}
          />

          {/* 5. Performance Section (4 Metrics + Trophy Encouragement Banner) */}
          <OverviewPerformanceSection
            performance={data?.performance}
            onNavigate={onNavigate}
          />
        </>
      )}
    </div>
  );
};

export default ProviderOverviewPanel;
