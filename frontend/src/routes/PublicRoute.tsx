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
    if (user?.roles?.includes('PROVIDER')) {
      return <Navigate to={ROUTES.PROVIDER_DASHBOARD} replace />;
    }
    return <Navigate to={ROUTES.PROFILE} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
