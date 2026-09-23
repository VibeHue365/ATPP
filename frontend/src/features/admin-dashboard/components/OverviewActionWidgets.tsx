import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react';
import type {
  ActivityFeedItem,
  PartnerRanking,
  PendingTaskItem,
  SystemAlertItem,
} from '../hooks/useAdminOverviewData';

export interface OverviewActionWidgetsProps {
  tasks: PendingTaskItem[];
  topPartners: PartnerRanking[];
  activities: ActivityFeedItem[];
  alerts: {
    warnings: SystemAlertItem[];
    critical: SystemAlertItem[];
  };
  onNavigateTab?: (tab: string) => void;
}

export const OverviewActionWidgets: React.FC<OverviewActionWidgetsProps> = ({
  tasks,
  topPartners,
  activities,
  alerts,
  onNavigateTab,
}) => {
  const getActivityIcon = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'booking':
        return { icon: ShoppingBag, color: '#2563EB', bg: '#EFF6FF' };
      case 'product':
        return { icon: Store, color: '#D97706', bg: '#FEF3C7' };
      case 'refund':
        return { icon: RotateCcw, color: '#DC2626', bg: '#FEE2E2' };
      case 'verification':
        return { icon: CheckCircle2, color: '#059669', bg: '#ECFDF5' };
      case 'dispute':
        return { icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2' };
      default:
        return { icon: User, color: '#4B5563', bg: '#F3F4F6' };
    }
  };

  return (
    <div className="lume-widgets-grid">
      {/* 1. Công việc cần xử lý */}
      <div className="lume-widget-card">
        <div className="lume-widget-card__header">
          <h4 className="lume-widget-card__title">
            <Clock size={16} color="#4A121A" />
            <span>Công việc cần xử lý</span>
          </h4>
          <button
            type="button"
            className="lume-widget-card__view-all"
            onClick={() => onNavigateTab?.('bookings')}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="lume-widget-card__list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="lume-task-row"
              onClick={() => onNavigateTab?.(task.tab)}
              role="button"
              tabIndex={0}
            >
              <span className="lume-task-row__text">{task.title}</span>
              <span
                className={`lume-task-row__badge ${
                  task.variant === 'red'
                    ? 'lume-task-row__badge--red'
                    : 'lume-task-row__badge--amber'
                }`}
              >
                {task.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Top đối tác theo booking */}
      <div className="lume-widget-card">
        <div className="lume-widget-card__header">
          <h4 className="lume-widget-card__title">
            <Store size={16} color="#4A121A" />
            <span>Top đối tác theo booking</span>
          </h4>
          <button
            type="button"
            className="lume-widget-card__view-all"
            onClick={() => onNavigateTab?.('providers')}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="lume-widget-card__list">
          {topPartners.map((partner) => (
            <div key={partner.rank} className="lume-partner-row">
              <div className="lume-partner-row__info">
                <span
                  className={`lume-rank-badge ${
                    partner.rank === 1
                      ? 'lume-rank-badge--1'
                      : partner.rank === 2
                      ? 'lume-rank-badge--2'
                      : partner.rank === 3
                      ? 'lume-rank-badge--3'
                      : 'lume-rank-badge--other'
                  }`}
                >
                  {partner.rank}
                </span>

                <img
                  src={partner.avatar}
                  alt={partner.name}
                  className="lume-partner-avatar"
                  onError={(e) => {
                    // Fallback to a solid color if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                <span className="lume-partner-name">{partner.name}</span>
              </div>

              <span className="lume-partner-bookings">
                {partner.bookings} booking
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Hoạt động gần đây */}
      <div className="lume-widget-card">
        <div className="lume-widget-card__header">
          <h4 className="lume-widget-card__title">
            <ShoppingBag size={16} color="#4A121A" />
            <span>Hoạt động gần đây</span>
          </h4>
          <button
            type="button"
            className="lume-widget-card__view-all"
            onClick={() => onNavigateTab?.('notifications')}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="lume-widget-card__list">
          {activities.map((act) => {
            const style = getActivityIcon(act.type);
            const Icon = style.icon;
            return (
              <div key={act.id} className="lume-activity-item">
                <div
                  className="lume-activity-icon-bubble"
                  style={{ backgroundColor: style.bg }}
                >
                  <Icon size={14} color={style.color} />
                </div>
                <div className="lume-activity-content">
                  <div>
                    <strong>{act.actor}</strong> {act.action}
                  </div>
                  <span className="lume-activity-time">{act.timeAgo}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Cảnh báo hệ thống */}
      <div className="lume-widget-card">
        <div className="lume-widget-card__header">
          <h4 className="lume-widget-card__title">
            <AlertCircle size={16} color="#DC2626" />
            <span>Cảnh báo hệ thống</span>
          </h4>
          <button
            type="button"
            className="lume-widget-card__view-all"
            onClick={() => onNavigateTab?.('disputes')}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="lume-widget-card__list">
          {/* Mức độ cảnh báo (Amber) */}
          <div className="lume-alert-section">
            <div className="lume-alert-section__title lume-alert-section__title--amber">
              <AlertTriangle size={12} />
              <span>Mức độ cảnh báo</span>
            </div>
            {alerts.warnings.map((alert) => (
              <div key={alert.id} className="lume-alert-item lume-alert-item--amber">
                <span>{alert.title}</span>
                <strong>{alert.count}</strong>
              </div>
            ))}
          </div>

          {/* Mức độ khẩn cấp (Red) */}
          <div className="lume-alert-section">
            <div className="lume-alert-section__title lume-alert-section__title--red">
              <AlertCircle size={12} />
              <span>Mức độ khẩn cấp</span>
            </div>
            {alerts.critical.map((alert) => (
              <div key={alert.id} className="lume-alert-item lume-alert-item--red">
                <span>{alert.title}</span>
                <strong>{alert.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
