import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { useToast } from '../../../components/feedback/Toast';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { Order } from '../types';
import type { useProviderIncidentState } from './useProviderIncidentState';
import type { useProviderOrderState } from './useProviderOrderState';
import { OrdersMetricCards } from './components/OrdersMetricCards';
import { OrdersFilterBar } from './components/OrdersFilterBar';
import { OrdersTable } from './components/OrdersTable';
import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { OrderActionDropdown } from './components/OrderActionDropdown';
import './ordersFigma.css';

type OrdersPanelProps = Pick<ReturnType<typeof useProviderOrderState>,
  'setOrderTab' | 'orderTab' | 'orders' | 'setBookingTypeFilter' | 'bookingTypeFilter' | 'loadingOrders' | 'setActionMenuId' | 'actionMenuId' | 'activePage' | 'setActivePage'
> &
  Pick<ReturnType<typeof useProviderSessionState>,
    'setSelectedBookingId' | 'setIsDetailModalOpen'
  > &
  Pick<ReturnType<typeof useProviderIncidentState>,
    'setReportingOrder' | 'setSelectedItemId' | 'setIncidentDesc' | 'setIncidentPhotos' | 'setIncidentAmount' | 'setIncidentActionType'
  > &
{
  toast: ReturnType<typeof useToast>;
  tabs: { label: string; count: number; }[];
  hasAodaiCapability: boolean | undefined;
  hasPhotographyCapability: boolean | undefined;
  monthlyRevenue: number;
  filteredOrders: Order[];
  resolveRescheduleRequest: (order: Order, item: any, approved: boolean) => Promise<void>;
  changeOrderStatus: (_id: string, apiStatus: string) => Promise<void>;
};

export function OrdersPanel({
  toast,
  tabs,
  setOrderTab,
  orderTab,
  hasAodaiCapability,
  hasPhotographyCapability,
  orders,
  setBookingTypeFilter,
  bookingTypeFilter,
  monthlyRevenue,
  loadingOrders,
  filteredOrders,
  setSelectedBookingId,
  setIsDetailModalOpen,
  setActionMenuId,
  actionMenuId,
  resolveRescheduleRequest,
  changeOrderStatus,
  setReportingOrder,
  setSelectedItemId,
  setIncidentDesc,
  setIncidentPhotos,
  setIncidentAmount,
  setIncidentActionType,
  activePage,
  setActivePage,
}: OrdersPanelProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Synchronize selected order with updated data when an order is selected
  const activeSelectedOrder = React.useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find((o) => o._id === selectedOrder._id) || selectedOrder;
  }, [orders, selectedOrder]);

  const activeActionOrder = React.useMemo(() => {
    if (!actionMenuId) return null;
    return orders.find((o) => o._id === actionMenuId) || null;
  }, [orders, actionMenuId]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setSelectedBookingId(order._id);
  };

  const handleOpenActionMenu = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setActionMenuId(actionMenuId === order._id ? null : order._id);
  };

  const handleOpenIncidentReport = (order: Order) => {
    setReportingOrder(order);
    const productItem = order.items?.find((i: any) => i.itemType === 'PRODUCT') || order.items?.[0];
    setSelectedItemId(productItem?._id || '');
    setIncidentDesc('');
    setIncidentPhotos([]);
    setIncidentAmount(order.depositTotal || 0);
    setIncidentActionType('CLEANING');
  };

  return (
    <main className="p-orders-container">
      {/* 1. Page Header */}
      <div className="p-orders-header">
        <div>
          <h2 className="p-orders-title">Đơn đặt lịch</h2>
          <p className="p-orders-subtitle">
            Quản lý tất cả đơn thuê áo dài, chụp ảnh và combo. Theo dõi trạng thái và xử lý nhanh chóng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('Tính năng xuất CSV đang được phát triển.')}
          className="p-orders-export-btn"
        >
          <Download size={15} />
          <span>Xuất tệp CSV</span>
        </button>
      </div>

      {/* 2. Top 4 KPI Metric Cards */}
      <OrdersMetricCards
        orders={orders}
        monthlyRevenue={monthlyRevenue}
        onSelectTab={(tab) => setOrderTab(tab)}
      />

      {/* 3. Filter Controls: Tabs & Service Chips */}
      <OrdersFilterBar
        orderTab={orderTab}
        setOrderTab={setOrderTab}
        bookingTypeFilter={bookingTypeFilter}
        setBookingTypeFilter={setBookingTypeFilter}
        hasAodaiCapability={hasAodaiCapability}
        hasPhotographyCapability={hasPhotographyCapability}
        tabs={tabs}
        orders={orders}
      />

      {/* 4. Split-Panel Layout: Orders Table (Left) + Detail Drawer (Right) */}
      <div className="p-orders-split-layout">
        <div className="p-orders-main-col">
          <OrdersTable
            orders={filteredOrders}
            loadingOrders={loadingOrders}
            selectedOrder={activeSelectedOrder}
            onSelectOrder={handleSelectOrder}
            onOpenActionMenu={handleOpenActionMenu}
            activePage={activePage}
            setActivePage={setActivePage}
          />
        </div>

        {/* Side Detail Drawer (Figma Node 345:267) */}
        {activeSelectedOrder && (
          <OrderDetailDrawer
            order={activeSelectedOrder}
            orders={filteredOrders}
            onClose={() => {
              setSelectedOrder(null);
            }}
            onSelectOrder={handleSelectOrder}
            resolveRescheduleRequest={resolveRescheduleRequest}
            changeOrderStatus={changeOrderStatus}
            onOpenIncidentReport={handleOpenIncidentReport}
            toast={toast}
          />
        )}
      </div>

      {/* 5. Row-level Action Dropdown Menu */}
      {activeActionOrder && (
        <OrderActionDropdown
          order={activeActionOrder}
          onClose={() => setActionMenuId(null)}
          setSelectedBookingId={setSelectedBookingId}
          setIsDetailModalOpen={setIsDetailModalOpen}
          resolveRescheduleRequest={resolveRescheduleRequest}
          changeOrderStatus={changeOrderStatus}
          setReportingOrder={setReportingOrder}
          setSelectedItemId={setSelectedItemId}
          setIncidentDesc={setIncidentDesc}
          setIncidentPhotos={setIncidentPhotos}
          setIncidentAmount={setIncidentAmount}
          setIncidentActionType={setIncidentActionType}
        />
      )}
    </main>
  );
}

export default OrdersPanel;
