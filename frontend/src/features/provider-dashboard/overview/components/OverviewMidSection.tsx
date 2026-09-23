import React, { useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

interface ScheduleItem {
  id?: string;
  day: string;
  month: string;
  customerName: string;
  avatarUrl?: string;
  serviceName: string;
  timeSlot: string;
  status: 'Sắp trả' | 'Đang thuê' | 'Đã xác nhận' | string;
  statusType: 'amber' | 'blue' | 'green' | string;
}

interface MidSectionProps {
  period: 'week' | 'month' | 'year';
  onPeriodChange: (p: 'week' | 'month' | 'year') => void;
  schedules?: any[];
  revenueData?: Array<{ label: string; value: number }>;
  onNavigate?: (view: any) => void;
}

export const OverviewMidSection: React.FC<MidSectionProps> = ({
  period,
  onPeriodChange,
  schedules: rawSchedules,
  revenueData: _revenueData,
  onNavigate,
}) => {
  const [selectedService, setSelectedService] = useState('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Mock sample schedule data matching Figma 323:7692 if rawSchedules is empty
  const defaultSchedules: ScheduleItem[] = [
    {
      id: 'sch-1',
      day: '28',
      month: 'TH07',
      customerName: 'Nguyễn Thị Mai',
      avatarUrl: '/figma-overview/avatar-mai.png',
      serviceName: 'Thuê áo dài truyền thống',
      timeSlot: '09:00 - 12:00',
      status: 'Sắp trả',
      statusType: 'amber',
    },
    {
      id: 'sch-2',
      day: '28',
      month: 'TH07',
      customerName: 'Trần Văn Nam',
      avatarUrl: '/figma-overview/avatar-nam.png',
      serviceName: 'Chụp ảnh ngoại cảnh Đại Nội',
      timeSlot: '14:30 - 17:30',
      status: 'Đang thuê',
      statusType: 'blue',
    },
    {
      id: 'sch-3',
      day: '29',
      month: 'TH07',
      customerName: 'Lê Thị Thu Hà',
      avatarUrl: '/figma-overview/avatar-ha.png',
      serviceName: 'Combo Áo dài & Gói Chụp',
      timeSlot: '08:00 - 11:30',
      status: 'Đã xác nhận',
      statusType: 'green',
    },
    {
      id: 'sch-4',
      day: '30',
      month: 'TH07',
      customerName: 'Phạm Đức Duy',
      avatarUrl: '/figma-overview/avatar-duy.png',
      serviceName: 'Thuê Cổ phục Nhật Bình',
      timeSlot: '10:00 - 15:00',
      status: 'Đã xác nhận',
      statusType: 'green',
    },
  ];

  const scheduleList: ScheduleItem[] = (rawSchedules && rawSchedules.length > 0)
    ? rawSchedules.slice(0, 4).map((s, idx) => {
        const parts = (s.date || '').split('/');
        return {
          id: `raw-${idx}`,
          day: parts[0] || '28',
          month: `TH${parts[1] || '07'}`,
          customerName: s.customerName || 'Khách hàng',
          serviceName: s.serviceName || 'Dịch vụ đặt lịch',
          timeSlot: s.time || '09:00 - 12:00',
          status: s.status || 'Đã xác nhận',
          statusType: s.color === 'deposit' ? 'green' : 'amber',
        };
      })
    : defaultSchedules;

  // Chart data setup (28 days or weekly buckets matching Figma)
  const chartPoints = [
    { label: '01/07', rev: 42, booking: 12 },
    { label: '03/07', rev: 48, booking: 14 },
    { label: '05/07', rev: 55, booking: 16 },
    { label: '08/07', rev: 68, booking: 22 },
    { label: '10/07', rev: 72, booking: 24 },
    { label: '12/07', rev: 80, booking: 26 },
    { label: '15/07', rev: 70, booking: 21 },
    { label: '18/07', rev: 85, booking: 28 },
    { label: '20/07', rev: 92, booking: 32 },
    { label: '22/07', rev: 78, booking: 25 },
    { label: '25/07', rev: 88, booking: 29 },
    { label: '28/07', rev: 96, booking: 34 },
    { label: '29/07', rev: 84, booking: 27 },
  ];

  // SVG Chart Geometry Constants
  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 40;
  const padTop = 20;
  const padBottom = 30;
  const drawWidth = svgWidth - padLeft - padRight;
  const drawHeight = svgHeight - padTop - padBottom;

  const maxRev = 100;
  const maxBooking = 40;

  // Calculate coordinates
  const points = chartPoints.map((pt, idx) => {
    const x = padLeft + idx * (drawWidth / (chartPoints.length - 1));
    const yRev = padTop + drawHeight * (1 - pt.rev / maxRev);
    const yBook = padTop + drawHeight * (1 - pt.booking / maxBooking);
    const barHeight = drawHeight * (pt.rev / maxRev);
    const barY = padTop + drawHeight - barHeight;
    return { ...pt, x, yRev, yBook, barY, barHeight };
  });

  // SVG Path for Booking Line
  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x},${curr.yBook}` : `${acc} L ${curr.x},${curr.yBook}`;
  }, '');

  return (
    <section className="po-mid-section-grid" aria-label="Biểu đồ và lịch">
      {/* 1. LEFT CONTAINER (7 Cols): Dual-Axis Chart */}
      <div className="po-card-box" id="chart-booking-revenue">
        <div className="po-card-box-header">
          <div className="po-card-box-title">
            <h3>Booking & Doanh thu</h3>
            <p>Biểu đồ thể hiện số lượng booking và doanh thu theo thời gian</p>
          </div>

          <div className="po-chart-controls">
            <select
              className="po-service-select"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              aria-label="Chọn dịch vụ"
            >
              <option value="all">Tất cả dịch vụ</option>
              <option value="aodai">Thuê áo dài</option>
              <option value="photo">Gói chụp ảnh</option>
            </select>

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
        <div className="po-chart-container">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="poBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F9A8B8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#FCD2DB" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = padTop + drawHeight * (1 - pct / 100);
              const revLabel = (pct * maxRev) / 100;
              const bookLabel = (pct * maxBooking) / 100;
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
                  {/* Left Y-axis (Revenue) */}
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#9CA3AF"
                    fontSize="10"
                    fontFamily="Plus Jakarta Sans"
                  >
                    {revLabel}
                  </text>
                  {/* Right Y-axis (Booking) */}
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
            {points.map((pt, i) => (
              <rect
                key={`bar-${i}`}
                x={pt.x - 7}
                y={pt.barY}
                width={14}
                height={pt.barHeight}
                fill="url(#poBarGrad)"
                rx={3}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.6}
              />
            ))}

            {/* Line (Số booking) */}
            <path
              d={linePath}
              fill="none"
              stroke="#851C33"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

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
              if (i % 3 !== 0 && i !== points.length - 1) return null;
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
            {hoveredIdx !== null && (
              <g transform={`translate(${points[hoveredIdx].x - 45}, ${points[hoveredIdx].yBook - 45})`}>
                <rect width="90" height="36" rx="6" fill="#1F2937" opacity="0.95" />
                <text x="45" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="600">
                  {points[hoveredIdx].label}: {points[hoveredIdx].rev} tr
                </text>
                <text x="45" y="28" textAnchor="middle" fill="#F9A8B8" fontSize="9" fontWeight="600">
                  {points[hoveredIdx].booking} bookings
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="po-chart-legend">
          <div className="po-legend-item">
            <span className="po-legend-pill-bar" />
            <span>Doanh thu (triệu)</span>
          </div>
          <div className="po-legend-item">
            <span className="po-legend-pill-line" />
            <span>Số booking</span>
          </div>
        </div>
      </div>

      {/* 2. RIGHT CONTAINER (5 Cols): Upcoming Schedule */}
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
          {scheduleList.map((item) => (
            <div className="po-schedule-item" key={item.id}>
              <div className="po-schedule-left">
                <div className="po-date-block">
                  <span className="po-date-block-day">{item.day}</span>
                  <span className="po-date-block-month">{item.month}</span>
                </div>

                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt={item.customerName}
                    className="po-schedule-avatar"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="po-schedule-avatar-fallback">
                    {item.customerName.charAt(0)}
                  </div>
                )}

                <div className="po-schedule-info">
                  <span className="po-schedule-cust-name">{item.customerName}</span>
                  <span className="po-schedule-service-name">{item.serviceName}</span>
                  <span className="po-schedule-time">{item.timeSlot}</span>
                </div>
              </div>

              <div className="po-schedule-right">
                <span className={`po-status-pill ${item.statusType}`}>
                  <span
                    className={`po-dot ${
                      item.statusType === 'amber'
                        ? 'po-dot-amber'
                        : item.statusType === 'blue'
                        ? 'po-dot-rose'
                        : 'po-dot-green'
                    }`}
                  />
                  <span>{item.status}</span>
                </span>
                <button
                  className="po-action-menu-btn"
                  title="Thao tác"
                  onClick={() => onNavigate?.('calendar')}
                  type="button"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
