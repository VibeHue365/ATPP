import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { Sparkles, X } from 'lucide-react';
import { AIChatBot } from '../features/dashboard/components/AIChatBot';
import { LandingHeader } from '../features/landing/components/LandingHeader';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isChatOpen, setIsChatOpen] = useState(false);


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
        <div style={{ position: 'fixed', bottom: '84px', right: '24px', zIndex: 9999 }}>
          {isChatOpen && (
            <div style={{
              position: 'absolute',
              bottom: '72px',
              right: '0',
              width: 'min(380px, calc(100vw - 32px))',
              height: 'min(540px, calc(100vh - 120px))',
              background: '#fcfbf9',
              borderRadius: '20px',
              boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(139, 90, 43, 0.2)',
            }}>
              <AIChatBot onClose={() => setIsChatOpen(false)} />
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
