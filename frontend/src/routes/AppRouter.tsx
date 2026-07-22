import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../config/routes';

// Layouts
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

// Guards
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Pages
import LandingPage from '../pages/LandingPage';
import { AoDaiListingPage } from '../pages/rentals/AoDaiListingPage';
import { ProductDetailPage } from '../pages/rentals/ProductDetailPage';
import { PhotographersListingPage } from '../pages/photographers/PhotographersListingPage';
import { PhotographerDetailPage } from '../pages/photographers/PhotographerDetailPage';
import { CartPage } from '../pages/cart/CartPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyOtpPage from '../pages/auth/VerifyOtpPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import OAuthCallback from '../pages/auth/OAuthCallback';
import ProfilePage from '../pages/dashboard/ProfilePage';
import SettingsPage from '../pages/dashboard/SettingsPage';
import NotFoundPage from '../pages/errors/NotFoundPage';
import OnboardingPage from '../pages/onboarding/OnboardingPage';
import ProviderDashboard from '../pages/providerdashboard/ProviderDashboard';
import BecomeProviderPage from '../pages/provider/BecomeProviderPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminDashboardRefactored from '../pages/admin/AdminDashboardRefactored';
import { ComboListingPage } from '../pages/combos/ComboListingPage';
import ComboDetailPage from '../pages/combos/ComboDetailPage';
import CheckoutResultPage from '../pages/checkout/CheckoutResultPage';
import NotificationsPage from '../pages/notifications/NotificationsPage';
import ChatPage from '../pages/chat/ChatPage';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Onboarding Page */}
      <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />

      {/* Provider Dashboard */}
      <Route path={ROUTES.PROVIDER_DASHBOARD} element={<ProviderDashboard />} />

      {/* Public Pages wrapped in MainLayout */}
      <Route element={<MainLayout />}>
        <Route path={ROUTES.LANDING} element={<LandingPage />} />
        <Route path={ROUTES.RENTALS} element={<AoDaiListingPage />} />
        <Route path={ROUTES.PRODUCT_DETAIL} element={<ProductDetailPage />} />
        <Route path={ROUTES.PHOTOGRAPHERS} element={<PhotographersListingPage />} />
        <Route path={ROUTES.PHOTOGRAPHER_DETAIL} element={<PhotographerDetailPage />} />
        <Route path={ROUTES.COMBOS} element={<ComboListingPage />} />
        <Route path={ROUTES.COMBO_DETAIL} element={<ComboDetailPage />} />
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
  );
};

export default AppRouter;
// Force Vite HMR reload to recognize the new ComboDetailPage route.
