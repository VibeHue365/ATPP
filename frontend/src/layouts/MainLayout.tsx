import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { LandingHeader } from '../features/landing/components/LandingHeader';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


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
  return (
    <div className="vh-main-layout">
      <LandingHeader />

      {/* Page Content */}
      <main className="vh-content lume-main">
        <Outlet />
      </main>

      {/* Redesigned minimal Footer */}
      <footer className="vh-footer-redesigned">
        <div className="vh-footer-container-redesigned">
          <div className="vh-footer-left">
            <Link to={ROUTES.LANDING} className="vh-footer-logo-redesigned" style={{ textDecoration: 'none' }}>
              <img src="/logo-transparent.png" alt="TàGo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
            </Link>
            <p className="vh-footer-copy">
              © {new Date().getFullYear()} TàGo. Curating Vietnamese Elegance through time and craftsmanship.
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
    </div>
  );
};

export default MainLayout;
