
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderNavigationState() {
  const [currentView, setCurrentView] = useState<'overview' | 'orders' | 'collections' | 'profile' | 'portfolio' | 'photography-packages' | 'calendar' | 'vouchers' | 'inventory' | 'reviews' | 'trust' | 'analytics' | 'payouts' | 'rental-operations' | 'role-management' | 'notifications'>('overview');
  const [collectionTab, setCollectionTab] = useState<'products' | 'inventory'>('products');

  return { currentView, setCurrentView, collectionTab, setCollectionTab };
}
