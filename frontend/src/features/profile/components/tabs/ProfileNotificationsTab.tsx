import React from 'react';
import { Bell, CheckCheck, Clock, Calendar, CreditCard, Truck, RefreshCw, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { useNotifications, getTimeAgo } from '../../../notifications/hooks/useNotifications';

export const ProfileNotificationsTab: React.FC = () => {
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  const getVisual = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'BOOKING') return { label: 'Đơn hàng', icon: <Calendar size={14} color="#8B1E2D" />, bg: '#FDF2F4', color: '#8B1E2D' };
    if (t === 'PAYMENT') return { label: 'Thanh toán', icon: <CreditCard size={14} color="#059669" />, bg: '#ECFDF5', color: '#059669' };
    if (t === 'HANDOVER') return { label: 'Giao nhận', icon: <Truck size={14} color="#2563EB" />, bg: '#EFF6FF', color: '#2563EB' };
    if (t === 'REFUND') return { label: 'Hoàn tiền', icon: <RefreshCw size={14} color="#0284C7" />, bg: '#E0F2FE', color: '#0284C7' };
    if (t === 'DISPUTE') return { label: 'Tranh chấp', icon: <AlertTriangle size={14} color="#D97706" />, bg: '#FEF3C7', color: '#D97706' };
    if (t === 'VERIFICATION') return { label: 'Xác thực', icon: <ShieldCheck size={14} color="#7C3AED" />, bg: '#F3E8FF', color: '#7C3AED' };
    return { label: 'Hệ thống', icon: <Sparkles size={14} color="#8B1E2D" />, bg: '#FDF2F4', color: '#8B1E2D' };
  };

  return (
    <div className="lume-dashboard-card" style={{ gap: '20px' }}>
      <div className="lume-dashboard-card-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="lume-dashboard-card-title">Trung tâm thông báo</h3>
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: '#8B1E2D',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 750,
                padding: '2px 8px',
                borderRadius: '999px'
              }}
            >
              {unreadCount} mới
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="lume-dashboard-card-action"
            onClick={markAllAsRead}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <CheckCheck size={14} /> Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#8C827A', fontSize: '13px' }}>
          Đang tải thông báo...
        </div>
      ) : notifications.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#FCFAF7',
            borderRadius: '12px',
            border: '1px dashed #E2DACF',
            color: '#8C827A',
            fontSize: '13px'
          }}
        >
          <Bell size={32} color="#C4B7A6" style={{ marginBottom: '8px' }} />
          <p style={{ margin: 0, fontWeight: 600, color: '#574D4F' }}>Bạn không có thông báo nào mới.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.map((n) => {
            const visual = getVisual(n.type);
            return (
              <div
                key={n._id}
                onClick={() => !n.isRead && markAsRead(n._id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: n.isRead ? '#FFFFFF' : '#FCFAF7',
                  border: n.isRead ? '1px solid #EFEAE2' : '1px solid #F2DCDD',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: visual.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {visual.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: visual.color
                      }}
                    >
                      {visual.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#8C827A', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {getTimeAgo(n.createdAt)}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 3px 0', fontSize: '13.5px', fontWeight: n.isRead ? 600 : 750, color: '#231F20' }}>
                    {n.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#574D4F', lineHeight: 1.4 }}>
                    {n.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
