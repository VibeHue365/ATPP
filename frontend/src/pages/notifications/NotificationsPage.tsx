import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Check, Search, Calendar, CreditCard,
 Package, AlertTriangle, Clock, ChevronRight, Inbox, RotateCw, ExternalLink, FileCheck, RotateCcw
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { ROUTES } from '../../config/routes';
import { adminVerificationApi } from '../../features/admin-verifications/api/adminVerificationApi';
import { adminDisputesApi } from '../../features/admin-disputes/api/adminDisputesApi';
import { adminReportedReviewsApi } from '../../features/admin-reviews/api/adminReportedReviewsApi';

interface NotificationItem {
  _id: string;
  title: string;
  content: string;
  type: 'BOOKING' | 'PAYMENT' | 'HANDOVER' | 'REFUND' | 'DISPUTE' | 'SYSTEM' | 'VERIFICATION' | string;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationsPageProps {
  hideBreadcrumb?: boolean;
  variant?: 'customer' | 'provider' | 'admin';
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  hideBreadcrumb = false,
  variant = 'customer'
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const userNotis = await httpClient.request<NotificationItem[]>('/notifications').catch(() => []);
      let allNotis: NotificationItem[] = Array.isArray(userNotis) ? [...userNotis] : [];

      if (variant === 'admin') {
        const [verificationResult, disputeResult, reviewResult] = await Promise.allSettled([
          adminVerificationApi.list(),
          adminDisputesApi.list(),
          adminReportedReviewsApi.list(),
        ]);

        if (verificationResult.status === 'fulfilled' && Array.isArray(verificationResult.value)) {
          verificationResult.value
            .filter((item: any) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')
            .forEach((item: any) => {
              allNotis.push({
                _id: `verif-${item.verificationId}`,
                title: `Phê duyệt hồ sơ: ${item.businessProfile?.businessName || 'Đối tác mới'}`,
                content: `Hồ sơ đăng ký nhà cung cấp đang ở trạng thái ${item.status}. Cần Admin thẩm định & phê duyệt.`,
                type: 'VERIFICATION',
                isRead: false,
                createdAt: item.createdAt || new Date().toISOString(),
                metadata: { tab: 'verifications' }
              });
            });
        }

        if (disputeResult.status === 'fulfilled' && Array.isArray(disputeResult.value)) {
          disputeResult.value.forEach((item: any) => {
            allNotis.push({
              _id: `dispute-${item._id}`,
              title: `Tranh chấp đơn ${item.bookingId?.bookingCode || 'cần xử lý'}`,
              content: item.description || 'Hệ thống ghi nhận sự cố / khiếu nại từ người dùng. Cần Admin đưa ra quyết định.',
              type: 'DISPUTE',
              isRead: false,
              createdAt: item.createdAt || new Date().toISOString(),
              metadata: { tab: 'disputes' }
            });
          });
        }

        if (reviewResult.status === 'fulfilled' && Array.isArray(reviewResult.value)) {
          reviewResult.value.forEach((item: any) => {
            allNotis.push({
              _id: `review-${item._id}`,
              title: 'Báo cáo vi phạm đánh giá (Spam)',
              content: item.reportReason || 'Đánh giá bị người dùng báo cáo vi phạm nội dung. Cần Admin kiểm duyệt.',
              type: 'SYSTEM',
              isRead: false,
              createdAt: item.reportedAt || new Date().toISOString(),
              metadata: { tab: 'reported-reviews' }
            });
          });
        }
      } else if (variant === 'provider') {
        const providerBookings = await httpClient.get<any[]>('/bookings/provider').catch(() => []);
        if (Array.isArray(providerBookings)) {
          providerBookings.forEach((b: any) => {
            if (b.status === 'PENDING') {
              allNotis.push({
                _id: `prov-bk-${b._id}`,
                title: `Đơn hàng mới #${b.bookingCode || b._id.substring(0, 6)}`,
                content: `Khách hàng đã đặt đơn mới. Vui lòng kiểm tra và xác nhận đơn hàng.`,
                type: 'BOOKING',
                isRead: false,
                createdAt: b.createdAt || new Date().toISOString(),
                metadata: { bookingId: b._id }
              });
            } else if (b.status === 'DISPUTED') {
              allNotis.push({
                _id: `prov-disp-${b._id}`,
                title: `Khiếu nại / Tranh chấp đơn #${b.bookingCode || b._id.substring(0, 6)}`,
                content: `Đơn hàng đang có tranh chấp cần đối soát và phối hợp với Admin xử lý.`,
                type: 'DISPUTE',
                isRead: false,
                createdAt: b.updatedAt || b.createdAt || new Date().toISOString(),
                metadata: { bookingId: b._id }
              });
            }
          });
        }
      } else if (variant === 'customer') {
        const custBookings = await httpClient.get<any[]>('/api/bookings').catch(() => []);
        if (Array.isArray(custBookings)) {
          custBookings.forEach((b: any) => {
            if (b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'CANCELLED') {
              allNotis.push({
                _id: `cust-bk-${b._id}`,
                title: `Cập nhật đơn hàng #${b.bookingCode || b._id.substring(0, 6)}`,
                content: `Trạng thái đơn hàng hiện tại: ${b.status === 'CONFIRMED' ? 'Đã xác nhận' : b.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy'}.`,
                type: 'BOOKING',
                isRead: true,
                createdAt: b.updatedAt || b.createdAt || new Date().toISOString(),
                metadata: { bookingId: b._id, url: '/dashboard/profile?tab=rentals' }
              });
            }
          });
        }
      }

      // De-duplicate by _id
      const uniqueNotis = Array.from(new Map(allNotis.map(n => [n._id, n])).values());
      // Sort newest first
      uniqueNotis.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(uniqueNotis);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      toast.error('Không thể tải danh sách thông báo');
    } finally {
      setLoading(false);
    }
  }, [variant, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (!id.startsWith('verif-') && !id.startsWith('dispute-') && !id.startsWith('review-') && !id.startsWith('prov-') && !id.startsWith('cust-')) {
        await httpClient.request(`/notifications/${id}/read`, { method: 'PATCH' });
      }
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.every(n => n.isRead)) return;
    setMarkingAll(true);
    try {
      await httpClient.request('/notifications/read-all', { method: 'POST' }).catch(() => null);
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      toast.error('Có lỗi xảy ra khi cập nhật thông báo');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = (noti: NotificationItem) => {
    if (!noti.isRead) {
      handleMarkAsRead(noti._id);
    }
    if (noti.metadata?.tab) {
      navigate(`/admin/dashboard-refactored?tab=${noti.metadata.tab}`);
    } else if (noti.metadata?.url) {
      navigate(noti.metadata.url);
    } else if (noti.metadata?.bookingId) {
      navigate(ROUTES.PROFILE);
    }
  };

  const getNotiStyle = (type: string) => {
    switch (type) {
      case 'VERIFICATION':
        return { icon: <FileCheck size={20} strokeWidth={2.2} />, bg: '#FEF3C7', color: '#D97706', border: '#FDE68A', label: 'Phê duyệt hồ sơ' };
      case 'DISPUTE':
        return { icon: <AlertTriangle size={20} strokeWidth={2.2} />, bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3', label: 'Tranh chấp' };
      case 'BOOKING':
        return { icon: <Calendar size={20} strokeWidth={2.2} />, bg: '#FAF6F0', color: '#4A0E17', border: '#E8E2D5', label: 'Đặt lịch' };
      case 'PAYMENT':
        return { icon: <CreditCard size={20} strokeWidth={2.2} />, bg: '#F0FDF4', color: '#166534', border: '#DCFCE7', label: 'Thanh toán' };
      case 'HANDOVER':
        return { icon: <Package size={20} strokeWidth={2.2} />, bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', label: 'Giao nhận' };
      case 'REFUND':
        return { icon: <RotateCcw size={20} strokeWidth={2.2} />, bg: '#F0F9FF', color: '#0284C7', border: '#BAE6FD', label: 'Hoàn tiền' };
      default:
        return { icon: <Bell size={20} strokeWidth={2.2} />, bg: '#F8F5FF', color: '#7C3AED', border: '#DDD6FE', label: 'Hệ thống' };
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return `Hôm qua ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const tabsList = useMemo(() => {
    if (variant === 'admin') {
      return [
        { id: 'all', label: 'Tất cả', count: notifications.length },
        { id: 'unread', label: 'Chưa đọc', count: notifications.filter(n => !n.isRead).length },
        { id: 'verifications', label: 'Phê duyệt hồ sơ', count: notifications.filter(n => n.type === 'VERIFICATION' || n.metadata?.tab === 'verifications').length },
        { id: 'disputes', label: 'Tranh chấp & Khiếu nại', count: notifications.filter(n => n.type === 'DISPUTE' || n.metadata?.tab === 'disputes').length },
        { id: 'system', label: 'Hệ thống', count: notifications.filter(n => n.type === 'SYSTEM' || n.metadata?.tab === 'reported-reviews').length },
      ];
    }
    if (variant === 'provider') {
      return [
        { id: 'all', label: 'Tất cả', count: notifications.length },
        { id: 'unread', label: 'Chưa đọc', count: notifications.filter(n => !n.isRead).length },
        { id: 'orders', label: 'Đơn hàng & Giao nhận', count: notifications.filter(n => n.type === 'BOOKING' || n.type === 'HANDOVER').length },
        { id: 'finance', label: 'Thanh toán & Quyết toán', count: notifications.filter(n => n.type === 'PAYMENT' || n.type === 'REFUND').length },
        { id: 'system', label: 'Hệ thống', count: notifications.filter(n => n.type === 'SYSTEM' || n.type === 'DISPUTE').length },
      ];
    }
    // Default: Customer
    return [
      { id: 'all', label: 'Tất cả', count: notifications.length },
      { id: 'unread', label: 'Chưa đọc', count: notifications.filter(n => !n.isRead).length },
      { id: 'booking', label: 'Đặt lịch & Giao nhận', count: notifications.filter(n => n.type === 'BOOKING' || n.type === 'HANDOVER').length },
      { id: 'payment', label: 'Thanh toán & Hoàn tiền', count: notifications.filter(n => n.type === 'PAYMENT' || n.type === 'REFUND').length },
      { id: 'system', label: 'Hệ thống', count: notifications.filter(n => n.type === 'SYSTEM' || n.type === 'DISPUTE').length },
    ];
  }, [notifications, variant]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(noti => {
      // Filter by tab
      if (activeTab === 'unread' && noti.isRead) return false;

      if (variant === 'admin') {
        if (activeTab === 'disputes' && noti.type !== 'DISPUTE' && noti.metadata?.tab !== 'disputes') return false;
        if (activeTab === 'verifications' && noti.type !== 'VERIFICATION' && noti.metadata?.tab !== 'verifications') return false;
        if (activeTab === 'system' && noti.type !== 'SYSTEM' && noti.metadata?.tab !== 'reported-reviews') return false;
      } else if (variant === 'provider') {
        if (activeTab === 'orders' && noti.type !== 'BOOKING' && noti.type !== 'HANDOVER') return false;
        if (activeTab === 'finance' && noti.type !== 'PAYMENT' && noti.type !== 'REFUND') return false;
        if (activeTab === 'system' && noti.type !== 'SYSTEM' && noti.type !== 'DISPUTE') return false;
      } else {
        if (activeTab === 'booking' && noti.type !== 'BOOKING' && noti.type !== 'HANDOVER') return false;
        if (activeTab === 'payment' && noti.type !== 'PAYMENT' && noti.type !== 'REFUND') return false;
        if (activeTab === 'system' && noti.type !== 'SYSTEM' && noti.type !== 'DISPUTE') return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return noti.title.toLowerCase().includes(q) || noti.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, activeTab, searchQuery, variant]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / itemsPerPage));

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredNotifications.slice(start, start + itemsPerPage);
  }, [filteredNotifications, currentPage, itemsPerPage]);

  const pageTitle = variant === 'admin'
    ? 'Trung tâm thông báo Admin'
    : variant === 'provider'
    ? 'Thông báo Nhà cung cấp'
    : 'Tất cả thông báo';

  const pageSubtitle = variant === 'admin'
    ? 'Theo dõi toàn bộ thông báo, phê duyệt hồ sơ đối tác, khiếu nại và các biến động hệ thống.'
    : variant === 'provider'
    ? 'Quản lý và cập nhật toàn bộ thông báo đơn hàng, dịch vụ, đánh giá và lịch sử quyết toán.'
    : 'Theo dõi các thông tin cập nhật về đơn đặt lịch, thanh toán và hệ thống của bạn.';

  return (
    <div style={{
      backgroundColor: hideBreadcrumb ? 'transparent' : '#FAF8F5',
      minHeight: hideBreadcrumb ? 'auto' : '100vh',
      padding: hideBreadcrumb ? '0' : '32px 16px 64px 16px'
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Breadcrumb & Navigation */}
        {!hideBreadcrumb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '13px', color: '#7A7A7A' }}>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: '#7A7A7A', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              onMouseOver={e => { e.currentTarget.style.color = '#4A0E17'; }}
              onMouseOut={e => { e.currentTarget.style.color = '#7A7A7A'; }}
            >
              Trang chủ
            </button>
            <ChevronRight size={14} />
            <span style={{ color: '#4A0E17', fontWeight: 700 }}>Thông báo</span>
          </div>
        )}

        {/* Main Card Header */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8E2D5', padding: '28px 32px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 850, color: '#4A0E17', letterSpacing: '-0.02em' }}>{pageTitle}</h1>
                {unreadCount > 0 && (
                  <span style={{ backgroundColor: '#4A0E17', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                    {unreadCount} cần xử lý
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#7A7A7A' }}>
                {pageSubtitle}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={fetchNotifications}
                disabled={loading}
                title="Làm mới thông báo"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '9px 14px', border: '1px solid #E8E2D5', borderRadius: '8px',
                  backgroundColor: '#FAF6F0', color: '#4A0E17', fontSize: '12px',
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#F3E8DC'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; }}
              >
                <RotateCw size={14} className={loading ? 'spin-anim' : ''} />
                Làm mới
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px', border: 'none', borderRadius: '8px',
                    backgroundColor: '#4A0E17', color: 'white', fontSize: '12px',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: '0 2px 8px rgba(74, 14, 23, 0.2)'
                  }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = '#380B12'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = '#4A0E17'; }}
                >
                  <CheckCheck size={14} />
                  Đọc tất cả
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F0ECE4', flexWrap: 'wrap', gap: '16px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tabsList.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '7px 14px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeTab === tab.id ? '#4A0E17' : '#FAF6F0',
                    color: activeTab === tab.id ? 'white' : '#7A7A7A',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {tab.label}
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#E8E2D5',
                    color: activeTab === tab.id ? 'white' : '#4A0E17'
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7A7A7A' }} />
              <input
                type="text"
                placeholder="Tìm kiếm thông báo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 34px',
                  borderRadius: '8px',
                  border: '1px solid #E8E2D5',
                  fontSize: '12px',
                  backgroundColor: '#FAF6F0',
                  outline: 'none',
                  transition: 'all 0.15s'
                }}
              />
            </div>
          </div>
        </div>

        {/* Notifications List Container */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8E2D5', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#7A7A7A' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #E8E2D5', borderTop: '3px solid #4A0E17', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Đang tải thông báo...</p>
            </div>
          ) : paginatedNotifications.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <Inbox size={48} color="#D4C5A9" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#4A0E17' }}>Không có thông báo nào</h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#7A7A7A' }}>
                {searchQuery ? 'Không tìm thấy thông báo khớp với từ khóa tìm kiếm.' : 'Bạn chưa có thông báo nào trong mục này.'}
              </p>
            </div>
          ) : (
            <div>
              {paginatedNotifications.map((noti, idx) => {
                const ts = getNotiStyle(noti.type);
                return (
                  <div
                    key={noti._id}
                    onClick={() => handleItemClick(noti)}
                    style={{
                      padding: '20px 24px',
                      borderBottom: idx < paginatedNotifications.length - 1 ? '1px solid #F0ECE4' : 'none',
                      backgroundColor: noti.isRead ? 'white' : '#FFFCF7',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      position: 'relative'
                    }}
                    onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; }}
                    onMouseOut={e => { e.currentTarget.style.backgroundColor = noti.isRead ? 'white' : '#FFFCF7'; }}
                  >
                    {/* Unread dot */}
                    {!noti.isRead && (
                      <div style={{
                        position: 'absolute',
                        left: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#4A0E17',
                        boxShadow: '0 0 0 3px rgba(74, 14, 23, 0.15)'
                      }} />
                    )}

                    {/* Main Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: noti.isRead ? 700 : 850, color: '#2A2A2A', letterSpacing: '-0.01em' }}>
                            {noti.title}
                          </h4>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                            {ts.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#7A7A7A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formatTime(noti.createdAt)}
                        </span>
                      </div>

                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#4A4A4A', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {noti.content}
                      </p>

                      {(noti.metadata?.url || noti.metadata?.tab) && (
                        <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#4A0E17' }}>
                          Xem chi tiết <ExternalLink size={12} />
                        </div>
                      )}
                    </div>

                    {/* Single Mark Read Action */}
                    {!noti.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(noti._id, e)}
                        title="Đánh dấu đã đọc"
                        style={{
                          background: 'none',
                          border: '1px solid #E8E2D5',
                          borderRadius: '6px',
                          padding: '6px',
                          color: '#B89047',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          transition: 'all 0.15s',
                          flexShrink: 0
                        }}
                        onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; e.currentTarget.style.color = '#4A0E17'; }}
                        onMouseOut={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#B89047'; }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {filteredNotifications.length > 0 && totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderTop: '1px solid #F0ECE4', backgroundColor: '#FAF6F0'
            }}>
              <span style={{ fontSize: '12px', color: '#7A7A7A', fontWeight: 600 }}>
                Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredNotifications.length)} / {filteredNotifications.length} thông báo
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 14px', border: '1px solid #E8E2D5', borderRadius: '6px',
                    backgroundColor: currentPage === 1 ? '#F5F5F5' : 'white',
                    color: currentPage === 1 ? '#B0A89A' : '#4A0E17',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px', fontWeight: 700, transition: 'all 0.15s'
                  }}
                >
                  Trang trước
                </button>

                <span style={{ fontSize: '12px', fontWeight: 800, color: '#4A0E17', padding: '0 8px' }}>
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '6px 14px', border: '1px solid #E8E2D5', borderRadius: '6px',
                    backgroundColor: currentPage >= totalPages ? '#F5F5F5' : 'white',
                    color: currentPage >= totalPages ? '#B0A89A' : '#4A0E17',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px', fontWeight: 700, transition: 'all 0.15s'
                  }}
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
