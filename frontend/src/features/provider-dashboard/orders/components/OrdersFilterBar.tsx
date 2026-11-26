import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  Gift,
  LayoutGrid,
  Shirt,
  X,
} from 'lucide-react';
import type { Order } from '../types';
import { buildRentalOrderTabs, orderHasRentalItems, parseRentalOrderTab } from '../rentalOrderFilters';

interface OrdersFilterBarProps {
  orderTab: string;
  setOrderTab: (tab: string) => void;
  bookingTypeFilter: string;
  setBookingTypeFilter: (type: string) => void;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  hasAodaiCapability: boolean | undefined;
  hasPhotographyCapability: boolean | undefined;
  tabs: { label: string; count: number }[];
  attentionTabs: { label: string; count: number }[];
  orders: Order[];
  orderMonthFilter: string;
  setOrderMonthFilter: React.Dispatch<React.SetStateAction<string>>;
}

export function OrdersFilterBar({
  orderTab,
  setOrderTab,
  bookingTypeFilter,
  setBookingTypeFilter,
  setActivePage,
  hasAodaiCapability,
  hasPhotographyCapability,
  tabs,
  attentionTabs,
  orders,
  orderMonthFilter,
  setOrderMonthFilter,
}: OrdersFilterBarProps) {
  const rentalFilter = parseRentalOrderTab(orderTab);
  const rentalCountOrders = React.useMemo(() => {
    if (bookingTypeFilter === 'AODAI_RENTAL' || bookingTypeFilter === 'COMBO') {
      return orders.filter((order) => order.bookingType === bookingTypeFilter);
    }
    return orders.filter(orderHasRentalItems);
  }, [orders, bookingTypeFilter]);
  const rentalTabs = React.useMemo(() => buildRentalOrderTabs(rentalCountOrders), [rentalCountOrders]);
  const visibleAttentionTabs = React.useMemo(
    () => attentionTabs.filter((tab) => tab.count > 0 || tab.label === orderTab),
    [attentionTabs, orderTab],
  );
  const selectedMonthRange = React.useMemo(() => {
    if (!orderMonthFilter) return 'Tất cả thời gian';
    const [year, month] = orderMonthFilter.split('-').map(Number);
    if (!year || !month) return 'Tất cả thời gian';
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return `01/${paddedMonth}/${year} - ${lastDay}/${paddedMonth}/${year}`;
  }, [orderMonthFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Status filters are split by context to avoid horizontal scrolling. */}
      <div className="p-orders-tabs-groups">
        <div className="p-orders-primary-filter-row">
          <div className="p-orders-tabs-bar" aria-label="Trạng thái đơn">
            {tabs.map((t) => {
              const isActive = orderTab === t.label;
              const isPending = t.label === 'Chờ xử lý' && t.count > 0;
              return (
                <button
                  key={t.label}
                  onClick={() => {
                    setOrderTab(t.label);
                    setActivePage(1);
                  }}
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

          {visibleAttentionTabs.length > 0 && (
            <div className="p-orders-attention-tabs" aria-label="Đơn cần chú ý">
              <span className="p-orders-attention-label"><AlertTriangle size={13} /> Cần chú ý</span>
              {visibleAttentionTabs.map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => {
                    setOrderTab(tab.label);
                    setActivePage(1);
                  }}
                  className={`p-attention-tab-btn ${orderTab === tab.label ? 'active' : ''}`}
                >
                  <span>{tab.label}</span>
                  <span>({tab.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {hasAodaiCapability && bookingTypeFilter !== 'PHOTOGRAPHY' && (
          <div className="p-orders-tabs-bar p-orders-tabs-bar-rental" aria-label="Trạng thái giao nhận áo dài">
            <span className="p-orders-tabs-section-label">Việc cần làm · Giao nhận</span>
            {rentalTabs.map((tab) => {
              const isActive = orderTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setOrderTab(tab.id);
                    if (bookingTypeFilter === 'Tất cả') setBookingTypeFilter('HAS_RENTAL');
                    setActivePage(1);
                  }}
                  className={`p-status-tab-btn p-rental-status-tab ${isActive ? 'active' : ''}`}
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span style={{ opacity: 0.85, fontSize: '11.5px' }}>({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Sub-filters: Service Type Chips & Date Picker */}
      <div className="p-orders-subfilter-bar">
        {hasAodaiCapability && hasPhotographyCapability ? (
          <div className="p-service-chips-group">
            {[
              { label: 'Tất cả dịch vụ', type: 'Tất cả', icon: <LayoutGrid size={14} /> },
              { label: 'Có thuê áo', type: 'HAS_RENTAL', icon: <Shirt size={14} /> },
              { label: 'Áo dài', type: 'AODAI_RENTAL', icon: <Shirt size={14} /> },
              { label: 'Chụp ảnh', type: 'PHOTOGRAPHY', icon: <Camera size={14} /> },
              { label: 'Combo', type: 'COMBO', icon: <Gift size={14} /> },
            ].map((chip) => {
              const isActive = bookingTypeFilter === chip.type;
              return (
                <button
                  key={chip.type}
                  type="button"
                  onClick={() => {
                    setBookingTypeFilter(chip.type);
                    if ((chip.type === 'PHOTOGRAPHY' || chip.type === 'Tất cả') && rentalFilter) {
                      setOrderTab('Tất cả');
                    }
                    setActivePage(1);
                  }}
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

        {/* Functional month filter */}
        <div className="p-filter-actions-group">
          <label className="p-date-trigger-btn p-date-month-picker" title="Chọn tháng đặt đơn">
            <Calendar size={14} color="#64748B" />
            <span>{selectedMonthRange}</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>⌵</span>
            <input
              type="month"
              value={orderMonthFilter}
              onChange={(event) => {
                setOrderMonthFilter(event.target.value);
                setActivePage(1);
              }}
              aria-label="Tháng đặt đơn"
            />
          </label>
          {orderMonthFilter && (
            <button
              type="button"
              className="p-date-clear-btn"
              title="Hiển thị tất cả thời gian"
              aria-label="Bỏ lọc theo tháng"
              onClick={() => {
                setOrderMonthFilter('');
                setActivePage(1);
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrdersFilterBar;
