import {
  Clock,
  Coins,
  Hourglass,
  ShoppingBag,
} from 'lucide-react';
import type { Order } from '../types';
import { getBookingStatusGroup, normalizeBookingStatusCode } from '../../../../utils/bookingStatus';

interface OrdersMetricCardsProps {
  orders: Order[];
  monthlyRevenue: number;
  onSelectTab: (tab: string) => void;
}

function parseOrderDate(order: Order): Date | null {
  let d: Date | null = order.rawOrderDate || order.createdAt
    ? new Date(order.rawOrderDate || order.createdAt || '')
    : null;
  if (!d || Number.isNaN(d.getTime())) {
    const parts = (order.orderDate || '').split(' ');
    const datePart = parts[parts.length - 1];
    if (datePart && datePart.includes('/')) {
      const [day, month, year] = datePart.split('/').map(Number);
      if (day && month && year) {
        d = new Date(year, month - 1, day);
      }
    }
  }
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function OrdersMetricCards({
  orders,
  monthlyRevenue,
  onSelectTab,
}: OrdersMetricCardsProps) {
  const inProgressCount = orders.filter(
    (o) => getBookingStatusGroup(o.rawStatus || o.status) === 'ACTIVE',
  ).length;

  const pendingCount = orders.filter(
    (o) => getBookingStatusGroup(o.rawStatus || o.status) === 'PENDING',
  ).length;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;

  let ordersThisMonth = 0;
  let ordersLastMonth = 0;
  let revenueLastMonth = 0;

  for (const order of orders) {
    const d = parseOrderDate(order);
    if (!d) continue;
    const isThisMonth = d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    const isLastMonth = d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    if (isThisMonth) {
      ordersThisMonth += 1;
    } else if (isLastMonth) {
      ordersLastMonth += 1;
      if (normalizeBookingStatusCode(order.rawStatus || order.status) === 'COMPLETED') {
        revenueLastMonth += order.totalAmount ?? 0;
      }
    }
  }

  const orderGrowthPct =
    ordersLastMonth > 0
      ? Math.round(((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100)
      : null;

  const revenueGrowthPct =
    revenueLastMonth > 0
      ? Math.round(((monthlyRevenue - revenueLastMonth) / revenueLastMonth) * 100)
      : null;

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
          {orderGrowthPct !== null ? (
            <>
              <span
                className={orderGrowthPct >= 0 ? 'p-kpi-growth-positive' : 'p-kpi-urgent'}
              >
                {orderGrowthPct >= 0 ? `↑ ${orderGrowthPct}%` : `↓ ${Math.abs(orderGrowthPct)}%`}
              </span>
              <span style={{ color: '#94A3B8' }}>
                so với tháng trước ({ordersThisMonth} đơn tháng này)
              </span>
            </>
          ) : (
            <span style={{ color: '#64748B' }}>
              {ordersThisMonth > 0 ? `${ordersThisMonth} đơn phát sinh tháng này` : 'Chưa có đơn phát sinh tháng này'}
            </span>
          )}
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
          {revenueGrowthPct !== null ? (
            <>
              <span
                className={revenueGrowthPct >= 0 ? 'p-kpi-growth-positive' : 'p-kpi-urgent'}
              >
                {revenueGrowthPct >= 0 ? `↑ ${revenueGrowthPct}%` : `↓ ${Math.abs(revenueGrowthPct)}%`}
              </span>
              <span style={{ color: '#94A3B8' }}>so với tháng trước</span>
            </>
          ) : (
            <span style={{ color: '#64748B' }}>
              {monthlyRevenue > 0 ? 'Từ đơn đã hoàn tất trong tháng' : 'Chưa có đơn hoàn tất tháng này'}
            </span>
          )}
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
