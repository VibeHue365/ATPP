import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useToast } from "../../components/feedback/Toast";
import { ROUTES } from "../../config/routes";
import { ResetPasswordForm } from "../../features/auth/components/ResetPasswordForm";

export const ResetPasswordPage: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      toast.success("Mã đặt lại mật khẩu đã được nạp tự động.");
    }
  }, [searchParams, toast]);

  return (
    <div className="vh-reset-view">
      <Link to={ROUTES.LOGIN} className="vh-auth-back-link">
        <ArrowLeft size={16} />
        <span>Quay về Đăng nhập</span>
      </Link>

      <div className="vh-auth-header-card mt-2">
        <h2>Đặt lại mật khẩu</h2>
        <p>Tạo mật khẩu mới cho tài khoản VibeHue của bạn</p>
      </div>

      <ResetPasswordForm initialToken={token} />
    </div>
  );
};

export default ResetPasswordPage;
