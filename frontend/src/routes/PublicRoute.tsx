import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loading } from "../components/feedback/Loading";
import { useAuth } from "../features/auth/hooks/useAuth";
import { ROUTES } from "../config/routes";

export const PublicRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <Loading fullScreen message="Đang khởi tạo ứng dụng..." />;
  }

  if (isAuthenticated) {
    if (user?.roles?.includes('ADMIN') || user?.roles?.includes('admin')) {
      return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />;
    }
    if (user?.roles?.includes('PROVIDER')) {
      return <Navigate to={ROUTES.PROVIDER_DASHBOARD} replace />;
    }
    // A customer returning to an auth page should land on the storefront.
    // Redirecting to Profile here races the LoginForm's post-login navigation.
    return <Navigate to={ROUTES.LANDING} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
