import React from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarRange,
  DollarSign,
  FileCheck,
  RefreshCw,
  RotateCcw,
  Store,
} from 'lucide-react';
import { useAdminOverviewData } from '../hooks/useAdminOverviewData';
import { OverviewKpiCard } from './OverviewKpiCard';
import { OverviewComboChart } from './OverviewComboChart';
import { OverviewServiceDonut } from './OverviewServiceDonut';
import { OverviewActionWidgets } from './OverviewActionWidgets';
import './overviewFigmaTheme.css';

export interface OverviewPanelProps {
  onNavigateTab?: (tab: string) => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ onNavigateTab }) => {
  const { data, isLoading, error, period, setPeriod, refresh } = useAdminOverviewData();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  return (
    <section className="lume-overview-container">
      {/* Top Header & Range Bar inside Overview */}
      <div className="lume-overview-header">
        <div className="lume-overview-header__title-block">
          <div className="lume-overview-header__title-row">
            <h1 className="lume-overview-header__title">Tổng quan hệ thống</h1>
            {data?.lastUpdated && (
              <span className="lume-updated-badge">
                Cập nhật lần cuối: {data.lastUpdated}
              </span>
            )}
          </div>
          <p className="lume-overview-header__subtitle">
            Theo dõi hiệu suất hoạt động, giao dịch và các vấn đề cần xử lý trên nền tảng Lumé.
          </p>
        </div>

        <div className="lume-overview-header__actions">
          <div className="lume-daterange-picker" title="Khoảng thời gian thống kê">
            <CalendarRange size={15} color="#4A121A" />
            <span>01/09/2024 - 30/09/2024 ▾</span>
          </div>

          <button
            type="button"
            className={`lume-refresh-btn ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void refresh()}
            disabled={isLoading}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} />
            <span>{isLoading ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#FEE2E2',
            color: '#991B1B',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* 6 KPI Cards Grid */}
      {data && (
        <>
          <div className="lume-kpi-grid">
            {/* 1. Tổng booking */}
            <OverviewKpiCard
              label="Tổng booking"
              value={formatNumber(data.kpis.totalBookings.value)}
              growth={data.kpis.totalBookings.growth}
              growthType="up-green"
              icon={Calendar}
              iconBg="#EFF6FF"
              iconColor="#2563EB"
              onClick={() => onNavigateTab?.('bookings')}
            />

            {/* 2. GMV tháng này */}
            <OverviewKpiCard
              label="GMV tháng này"
              value={formatCurrency(data.kpis.gmv.value)}
              growth={data.kpis.gmv.growth}
              growthType="up-green"
              icon={DollarSign}
              iconBg="#FFFBEB"
              iconColor="#D97706"
              onClick={() => onNavigateTab?.('revenue')}
            />

            {/* 3. Đối tác hoạt động */}
            <OverviewKpiCard
              label="Đối tác hoạt động"
              value={formatNumber(data.kpis.activePartners.value)}
              growth={data.kpis.activePartners.growth}
              growthType="up-green"
              icon={Store}
              iconBg="#ECFDF5"
              iconColor="#059669"
              onClick={() => onNavigateTab?.('providers')}
            />

            {/* 4. Chờ phê duyệt */}
            <OverviewKpiCard
              label="Chờ phê duyệt"
              value={formatNumber(data.kpis.pendingApprovals.total)}
              growth={data.kpis.pendingApprovals.growth}
              growthType="up-red"
              breakdown={`${data.kpis.pendingApprovals.partners} hs đối tác · ${data.kpis.pendingApprovals.products} SP · ${data.kpis.pendingApprovals.combos} combo`}
              icon={FileCheck}
              iconBg="#FEF2F2"
              iconColor="#DC2626"
              onClick={() => onNavigateTab?.('verifications')}
            />

            {/* 5. Hoàn tiền chờ xử lý */}
            <OverviewKpiCard
              label="Hoàn tiền chờ xử lý"
              value={formatNumber(data.kpis.pendingRefunds.value)}
              growth={data.kpis.pendingRefunds.growth}
              growthType="up-red"
              icon={RotateCcw}
              iconBg="#FEF2F2"
              iconColor="#DC2626"
              onClick={() => onNavigateTab?.('refunds')}
            />

            {/* 6. Tranh chấp đang mở */}
            <OverviewKpiCard
              label="Tranh chấp đang mở"
              value={formatNumber(data.kpis.openDisputes.value)}
              growth={data.kpis.openDisputes.growth}
              growthType="up-red"
              icon={AlertTriangle}
              iconBg="#FEF2F2"
              iconColor="#DC2626"
              onClick={() => onNavigateTab?.('disputes')}
            />
          </div>

          {/* Charts Row: Combo Chart + Donut Chart */}
          <div className="lume-charts-row">
            <OverviewComboChart
              period={period}
              onPeriodChange={setPeriod}
              summaryBookings={data.chart.summaryBookings}
              summaryGmv={data.chart.summaryGmv}
              points={data.chart.points}
            />

            <OverviewServiceDonut
              total={data.services.total}
              items={data.services.items}
            />
          </div>

          {/* 4 Action & Alert Widgets */}
          <OverviewActionWidgets
            tasks={data.tasks}
            topPartners={data.topPartners}
            activities={data.activities}
            alerts={data.alerts}
            onNavigateTab={onNavigateTab}
          />
        </>
      )}
    </section>
  );
};
export default OverviewPanel;
