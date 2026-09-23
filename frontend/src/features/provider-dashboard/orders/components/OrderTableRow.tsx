import React from 'react';
import {
  AlertTriangle,
  Camera,
  Gift,
  MoreVertical,
  Shirt,
} from 'lucide-react';
import type { Order } from '../types';
import { getOrderGroup } from '../orderHelpers';

interface OrderTableRowProps {
  order: Order;
  index: number;
  isSelected: boolean;
  onSelectOrder: (order: Order) => void;
  onOpenActionMenu: (e: React.MouseEvent, order: Order) => void;
}

export function OrderTableRow({
  order,
  index,
  isSelected,
  onSelectOrder,
  onOpenActionMenu,
}: OrderTableRowProps) {
  // Service Icon & Color
  const serviceConfig = React.useMemo(() => {
    if (order.bookingType === 'COMBO') {
      return {
        icon: <Gift size={16} color="#BE123C" />,
        bg: '#FFF1F2',
        label: 'Combo Áo dài + Chụp ảnh',
      };
    }
    if (order.bookingType === 'PHOTOGRAPHY') {
      return {
        icon: <Camera size={16} color="#2563EB" />,
        bg: '#EFF6FF',
        label: 'Gói chụp ảnh',
      };
    }
    return {
      icon: <Shirt size={16} color="#16A34A" />,
      bg: '#F0FDF4',
      label: 'Thuê áo dài',
    };
  }, [order.bookingType]);

  // Compute countdown for Photography
  const countdownText = React.useMemo(() => {
    const rawShootDate = (order as any).shootDate || order.items?.[0]?.shootDate;
    const timeSlotStr = (order as any).shootTimeSlot || order.items?.[0]?.timeSlot || '';
    if (!rawShootDate || (order.bookingType !== 'PHOTOGRAPHY' && order.bookingType !== 'COMBO')) {
      return null;
    }
    const d = new Date(rawShootDate);
    if (isNaN(d.getTime())) return null;

    let startHours = 8;
    let startMinutes = 0;
    if (timeSlotStr) {
      const match = timeSlotStr.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        startHours = parseInt(match[1], 10);
        startMinutes = parseInt(match[2], 10);
      }
    }
    const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHours, startMinutes);
    const diffMs = targetStart.getTime() - Date.now();

    if (order.rawStatus === 'IN_PROGRESS') {
      return '⚡ Đang chụp ảnh';
    }
    if (['CONFIRMED', 'DEPOSIT_PAID'].includes(order.rawStatus || '')) {
      if (diffMs > 0) {
        const mins = Math.floor(diffMs / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 24 ? `⏳ Còn ${Math.floor(h / 24)} ngày` : `⏳ Còn ${h}h ${m}m`;
      }
      return '⚠️ Đến giờ chụp';
    }
    return null;
  }, [order]);

  // Status Pill Class
  const statusPillClass = React.useMemo(() => {
    if (order.pickupDamageReport) return 'p-status-pill p-pill-damage';
    const group = getOrderGroup(order.status);
    if (group === 'Hoàn thành') return 'p-status-pill p-pill-completed';
    if (group === 'Đã hủy') return 'p-status-pill p-pill-cancelled';
    if (order.rawStatus === 'IN_PROGRESS' || order.status === 'ĐANG CHỤP') return 'p-status-pill p-pill-in-progress';
    if (order.rawStatus === 'PICKUP_PENDING' || order.status === 'CHỜ NHẬN ĐỒ') return 'p-status-pill p-pill-pickup-pending';
    if (order.rawStatus === 'DEPOSIT_PAID' || order.rawStatus === 'CONFIRMED') return 'p-status-pill p-pill-upcoming';
    return 'p-status-pill p-pill-in-progress';
  }, [order]);

  const depositSubline = React.useMemo(() => {
    if (order.depositTotal && order.depositTotal > 0 && order.rawStatus !== 'COMPLETED') {
      return 'Đã cọc 50%';
    }
    return order.rawStatus === 'COMPLETED' ? 'Đã thanh toán' : 'Chờ thanh toán';
  }, [order]);

  return (
    <tr
      className={`p-order-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelectOrder(order)}
    >
      {/* 1. STT */}
      <td style={{ width: '40px', color: '#94A3B8', fontSize: '12px' }}>
        {index + 1}
      </td>

      {/* 2. Mã đơn */}
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className="p-order-id-badge">
          {order.id || `#VH-${order._id.slice(-5).toUpperCase()}`}
        </span>
      </td>

      {/* 3. Khách hàng */}
      <td>
        <div className="p-cust-cell">
          <div className="p-cust-avatar-fallback">
            {order.customerInitials || (order.customerName ? order.customerName.charAt(0).toUpperCase() : 'K')}
          </div>
          <div>
            <div className="p-cust-name">{order.customerName || 'Khách vãng lai'}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{order.customerEmail || ''}</div>
          </div>
        </div>
      </td>

      {/* 4. Sản phẩm / Dịch vụ */}
      <td style={{ minWidth: '220px' }}>
        <div className="p-prod-cell">
          <div className="p-prod-icon-box" style={{ backgroundColor: serviceConfig.bg }}>
            {serviceConfig.icon}
          </div>
          <div>
            <div className="p-prod-title">{order.productName || 'Dịch vụ'}</div>
            <div className="p-prod-desc">{serviceConfig.label}</div>
            {countdownText && (
              <div className="p-row-countdown">
                <span>{countdownText}</span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* 5. Ngày đặt */}
      <td style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
        {order.orderDate}
      </td>

      {/* 6. Tổng tiền & Trạng thái cọc */}
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div className="p-total-main">{order.total}</div>
        <div className="p-total-sub">{depositSubline}</div>
      </td>

      {/* 7. Trạng thái */}
      <td style={{ textAlign: 'center' }}>
        <span className={statusPillClass}>
          {order.pickupDamageReport && <AlertTriangle size={12} />}
          <span>{order.pickupDamageReport ? 'Khách báo lỗi' : order.status}</span>
        </span>
      </td>

      {/* 8. Thao tác */}
      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="p-action-detail-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder(order);
            }}
          >
            Chi tiết
          </button>
          <button
            type="button"
            className="p-action-more-btn"
            onClick={(e) => onOpenActionMenu(e, order)}
            title="Thao tác khác"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default OrderTableRow;
