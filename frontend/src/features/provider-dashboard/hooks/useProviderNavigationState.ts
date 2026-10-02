
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderNavigationState() {
  const [currentView, setCurrentView] = useState<'overview' | 'orders' | 'collections' | 'profile' | 'portfolio' | 'photography-packages' | 'calendar' | 'vouchers' | 'inventory' | 'reviews' | 'trust' | 'analytics' | 'payouts' | 'rental-operations' | 'role-management' | 'notifications'>('overview');
  const [collectionTab, setCollectionTab] = useState<'products' | 'inventory'>('products');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vibe_provider_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vibe_provider_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  return {
    currentView,
    setCurrentView,
    collectionTab,
    setCollectionTab,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
  };
}
