import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loading } from "../../components/feedback/Loading";
import { useToast } from "../../components/feedback/Toast";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { authService } from "../../features/auth/services/authService";
import { ROUTES } from "../../config/routes";

export const OAuthCallback: React.FC = () => {
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (handledRef.current) {
        return;
      }
      handledRef.current = true;

      const code = searchParams.get("code");

      if (code) {
        try {
          const session = await authService.exchangeOAuthCode(code);
          const user = await setSession(session.accessToken, session.refreshToken);
          toast.success("Đăng nhập bằng tài khoản Google thành công.");
          
          if (user?.roles?.includes('ADMIN') || user?.roles?.includes('admin')) {
            navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
          } else if (user?.roles?.includes('PROVIDER')) {
            navigate(ROUTES.PROVIDER_DASHBOARD, { replace: true });
          } else {
            navigate(ROUTES.LANDING, { replace: true });
          }
        } catch (err: any) {
          console.error("OAuth callback session establishment failed:", err);
          toast.error(
            "Không thể đồng bộ phiên làm việc. Vui lòng đăng nhập lại.",
          );
          navigate(ROUTES.LOGIN, { replace: true });
        }
      } else {
        toast.error("Tham số xác thực Google không hợp lệ hoặc bị thiếu.");
        navigate(ROUTES.LOGIN, { replace: true });
      }
    };

    void handleCallback();
  }, [navigate, searchParams, setSession, toast]);

  return (
    <Loading fullScreen message="Đang liên kết tài khoản Google của bạn..." />
  );
};

export default OAuthCallback;
