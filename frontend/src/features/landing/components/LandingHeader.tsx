import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { useCart } from '../../../context/CartContext';
import { useNotifications } from '../../../features/notifications/hooks/useNotifications';
import { ROUTES } from '../../../config/routes';
import { API_BASE_URL } from '../../../config/env';
import '../../../pages/LandingPage.css';
import { useHeaderScroll } from '../hooks/useHeaderScroll';
import { 
  Bell,
  ShoppingBag,
  User as UserIcon, 
  LogOut, 
  Settings, 
  CheckCheck, 
  Check,
  ShieldCheck, 
  Sparkles, 
  MessageSquare, 
  Menu, 
  X,
  Calendar,
  CreditCard,
  Truck,
  RefreshCw,
  AlertTriangle,
  Clock,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { getTimeAgo } from '../../../features/notifications/hooks/useNotifications';

export const LandingHeader: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { cart } = useCart();
  const { 
    notifications, 
    loading: loadingNoti, 
    unreadCount, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notiFilter, setNotiFilter] = useState<'all' | 'unread'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isScrolled = useHeaderScroll(24);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);

  const getNotificationVisual = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'BOOKING') {
      return {
        label: 'Đơn hàng',
        icon: <Calendar size={15} color="#B52B47" />,
        bg: '#FCECEF',
        tagBg: '#FFF0F2',
        tagColor: '#B52B47',
      };
    }
    if (t === 'PAYMENT') {
      return {
        label: 'Thanh toán',
        icon: <CreditCard size={15} color="#059669" />,
        bg: '#E6F9F0',
        tagBg: '#EDFBF5',
        tagColor: '#059669',
      };
    }
    if (t === 'HANDOVER') {
      return {
        label: 'Giao nhận',
        icon: <Truck size={15} color="#2563EB" />,
        bg: '#EEF4FF',
        tagBg: '#F0F5FF',
        tagColor: '#2563EB',
      };
    }
    if (t === 'REFUND') {
      return {
        label: 'Hoàn tiền',
        icon: <RefreshCw size={15} color="#0284C7" />,
        bg: '#E0F2FE',
        tagBg: '#F0F9FF',
        tagColor: '#0284C7',
      };
    }
    if (t === 'DISPUTE') {
      return {
        label: 'Tranh chấp',
        icon: <AlertTriangle size={15} color="#D97706" />,
        bg: '#FEF3C7',
        tagBg: '#FFFBEB',
        tagColor: '#D97706',
      };
    }
    if (t === 'VERIFICATION') {
      return {
        label: 'Xác thực',
        icon: <ShieldCheck size={15} color="#7C3AED" />,
        bg: '#F3E8FF',
        tagBg: '#FAF5FF',
        tagColor: '#7C3AED',
      };
    }
    return {
      label: 'Hệ thống',
      icon: <Sparkles size={15} color="#B52B47" />,
      bg: '#FBE5E9',
      tagBg: '#FFF5F7',
      tagColor: '#B52B47',
    };
  };

  const handleNotificationClick = (n: any) => {
    if (!n.isRead) {
      markAsRead(n._id);
    }
    setIsNotiOpen(false);
    if (n.metadata?.url) {
      navigate(n.metadata.url);
    } else if (n.metadata?.bookingId) {
      navigate(`/dashboard/profile?tab=rentals&bookingId=${n.metadata.bookingId}`);
    } else if (n.type === 'BOOKING' || n.type === 'HANDOVER') {
      navigate('/dashboard/profile?tab=rentals');
    }
  };

  const displayedNotifications = notiFilter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  // Close dropdown / notification panel on click outside
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
    return '/avatar_hanna.webp';
  };

  useEffect(() => {
    const sectionId = location.hash.replace('#', '');
    if (!sectionId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);
  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    navigate(`${ROUTES.LANDING}#${sectionId}`);
  };

  return (
    <header className={`lume-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="lume-header__inner w-full max-w-[1440px] mx-auto">
        {/* Compact Moderate Rounded Container matching Target Screenshot */}
        <div 
          className="lume-header__content w-full flex items-center transition-all"
        >
          {/* Left: Logo Box & Subtitle */}
          <Link 
            to="/" 
            aria-label="LUMÉ - Áo dài & Chụp ảnh"
            className="flex items-center gap-2.5 text-decoration-none group shrink-0"
          >
            {/* Near Circular Burgundy Icon */}
            <div 
              className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-serif font-black text-lg text-white shadow-2xs transition-transform group-hover:scale-105 shrink-0"
              style={{ backgroundColor: 'var(--landing-primary)' }}
            >
              L
            </div>
            <div className="flex flex-col shrink-0">
              <span 
                className="font-header font-black text-base md:text-lg tracking-tight leading-none"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                LUMÉ
              </span>
              <span 
                className="text-[9px] font-bold tracking-widest uppercase mt-0.5"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                ÁO DÀI & CHỤP ẢNH
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links (Visible exclusively on lg: desktop) */}
          <nav className="lume-header__nav hidden lg:flex items-center justify-center gap-6 lg:gap-8 font-body text-xs md:text-sm font-medium shrink-0">
            <button 
              type="button"
              onClick={() => scrollToSection('service-finder')}
              className="transition-colors hover:opacity-80 cursor-pointer bg-transparent border-none p-0 whitespace-nowrap"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              Dịch vụ
            </button>
            <Link 
              to={ROUTES.RENTALS} 
              className="transition-colors hover:opacity-80 text-decoration-none whitespace-nowrap"
              style={{ color: location.pathname === ROUTES.RENTALS ? 'var(--landing-primary)' : 'var(--landing-text-primary)' }}
            >
              Áo dài
            </Link>
            <Link 
              to={ROUTES.PHOTOGRAPHERS} 
              className="transition-colors hover:opacity-80 text-decoration-none whitespace-nowrap"
              style={{ color: location.pathname.startsWith('/photographers') ? 'var(--landing-primary)' : 'var(--landing-text-primary)' }}
            >
              Chụp ảnh
            </Link>
            <Link 
              to={ROUTES.COMBOS} 
              className="transition-colors hover:opacity-80 text-decoration-none whitespace-nowrap"
              style={{ color: location.pathname === ROUTES.COMBOS ? 'var(--landing-primary)' : 'var(--landing-text-primary)' }}
            >
              Combo
            </Link>
            <button 
              type="button"
              onClick={() => scrollToSection('locations')}
              className="transition-colors hover:opacity-80 cursor-pointer bg-transparent border-none p-0 whitespace-nowrap"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              Địa điểm
            </button>
          </nav>

          {/* Right: Soft Utility Buttons & Action Controls */}
          <div className="lume-header__actions flex items-center gap-2 md:gap-3 shrink-0 whitespace-nowrap">
            
            {/* Utility Icon 1: Notification Bell Button */}
            <div className="lume-header__utility lume-noti relative shrink-0" ref={notiRef}>
              <button
                type="button"
                onClick={() => {
                  setIsNotiOpen(!isNotiOpen);
                  if (!isNotiOpen) fetchNotifications();
                }}
                aria-label="Thông báo"
                aria-expanded={isNotiOpen}
                title="Thông báo"
                className={`lume-noti__trigger ${isNotiOpen ? 'is-open' : ''}`}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="lume-noti__badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotiOpen && (
                <div 
                  className="lume-noti__menu"
                  role="region" 
                  aria-label="Bảng thông báo"
                >
                  {/* Panel Header */}
                  <div className="lume-noti__header">
                    <div className="lume-noti__header-top">
                      <div className="lume-noti__title">
                        <span>Thông báo</span>
                        {unreadCount > 0 && (
                          <span className="lume-noti__counter-pill">
                            {unreadCount} mới
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          type="button"
                          onClick={markAllAsRead} 
                          className="lume-noti__mark-all-btn"
                          title="Đánh dấu tất cả đã đọc"
                        >
                          <CheckCheck size={14} />
                          Đọc tất cả
                        </button>
                      )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="lume-noti__tabs">
                      <button
                        type="button"
                        onClick={() => setNotiFilter('all')}
                        className={`lume-noti__tab ${notiFilter === 'all' ? 'is-active' : ''}`}
                      >
                        Tất cả
                        <span className="lume-noti__tab-count">({notifications.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotiFilter('unread')}
                        className={`lume-noti__tab ${notiFilter === 'unread' ? 'is-active' : ''}`}
                      >
                        Chưa đọc
                        {unreadCount > 0 && (
                          <span className="lume-noti__tab-count">({unreadCount})</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="lume-noti__list">
                    {loadingNoti ? (
                      <div className="py-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="lume-noti__skeleton">
                            <div className="lume-noti__skeleton-avatar" />
                            <div className="lume-noti__skeleton-lines">
                              <div className="lume-noti__skeleton-line" style={{ width: '40%' }} />
                              <div className="lume-noti__skeleton-line" style={{ width: '85%' }} />
                              <div className="lume-noti__skeleton-line" style={{ width: '65%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : displayedNotifications.length === 0 ? (
                      <div className="lume-noti__empty">
                        <div className="lume-noti__empty-icon">
                          {notiFilter === 'unread' ? <CheckCheck size={24} /> : <Inbox size={24} />}
                        </div>
                        <div className="lume-noti__empty-title">
                          {notiFilter === 'unread' ? 'Đã đọc tất cả' : 'Không có thông báo mới'}
                        </div>
                        <p className="lume-noti__empty-desc">
                          {notiFilter === 'unread'
                            ? 'Bạn không còn thông báo chưa đọc nào.'
                            : 'Các thông báo về đơn hàng, thanh toán và khuyến mãi sẽ xuất hiện ở đây.'}
                        </p>
                      </div>
                    ) : (
                      displayedNotifications.map((n) => {
                        const visual = getNotificationVisual(n.type);
                        return (
                          <div 
                            key={n._id} 
                            onClick={() => handleNotificationClick(n)}
                            className={`lume-noti__item ${n.isRead ? 'is-read' : 'is-unread'}`}
                          >
                            {!n.isRead && <span className="lume-noti__unread-dot" />}
                            
                            {/* Type Icon Badge */}
                            <div 
                              className="lume-noti__icon-box"
                              style={{ backgroundColor: visual.bg }}
                            >
                              {visual.icon}
                            </div>

                            {/* Content */}
                            <div className="lume-noti__content">
                              <div className="lume-noti__meta">
                                <span 
                                  className="lume-noti__type-tag"
                                  style={{ backgroundColor: visual.tagBg, color: visual.tagColor }}
                                >
                                  {visual.label}
                                </span>
                                <span className="lume-noti__time">
                                  <Clock size={10} />
                                  {getTimeAgo(n.createdAt)}
                                </span>
                              </div>
                              
                              <div className="lume-noti__item-title">
                                {n.title}
                              </div>
                              
                              <p className="lume-noti__item-desc">
                                {n.content}
                              </p>
                            </div>

                            {/* Quick Mark Read Action */}
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n._id);
                                }}
                                className="lume-noti__mark-read-icon"
                                title="Đánh dấu đã đọc"
                                aria-label="Đánh dấu đã đọc"
                              >
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="lume-noti__footer">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotiOpen(false);
                        navigate(ROUTES.NOTIFICATIONS);
                      }}
                      className="lume-noti__footer-link"
                    >
                      <span>Xem tất cả thông báo</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Utility Icon 2: Cart ShoppingBag Link Pill Button */}
            <Link
              to={ROUTES.CART}
              aria-label="Giỏ hàng"
              title="Giỏ hàng"
              className="lume-header__utility w-9 h-9 rounded-xl flex items-center justify-center transition-all text-decoration-none relative hover:opacity-90 shrink-0"
              style={{ 
                backgroundColor: 'var(--landing-surface-soft)',
                color: 'var(--landing-text-secondary)',
              }}
            >
              <ShoppingBag size={16} />
              {cart.length > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: 'var(--landing-primary)' }}
                >
                  {cart.length}
                </span>
              )}
            </Link>

            {/* User Auth Control / Login Text Link */}
            {isAuthenticated ? (
              <div className="lume-header__login lume-account relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((open) => !open)}
                  aria-label="Mở menu tài khoản"
                  aria-expanded={isDropdownOpen}
                  className={`lume-account__trigger ${isDropdownOpen ? "is-open" : ""}`}
                >
                  <img src={getAvatarUrl()} alt={user?.fullName || "Avatar"} />
                </button>

                {isDropdownOpen && (
                  <div className="lume-account__menu" role="menu" aria-label="Tài khoản">
                    <div className="lume-account__profile">
                      <img src={getAvatarUrl()} alt="" aria-hidden="true" />
                      <div>
                        <strong>{user?.fullName || "Người dùng"}</strong>
                        <span>{user?.email || "Chưa cập nhật email"}</span>
                      </div>
                    </div>

                    <div className="lume-account__items">
                      {(user?.roles?.includes("ADMIN") || user?.roles?.includes("admin")) && (
                        <Link to={ROUTES.ADMIN_DASHBOARD} onClick={() => setIsDropdownOpen(false)} className="lume-account__item lume-account__item--accent">
                          <ShieldCheck size={16} /><span>Kênh quản trị</span>
                        </Link>
                      )}
                      {user?.roles?.includes("PROVIDER") ? (
                        <Link to={ROUTES.PROVIDER_DASHBOARD} onClick={() => setIsDropdownOpen(false)} className="lume-account__item lume-account__item--accent">
                          <Sparkles size={16} /><span>Kênh đối tác</span>
                        </Link>
                      ) : (
                        <Link to={ROUTES.PROVIDER_REGISTER} onClick={() => setIsDropdownOpen(false)} className="lume-account__item lume-account__item--accent">
                          <Sparkles size={16} /><span>Đăng ký đối tác</span>
                        </Link>
                      )}
                      <Link to={ROUTES.PROFILE} onClick={() => setIsDropdownOpen(false)} className="lume-account__item">
                        <UserIcon size={16} /><span>Trang cá nhân</span>
                      </Link>
                      <Link to={ROUTES.SETTINGS} onClick={() => setIsDropdownOpen(false)} className="lume-account__item">
                        <Settings size={16} /><span>Cài đặt</span>
                      </Link>
                      <Link to="/dashboard/profile?tab=rentals" onClick={() => setIsDropdownOpen(false)} className="lume-account__item">
                        <ShoppingBag size={16} /><span>Đơn hàng của tôi</span>
                      </Link>
                      <Link to={ROUTES.NOTIFICATIONS} onClick={() => setIsDropdownOpen(false)} className="lume-account__item">
                        <Bell size={16} /><span>Thông báo</span>
                      </Link>
                      <Link to={ROUTES.CHAT} onClick={() => setIsDropdownOpen(false)} className="lume-account__item">
                        <MessageSquare size={16} /><span>Tin nhắn</span>
                      </Link>
                    </div>

                    <div className="lume-account__divider" />
                    <button type="button" onClick={handleLogout} className="lume-account__logout">
                      <LogOut size={16} /><span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>            ) : (
              <Link
                to={ROUTES.LOGIN}
                className="lume-header__login text-xs md:text-sm font-semibold transition-all text-decoration-none px-2 py-1 hover:opacity-80 shrink-0 whitespace-nowrap"
                style={{
                  color: 'var(--landing-text-primary)',
                }}
              >
                Đăng nhập
              </Link>
            )}

            {/* Primary CTA Button: Đặt lịch (Compact rounded-xl) */}
            <button
              type="button"
              onClick={() => scrollToSection('rentals')}
              className="lume-header__cta px-4 md:px-5 py-2 text-xs md:text-sm font-bold text-white rounded-xl transition-all cursor-pointer shadow-2xs hover:opacity-95 border-none shrink-0 whitespace-nowrap"
              style={{ backgroundColor: 'var(--landing-primary)' }}
            >
              Đặt lịch
            </button>

            {/* Mobile Hamburger Toggle (Exclusively on lg:hidden) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              className="lume-header__menu-trigger lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:bg-stone-100 border-none bg-transparent shrink-0"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <nav 
          id="mobile-navigation-menu"
          className="lume-mobile-menu lg:hidden max-w-[1440px] mx-auto px-4 md:px-8 mt-3"
        >
          <div 
            className="p-4 rounded-2xl bg-white shadow-xl border flex flex-col gap-3 font-header text-sm font-semibold animate-in fade-in slide-in-from-top-2"
            style={{ borderColor: 'var(--landing-border)' }}
          >
            <button 
              type="button"
              onClick={() => scrollToSection('service-finder')}
              className="text-left py-2 border-b bg-transparent border-none p-0 cursor-pointer"
              style={{ borderColor: 'var(--landing-border)', color: 'var(--landing-text-primary)' }}
            >
              Dịch vụ
            </button>
            <Link 
              to={ROUTES.RENTALS}
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b text-decoration-none"
              style={{ borderColor: 'var(--landing-border)', color: 'var(--landing-text-primary)' }}
            >
              Áo dài
            </Link>
            <Link 
              to={ROUTES.PHOTOGRAPHERS}
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b text-decoration-none"
              style={{ borderColor: 'var(--landing-border)', color: 'var(--landing-text-primary)' }}
            >
              Chụp ảnh
            </Link>
            <Link 
              to={ROUTES.COMBOS}
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b text-decoration-none"
              style={{ borderColor: 'var(--landing-border)', color: 'var(--landing-text-primary)' }}
            >
              Combo
            </Link>
            <button 
              type="button"
              onClick={() => scrollToSection('locations')}
              className="text-left py-2 bg-transparent border-none p-0 cursor-pointer"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              Địa điểm
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
