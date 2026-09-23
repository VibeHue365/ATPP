import React from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { ServiceShareItem } from '../hooks/useAdminOverviewData';

export interface OverviewServiceDonutProps {
  total: number;
  items: ServiceShareItem[];
}

export const OverviewServiceDonut: React.FC<OverviewServiceDonutProps> = ({
  total,
  items,
}) => {
  const radius = 68;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="lume-chart-card">
      <div className="lume-chart-card__header">
        <div className="lume-chart-card__title-group">
          <h3>Cơ cấu dịch vụ</h3>
          <p>Tỷ lệ booking theo loại hình dịch vụ</p>
        </div>

        <div className="lume-chart-card__controls">
          <button type="button" className="lume-dropdown-trigger">
            <span>Tháng này</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="lume-donut-content">
        <div className="lume-donut-svg-box">
          <svg viewBox="0 0 170 170" width="100%" height="100%">
            <circle
              cx="85"
              cy="85"
              r={radius}
              fill="transparent"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
            />

            {items.map((item) => {
              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += item.percentage;

              return (
                <circle
                  key={item.id}
                  cx="85"
                  cy="85"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 85 85)"
                  style={{
                    transition: 'stroke-dasharray 0.5s ease',
                  }}
                />
              );
            })}
          </svg>

          <div className="lume-donut-center-label">
            <span>Tổng booking</span>
            <strong>{new Intl.NumberFormat('vi-VN').format(total)}</strong>
          </div>
        </div>

        <div className="lume-donut-legend">
          {items.map((item) => (
            <div key={item.id} className="lume-donut-legend__item">
              <div className="lume-donut-legend__left">
                <span
                  className="lume-donut-legend__dot"
                  style={{ backgroundColor: item.color }}
                />
                <span className="lume-donut-legend__name">{item.name}</span>
              </div>

              <div className="lume-donut-legend__right">
                <span className="lume-donut-legend__count">
                  {new Intl.NumberFormat('vi-VN').format(item.count)}
                </span>
                <span className="lume-donut-legend__pct">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lume-donut-footer-note">
        <Sparkles size={14} color="#B89047" />
        <span>Doanh số tăng trưởng đều ở phân khúc Cho thuê Áo Dài</span>
      </div>
    </div>
  );
};
