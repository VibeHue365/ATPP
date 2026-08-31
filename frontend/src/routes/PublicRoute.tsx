import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loading } from "../components/feedback/Loading";
import { useAuth } from "../features/auth/hooks/useAuth";
import { ROUTES } from "../config/routes";

const getValidRedirectPath = (fromState: any): string => {
  let path: string = ROUTES.LANDING;
  if (typeof fromState === "string" && fromState.trim()) {
    path = fromState;
  } else if (fromState?.pathname) {
    path = `${fromState.pathname}${fromState.search || ""}${fromState.hash || ""}`;
  }

  // Avoid redirecting back to auth pages
  if (
    path.startsWith("/auth") ||
    path === (ROUTES.LOGIN as string) ||
    path === (ROUTES.REGISTER as string) ||
    path === (ROUTES.VERIFY_EMAIL as string) ||
    path === (ROUTES.FORGOT_PASSWORD as string) ||
    path === (ROUTES.RESET_PASSWORD as string) ||
    path === (ROUTES.OAUTH_CALLBACK as string)
  ) {
    return ROUTES.LANDING;
  }

  return path;
};

export const PublicRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loading fullScreen message="Đang khởi tạo ứng dụng..." />;
  }

  if (isAuthenticated) {
    if (user?.roles?.includes("ADMIN") || user?.roles?.includes("admin")) {
      return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />;
    }
    if (user?.roles?.includes("PROVIDER")) {
      return <Navigate to={ROUTES.PROVIDER_DASHBOARD} replace />;
    }
    const destination = getValidRedirectPath((location.state as any)?.from);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;

