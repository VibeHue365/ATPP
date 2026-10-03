import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../config/routes';
import { LandingHeader } from '../features/landing/components/LandingHeader';
import { LandingFooter } from '../features/landing/components/LandingFooter';
import { AIChatBot } from '../features/dashboard/components/AIChatBot';

export const LandingLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    <div 
      className="min-h-screen flex flex-col font-body"
      style={{ backgroundColor: 'var(--landing-bg, #FCFAF8)' }}
    >
      {/* Target Scoped Landing Header */}
      <LandingHeader />

      {/* Main Content Area */}
      <main className="lume-main flex-1 w-full">
        <Outlet />
      </main>

      {/* Target Scoped Landing Footer */}
      <LandingFooter />

      {/* AI Assistant Chat Widget */}
      <AIChatBot />
    </div>
  );
};

export default LandingLayout;
