
import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api/providerDashboardApi';

/** Mounted at dashboard scope, preserving polling and dropdown lifetime across tabs. */
export function useProviderNotifications() {
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNoti, setLoadingNoti] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  // Click outside to close notification panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNoti(true);
      const data = await notificationsApi.list<any[]>();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoadingNoti(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const providerUnreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotiMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const handleNotiMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllRead({ method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) { console.error(e); }
  };

  const getNotiTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getNotiTypeStyle = (type: string) => {
    switch (type) {
      case 'BOOKING': return { bg: '#EEF2FF', color: '#4338CA', icon: '📋' };
      case 'PAYMENT': return { bg: '#F0FDF4', color: '#166534', icon: '💳' };
      case 'HANDOVER': return { bg: '#FFF7ED', color: '#C2410C', icon: '🤝' };
      case 'REFUND': return { bg: '#FEF3C7', color: '#92400E', icon: '💰' };
      case 'DISPUTE': return { bg: '#FEE2E2', color: '#991B1B', icon: '⚠️' };
      case 'SYSTEM': return { bg: '#F5F3FF', color: '#7C3AED', icon: '🔔' };
      default: return { bg: '#F9FAFB', color: '#6B7280', icon: '📌' };
    }
  };

  return {
    isNotiOpen, setIsNotiOpen, notifications, loadingNoti, notiRef, fetchNotifications,
    providerUnreadCount, handleNotiMarkAsRead, handleNotiMarkAllAsRead, getNotiTimeAgo, getNotiTypeStyle,
  };
}
