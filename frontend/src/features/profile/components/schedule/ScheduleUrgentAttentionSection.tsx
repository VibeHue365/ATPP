import React from 'react';
import { Bell, Image as ImageIcon } from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

interface UrgentItem {
  id: string;
  type: 'DUE_SOON' | 'OVERDUE';
  title: string;
  code: string;
  size: string;
  dueDate: string;
  countdownLabel: string;
  countdownValue: string;
  image?: string;
  booking?: any;
}

interface ScheduleUrgentAttentionSectionProps {
  urgentItems?: UrgentItem[];
  onViewDetail: (item: UrgentItem) => void;
}

export const ScheduleUrgentAttentionSection: React.FC<ScheduleUrgentAttentionSectionProps> = ({
  urgentItems = [
    {
      id: 'urgent-1',
      type: 'DUE_SOON',
      title: 'Áo dài Nhật Bình đỏ',
      code: 'RT-1024',
      size: 'M',
      dueDate: 'Hôm nay, 12/08/2026 trước 18:00',
      countdownLabel: 'Còn',
      countdownValue: '6 giờ',
      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=300'
    },
    {
      id: 'urgent-2',
      type: 'OVERDUE',
      title: 'Áo dài gấm xanh ngọc',
      code: 'RT-0998',
      size: 'S',
      dueDate: '09/08/2026 • 18:00',
      countdownLabel: 'Quá hạn',
      countdownValue: '1 ngày',
      image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=300'
    }
  ],
  onViewDetail
}) => {
  if (!urgentItems || urgentItems.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Heading */}
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#C2410C', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Bell size={16} />
        <span>Cần chú ý ({urgentItems.length})</span>
      </h3>

      {/* Grid of 2 Urgent Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {urgentItems.map((item) => {
          const isOverdue = item.type === 'OVERDUE';
          const themeColor = isOverdue ? '#DC2626' : '#EA580C';
          const themeBg = isOverdue ? '#FFF5F5' : '#FFF9F5';
          const themeBorder = isOverdue ? '#FECACA' : '#FED7AA';

          return (
            <div
              key={item.id}
              style={{
                backgroundColor: themeBg,
                border: `1px solid ${themeBorder}`,
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {/* Thumbnail */}
                <div
                  style={{
                    width: '68px',
                    height: '80px',
                    minWidth: '68px',
                    maxWidth: '68px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#EAE6E1',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <ImageWithFallback
                    src={item.image}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    fallback={
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                        <ImageIcon size={20} />
                      </div>
                    }
                  />
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 'fit-content',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: isOverdue ? '#FEE2E2' : '#FFEDD5',
                      color: themeColor,
                      letterSpacing: '0.04em'
                    }}
                  >
                    {isOverdue ? 'QUÁ HẠN' : 'SẮP ĐẾN HẠN'}
                  </span>

                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#231F20', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </h4>

                  <span style={{ fontSize: '11px', color: '#7D736B' }}>
                    Mã thuê: {item.code} • Size {item.size}
                  </span>

                  <span style={{ fontSize: '11px', color: '#4A3F35', fontWeight: 600 }}>
                    Hạn trả: {item.dueDate}
                  </span>
                </div>
              </div>

              {/* Right: Countdown & Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', flexShrink: 0, gap: '8px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', color: themeColor, fontWeight: 700, display: 'block' }}>
                    {item.countdownLabel}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: themeColor }}>
                    {item.countdownValue}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onViewDetail(item)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    border: `1px solid ${themeBorder}`,
                    color: themeColor,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = themeColor;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.color = themeColor;
                  }}
                >
                  Xem chi tiết
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
