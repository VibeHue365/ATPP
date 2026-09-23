import {
  Clock,
  Coins,
  Hourglass,
  ShoppingBag,
} from 'lucide-react';
import type { Order } from '../types';
import { getOrderGroup } from '../orderHelpers';

interface OrdersMetricCardsProps {
  orders: Order[];
  monthlyRevenue: number;
  onSelectTab: (tab: string) => void;
}

export function OrdersMetricCards({
  orders,
  monthlyRevenue,
  onSelectTab,
}: OrdersMetricCardsProps) {
  const inProgressCount = orders.filter(
    (o) => getOrderGroup(o.status) === 'Đang thực hiện'
  ).length;

  const pendingCount = orders.filter(
    (o) => getOrderGroup(o.status) === 'Chờ xử lý'
  ).length;

  return (
    <div className="p-orders-metrics-grid">
      {/* 1. Tổng đơn hàng */}
      <div className="p-order-kpi-card">
        <div className="p-kpi-top">
          <span className="p-kpi-label">Tổng đơn hàng</span>
          <div className="p-kpi-icon-box" style={{ backgroundColor: '#FDF2F4', color: '#C43256' }}>
            <ShoppingBag size={20} />
          </div>
        </div>
        <p className="p-kpi-value">{orders.length}</p>
        <div className="p-kpi-footer">
          <span className="p-kpi-growth-positive">↑ 12%</span>
          <span style={{ color: '#94A3B8' }}>so với tháng trước</span>
        </div>
      </div>

      {/* 2. Doanh thu tháng này */}
      <div className="p-order-kpi-card">
        <div className="p-kpi-top">
          <span className="p-kpi-label">Doanh thu tháng này</span>
          <div className="p-kpi-icon-box" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
            <Coins size={20} />
          </div>
        </div>
        <p className="p-kpi-value">{(monthlyRevenue || 0).toLocaleString('vi-VN')}đ</p>
        <div className="p-kpi-footer">
          <span className="p-kpi-growth-positive">↑ 18%</span>
          <span style={{ color: '#94A3B8' }}>so với tháng trước</span>
        </div>
      </div>

      {/* 3. Đang thực hiện */}
      <div className="p-order-kpi-card">
        <div className="p-kpi-top">
          <span className="p-kpi-label">Đang thực hiện</span>
          <div className="p-kpi-icon-box" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
            <Clock size={20} />
          </div>
        </div>
        <p className="p-kpi-value">{inProgressCount}</p>
        <div className="p-kpi-footer">
          <button
            type="button"
            className="p-kpi-link"
            onClick={() => onSelectTab('Đang thực hiện')}
          >
            Xem chi tiết →
          </button>
        </div>
      </div>

      {/* 4. Đơn chờ xử lý */}
      <div className="p-order-kpi-card">
        <div className="p-kpi-top">
          <span className="p-kpi-label">Đơn chờ xử lý</span>
          <div className="p-kpi-icon-box" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
            <Hourglass size={20} />
          </div>
        </div>
        <p className="p-kpi-value">{pendingCount}</p>
        <div className="p-kpi-footer">
          {pendingCount > 0 ? (
            <span
              className="p-kpi-urgent"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectTab('Chờ xử lý')}
            >
              ⚠ Cần xử lý
            </span>
          ) : (
            <span style={{ color: '#10B981', fontWeight: 600 }}>Đã xử lý hết</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrdersMetricCards;
