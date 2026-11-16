import React from 'react';
import type { RecentOrderItem } from '../../types/profile.types';

interface RecentOrdersCardProps {
  orders: RecentOrderItem[];
  onViewAll: () => void;
  onViewDetails: (booking: any) => void;
  onContinuePayment: (bookingId: string) => void;
}

export const RecentOrdersCard: React.FC<RecentOrdersCardProps> = ({
  orders,
  onViewAll,
  onViewDetails,
  onContinuePayment
}) => {
  return (
    <div className="lume-dashboard-card">
      <div className="lume-dashboard-card-header">
        <h3 className="lume-dashboard-card-title">Đơn hàng gần đây</h3>
        <button type="button" className="lume-dashboard-card-action" onClick={onViewAll}>
          Xem tất cả
        </button>
      </div>

      {orders.length === 0 ? (
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
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#574D4F', margin: '0 0 4px 0' }}>
            Chưa có đơn hàng nào
          </p>
          <p style={{ fontSize: '11.5px', color: '#8C827A', margin: '0' }}>
            Các đơn thuê & đặt lịch sẽ được lưu lại tại đây.
          </p>
        </div>
      ) : (
        <div className="lume-recent-orders-list">
          {orders.slice(0, 4).map((order) => (
            <div
              key={order.id}
              className="lume-recent-order-item"
              onClick={() => onViewDetails(order.booking)}
            >
              <div className="lume-order-info">
                <h4 className="lume-order-title">{order.title}</h4>
                <span className="lume-order-meta">
                  {order.bookingCode} • {order.dateStr}
                </span>
              </div>
              <span
                className="lume-order-status-badge"
                style={{
                  backgroundColor: order.statusBg,
                  color: order.statusColor
                }}
              >
                {order.statusLabel}
              </span>
              {['PENDING_PAYMENT', 'WAITING_PAYMENT'].includes(order.status) && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onContinuePayment(order.bookingId);
                  }}
                  style={{
                    marginLeft: '8px',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '5px 8px',
                    background: '#8E1B2E',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Thanh toán
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="lume-recent-orders-view-all-btn"
        onClick={onViewAll}
      >
        Xem tất cả đơn hàng →
      </button>
    </div>
  );
};
