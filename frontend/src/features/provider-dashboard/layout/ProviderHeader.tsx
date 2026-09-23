import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  HelpCircle,
  LogOut,
  Search,
  Settings,
  Store,
  User,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import type { useProviderNavigationState } from '../hooks/useProviderNavigationState';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import { getImageUrl } from '../shared/mediaHelpers';
import './providerNavbar.css';

type ProviderHeaderProps = Pick<ReturnType<typeof useProviderNavigationState>,
  'setCurrentView'
> &
  Pick<ReturnType<typeof useProviderSessionState>,
    'provider'
  > &
{
  notiRef: RefObject<HTMLDivElement | null>;
  setIsNotiOpen: Dispatch<SetStateAction<boolean>>;
  isNotiOpen: boolean;
  fetchNotifications: () => Promise<void>;
  providerUnreadCount: number;
  handleNotiMarkAllAsRead: () => Promise<void>;
  loadingNoti: boolean;
  notifications: any[];
  getNotiTypeStyle: (type: string) => { bg: string; color: string; icon: string; };
  handleNotiMarkAsRead: (id: string) => Promise<void>;
  getNotiTimeAgo: (dateStr: string) => string;
};

export function ProviderHeader({
  notiRef,
  setIsNotiOpen,
  isNotiOpen,
  fetchNotifications,
  providerUnreadCount,
  handleNotiMarkAllAsRead,
  loadingNoti,
  notifications,
  getNotiTypeStyle,
  handleNotiMarkAsRead,
  getNotiTimeAgo,
  setCurrentView,
  provider,
}: ProviderHeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { logout } = useAuth();
  const navigate = useNavigate();

  // Outside click to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global shortcut (Cmd+K / Ctrl+K) to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
    navigate('/auth/login');
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const shortcutText = isMac ? '⌘ K' : 'Ctrl K';

  const businessName = provider?.businessName || 'Huế Áo Dài Studio';
  const avatarUrl = provider?.avatar || provider?.logoUrl ? getImageUrl(provider.avatar || provider.logoUrl) : null;

  return (
    <header className="p-header-bar">
      {/* 1. Left Search Bar */}
      <div className="p-search-wrapper">
        <Search size={18} className="p-search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="p-search-input"
          placeholder="Tìm kiếm đơn đặt lịch, khách hàng, dịch vụ..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          id="global-provider-search"
        />
        <span className="p-search-shortcut-badge">{shortcutText}</span>
      </div>

      {/* 2. Right Actions: Notification Bell + Profile */}
      <div className="p-header-actions">
        {/* Notification Bell with Badge & Dropdown */}
        <div style={{ position: 'relative' }} ref={notiRef}>
          <button
            onClick={() => {
              setIsNotiOpen(!isNotiOpen);
              if (!isNotiOpen) fetchNotifications();
            }}
            className="p-noti-btn"
            title="Thông báo"
            type="button"
            id="btn-header-notifications"
          >
            <Bell size={20} />
            {providerUnreadCount > 0 && (
              <span className="p-noti-badge">
                {providerUnreadCount > 99 ? '99+' : providerUnreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover Dropdown */}
          {isNotiOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: '-20px',
                width: '380px',
                maxHeight: '480px',
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
                zIndex: 9999,
                overflow: 'hidden',
                animation: 'noti-slide-in 0.2s ease-out',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #FAF6F0 0%, #FFF 100%)',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#531320' }}>
                    Thông báo
                  </h3>
                  {providerUnreadCount > 0 && (
                    <span style={{ fontSize: '10px', color: '#D97706', fontWeight: 600 }}>
                      {providerUnreadCount} chưa đọc
                    </span>
                  )}
                </div>
                {providerUnreadCount > 0 && (
                  <button
                    onClick={handleNotiMarkAllAsRead}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      color: '#531320',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    type="button"
                  >
                    <CheckCheck size={12} />
                    Đọc tất cả
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {loadingNoti ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Đang tải...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <Bell size={28} color="#94A3B8" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      Chưa có thông báo
                    </p>
                  </div>
                ) : (
                  notifications.map((noti) => {
                    const ts = getNotiTypeStyle(noti.type);
                    return (
                      <div
                        key={noti._id}
                        onClick={() => !noti.isRead && handleNotiMarkAsRead(noti._id)}
                        style={{
                          padding: '12px 18px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: noti.isRead ? 'white' : '#FFFCF7',
                          transition: 'background 0.15s',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                          position: 'relative',
                        }}
                      >
                        {!noti.isRead && (
                          <div
                            style={{
                              position: 'absolute',
                              left: '6px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: '#EF4444',
                            }}
                          />
                        )}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: ts.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            flexShrink: 0,
                          }}
                        >
                          {ts.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '12px', fontWeight: noti.isRead ? 600 : 700, color: '#1E293B' }}>
                              {noti.title}
                            </span>
                            <span
                              style={{
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontSize: '8px',
                                fontWeight: 700,
                                backgroundColor: ts.bg,
                                color: ts.color,
                                textTransform: 'uppercase',
                                flexShrink: 0,
                              }}
                            >
                              {noti.type}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '11px',
                              color: '#64748B',
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {noti.content}
                          </p>
                          <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                            {getNotiTimeAgo(noti.createdAt)}
                          </span>
                        </div>
                        {!noti.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotiMarkAsRead(noti._id);
                            }}
                            title="Đánh dấu đã đọc"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '3px',
                              cursor: 'pointer',
                              color: '#D97706',
                              flexShrink: 0,
                            }}
                            type="button"
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div
                  style={{
                    padding: '10px 18px',
                    borderTop: '1px solid #F1F5F9',
                    textAlign: 'center',
                    backgroundColor: '#FAF6F0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotiOpen(false);
                      setCurrentView('notifications');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#531320',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '4px 12px',
                      borderRadius: '4px',
                    }}
                  >
                    Xem tất cả thông báo →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="p-header-divider" />

        {/* User Profile Trigger & Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            className={`p-profile-trigger ${isProfileOpen ? 'active' : ''}`}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            type="button"
            aria-expanded={isProfileOpen}
            id="btn-header-profile"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="p-profile-avatar" />
            ) : (
              <div className="p-profile-avatar-fallback">
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="p-profile-info">
              <span className="p-profile-name">{businessName}</span>
              <span className="p-profile-role">Nhà cung cấp</span>
            </div>
            <ChevronDown size={16} className={`p-profile-chevron ${isProfileOpen ? 'rotated' : ''}`} />
          </button>

          {/* User Profile Dropdown Menu (Figma #338:106) */}
          {isProfileOpen && (
            <div className="p-profile-dropdown" role="menu">
              {/* 1. Thông tin tài khoản */}
              <button
                className="p-dropdown-item"
                onClick={() => {
                  setIsProfileOpen(false);
                  setCurrentView('profile');
                }}
                role="menuitem"
                type="button"
              >
                <User size={18} color="#64748B" />
                <span>Thông tin tài khoản</span>
              </button>

              {/* 2. Quản lý cửa hàng */}
              <button
                className="p-dropdown-item"
                onClick={() => {
                  setIsProfileOpen(false);
                  setCurrentView('collections');
                }}
                role="menuitem"
                type="button"
              >
                <Store size={18} color="#64748B" />
                <span>Quản lý cửa hàng</span>
              </button>

              {/* 3. Cài đặt */}
              <button
                className="p-dropdown-item"
                onClick={() => {
                  setIsProfileOpen(false);
                  setCurrentView('profile');
                }}
                role="menuitem"
                type="button"
              >
                <Settings size={18} color="#64748B" />
                <span>Cài đặt</span>
              </button>

              <div className="p-dropdown-divider" />

              {/* 4. Trợ giúp & Hỗ trợ */}
              <button
                className="p-dropdown-item"
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate('/chat');
                }}
                role="menuitem"
                type="button"
              >
                <HelpCircle size={18} color="#64748B" />
                <span>Trợ giúp & Hỗ trợ</span>
              </button>

              {/* 5. Đăng xuất (Red Accent) */}
              <button
                className="p-dropdown-item logout"
                onClick={handleLogout}
                role="menuitem"
                type="button"
              >
                <LogOut size={18} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default ProviderHeader;
