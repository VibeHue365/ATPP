import React from 'react';
import {
  Calendar,
  Camera,
  Gift,
  LayoutGrid,
  Shirt,
  SlidersHorizontal,
} from 'lucide-react';
import type { Order } from '../types';

interface OrdersFilterBarProps {
  orderTab: string;
  setOrderTab: (tab: string) => void;
  bookingTypeFilter: string;
  setBookingTypeFilter: (type: string) => void;
  hasAodaiCapability: boolean | undefined;
  hasPhotographyCapability: boolean | undefined;
  tabs: { label: string; count: number }[];
  orders: Order[];
}

export function OrdersFilterBar({
  orderTab,
  setOrderTab,
  bookingTypeFilter,
  setBookingTypeFilter,
  hasAodaiCapability,
  hasPhotographyCapability,
  tabs,
  orders: _orders,
}: OrdersFilterBarProps) {
  const currentMonthYear = React.useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return `01/${month}/${year} - ${lastDay}/${month}/${year}`;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Status Tabs Bar */}
      <div className="p-orders-tabs-bar">
        {tabs.map((t) => {
          const isActive = orderTab === t.label;
          const isPending = t.label === 'Chờ xử lý' && t.count > 0;
          return (
            <button
              key={t.label}
              onClick={() => setOrderTab(t.label)}
              className={`p-status-tab-btn ${isActive ? 'active' : ''}`}
              type="button"
            >
              {isPending && <span className="p-tab-dot-alert" />}
              <span>{t.label}</span>
              <span style={{ opacity: 0.85, fontSize: '11.5px' }}>({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. Sub-filters: Service Type Chips & Date Picker */}
      <div className="p-orders-subfilter-bar">
        {hasAodaiCapability && hasPhotographyCapability ? (
          <div className="p-service-chips-group">
            {[
              { label: 'Tất cả dịch vụ', type: 'Tất cả', icon: <LayoutGrid size={14} /> },
              { label: 'Áo dài', type: 'AODAI_RENTAL', icon: <Shirt size={14} /> },
              { label: 'Chụp ảnh', type: 'PHOTOGRAPHY', icon: <Camera size={14} /> },
              { label: 'Combo', type: 'COMBO', icon: <Gift size={14} /> },
            ].map((chip) => {
              const isActive = bookingTypeFilter === chip.type;
              return (
                <button
                  key={chip.type}
                  type="button"
                  onClick={() => setBookingTypeFilter(chip.type)}
                  className={`p-service-chip ${isActive ? 'active' : ''}`}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        {/* Date Filter & More Filters */}
        <div className="p-filter-actions-group">
          <button
            type="button"
            className="p-date-trigger-btn"
            title="Khoảng thời gian"
          >
            <Calendar size={14} color="#64748B" />
            <span>{currentMonthYear}</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>⌵</span>
          </button>

          <button
            type="button"
            className="p-filter-more-btn"
            title="Bộ lọc nâng cao"
          >
            <SlidersHorizontal size={14} color="#64748B" />
            <span>Bộ lọc</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrdersFilterBar;
