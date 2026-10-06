import React from 'react';
import {
  CalendarCheck,
  Package,
  MessageSquare,
  Clock,
  ChevronRight,
  DollarSign,
  Star,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type {
  ProviderOverviewRecentActivity,
  ProviderOverviewTask,
  ProviderOverviewTopService,
} from '../types';

interface ThreeColumnsProps {
  tasks?: ProviderOverviewTask[];
  topServices?: ProviderOverviewTopService[];
  activities?: ProviderOverviewRecentActivity[];
  isLoading?: boolean;
  onNavigate?: (view: any) => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 30) return `${diffDay} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  } catch {
    return 'Gần đây';
  }
}

export const OverviewThreeColumns: React.FC<ThreeColumnsProps> = ({
  tasks = [],
  topServices = [],
  activities = [],
  onNavigate,
}) => {
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'CONFIRM_BOOKING':
        return <CalendarCheck size={16} />;
      case 'RETURN_OVERDUE':
        return <AlertTriangle size={16} color="#DC2626" />;
      case 'RETURN_DUE':
        return <Package size={16} />;
      case 'SHOOT_TODAY':
        return <Clock size={16} />;
      case 'UNREAD_NOTIFICATIONS':
        return <MessageSquare size={16} />;
      default:
        return <Sparkles size={16} />;
    }
  };

  const getTaskBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return { text: 'Gấp', className: 'urgent' };
      case 'today':
        return { text: 'Hôm nay', className: 'today' };
      default:
        return { text: 'Mới', className: 'pending' };
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT_PAID':
        return <DollarSign size={16} />;
      case 'CONFIRMED':
      case 'COMPLETED':
        return <CheckCircle2 size={16} />;
      case 'PICKED_UP':
      case 'RETURNED':
        return <Package size={16} />;
      case 'CANCELLED':
        return <RotateCcw size={16} />;
      default:
        return <Star size={16} />;
    }
  };

  return (
    <section
      className="po-three-columns-grid"
      aria-label="Nhiệm vụ, dịch vụ và hoạt động"
    >
      {/* CỘT 1: Việc cần làm hôm nay */}
      <div className="po-column-card" id="col-tasks-today">
        <div className="po-column-header">
          <h3>Việc cần làm hôm nay</h3>
          <button
            className="po-link-view-all"
            onClick={() => onNavigate?.('orders')}
            type="button"
          >
            <span>Xem tất cả</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-task-list">
          {tasks.length === 0 ? (
            <div className="po-column-empty">
              <CheckCircle2 size={32} color="#10B981" />
              <p className="po-empty-text-main">Không còn việc cần xử lý 🎉</p>
              <span className="po-empty-text-sub">
                Tất cả đơn hàng và lịch hẹn đều đã được phản hồi kịp thời.
              </span>
            </div>
          ) : (
            tasks.map((task) => {
              const badge = getTaskBadge(task.urgency);
              return (
                <div
                  key={task.id}
                  className="po-task-row"
                  onClick={() => onNavigate?.(task.targetView)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="po-task-left">
                    <div className="po-task-icon-circle">
                      {getTaskIcon(task.type)}
                    </div>
                    <div className="po-task-text">
                      <span className="po-task-title">{task.title}</span>
                      <span className="po-task-desc">{task.description}</span>
                    </div>
                  </div>
                  <span className={`po-task-badge ${badge.className}`}>
                    {badge.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CỘT 2: Dịch vụ hàng đầu */}
      <div className="po-column-card" id="col-top-services">
        <div className="po-column-header">
          <h3>Dịch vụ hàng đầu</h3>
          <button
            className="po-link-view-all"
            onClick={() => onNavigate?.('collections')}
            type="button"
          >
            <span>Xem kho đồ</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-service-list">
          {topServices.length === 0 ? (
            <div className="po-column-empty">
              <Package size={32} color="var(--po-text-subtle)" />
              <p className="po-empty-text-main">Chưa có dịch vụ phát sinh doanh thu</p>
              <span className="po-empty-text-sub">
                Đăng thêm mẫu áo dài hoặc gói chụp ảnh để thu hút khách hàng.
              </span>
            </div>
          ) : (
            topServices.map((service, idx) => {
              const rankClass =
                idx === 0
                  ? 'rank-1'
                  : idx === 1
                  ? 'rank-2'
                  : idx === 2
                  ? 'rank-3'
                  : 'rank-other';

              const formattedRev =
                service.revenue >= 1_000_000
                  ? `${(service.revenue / 1_000_000).toFixed(1)} tr`
                  : service.revenue >= 1_000
                  ? `${(service.revenue / 1_000).toFixed(0)} k`
                  : `${service.revenue} đ`;

              return (
                <div key={service.id} className="po-service-row">
                  <div className="po-service-left">
                    <span className={`po-rank-badge ${rankClass}`}>{idx + 1}</span>
                    {service.image ? (
                      <img
                        src={service.image}
                        alt={service.name}
                        className="po-product-thumb"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            'none';
                        }}
                      />
                    ) : (
                      <div className="po-product-thumb-fallback">
                        <Package size={16} />
                      </div>
                    )}
                    <div className="po-product-info">
                      <span className="po-product-name">{service.name}</span>
                      <span className="po-product-count">
                        {service.bookings} lượt{' '}
                        {service.kind === 'PRODUCT' ? 'thuê' : 'chụp'}
                      </span>
                    </div>
                  </div>

                  <div className="po-service-right">
                    <span className="po-product-revenue">{formattedRev}</span>
                    <div className="po-product-progress-bar">
                      <div
                        className="po-product-progress-fill"
                        style={{ width: `${Math.max(10, service.sharePct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CỘT 3: Hoạt động gần đây */}
      <div className="po-column-card" id="col-recent-activities">
        <div className="po-column-header">
          <h3>Hoạt động gần đây</h3>
          <button
            className="po-link-view-all"
            onClick={() => onNavigate?.('orders')}
            type="button"
          >
            <span>Tất cả đơn</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-activity-list">
          {activities.length === 0 ? (
            <div className="po-column-empty">
              <Clock size={32} color="var(--po-text-subtle)" />
              <p className="po-empty-text-main">Chưa có hoạt động mới</p>
              <span className="po-empty-text-sub">
                Các sự kiện đơn hàng và thông báo mới sẽ được ghi nhận tại đây.
              </span>
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="po-activity-row"
                onClick={() => onNavigate?.('orders')}
                style={{ cursor: 'pointer' }}
              >
                <div className="po-activity-left">
                  <div className="po-activity-icon">
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="po-activity-text">
                    <span className="po-activity-title">{act.title}</span>
                    <span className="po-activity-desc">{act.description}</span>
                  </div>
                </div>
                <span className="po-activity-time">
                  {formatRelativeTime(act.occurredAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
