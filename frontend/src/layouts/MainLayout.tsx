import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { LogOut, ShoppingBag, Bell, Search, User as UserIcon, Settings, Sparkles, X, ShieldCheck, Check, CheckCheck } from 'lucide-react';
import { API_BASE_URL } from '../config/env';
import { AIChatBot } from '../features/dashboard/components/AIChatBot';
import { useCart } from '../context/CartContext';
import { httpClient } from '../services/httpClient';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNoti, setLoadingNoti] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);

  // Close dropdown / notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingNoti(true);
      const data = await httpClient.request<any[]>('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoadingNoti(false);
    }
  }, [isAuthenticated]);

  // Load notifications on mount & periodically every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await httpClient.request(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await httpClient.request('/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    } catch (e) {
      console.error('Failed to mark all notifications as read', e);
    }
  };

  const getTimeAgo = (dateStr: string) => {
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

  const getNotiTypeColor = (type: string) => {
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
  // Redirect to onboarding if user is logged in but hasn't completed onboarding
  // Also redirect Admin to Admin Dashboard automatically if they access customer layouts
  useEffect(() => {
    if (isAuthenticated && user) {
      const isAdmin = user.roles?.includes('ADMIN') || user.roles?.includes('admin');
      if (isAdmin) {
        navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
        return;
      }
      if (user.hasCompletedOnboarding === false && location.pathname !== ROUTES.ONBOARDING) {
        navigate(ROUTES.ONBOARDING);
      }
    }
  }, [isAuthenticated, user, location.pathname, navigate]);
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      const filename = user.avatar.includes('/') || user.avatar.includes('\\')
        ? user.avatar.split(/[/\\]/).pop()
        : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    return '/avatar_hanna.png';
  };

  // Convert role arrays into Vietnamese display name
  const getRoleDisplayName = (roles?: string[]) => {
    if (!roles || roles.length === 0) return 'Khách hàng';
    if (roles.includes('ADMIN')) return 'Quản trị viên';
    if (roles.includes('PROVIDER')) return 'Đối tác (Provider)';
    if (roles.includes('MERCHANT') || roles.includes('STORE_OWNER') || roles.includes('SHOP_OWNER')) return 'Chủ cửa hàng';
    if (roles.includes('PHOTOGRAPHER')) return 'Nhiếp ảnh gia';
    return 'Khách hàng';
  };

  return (
    <div className="vh-main-layout">
      {/* Global Redesigned Header - Premium Mockup Style */}
      <header className="vh-header">
        <div className="vh-header-container">
          
          {/* Logo block: Di sản Áo Dài + CURATING ELEGANCE */}
          <Link to={ROUTES.LANDING} className="vh-logo-redesigned" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
            <span className="font-header" style={{ color: 'var(--color-primary-dark)', fontSize: '24px', fontWeight: 700, lineHeight: 1.15 }}>
              Di sản Áo Dài
            </span>
            <span className="font-header" style={{ color: 'var(--color-gold)', fontSize: '8px', fontWeight: 600, letterSpacing: '0.15em', marginTop: '2px' }}>
              CURATING ELEGANCE
            </span>
          </Link>

          {/* Centered Navigation Menu - Dynamic Brand Links */}
          <nav className="vh-header-nav-custom">
            <Link 
              to="/" 
              className={`vh-header-nav-link-custom ${location.pathname === '/' && !location.hash ? 'active' : ''}`}
            >
              Khám phá
            </Link>

            <Link 
              to={ROUTES.RENTALS} 
              className={`vh-header-nav-link-custom ${location.pathname === ROUTES.RENTALS ? 'active' : ''}`}
            >
              Cho thuê
            </Link>

            <Link 
              to={ROUTES.PHOTOGRAPHERS} 
              className={`vh-header-nav-link-custom ${location.pathname.startsWith('/photographers') ? 'active' : ''}`}
            >
              Nhiếp ảnh
            </Link>

            <Link 
              to={ROUTES.COMBOS} 
              className={`vh-header-nav-link-custom ${location.pathname === ROUTES.COMBOS ? 'active' : ''}`}
            >
              Combo
            </Link>
          </nav>

          {/* Search bar Pill-shaped */}
          <div className="vh-header-search-container">
            <Search size={16} className="vh-header-search-icon" />
            <input type="text" placeholder="Tìm kiếm sản phẩm" className="vh-header-search-input" />
          </div>

          {/* Right Action Icons & User section */}
          <div className="vh-header-actions-redesigned">
            
            <div style={{ position: 'relative' }} ref={notiRef}>
              <button 
                className="vh-header-action-icon-custom" 
                title="Thông báo"
                onClick={() => { setIsNotiOpen(!isNotiOpen); if (!isNotiOpen) fetchNotifications(); }}
                style={{ position: 'relative' }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    backgroundColor: 'var(--color-primary)', color: 'white',
                    borderRadius: '50%', minWidth: '16px', height: '16px',
                    fontSize: '9px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', boxShadow: '0 1px 4px rgba(74,14,23,0.4)',
                    animation: 'pulse-badge 2s infinite'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {isNotiOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 12px)', right: '-60px',
                  width: '400px', maxHeight: '520px',
                  backgroundColor: 'white', borderRadius: '14px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
                  zIndex: 9999, overflow: 'hidden',
                  animation: 'noti-slide-in 0.2s ease-out'
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '16px 20px', borderBottom: '1px solid #F0EBE3',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #FAF6F0 0%, #FFF 100%)'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#4A0E17', letterSpacing: '-0.01em' }}>Thông báo</h3>
                      {unreadCount > 0 && (
                        <span style={{ fontSize: '11px', color: '#B89047', fontWeight: 600 }}>{unreadCount} thông báo chưa đọc</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '5px 10px', border: '1px solid #E8E2D5', borderRadius: '6px',
                          backgroundColor: 'white', color: '#706E3B', fontSize: '11px',
                          fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; }}
                        onMouseOut={e => { e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <CheckCheck size={12} />
                        Đọc tất cả
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    {loadingNoti ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A' }}>
                        <div style={{ width: '24px', height: '24px', border: '2px solid #E8E2D5', borderTop: '2px solid #4A0E17', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Đang tải...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <Bell size={32} color="#D4C5A9" style={{ marginBottom: '12px' }} />
                        <p style={{ margin: 0, fontSize: '13px', color: '#7A7A7A', fontWeight: 600 }}>Chưa có thông báo nào</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#B0A89A' }}>Các thông báo mới sẽ hiển thị tại đây</p>
                      </div>
                    ) : (
                      notifications.map((noti) => {
                        const typeStyle = getNotiTypeColor(noti.type);
                        return (
                          <div
                            key={noti._id}
                            onClick={() => !noti.isRead && handleMarkAsRead(noti._id)}
                            style={{
                              padding: '14px 20px', cursor: 'pointer',
                              borderBottom: '1px solid #F5F0E8',
                              backgroundColor: noti.isRead ? 'white' : '#FFFCF7',
                              transition: 'background 0.15s',
                              display: 'flex', gap: '12px', alignItems: 'flex-start',
                              position: 'relative'
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FAF6F0'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = noti.isRead ? 'white' : '#FFFCF7'; }}
                          >
                            {/* Unread dot */}
                            {!noti.isRead && (
                              <div style={{
                                position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                                width: '6px', height: '6px', borderRadius: '50%',
                                backgroundColor: '#4A0E17'
                              }} />
                            )}

                            {/* Type icon */}
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '10px',
                              backgroundColor: typeStyle.bg, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: '16px', flexShrink: 0
                            }}>
                              {typeStyle.icon}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <span style={{
                                  fontSize: '13px', fontWeight: noti.isRead ? 600 : 750,
                                  color: '#2A2A2A', lineHeight: '1.3'
                                }}>
                                  {noti.title}
                                </span>
                                <span style={{
                                  padding: '1px 5px', borderRadius: '3px', fontSize: '8px',
                                  fontWeight: 700, backgroundColor: typeStyle.bg, color: typeStyle.color,
                                  textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0
                                }}>
                                  {noti.type}
                                </span>
                              </div>
                              <p style={{
                                margin: 0, fontSize: '12px', color: '#6B6B6B',
                                lineHeight: '1.45', wordBreak: 'break-word',
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as any, overflow: 'hidden'
                              }}>
                                {noti.content}
                              </p>
                              <span style={{ fontSize: '10px', color: '#B0A89A', fontWeight: 500, marginTop: '4px', display: 'block' }}>
                                {getTimeAgo(noti.createdAt)}
                              </span>
                            </div>

                            {/* Read indicator */}
                            {!noti.isRead && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(noti._id); }}
                                title="Đánh dấu đã đọc"
                                style={{
                                  background: 'none', border: 'none', padding: '4px',
                                  cursor: 'pointer', color: '#B89047', flexShrink: 0,
                                  opacity: 0.6, transition: 'opacity 0.15s'
                                }}
                                onMouseOver={e => { e.currentTarget.style.opacity = '1'; }}
                                onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; }}
                              >
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div style={{
                      padding: '10px 20px', borderTop: '1px solid #F0EBE3',
                      textAlign: 'center', background: '#FDFCFA'
                    }}>
                      <button
                        onClick={() => { setIsNotiOpen(false); navigate('/dashboard/profile?tab=notifications'); }}
                        style={{
                          background: 'none', border: 'none', color: '#B89047',
                          fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          padding: '4px 12px', borderRadius: '4px', transition: 'all 0.15s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.color = '#4A0E17'; }}
                        onMouseOut={e => { e.currentTarget.style.color = '#B89047'; }}
                      >
                        Xem tất cả thông báo →
                      </button>
                    </div>
                  )}

                  {/* Animations */}
                  <style>{`
                    @keyframes noti-slide-in {
                      from { opacity: 0; transform: translateY(-8px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes pulse-badge {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.1); }
                    }
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              )}
            </div>
            <Link to={ROUTES.CART} className="vh-header-action-icon-custom" title="Giỏ hàng" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="vh-cart-badge" style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {cart.length}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="vh-header-user-section-relative-wrapper" ref={dropdownRef}>
                {/* Trigger Area: Name/Role + Avatar */}
                <div 
                  className="vh-header-user-section-custom" 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* User info: Name + Role below */}
                  <div className="vh-header-user-text-custom">
                    <span className="vh-header-username-custom font-body">
                      {user?.fullName || 'Người dùng'}
                    </span>
                    <span className="vh-header-userrole-custom font-body">
                      {getRoleDisplayName(user?.roles)}
                    </span>
                  </div>
                  
                  {/* Circular Avatar */}
                  <div className="vh-header-avatar-link-custom">
                    <img src={getAvatarUrl()} alt={user?.fullName} className="vh-header-avatar-img-custom" />
                  </div>
                </div>

                {/* Dropdown Menu - EXACTLY as Mockup */}
                {isDropdownOpen && (
                  <div className="vh-header-dropdown-menu-container animate-scale-up-fade">
                    {/* Position arrow */}
                    <div className="vh-header-dropdown-arrow-up"></div>

                    {/* Header info */}
                    <div className="vh-header-dropdown-header-block">
                      <img src={getAvatarUrl()} alt={user?.fullName} className="vh-header-dropdown-avatar-square" />
                      <div className="vh-header-dropdown-header-text">
                        <span className="vh-header-dropdown-header-name font-header">{user?.fullName}</span>
                        <span className="vh-header-dropdown-header-email">{user?.email}</span>
                      </div>
                    </div>

                    {/* Nav Items */}
                    <div className="vh-header-dropdown-items-list">
                      {(user?.roles?.includes('ADMIN') || user?.roles?.includes('admin')) && (
                        <Link 
                          to={ROUTES.ADMIN_DASHBOARD} 
                          className="vh-header-dropdown-item-link" 
                          onClick={() => setIsDropdownOpen(false)}
                          style={{ color: '#C0392B', fontWeight: 'bold' }}
                        >
                          <ShieldCheck size={16} />
                          <span>Kênh Quản Trị (Admin)</span>
                        </Link>
                      )}

                      {user?.roles?.includes('PROVIDER') && (
                        <Link 
                          to={ROUTES.PROVIDER_DASHBOARD} 
                          className="vh-header-dropdown-item-link" 
                          onClick={() => setIsDropdownOpen(false)}
                          style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
                        >
                          <Sparkles size={16} />
                          <span>Kênh Đối Tác</span>
                        </Link>
                      )}

                      {!user?.roles?.includes('PROVIDER') && (
                        <Link
                          to={ROUTES.PROVIDER_REGISTER}
                          className="vh-header-dropdown-item-link"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Sparkles size={16} />
                          <span>Đăng ký Provider</span>
                        </Link>
                      )}
                      {!user?.roles?.includes('PROVIDER') && (
                        <Link 
                          to={ROUTES.PROFILE} 
                          className="vh-header-dropdown-item-link" 
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <UserIcon size={16} />
                          <span>Trang cá nhân</span>
                        </Link>
                      )}

                      <Link 
                        to="/dashboard/profile?tab=rentals" 
                        className="vh-header-dropdown-item-link" 
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <ShoppingBag size={16} />
                        <span>Đơn hàng</span>
                      </Link>

                      <Link 
                        to={ROUTES.SETTINGS} 
                        className="vh-header-dropdown-item-link" 
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Settings size={16} />
                        <span>Cài đặt</span>
                      </Link>

                      <div className="vh-header-dropdown-divider-line"></div>

                      <button 
                        className="vh-header-dropdown-item-btn logout font-body" 
                        onClick={handleLogout}
                      >
                        <LogOut size={16} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to={ROUTES.LOGIN} className="vh-btn vh-btn-primary vh-btn-sm" style={{ borderRadius: '8px', padding: '8px 20px', fontWeight: 600 }}>
                ĐĂNG NHẬP
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="vh-content">
        <Outlet />
      </main>

      {/* Redesigned minimal Footer */}
      <footer className="vh-footer-redesigned">
        <div className="vh-footer-container-redesigned">
          <div className="vh-footer-left">
            <Link to={ROUTES.LANDING} className="vh-footer-logo-redesigned font-header" style={{ textDecoration: 'none' }}>
              Di sản Áo Dài
            </Link>
            <p className="vh-footer-copy">
              © {new Date().getFullYear()} Di sản Áo Dài. Curating Vietnamese Elegance through time and craftsmanship.
            </p>
          </div>
          
          <div className="vh-footer-right-links">
            <a href="#about">Về chúng tôi</a>
            <a href="#terms">Điều khoản dịch vụ</a>
            <a href="#privacy">Chính sách bảo mật</a>
            <a href="#contact">Liên hệ</a>
          </div>
        </div>
      </footer>
      {/* AI ChatBot Floating Widget */}
      {isAuthenticated && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
          {isChatOpen && (
            <div style={{
              position: 'absolute',
              bottom: '72px',
              right: '0',
              width: '380px',
              height: '520px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(139, 90, 43, 0.15)',
            }}>
              {/* Chat Header */}
              <div style={{
                background: 'linear-gradient(135deg, #8B5A2B 0%, #6B4226 100%)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'white',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Trợ Lý AI Áo Dài</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px' }}
                >
                  <X size={18} />
                </button>
              </div>
              {/* Chat Content */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <AIChatBot />
              </div>
            </div>
          )}

          {/* Floating Toggle Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            title="Trợ Lý AI"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isChatOpen
                ? 'linear-gradient(135deg, #6B4226 0%, #4a2e1a 100%)'
                : 'linear-gradient(135deg, #8B5A2B 0%, #C49A6C 100%)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(139, 90, 43, 0.5)',
              transition: 'all 0.3s ease',
              color: 'white',
            }}
          >
            {isChatOpen ? <X size={24} /> : <Sparkles size={24} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
