
import { useState } from 'react';
import type { Order } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderOrderState() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderTab, setOrderTab] = useState('Tất cả');
  const [bookingTypeFilter, setBookingTypeFilter] = useState('Tất cả');
  const [activePage, setActivePage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  return {
    orders, setOrders, loadingOrders, setLoadingOrders, orderTab, setOrderTab, bookingTypeFilter,
    setBookingTypeFilter, activePage, setActivePage, actionMenuId, setActionMenuId,
  };
}
