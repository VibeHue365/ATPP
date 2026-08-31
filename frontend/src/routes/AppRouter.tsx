import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../config/routes';

// Layouts
import MainLayout from '../layouts/MainLayout';
import LandingLayout from '../layouts/LandingLayout';
import AuthLayout from '../layouts/AuthLayout';

// Guards
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Lazy-loaded Pages
const LandingPage = lazy(() => import('../pages/LandingPage'));
const AoDaiListingPage = lazy(() =>
  import('../pages/rentals/AoDaiListingPage').then((m) => ({ default: m.AoDaiListingPage }))
);
const ProductDetailPage = lazy(() =>
  import('../pages/rentals/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const PhotographersListingPage = lazy(() =>
  import('../pages/photographers/PhotographersListingPage').then((m) => ({ default: m.PhotographersListingPage }))
);
const PhotographerDetailPage = lazy(() =>
  import('../pages/photographers/PhotographerDetailPage').then((m) => ({ default: m.PhotographerDetailPage }))
);
const CartPage = lazy(() =>
  import('../pages/cart/CartPage').then((m) => ({ default: m.CartPage }))
);
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const VerifyOtpPage = lazy(() => import('../pages/auth/VerifyOtpPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const OAuthCallback = lazy(() => import('../pages/auth/OAuthCallback'));
const ProfilePage = lazy(() => import('../pages/dashboard/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/dashboard/SettingsPage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
const OnboardingPage = lazy(() => import('../pages/onboarding/OnboardingPage'));
const ProviderDashboard = lazy(() => import('../pages/providerdashboard/ProviderDashboard'));
const BecomeProviderPage = lazy(() => import('../pages/provider/BecomeProviderPage'));
const AdminDashboardRefactored = lazy(() => import('../pages/admin/AdminDashboardRefactored'));
const ComboListingPage = lazy(() =>
  import('../pages/combos/ComboListingPage').then((m) => ({ default: m.ComboListingPage }))
);
const ComboDetailPage = lazy(() => import('../pages/combos/ComboDetailPage'));
const CheckoutResultPage = lazy(() => import('../pages/checkout/CheckoutResultPage'));
const ProviderStorePage = lazy(() => import('../pages/store/ProviderStorePage'));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage'));
const ChatPage = lazy(() => import('../pages/chat/ChatPage'));
const VirtualTryOn3DPage = lazy(() => import('../pages/virtual-tryon/VirtualTryOn3DPage'));

const PageFallbackLoader: React.FC = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}
  >
    <div
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(118, 20, 28, 0.15)',
        borderTopColor: '#76141C',
        borderRadius: '50%',
        animation: 'vh-spin 0.8s linear infinite',
      }}
    />
    <style>{`
      @keyframes vh-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<PageFallbackLoader />}>
      <Routes>
        {/* Onboarding Page */}
        <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />

        {/* Provider Dashboard */}
        <Route path={ROUTES.PROVIDER_DASHBOARD} element={<ProviderDashboard />} />

        {/* Landing Page with Scoped LandingLayout */}
        <Route element={<LandingLayout />}>
          <Route path={ROUTES.LANDING} element={<LandingPage />} />
        </Route>

        {/* Public Pages wrapped in MainLayout */}
        <Route element={<MainLayout />}>
          <Route path={ROUTES.RENTALS} element={<AoDaiListingPage />} />
          <Route path={ROUTES.PRODUCT_DETAIL} element={<ProductDetailPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path={ROUTES.VIRTUAL_TRYON_3D} element={<VirtualTryOn3DPage />} />
          <Route path={ROUTES.PHOTOGRAPHERS} element={<PhotographersListingPage />} />
          <Route path={ROUTES.PHOTOGRAPHER_DETAIL} element={<PhotographerDetailPage />} />
          <Route path={ROUTES.COMBOS} element={<ComboListingPage />} />
          <Route path={ROUTES.COMBO_DETAIL} element={<ComboDetailPage />} />
          <Route path={ROUTES.PROVIDER_STORE} element={<ProviderStorePage />} />
          <Route path={ROUTES.CART} element={<CartPage />} />
        </Route>

        {/* Google OAuth Callback Handler */}
        <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallback />} />

        {/* Guest-only Auth Pages guarded by PublicRoute */}
        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyOtpPage />} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
            <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* Private Profile Pages guarded by ProtectedRoute under MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Redirect /dashboard to /dashboard/profile */}
            <Route path={ROUTES.DASHBOARD} element={<Navigate to={ROUTES.PROFILE} replace />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
            <Route path={ROUTES.CHAT} element={<ChatPage />} />
            <Route path={ROUTES.CHECKOUT_RESULT} element={<CheckoutResultPage />} />
            <Route path="/payments/checkout/:code" element={<CheckoutResultPage />} />
            <Route path={ROUTES.PROVIDER_REGISTER} element={<BecomeProviderPage />} />
          </Route>
          {/* Admin Dashboard Page (No MainLayout header/footer) */}
          <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardRefactored />} />
          {/* Parallel preview route: legacy dashboard remains the production route during refactor. */}
          <Route path={ROUTES.ADMIN_DASHBOARD_REFACTORED} element={<AdminDashboardRefactored />} />
        </Route>

        {/* 404 Route Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
