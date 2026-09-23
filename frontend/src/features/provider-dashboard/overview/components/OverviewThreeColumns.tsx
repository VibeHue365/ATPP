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
} from 'lucide-react';

interface ThreeColumnsProps {
  pendingOrdersCount?: number;
  rentalsDueCount?: number;
  unreadNotisCount?: number;
  popularProducts?: Array<{ name: string; image?: string; count: number }>;
  notifications?: Array<{ _id: string; title?: string; message?: string; createdAt: string }>;
  onNavigate?: (view: any) => void;
}

export const OverviewThreeColumns: React.FC<ThreeColumnsProps> = ({
  pendingOrdersCount = 5,
  rentalsDueCount = 1,
  unreadNotisCount = 3,
  popularProducts,
  notifications,
  onNavigate,
}) => {
  // Default to-do items matching Figma 323:7692
  const tasks = [
    {
      id: 'task-1',
      icon: <CalendarCheck size={16} />,
      title: `${pendingOrdersCount} đơn đặt lịch chờ xác nhận`,
      desc: 'Cần phản hồi trong 2 giờ',
      badge: 'Gấp',
      badgeClass: 'urgent',
      view: 'orders',
    },
    {
      id: 'task-2',
      icon: <Package size={16} />,
      title: `${rentalsDueCount} đơn thuê áo dài đến hạn trả`,
      desc: 'Khách: Nguyễn Thị Mai',
      badge: 'Hôm nay',
      badgeClass: 'today',
      view: 'rental-operations',
    },
    {
      id: 'task-3',
      icon: <MessageSquare size={16} />,
      title: `${unreadNotisCount} tin nhắn mới từ khách hàng`,
      desc: 'Khách đang quan tâm gói chụp',
      badge: 'Mới',
      badgeClass: 'pending',
      view: 'notifications',
    },
    {
      id: 'task-4',
      icon: <Clock size={16} />,
      title: 'Chuẩn bị 2 bộ trang phục chiều nay',
      desc: 'Lịch chụp lúc 14:30',
      badge: 'Hôm nay',
      badgeClass: 'today',
      view: 'calendar',
    },
  ];

  // Default Top Services matching Figma 323:7692
  const defaultServices = [
    {
      id: 'prod-1',
      rank: 1,
      rankClass: 'rank-1',
      name: 'Áo Dài Phượng Hoàng Đỏ',
      image: '/figma-overview/product-phuong-hoang.png',
      count: 38,
      revenue: '18.5 tr',
      progress: 90,
    },
    {
      id: 'prod-2',
      rank: 2,
      rankClass: 'rank-2',
      name: 'Cổ phục Nhật Bình Huế',
      image: '/figma-overview/product-nha-nguyet.png',
      count: 29,
      revenue: '14.2 tr',
      progress: 72,
    },
    {
      id: 'prod-3',
      rank: 3,
      rankClass: 'rank-3',
      name: 'Áo Dài Trắng Tuyết Mai',
      image: '/figma-overview/product-tuyet-mai.png',
      count: 24,
      revenue: '9.8 tr',
      progress: 55,
    },
    {
      id: 'prod-4',
      rank: 4,
      rankClass: 'rank-other',
      name: 'Áo Dài Hoa Cúc Họa Mi',
      image: '/figma-overview/product-cuc-hoa-mi.png',
      count: 18,
      revenue: '8.5 tr',
      progress: 45,
    },
  ];

  const topServices = (popularProducts && popularProducts.length > 0)
    ? popularProducts.slice(0, 4).map((p, idx) => ({
        id: `pop-${idx}`,
        rank: idx + 1,
        rankClass: idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other',
        name: p.name,
        image: p.image || defaultServices[idx]?.image || '/figma-overview/product-phuong-hoang.png',
        count: p.count,
        revenue: `${(p.count * 450000 / 1000000).toFixed(1)} tr`,
        progress: Math.min(100, Math.max(30, 90 - idx * 15)),
      }))
    : defaultServices;

  // Default Recent Activities matching Figma 323:7692
  const defaultActivities = [
    {
      id: 'act-1',
      icon: <DollarSign size={16} />,
      title: 'Lê Hoàng đã đặt cọc 500.000 đ',
      desc: 'Gói thuê Cổ phục Nhật Bình',
      time: '15 phút trước',
    },
    {
      id: 'act-2',
      icon: <Star size={16} />,
      title: 'Khách hàng đánh giá 5 sao ⭐',
      desc: '"Áo dài rất mới và form dáng chuẩn!"',
      time: '1 giờ trước',
    },
    {
      id: 'act-3',
      icon: <CheckCircle2 size={16} />,
      title: 'Trần Nam xác nhận lịch chụp',
      desc: 'Chụp ảnh tại Lăng Khải Định',
      time: '3 giờ trước',
    },
    {
      id: 'act-4',
      icon: <Package size={16} />,
      title: 'Hoàn tất nhận lại 2 áo dài',
      desc: 'Khách: Hoàng Thu Thảo - Đã kiểm tra',
      time: '5 giờ trước',
    },
  ];

  const activities = (notifications && notifications.length > 0)
    ? notifications.slice(0, 4).map((n, idx) => ({
        id: n._id || `noti-${idx}`,
        icon: idx % 2 === 0 ? <DollarSign size={16} /> : <CheckCircle2 size={16} />,
        title: n.title || 'Cập nhật hoạt động',
        desc: n.message || 'Thông tin đơn hàng',
        time: 'Gần đây',
      }))
    : defaultActivities;

  return (
    <section className="po-three-columns-grid" aria-label="Nhiệm vụ, dịch vụ và hoạt động">
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
          {tasks.map((task) => (
            <div
              key={task.id}
              className="po-task-row"
              onClick={() => onNavigate?.(task.view)}
              role="button"
              tabIndex={0}
            >
              <div className="po-task-left">
                <div className="po-task-icon-circle">{task.icon}</div>
                <div className="po-task-text">
                  <span className="po-task-title">{task.title}</span>
                  <span className="po-task-desc">{task.desc}</span>
                </div>
              </div>
              <span className={`po-task-badge ${task.badgeClass}`}>{task.badge}</span>
            </div>
          ))}
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
            <span>Xem chi tiết</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-service-list">
          {topServices.map((service) => (
            <div key={service.id} className="po-service-row">
              <div className="po-service-left">
                <span className={`po-rank-badge ${service.rankClass}`}>{service.rank}</span>
                <img
                  src={service.image}
                  alt={service.name}
                  className="po-product-thumb"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="po-product-info">
                  <span className="po-product-name">{service.name}</span>
                  <span className="po-product-count">{service.count} lượt thuê</span>
                </div>
              </div>

              <div className="po-service-right">
                <span className="po-product-revenue">{service.revenue}</span>
                <div className="po-product-progress-bar">
                  <div
                    className="po-product-progress-fill"
                    style={{ width: `${service.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CỘT 3: Hoạt động gần đây */}
      <div className="po-column-card" id="col-recent-activities">
        <div className="po-column-header">
          <h3>Hoạt động gần đây</h3>
          <button
            className="po-link-view-all"
            onClick={() => onNavigate?.('notifications')}
            type="button"
          >
            <span>Xem tất cả</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="po-activity-list">
          {activities.map((act) => (
            <div key={act.id} className="po-activity-row">
              <div className="po-activity-left">
                <div className="po-activity-icon">{act.icon}</div>
                <div className="po-activity-text">
                  <span className="po-activity-title">{act.title}</span>
                  <span className="po-activity-desc">{act.desc}</span>
                </div>
              </div>
              <span className="po-activity-time">{act.time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
