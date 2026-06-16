import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { 
  User, 
  LogOut, 
  Menu, 
  X, 
  Compass
} from 'lucide-react';
import { API_BASE_URL } from '../config/env';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const navItems = [
    { name: 'Hồ sơ cá nhân', path: ROUTES.PROFILE, icon: <User size={20} /> },
  ];

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      // NestJS static uploads: e.g. /uploads/avatars/filename -> let's map to static server url
      // Since it's stored in uploads/avatars/filename, backend should serve it at static path, e.g. http://localhost:3000/uploads/avatars/...
      // Let's check backend or serve it relative to API_BASE_URL.
      // Wait, let's see how avatar path is returned: if it's "170...jpg", it should be loaded from backend server.
      // Let's use `${API_BASE_URL}/uploads/avatars/${user.avatar}` if it is a relative filename, or adjust accordingly.
      // Let's make sure we handle it robustly!
      const filename = user.avatar.includes('/') || user.avatar.includes('\\') 
        ? user.avatar.split(/[/\\]/).pop() 
        : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'default'}`;
  };

  return (
    <div className="vh-db-container">
      {/* Mobile Header */}
      <header className="vh-db-mobile-header">
        <Link to={ROUTES.LANDING} className="vh-db-mobile-logo">
          <Compass size={24} className="vh-txt-purple" />
          <span>VibeHue</span>
        </Link>
        <button className="vh-db-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop */}
      <aside className={`vh-db-sidebar ${mobileOpen ? 'vh-db-sidebar-open' : ''}`}>
        <div className="vh-db-sidebar-header">
          <Link to={ROUTES.LANDING} className="vh-db-logo" onClick={() => setMobileOpen(false)}>
            <Compass size={28} className="vh-logo-icon" />
            <span>VibeHue</span>
          </Link>
        </div>

        <nav className="vh-db-nav">
          <div className="vh-db-section-label">Tài khoản của bạn</div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`vh-db-nav-item ${isActive ? 'vh-db-nav-item-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="vh-db-sidebar-footer">
          <div className="vh-db-user-pill">
            <img src={getAvatarUrl()} alt={user?.fullName} className="vh-db-user-avatar" />
            <div className="vh-db-user-info">
              <div className="vh-db-user-name">{user?.fullName}</div>
              <div className="vh-db-user-email">{user?.email}</div>
            </div>
          </div>
          <button className="vh-db-logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && <div className="vh-db-backdrop" onClick={() => setMobileOpen(false)}></div>}

      {/* Main Content Area */}
      <main className="vh-db-main">
        {/* Topbar - Desktop */}
        <header className="vh-db-topbar">
          <div className="vh-db-breadcrumbs">
            <span className="vh-bread-parent">Dashboard</span>
            <span className="vh-bread-sep">/</span>
            <span className="vh-bread-child">Hồ sơ cá nhân</span>
          </div>
          
          <div className="vh-db-actions">
            <Link to={ROUTES.LANDING} className="vh-topbar-link">
              Trở về Trang chủ
            </Link>
            <div className="vh-db-topbar-profile">
              <img src={getAvatarUrl()} alt={user?.fullName} />
              <span>{user?.fullName}</span>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <div className="vh-db-content-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default DashboardLayout;
