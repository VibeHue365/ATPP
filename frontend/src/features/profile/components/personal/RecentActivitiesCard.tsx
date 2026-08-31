import React from 'react';
import { Calendar, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface RecentActivitiesCardProps {
  bookings?: any[];
}

export const RecentActivitiesCard: React.FC<RecentActivitiesCardProps> = ({ bookings = [] }) => {
  const activities = React.useMemo(() => {
    if (!bookings || bookings.length === 0) return [];

    const list: Array<{
      id: string;
      title: string;
      time: string;
      icon: React.ReactNode;
      badgeLabel: string;
      badgeBg: string;
      badgeColor: string;
    }> = [];

    bookings.slice(0, 4).forEach((b, idx) => {
      const firstItem = b.items?.[0] || {};
      const code = b.bookingCode || `RT-${b._id.slice(-4)}`;
      const title = firstItem.name || (firstItem.itemType === 'PHOTOGRAPHY_PACKAGE' ? 'Gói chụp ảnh' : 'Trang phục thuê');
      const timeStr = b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : 'Gần đây';

      if (b.status === 'COMPLETED') {
        list.push({
          id: `act-${b._id}-${idx}`,
          title: `Hoàn tất đơn hàng #${code} - ${title}`,
          time: timeStr,
          icon: <CheckCircle2 size={16} color="#047857" />,
          badgeLabel: 'Hoàn tất',
          badgeBg: '#ECFDF5',
          badgeColor: '#047857'
        });
      } else if (b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') {
        list.push({
          id: `act-${b._id}-${idx}`,
          title: `Đặt lịch thành công #${code} - ${title}`,
          time: timeStr,
          icon: <Calendar size={16} color="#1D4ED8" />,
          badgeLabel: b.status === 'DEPOSIT_PAID' ? 'Chờ duyệt' : 'Đã xác nhận',
          badgeBg: b.status === 'DEPOSIT_PAID' ? '#FEF3C7' : '#EFF6FF',
          badgeColor: b.status === 'DEPOSIT_PAID' ? '#B45309' : '#1D4ED8'
        });
      } else if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') {
        list.push({
          id: `act-${b._id}-${idx}`,
          title: `Đang trải nghiệm dịch vụ #${code} - ${title}`,
          time: timeStr,
          icon: <Clock size={16} color="#0284C7" />,
          badgeLabel: 'Đang diễn ra',
          badgeBg: '#E0F2FE',
          badgeColor: '#0369A1'
        });
      } else {
        list.push({
          id: `act-${b._id}-${idx}`,
          title: `Đơn hàng #${code} - ${title}`,
          time: timeStr,
          icon: <Sparkles size={16} color="#8B1E2D" />,
          badgeLabel: b.status === 'CANCELLED' ? 'Đã hủy' : 'Đã trả đồ',
          badgeBg: '#F3F4F6',
          badgeColor: '#4B5563'
        });
      }
    });

    return list;
  }, [bookings]);

  return (
    <div className="lume-form-card">
      <div className="lume-form-card-header">
        <h3 className="lume-form-card-title">Hoạt động gần đây</h3>
        <p className="lume-form-card-subtitle">Các hoạt động mới nhất trên tài khoản của bạn</p>
      </div>

      {activities.length === 0 ? (
        <div
          style={{
            padding: '28px 16px',
            textAlign: 'center',
            backgroundColor: '#FCFAF7',
            borderRadius: '12px',
            border: '1px dashed #E2DACF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={24} color="#C4B7A6" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#4A3F35' }}>
            Chưa có hoạt động nào được ghi nhận
          </span>
          <span style={{ fontSize: '11.5px', color: '#8C827A' }}>
            Lịch sử đặt đồ, thanh toán và hoàn tất dịch vụ sẽ xuất hiện tại đây.
          </span>
        </div>
      ) : (
        <div className="lume-activities-list">
          {activities.map((act) => (
            <div key={act.id} className="lume-activity-item">
              <div className="lume-activity-left">
                <div className="lume-activity-icon-box">{act.icon}</div>
                <div>
                  <h4 className="lume-activity-title">{act.title}</h4>
                  <p className="lume-activity-time">{act.time}</p>
                </div>
              </div>

              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 750,
                  backgroundColor: act.badgeBg,
                  color: act.badgeColor
                }}
              >
                {act.badgeLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
