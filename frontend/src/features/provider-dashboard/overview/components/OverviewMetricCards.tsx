import React from 'react';
import {
  DollarSign,
  CalendarCheck,
  Clock,
  Package,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface MetricCardsProps {
  totalRevenue?: number;
  newBookingsCount?: number;
  unconfirmedCount?: number;
  upcomingCount?: number;
  todaySchedulesCount?: number;
  rentedCount?: number;
  returnsTodayCount?: number;
  completionRate?: number;
  urgentTasksCount?: number;
  onNavigate?: (view: any) => void;
}

export const OverviewMetricCards: React.FC<MetricCardsProps> = ({
  totalRevenue,
  newBookingsCount = 0,
  unconfirmedCount,
  upcomingCount = 0,
  todaySchedulesCount = 0,
  rentedCount = 0,
  returnsTodayCount = 0,
  onNavigate,
}) => {
  // Format VND
  const formatVnd = (val?: number) => {
    if (val == null || val === 0) return '0 đ';
    return `${val.toLocaleString('vi-VN')} đ`;
  };

  const revenueDisplay = formatVnd(totalRevenue);
  const bookingsDisplay = String(newBookingsCount);
  const unconfirmedNote = unconfirmedCount != null && unconfirmedCount > 0
    ? `${unconfirmedCount} đơn cần xác nhận`
    : 'Đang chờ xử lý';

  const upcomingDisplay = String(upcomingCount);
  const todaySchedulesNote = todaySchedulesCount > 0
    ? `${todaySchedulesCount} lịch hôm nay`
    : 'Lịch tuần này';

  const rentedDisplay = String(rentedCount);
  const returnsTodayNote = returnsTodayCount > 0
    ? `${returnsTodayCount} đơn đến hạn trả`
    : 'Hiện vật đang lưu thông';

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
          <span className="po-metric-card-title">Doanh thu tháng này</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{revenueDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-trend-badge-green">
              <TrendingUp size={13} />
              <span>Tăng trưởng tốt</span>
            </span>
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
          <div className="po-metric-icon-box" style={{ background: '#FFFBEB', color: '#D97706' }}>
            <CalendarCheck size={20} />
          </div>
          <span className="po-metric-card-title">Booking chờ xử lý</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{bookingsDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span className="po-dot po-dot-amber" />
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
          <div className="po-metric-icon-box" style={{ background: '#ECFDF5', color: '#16A34A' }}>
            <Clock size={20} />
          </div>
          <span className="po-metric-card-title">Lịch chụp & Hẹn gặp</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{upcomingDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span className="po-dot po-dot-green" />
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
          <div className="po-metric-icon-box" style={{ background: '#F8FAFC', color: '#475569' }}>
            <Package size={20} />
          </div>
          <span className="po-metric-card-title">Đang cho thuê</span>
        </div>
        <div className="po-metric-card-bottom">
          <div className="po-metric-value">{rentedDisplay}</div>
          <div className="po-metric-footer">
            <span className="po-dot-badge">
              <span className="po-dot po-dot-rose" />
              <span>{returnsTodayNote}</span>
            </span>
            <ChevronRight size={14} className="po-chevron-link" />
          </div>
        </div>
      </div>
    </section>
  );
};
