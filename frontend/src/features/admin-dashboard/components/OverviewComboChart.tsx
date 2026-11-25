import React, { useMemo, useState } from 'react';
import type { OverviewChartPoint } from '../hooks/useAdminOverviewData';
import { computeNiceScale, formatCompactVnd, formatExactVnd } from '../utils/chartScale';

export interface OverviewComboChartProps {
  period: 'day' | 'week' | 'month';
  onPeriodChange: (p: 'day' | 'week' | 'month') => void;
  periodLabel?: string;
  summaryBookings: number;
  summaryGmv: number;
  bookingGrowthPct?: number;
  gmvGrowthPct?: number;
  points: OverviewChartPoint[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  monthOptions: Array<{ value: string; label: string }>;
}

export const OverviewComboChart: React.FC<OverviewComboChartProps> = ({
  period,
  onPeriodChange,
  periodLabel,
  summaryBookings,
  summaryGmv,
  bookingGrowthPct = 0,
  gmvGrowthPct = 0,
  points,
  selectedMonth,
  onMonthChange,
  monthOptions,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG Coordinate mapping
  const width = 640;
  const height = 240;
  const padLeft = 44;
  const padRight = 54;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const resolvedPoints = useMemo(
    () =>
      points.map((p) => {
        const gmvVnd =
          typeof p.gmv === 'number' && Number.isFinite(p.gmv)
            ? p.gmv
            : Math.round((p.gmvMillions ?? 0) * 1_000_000);
        return {
          ...p,
          displayLabel: p.label || p.day,
          tooltipLabel:
            p.fullLabel ||
            (period === 'day'
              ? `Khung ${p.day}`
              : period === 'week'
                ? `Ngày ${p.day}`
                : `Ngày ${p.day}`),
          gmvVnd,
        };
      }),
    [points, period],
  );

  const rawMaxBookings = Math.max(0, ...resolvedPoints.map((p) => p.bookings ?? 0));
  const rawMaxGmv = Math.max(0, ...resolvedPoints.map((p) => p.gmvVnd));

  const bookingScale = useMemo(
    () => computeNiceScale(rawMaxBookings, 4, { integerOnly: true, minMax: 4 }),
    [rawMaxBookings],
  );
  const gmvScale = useMemo(
    () => computeNiceScale(rawMaxGmv, 4, { minMax: 400_000 }),
    [rawMaxGmv],
  );

  const stepX =
    resolvedPoints.length > 1 ? chartW / (resolvedPoints.length - 1) : 0;
  const xForIndex = (idx: number) =>
    resolvedPoints.length === 1 ? padLeft + chartW / 2 : padLeft + idx * stepX;

  const barW =
    resolvedPoints.length <= 1
      ? 28
      : Math.max(8, Math.min(24, (chartW / resolvedPoints.length) * 0.58));
  const hitColW =
    resolvedPoints.length <= 1
      ? chartW
      : Math.max(16, chartW / resolvedPoints.length);

  const labelInterval =
    resolvedPoints.length > 20 ? 3 : resolvedPoints.length > 12 ? 2 : 1;

  // Build SVG path for GMV line
  const gmvCoords = resolvedPoints.map((p, i) => {
    const x = xForIndex(i);
    const y =
      padTop +
      chartH -
      (Math.min(p.gmvVnd, gmvScale.max) / (gmvScale.max || 1)) * chartH;
    return { x, y, point: p };
  });

  const linePath = gmvCoords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, '');

  const resolvedPeriodLabel =
    periodLabel ||
    (period === 'day'
      ? 'Hôm nay'
      : period === 'week'
        ? '7 ngày gần nhất'
        : 'Tháng hiện tại');

  const renderTrendBadge = (pct: number) => {
    const safePct = Number.isFinite(pct) ? pct : 0;
    const isNegative = safePct < 0;
    const isZero = safePct === 0;
    return (
      <span
        className="lume-chart-summary-item__trend"
        style={{
          color: isNegative ? '#DC2626' : isZero ? '#6B7280' : '#059669',
        }}
      >
        {isNegative ? '▼' : isZero ? '•' : '▲'} {Math.abs(safePct).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="lume-chart-card">
      <div className="lume-chart-card__header">
        <div className="lume-chart-card__title-group">
          <h3>Booking & Giá trị giao dịch</h3>
          <p>Số lượng booking và GMV theo thời gian</p>
        </div>

        <div className="lume-chart-card__controls">
          <div className="lume-pill-tabs">
            <button
              type="button"
              className={`lume-pill-tab ${period === 'day' ? 'is-active' : ''}`}
              onClick={() => onPeriodChange('day')}
            >
              Ngày
            </button>
            <button
              type="button"
              className={`lume-pill-tab ${period === 'week' ? 'is-active' : ''}`}
              onClick={() => onPeriodChange('week')}
            >
              Tuần
            </button>
            <button
              type="button"
              className={`lume-pill-tab ${period === 'month' ? 'is-active' : ''}`}
              onClick={() => onPeriodChange('month')}
            >
              Tháng
            </button>
          </div>

          <select className="lume-dropdown-trigger" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)} aria-label="Chọn tháng thống kê" title={resolvedPeriodLabel}>
            {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="lume-chart-summary-badges">
        <div className="lume-chart-summary-item">
          <div className="lume-chart-summary-item__label">
            <i style={{ backgroundColor: '#F4A6AC' }} />
            <span>Tổng booking</span>
          </div>
          <div className="lume-chart-summary-item__value">
            <span className="lume-chart-summary-item__number">
              {new Intl.NumberFormat('vi-VN').format(summaryBookings)}
            </span>
            {renderTrendBadge(bookingGrowthPct)}
          </div>
        </div>

        <div className="lume-chart-summary-item">
          <div className="lume-chart-summary-item__label">
            <i style={{ backgroundColor: '#6B1D2F' }} />
            <span>Tổng giá trị giao dịch (GMV)</span>
          </div>
          <div className="lume-chart-summary-item__value">
            <span className="lume-chart-summary-item__number">
              {formatExactVnd(summaryGmv)}
            </span>
            {renderTrendBadge(gmvGrowthPct)}
          </div>
        </div>
      </div>

      <div className="lume-combo-chart-wrapper">
        {resolvedPoints.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: '13px',
            }}
          >
            Chưa có dữ liệu giao dịch trong khoảng thời gian này.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="lume-combo-chart-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {bookingScale.ticks.map((leftVal, idx) => {
              const ratio = idx / (bookingScale.ticks.length - 1 || 1);
              const y = padTop + chartH * ratio;
              const rightVal = gmvScale.ticks[idx] ?? 0;

              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#F3F4F6"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#9CA3AF"
                    fontWeight="600"
                  >
                    {new Intl.NumberFormat('vi-VN').format(leftVal)}
                  </text>
                  <text
                    x={width - padRight + 8}
                    y={y + 4}
                    textAnchor="start"
                    fontSize="10"
                    fill="#9CA3AF"
                    fontWeight="600"
                  >
                    {formatCompactVnd(rightVal)}
                  </text>
                </g>
              );
            })}

            {/* Bars for bookings + full-height hit columns */}
            {resolvedPoints.map((p, i) => {
              const cx = xForIndex(i);
              const barH =
                (Math.min(p.bookings, bookingScale.max) / (bookingScale.max || 1)) *
                chartH;
              const x = cx - barW / 2;
              const y = padTop + chartH - barH;
              const isHovered = hoveredIdx === i;
              const showXLabel =
                isHovered ||
                i === 0 ||
                i === resolvedPoints.length - 1 ||
                i % labelInterval === 0;

              return (
                <g
                  key={`${p.day}-${i}`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={cx - hitColW / 2}
                    y={padTop}
                    width={hitColW}
                    height={chartH}
                    fill="transparent"
                  />
                  {barH > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={Math.min(4, barW / 2)}
                      fill={isHovered ? '#E06D75' : '#F4A6AC'}
                      opacity={isHovered ? 1 : 0.85}
                      style={{ transition: 'all 0.2s' }}
                    />
                  )}
                  {showXLabel && (
                    <text
                      x={cx}
                      y={height - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isHovered ? '#4A121A' : '#9CA3AF'}
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {p.displayLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Smooth Line for GMV */}
            {gmvCoords.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke="#6B1D2F"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )}

            {/* GMV points */}
            {gmvCoords.map((coord, i) => {
              const isHovered = hoveredIdx === i;
              return (
                <circle
                  key={`${coord.point.day}-${i}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#FFFFFF"
                  stroke="#6B1D2F"
                  strokeWidth={2.5}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                />
              );
            })}
          </svg>
        )}

        {/* Hover Tooltip */}
        {hoveredIdx !== null && resolvedPoints[hoveredIdx] && (
          <div
            className="lume-chart-tooltip"
            style={{
              left: `${Math.min(86, Math.max(14, (xForIndex(hoveredIdx) / width) * 100))}%`,
              top: '38%',
            }}
          >
            <strong>{resolvedPoints[hoveredIdx].tooltipLabel}</strong>
            <div>
              <span style={{ color: '#F4A6AC' }}>●</span>
              <span>Booking: {resolvedPoints[hoveredIdx].bookings} đơn</span>
            </div>
            <div>
              <span style={{ color: '#D9778A' }}>●</span>
              <span>GMV: {formatExactVnd(resolvedPoints[hoveredIdx].gmvVnd)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
