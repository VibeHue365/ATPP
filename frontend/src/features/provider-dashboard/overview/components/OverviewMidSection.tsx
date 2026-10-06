import React, { useState } from 'react';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Inbox,
} from 'lucide-react';
import type {
  ProviderOverviewChart,
  ProviderOverviewScheduleItem,
} from '../types';

interface MidSectionProps {
  period: 'week' | 'month' | 'year';
  onPeriodChange: (p: 'week' | 'month' | 'year') => void;
  service: string;
  onServiceChange: (s: string) => void;
  chart?: ProviderOverviewChart;
  schedules?: ProviderOverviewScheduleItem[];
  isLoading?: boolean;
  onNavigate?: (view: any) => void;
  capabilities?: string[];
  selectedMonth?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onCurrentMonth?: () => void;
  isCurrentMonth?: boolean;
}

export const OverviewMidSection: React.FC<MidSectionProps> = ({
  period,
  onPeriodChange,
  service,
  onServiceChange,
  chart,
  schedules = [],
  isLoading = false,
  onNavigate,
  capabilities = [],
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
  isCurrentMonth = true,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rawPoints = chart?.points || [];

  // Determine dynamic axis ranges
  const rawMaxRev = rawPoints.reduce((m, p) => Math.max(m, p.revenue), 0);
  // Default to at least 2 million VND if 0, so axis is drawn cleanly
  const maxRevMillion = rawMaxRev > 0 ? Math.ceil(rawMaxRev / 1_000_000) : 5;
  const maxRev = maxRevMillion * 1_000_000;

  const rawMaxBook = rawPoints.reduce((m, p) => Math.max(m, p.bookings), 0);
  const maxBooking = Math.max(Math.ceil((rawMaxBook + 1) / 5) * 5, 10);

  // SVG Chart Geometry Constants
  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 46;
  const padRight = 36;
  const padTop = 20;
  const padBottom = 30;
  const drawWidth = svgWidth - padLeft - padRight;
  const drawHeight = svgHeight - padTop - padBottom;

  // Calculate coordinates
  const points = rawPoints.map((pt, idx) => {
    const x =
      rawPoints.length > 1
        ? padLeft + idx * (drawWidth / (rawPoints.length - 1))
        : padLeft + drawWidth / 2;
    const yRev = padTop + drawHeight * (1 - Math.min(1, pt.revenue / maxRev));
    const yBook = padTop + drawHeight * (1 - Math.min(1, pt.bookings / maxBooking));
    const barHeight = drawHeight * Math.min(1, pt.revenue / maxRev);
    const barY = padTop + drawHeight - barHeight;
    return { ...pt, x, yRev, yBook, barY, barHeight };
  });

  // SVG Path for Booking Line
  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x},${curr.yBook}` : `${acc} L ${curr.x},${curr.yBook}`;
  }, '');

  const hasAodai =
    capabilities.length === 0 ||
    capabilities.includes('AODAI_RENTAL') ||
    capabilities.includes('RENTAL') ||
    capabilities.includes('COSTUME_RENTAL');
  const hasPhoto =
    capabilities.length === 0 || capabilities.includes('PHOTOGRAPHY');

  return (
    <section className="po-mid-section-grid" aria-label="Biểu đồ và lịch">
      {/* 1. LEFT CONTAINER: Dual-Axis Chart */}
      <div className="po-card-box" id="chart-booking-revenue">
        <div className="po-card-box-header">
          <div className="po-card-box-title">
            <h3>Booking & Doanh thu</h3>
            <p>
              {chart?.totals
                ? `Tổng: ${(chart.totals.revenue / 1_000_000).toFixed(1)} tr · ${
                    chart.totals.bookings
                  } đơn ${
                    period === 'month' && chart.selectedMonthLabel
                      ? `(${chart.selectedMonthLabel})`
                      : 'trong kỳ này'
                  }`
                : 'Biểu đồ thể hiện số lượng booking và doanh thu theo thời gian'}
            </p>
          </div>

          <div className="po-chart-controls">
            <select
              className="po-service-select"
              value={service}
              onChange={(e) => onServiceChange(e.target.value)}
              aria-label="Chọn dịch vụ"
            >
              <option value="all">Tất cả dịch vụ</option>
              {hasAodai && <option value="AODAI_RENTAL">Thuê áo dài</option>}
              {hasPhoto && <option value="PHOTOGRAPHY">Gói chụp ảnh</option>}
              {hasAodai && hasPhoto && <option value="COMBO">Combo trọn gói</option>}
            </select>

            {/* Month Navigator when period === 'month' */}
            {period === 'month' && (
              <div className="po-month-navigator" aria-label="Chọn tháng tra cứu">
                <button
                  type="button"
                  className="po-month-nav-btn"
                  onClick={onPrevMonth}
                  title="Tháng trước"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="po-month-nav-display">
                  <Calendar size={13} className="po-month-nav-icon" />
                  <span className="po-month-nav-text">
                    {chart?.selectedMonthLabel || 'Tháng này'}
                  </span>
                  {!isCurrentMonth && (
                    <button
                      type="button"
                      className="po-btn-current-month"
                      onClick={onCurrentMonth}
                      title="Quay về tháng hiện tại"
                    >
                      Hiện tại
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className={`po-month-nav-btn ${isCurrentMonth ? 'disabled' : ''}`}
                  onClick={onNextMonth}
                  disabled={isCurrentMonth}
                  title={isCurrentMonth ? 'Đang ở tháng hiện tại' : 'Tháng sau'}
                  aria-label="Tháng sau"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <div className="po-period-tabs" role="tablist">
              {(['week', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  className={`po-period-tab-btn ${period === p ? 'active' : ''}`}
                  onClick={() => onPeriodChange(p)}
                  type="button"
                >
                  {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dual Axis Composite SVG Chart */}
        <div
          className={`po-chart-container ${isLoading ? 'po-chart-loading' : ''}`}
          style={{ position: 'relative' }}
        >
          {rawPoints.length === 0 ? (
            <div className="po-empty-chart-box">
              <Inbox size={32} color="var(--po-text-subtle)" />
              <p>Chưa có dữ liệu đặt lịch trong kỳ này</p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="poBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F9A8B8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#FCD2DB" stopOpacity="0.25" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = padTop + drawHeight * (1 - pct / 100);
                const revLabel = (pct * maxRevMillion) / 100;
                const bookLabel = Math.round((pct * maxBooking) / 100);
                return (
                  <g key={pct}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeDasharray={pct === 0 ? 'none' : '4 4'}
                      strokeWidth={pct === 0 ? '1.5' : '1'}
                    />
                    {/* Left Y-axis (Revenue in Triệu) */}
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#9CA3AF"
                      fontSize="10"
                      fontFamily="Plus Jakarta Sans"
                    >
                      {revLabel >= 1 ? `${revLabel}tr` : `${revLabel * 1000}k`}
                    </text>
                    {/* Right Y-axis (Booking count) */}
                    <text
                      x={svgWidth - padRight + 8}
                      y={y + 4}
                      textAnchor="start"
                      fill="#9CA3AF"
                      fontSize="10"
                      fontFamily="Plus Jakarta Sans"
                    >
                      {bookLabel}
                    </text>
                  </g>
                );
              })}

              {/* Bars (Doanh thu) */}
              {points.map((pt, i) => {
                const barW = Math.max(
                  4,
                  Math.min(18, Math.floor(drawWidth / points.length) - 4),
                );
                return (
                  <rect
                    key={`bar-${i}`}
                    x={pt.x - barW / 2}
                    y={pt.barHeight > 0 ? pt.barY : padTop + drawHeight - 1}
                    width={barW}
                    height={Math.max(2, pt.barHeight)}
                    fill="url(#poBarGrad)"
                    rx={2.5}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.5}
                  />
                );
              })}

              {/* Line (Số booking) */}
              {points.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#851C33"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Dots on Line */}
              {points.map((pt, i) => (
                <circle
                  key={`dot-${i}`}
                  cx={pt.x}
                  cy={pt.yBook}
                  r={hoveredIdx === i ? 5 : 3.5}
                  fill="#851C33"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}

              {/* X-Axis Dates */}
              {points.map((pt, i) => {
                // Adaptive X-axis tick display
                const step =
                  points.length <= 7
                    ? 1
                    : points.length <= 15
                    ? 2
                    : points.length <= 31
                    ? 4
                    : 2;
                if (i % step !== 0 && i !== points.length - 1) return null;
                return (
                  <text
                    key={`x-${i}`}
                    x={pt.x}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    fill="#9CA3AF"
                    fontSize="10"
                    fontFamily="Plus Jakarta Sans"
                  >
                    {pt.label}
                  </text>
                );
              })}

              {/* Tooltip on Hover */}
              {hoveredIdx !== null && points[hoveredIdx] && (
                <g
                  transform={`translate(${Math.max(
                    0,
                    Math.min(svgWidth - 110, points[hoveredIdx].x - 55),
                  )}, ${Math.max(10, points[hoveredIdx].yBook - 48)})`}
                >
                  <rect
                    width="110"
                    height="42"
                    rx="6"
                    fill="#1F2937"
                    opacity="0.95"
                  />
                  <text
                    x="55"
                    y="16"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {points[hoveredIdx].label}:{' '}
                    {points[hoveredIdx].revenue.toLocaleString('vi-VN')} đ
                  </text>
                  <text
                    x="55"
                    y="32"
                    textAnchor="middle"
                    fill="#F9A8B8"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {points[hoveredIdx].bookings} lượt đặt lịch
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>

        {/* Legend */}
        <div className="po-chart-legend">
          <div className="po-legend-item">
            <span className="po-legend-pill-bar" />
            <span>Doanh thu thực tế</span>
          </div>
          <div className="po-legend-item">
            <span className="po-legend-pill-line" />
            <span>Số booking</span>
          </div>
        </div>
      </div>

      {/* 2. RIGHT CONTAINER: Upcoming Schedule */}
      <div className="po-card-box" id="list-upcoming-schedules">
        <div className="po-card-box-header">
          <div className="po-card-box-title">
            <h3>Lịch sắp tới</h3>
          </div>
          <button
            className="po-link-view-all"
            onClick={() => onNavigate?.('calendar')}
            type="button"
          >
            <span>Xem tất cả</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-schedule-list">
          {schedules.length === 0 ? (
            <div className="po-empty-schedule-state">
              <Calendar size={36} color="var(--po-text-subtle)" />
              <p className="po-empty-title">Chưa có lịch hẹn sắp tới</p>
              <p className="po-empty-subtitle">
                Khi khách hàng hoàn tất đặt lịch chụp hoặc thuê đồ, lịch hẹn sẽ
                xuất hiện tại đây.
              </p>
              <button
                className="po-btn-open-calendar"
                type="button"
                onClick={() => onNavigate?.('calendar')}
              >
                Mở lịch hẹn & ca làm
              </button>
            </div>
          ) : (
            schedules.map((item) => {
              const dateObj = new Date(item.startsAt);
              const dayStr = String(dateObj.getDate()).padStart(2, '0');
              const monthStr = `TH${String(dateObj.getMonth() + 1).padStart(
                2,
                '0',
              )}`;

              return (
                <div
                  className="po-schedule-item"
                  key={item.id}
                  onClick={() => onNavigate?.('calendar')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="po-schedule-left">
                    <div className="po-date-block">
                      <span className="po-date-block-day">{dayStr}</span>
                      <span className="po-date-block-month">{monthStr}</span>
                    </div>

                    {item.customer.avatarUrl ? (
                      <img
                        src={item.customer.avatarUrl}
                        alt={item.customer.name}
                        className="po-schedule-avatar"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            'none';
                        }}
                      />
                    ) : (
                      <div className="po-schedule-avatar-fallback">
                        {item.customer.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="po-schedule-info">
                      <span className="po-schedule-cust-name">
                        {item.customer.name}
                      </span>
                      <span className="po-schedule-service-name">
                        {item.serviceName}
                      </span>
                      <span className="po-schedule-time">{item.timeLabel}</span>
                    </div>
                  </div>

                  <div className="po-schedule-right">
                    <span className={`po-status-pill ${item.statusTone}`}>
                      <span
                        className={`po-dot ${
                          item.statusTone === 'amber'
                            ? 'po-dot-amber'
                            : item.statusTone === 'blue'
                            ? 'po-dot-rose'
                            : 'po-dot-green'
                        }`}
                      />
                      <span>{item.status}</span>
                    </span>
                    <button
                      className="po-action-menu-btn"
                      title="Thao tác"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('calendar');
                      }}
                      type="button"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
