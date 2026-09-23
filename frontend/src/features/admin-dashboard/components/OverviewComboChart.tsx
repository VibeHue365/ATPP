import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OverviewChartPoint } from '../hooks/useAdminOverviewData';

export interface OverviewComboChartProps {
  period: 'day' | 'week' | 'month';
  onPeriodChange: (p: 'day' | 'week' | 'month') => void;
  summaryBookings: number;
  summaryGmv: number;
  points: OverviewChartPoint[];
}

export const OverviewComboChart: React.FC<OverviewComboChartProps> = ({
  period,
  onPeriodChange,
  summaryBookings,
  summaryGmv,
  points,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG Coordinate mapping
  const width = 640;
  const height = 240;
  const padLeft = 45;
  const padRight = 50;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxBookings = 600;
  const maxGmv = 120; // in Millions

  const stepX = points.length > 1 ? chartW / (points.length - 1) : chartW;

  // Build SVG path for GMV line
  const gmvCoords = points.map((p, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + chartH - (Math.min(p.gmvMillions, maxGmv) / maxGmv) * chartH;
    return { x, y, point: p };
  });

  const linePath = gmvCoords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1];
    // Smooth cubic bezier
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, '');

  const formatGmvString = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
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

          <button type="button" className="lume-dropdown-trigger">
            <span>Tháng 09/2024</span>
            <ChevronDown size={14} />
          </button>
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
            <span className="lume-chart-summary-item__trend">▲ 12.3%</span>
          </div>
        </div>

        <div className="lume-chart-summary-item">
          <div className="lume-chart-summary-item__label">
            <i style={{ backgroundColor: '#6B1D2F' }} />
            <span>Tổng giá trị giao dịch (GMV)</span>
          </div>
          <div className="lume-chart-summary-item__value">
            <span className="lume-chart-summary-item__number">
              {formatGmvString(summaryGmv)}
            </span>
            <span className="lume-chart-summary-item__trend">▲ 18.6%</span>
          </div>
        </div>
      </div>

      <div className="lume-combo-chart-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="lume-combo-chart-svg"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padTop + chartH * ratio;
            const leftVal = Math.round(maxBookings * (1 - ratio));
            const rightVal = Math.round(maxGmv * (1 - ratio));

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
                  {leftVal}
                </text>
                <text
                  x={width - padRight + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="#9CA3AF"
                  fontWeight="600"
                >
                  {rightVal}tr
                </text>
              </g>
            );
          })}

          {/* Bars for bookings */}
          {points.map((p, i) => {
            const barW = 14;
            const barH = (Math.min(p.bookings, maxBookings) / maxBookings) * chartH;
            const x = padLeft + i * stepX - barW / 2;
            const y = padTop + chartH - barH;
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={p.day}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={isHovered ? '#E06D75' : '#F4A6AC'}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* X Axis label */}
                <text
                  x={x + barW / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? '#4A121A' : '#9CA3AF'}
                  fontWeight={isHovered ? '700' : '500'}
                >
                  {p.day}
                </text>
              </g>
            );
          })}

          {/* Smooth Line for GMV */}
          <path
            d={linePath}
            fill="none"
            stroke="#6B1D2F"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* GMV points */}
          {gmvCoords.map((coord, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={coord.point.day}
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

        {/* Hover Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="lume-chart-tooltip"
            style={{
              left: `${((padLeft + hoveredIdx * stepX) / width) * 100}%`,
              top: '40%',
            }}
          >
            <strong>Ngày {points[hoveredIdx].day}/09</strong>
            <div>
              <span style={{ color: '#F4A6AC' }}>●</span>
              <span>Booking: {points[hoveredIdx].bookings} đơn</span>
            </div>
            <div>
              <span style={{ color: '#F4A6AC' }}>●</span>
              <span>GMV: {points[hoveredIdx].gmvMillions}.000.000đ</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
