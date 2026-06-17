import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loading } from "../../components/feedback/Loading";
import { useToast } from "../../components/feedback/Toast";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { ROUTES } from "../../config/routes";

export const OAuthCallback: React.FC = () => {
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get("accessToken");
      const refreshToken = searchParams.get("refreshToken");

      if (accessToken && refreshToken) {
        try {
          await setSession(accessToken, refreshToken);
          toast.success("Đăng nhập bằng tài khoản Google thành công.");
          navigate(ROUTES.LANDING, { replace: true });
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
