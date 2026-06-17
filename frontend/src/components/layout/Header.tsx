import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../../config/routes';
import { Compass, ShoppingBag, LayoutDashboard, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LANDING);
  };

  return (
    <header className="vh-header">
      <div className="vh-header-container">
        <Link to={ROUTES.LANDING} className="vh-logo">
          <Compass className="vh-logo-icon animate-pulse" size={28} />
          <span>Silk & Stone</span>
        </Link>

        <nav className="vh-header-nav">
          <a href="#rentals">RENTALS</a>
          <a href="#photographers">PHOTOGRAPHERS</a>
          <a href="#ai-styling">AI STYLING</a>
          <a href="#heritage">HERITAGE</a>
        </nav>

        <div className="vh-header-actions">
          <button className="vh-btn vh-btn-text p-2" title="Giỏ hàng">
            <ShoppingBag size={20} />
          </button>

          {isAuthenticated ? (
            <div className="vh-header-user-menu">
              <Link to={ROUTES.PROFILE} className="vh-btn vh-btn-outline vh-btn-sm vh-header-dashboard-btn">
                <LayoutDashboard size={16} />
                <span>Cá nhân</span>
              </Link>
              <div className="vh-user-badge">
                <span className="vh-user-badge-name pl-2">{user?.fullName}</span>
              </div>
              <button onClick={handleLogout} className="vh-header-logout-btn" title="Đăng xuất">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link to={ROUTES.LOGIN} className="vh-btn vh-btn-primary vh-btn-sm">
              SIGN IN
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
