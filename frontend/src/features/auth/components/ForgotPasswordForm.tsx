import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Send } from "lucide-react";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";
import { translateError } from "../../../utils/errorTranslator";

export const ForgotPasswordForm: React.FC = () => {
  const { forgotPassword } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Vui lòng nhập địa chỉ email");
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword({ email });
      toast.success("Yêu cầu thành công. Vui lòng kiểm tra hộp thư của bạn.");
    } catch (err: any) {
      toast.error(translateError(err.message) || "Không thể gửi yêu cầu khôi phục mật khẩu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Title Group */}
      <div className="lume-auth-title-group">
        <h1 className="lume-auth-title">
          Quên <span>mật khẩu?</span>
        </h1>
        <p className="lume-auth-subtitle">
          Nhập email tài khoản của bạn để nhận liên kết thiết lập lại mật khẩu an toàn.
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="lume-auth-form">
        <div className="lume-form-group">
          <label htmlFor="forgot-email" className="lume-form-label">
            Địa chỉ email
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="forgot-email"
              type="email"
              placeholder="nhap.email@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="lume-form-input has-left-icon"
              required
            />
            <div className="lume-form-input-icon-left">
              <Mail size={17} />
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={isLoading}
          className="lume-auth-submit-btn"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 150" />
              </svg>
              <span>Đang gửi yêu cầu...</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Gửi liên kết khôi phục</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="lume-auth-footer-switch">
        <span>Nhớ lại mật khẩu?</span>
        <Link to={ROUTES.LOGIN}>Quay lại Đăng nhập</Link>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;

