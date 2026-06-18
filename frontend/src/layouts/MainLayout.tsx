import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { LogOut, ShoppingBag, Bell, Search, User as UserIcon, Settings } from 'lucide-react';
import { API_BASE_URL } from '../config/env';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
    return '/avatar_hanna.png';
  };

  // Convert role arrays into Vietnamese display name
  const getRoleDisplayName = (roles?: string[]) => {
    if (!roles || roles.length === 0) return 'Khách hàng';
    if (roles.includes('ADMIN')) return 'Quản trị viên';
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

            <a 
              href="/#photographers" 
              className={`vh-header-nav-link-custom ${location.hash === '#photographers' ? 'active' : ''}`}
            >
              Nhiếp ảnh
            </a>

            <a 
              href="/#heritage" 
              className={`vh-header-nav-link-custom ${location.hash === '#heritage' ? 'active' : ''}`}
            >
              Di sản
            </a>
          </nav>

          {/* Search bar Pill-shaped */}
          <div className="vh-header-search-container">
            <Search size={16} className="vh-header-search-icon" />
            <input type="text" placeholder="Tìm kiếm sản phẩm" className="vh-header-search-input" />
          </div>

          {/* Right Action Icons & User section */}
          <div className="vh-header-actions-redesigned">
            
            <button className="vh-header-action-icon-custom" title="Thông báo">
              <Bell size={20} />
            </button>
            
            <button className="vh-header-action-icon-custom" title="Giỏ hàng">
              <ShoppingBag size={20} />
            </button>

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
                      <Link 
                        to={ROUTES.PROFILE} 
                        className="vh-header-dropdown-item-link" 
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UserIcon size={16} />
                        <span>Trang cá nhân</span>
                      </Link>

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
            <a href="#about">About Us</a>
            <a href="#terms">Terms of Service</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
