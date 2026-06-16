import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loading } from "../components/feedback/Loading";
import { useAuth } from "../features/auth/hooks/useAuth";
import { ROUTES } from "../config/routes";

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loading fullScreen message="Đang tải dữ liệu phiên làm việc..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
