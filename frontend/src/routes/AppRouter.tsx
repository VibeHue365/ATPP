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
        </Route>
      </Route>

      {/* 404 Route Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
