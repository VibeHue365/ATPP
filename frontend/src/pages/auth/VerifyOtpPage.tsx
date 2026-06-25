import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useToast } from "../../components/feedback/Toast";
import { ROUTES } from "../../config/routes";
import { VerifyOtpForm } from "../../features/auth/components/VerifyOtpForm";

export const VerifyOtpPage: React.FC = () => {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { email?: string; message?: string } | null;
  const stateEmail = state?.email || "";

  useEffect(() => {
    if (state?.message) {
      toast.info(state.message);
      navigate(location.pathname, {
        replace: true,
        state: state.email ? { email: state.email } : null,
      });
    }
  }, [location.pathname, navigate, state, toast]);

  return (
    <div className="vh-otp-view">
      <Link to={ROUTES.REGISTER} className="vh-auth-back-link">
        <ArrowLeft size={16} />
        <span>Trở về Đăng ký</span>
      </Link>

      <div className="vh-auth-header-card mt-2">
        <h2>Xác thực tài khoản</h2>
        <p>Chúng tôi đã gửi mã xác thực OTP 6 số đến email của bạn</p>
      </div>

      <VerifyOtpForm initialEmail={stateEmail} />
    </div>
  );
};

export default VerifyOtpPage;
