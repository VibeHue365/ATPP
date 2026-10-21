import React from 'react';
import {
  DollarSign,
  CalendarCheck,
  Clock,
  Package,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { ProviderOverviewKpis } from '../types';

interface MetricCardsProps {
  kpis?: ProviderOverviewKpis;
  isLoading?: boolean;
  onNavigate?: (view: any) => void;
}

export const OverviewMetricCards: React.FC<MetricCardsProps> = ({
  kpis,
  isLoading = false,
  onNavigate,
}) => {
  // Format VND
  const formatVnd = (val?: number) => {
    if (val == null || val === 0) return '0 đ';
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  if (isLoading) {
    return (
      <section className="po-metric-cards-grid" aria-label="Chỉ số chính">
        {[1, 2, 3, 4].map((i) => (
          <div className="po-metric-card po-skeleton-card" key={i}>
            <div className="po-skeleton-line po-sk-title" />
            <div className="po-skeleton-line po-sk-value" />
            <div className="po-skeleton-line po-sk-note" />
          </div>
        ))}
      </section>
    );
  }

  // Card 1: Revenue this month
  const revenueDisplay = formatVnd(kpis?.revenueThisMonth);
  const revChangePct = kpis?.revenueChangePct;
  const isPositiveTrend = revChangePct != null && revChangePct > 0;
  const isNegativeTrend = revChangePct != null && revChangePct < 0;

  // Card 2: Bookings waiting confirmation
  const pendingCount = kpis?.pendingConfirmCount ?? 0;
  const bookingsDisplay = String(pendingCount);
  const unconfirmedNote =
    pendingCount > 0
      ? `${pendingCount} đơn chờ đối tác duyệt`
      : 'Không có đơn chờ duyệt';

  // Card 3: Upcoming schedules
  const upcomingCount = kpis?.upcomingSchedulesCount ?? 0;
  const upcomingDisplay = String(upcomingCount);
  const todaySchedulesCount = kpis?.todaySchedulesCount ?? 0;
  const todaySchedulesNote =
    todaySchedulesCount > 0
      ? `${todaySchedulesCount} lịch hẹn hôm nay`
      : upcomingCount > 0
      ? 'Lịch trong 7 ngày tới'
      : 'Chưa có lịch sắp tới';

  // Card 4: Rented products
  const rentedCount = kpis?.activeRentalsCount ?? 0;
  const rentedDisplay = String(rentedCount);
  const overdueCount = kpis?.overdueReturnsCount ?? 0;
  const returnsDueTodayCount = kpis?.returnsDueTodayCount ?? 0;

  const returnsNote =
    overdueCount > 0
      ? `⚠️ ${overdueCount} đơn quá hạn trả`
      : returnsDueTodayCount > 0
      ? `${returnsDueTodayCount} đơn đến hạn trả hôm nay`
      : rentedCount > 0
      ? `${rentedCount} trang phục đang lưu thông`
      : 'Chưa có đồ đang cho thuê';

  return (
    <section className="po-metric-cards-grid" aria-label="Chỉ số chính">
      {/* 1. Doanh thu tháng này */}
      <div
        className="po-metric-card"
        onClick={() => onNavigate?.('payouts')}
        role="button"
        tabIndex={0}
        id="card-revenue-month"
      >
        <div className="po-metric-card-top">
          <div className="po-metric-icon-box">
            <DollarSign size={20} />
          </div>
          <span className="po-metric-card-title">
            {kpis?.selectedMonthLabel
              ? `Doanh thu (${kpis.selectedMonthLabel})`
              : 'Doanh thu tháng này'}
          </span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{revenueDisplay}</div>
          <div className="po-metric-footer">
            {isPositiveTrend ? (
              <span className="po-trend-badge-green">
                <TrendingUp size={13} />
                <span>+{revChangePct}% so với tháng trước</span>
              </span>
            ) : isNegativeTrend ? (
              <span className="po-trend-badge-rose">
                <TrendingDown size={13} />
                <span>{revChangePct}% so với tháng trước</span>
              </span>
            ) : (
              <span className="po-trend-badge-gray">
                <span>{kpis?.revenueLastMonth ? 'Bằng tháng trước' : 'Tháng đầu tiên'}</span>
              </span>
            )}
            <ChevronRight size={14} className="po-chevron-link" />
          </div>
        </div>
      </div>

      {/* 2. Booking mới cần xác nhận */}
      <div
        className="po-metric-card"
        onClick={() => onNavigate?.('orders')}
        role="button"
        tabIndex={0}
        id="card-new-bookings"
      >
        <div className="po-metric-card-top">
          <div
            className="po-metric-icon-box"
            style={{ background: '#FFFBEB', color: '#D97706' }}
          >
            <CalendarCheck size={20} />
          </div>
          <span className="po-metric-card-title">Booking chờ xử lý</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{bookingsDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span
                className={`po-dot ${
                  pendingCount > 0 ? 'po-dot-amber' : 'po-dot-green'
                }`}
              />
              <span>{unconfirmedNote}</span>
            </span>
            <ChevronRight size={14} className="po-chevron-link" />
          </div>
        </div>
      </div>

      {/* 3. Lịch hẹn sắp tới */}
      <div
        className="po-metric-card"
        onClick={() => onNavigate?.('calendar')}
        role="button"
        tabIndex={0}
        id="card-upcoming-schedules"
      >
        <div className="po-metric-card-top">
          <div
            className="po-metric-icon-box"
            style={{ background: '#ECFDF5', color: '#16A34A' }}
          >
            <Clock size={20} />
          </div>
          <span className="po-metric-card-title">Lịch chụp & Hẹn gặp</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{upcomingDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span
                className={`po-dot ${
                  todaySchedulesCount > 0
                    ? 'po-dot-amber'
                    : upcomingCount > 0
                    ? 'po-dot-green'
                    : 'po-dot-gray'
                }`}
              />
              <span>{todaySchedulesNote}</span>
            </span>
            <ChevronRight size={14} className="po-chevron-link" />
          </div>
        </div>
      </div>

      {/* 4. Đang thuê áo dài */}
      <div
        className="po-metric-card"
        onClick={() => onNavigate?.('rental-operations')}
        role="button"
        tabIndex={0}
        id="card-rented-items"
      >
        <div className="po-metric-card-top">
          <div
            className="po-metric-icon-box"
            style={{ background: '#F8FAFC', color: '#475569' }}
          >
            <Package size={20} />
          </div>
          <span className="po-metric-card-title">Đang cho thuê</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{rentedDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span
                className={`po-dot ${
                  overdueCount > 0
                    ? 'po-dot-rose'
                    : returnsDueTodayCount > 0
                    ? 'po-dot-amber'
                    : 'po-dot-green'
                }`}
              />
              <span>{returnsNote}</span>
            </span>
            <ChevronRight size={14} className="po-chevron-link" />
          </div>
        </div>
      </div>
    </section>
  );
};
