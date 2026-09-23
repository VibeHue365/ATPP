import React, { type ComponentType } from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface OverviewKpiCardProps {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number; color?: string }>;
  iconBg: string;
  iconColor: string;
  growth: number;
  growthType: 'up-green' | 'up-red';
  growthDesc?: string;
  breakdown?: string;
  onClick?: () => void;
}

export const OverviewKpiCard: React.FC<OverviewKpiCardProps> = ({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  growth,
  growthType,
  growthDesc = 'so với tháng trước',
  breakdown,
  onClick,
}) => {
  return (
    <div
      className="lume-kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="lume-kpi-card__top">
        <span className="lume-kpi-card__label">{label}</span>
        <div
          className="lume-kpi-card__icon-bubble"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={18} color={iconColor} />
        </div>
      </div>

      <div className="lume-kpi-card__value">{value}</div>

      <div className="lume-kpi-card__footer">
        <span
          className={`lume-kpi-card__trend ${
            growthType === 'up-green'
              ? 'lume-kpi-card__trend--up-green'
              : 'lume-kpi-card__trend--up-red'
          }`}
        >
          <ArrowUpRight size={13} strokeWidth={2.5} />
          {growth.toFixed(1)}%
        </span>
        <span className="lume-kpi-card__trend-desc">{growthDesc}</span>
      </div>

      {breakdown && (
        <div className="lume-kpi-card__breakdown">{breakdown}</div>
      )}
    </div>
  );
};
