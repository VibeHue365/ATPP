import React from 'react';
import { Calendar, Clock, AlertCircle, Sparkles } from 'lucide-react';
import type { UpcomingScheduleItem } from '../../types/profile.types';

interface UpcomingScheduleCardProps {
  items: UpcomingScheduleItem[];
  onViewAll: () => void;
  onViewDetails: (booking: any) => void;
  onExplore: () => void;
}

export const UpcomingScheduleCard: React.FC<UpcomingScheduleCardProps> = ({
  items,
  onViewAll,
  onViewDetails,
  onExplore
}) => {
  return (
    <div className="lume-dashboard-card">
      <div className="lume-dashboard-card-header">
        <h3 className="lume-dashboard-card-title">Lịch sắp tới</h3>
        <button type="button" className="lume-dashboard-card-action" onClick={onViewAll}>
          Xem tất cả
        </button>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 12px',
            textAlign: 'center',
            backgroundColor: '#FCFAF7',
            borderRadius: '12px',
            border: '1px dashed #E5DCD0'
          }}
        >
          <Calendar size={32} color="#A89F91" style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#574D4F', margin: '0 0 4px 0' }}>
            Không có lịch sắp tới
          </p>
          <p style={{ fontSize: '11.5px', color: '#8C827A', margin: '0 0 14px 0' }}>
            Khám phá các mẫu áo dài & gói chụp độc quyền ngay.
          </p>
          <button
            type="button"
            onClick={onExplore}
            style={{
              padding: '6px 14px',
              backgroundColor: '#8B1E2D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Đặt lịch ngay
          </button>
        </div>
      ) : (
        <div className="lume-upcoming-list">
          {items.slice(0, 3).map((item) => {
            const badgeClass =
              item.badgeStatus === 'OVERDUE'
                ? 'overdue'
                : item.badgeStatus === 'URGENT'
                ? 'urgent'
                : item.badgeStatus === 'ACTIVE'
                ? 'active'
                : 'upcoming';

            return (
              <div key={item.id} className="lume-upcoming-item-box">
                <div className="lume-upcoming-top-row">
                  <span className={`lume-countdown-badge ${badgeClass}`}>
                    {item.badgeStatus === 'OVERDUE' && <AlertCircle size={11} />}
                    {item.badgeStatus === 'URGENT' && <Clock size={11} />}
                    {item.badgeStatus === 'ACTIVE' && <Sparkles size={11} />}
                    <span>{item.badgeLabel}</span>
                  </span>
                  <span className="lume-upcoming-time-tag">{item.countdownText}</span>
                </div>

                <div>
                  <h4 className="lume-upcoming-item-title">{item.title}</h4>
                  <p className="lume-upcoming-item-code">
                    Mã: <strong>{item.code}</strong>
                    {item.size ? ` • Size ${item.size}` : ''}
                    {item.color ? ` • Màu ${item.color}` : ''}
                  </p>
                </div>

                <div className="lume-upcoming-footer">
                  <span className="lume-upcoming-date">
                    <Calendar size={12} />
                    <span>
                      {item.dateStr}
                      {item.timeSlot ? ` • ${item.timeSlot}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="lume-upcoming-btn"
                    onClick={() => onViewDetails(item.booking)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
