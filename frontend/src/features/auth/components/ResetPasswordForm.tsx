import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";
import { translateError } from "../../../utils/errorTranslator";

interface ResetPasswordFormProps {
  initialToken?: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  initialToken = "",
}) => {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
    }
  }, [initialToken]);

  const validate = () => {
    const tempErrors: typeof errors = {};
    if (!token) tempErrors.token = "Vui lòng cung cấp mã khôi phục";

    if (!newPassword) tempErrors.newPassword = "Vui lòng nhập mật khẩu mới";
    else if (newPassword.length < 8) {
      tempErrors.newPassword = "Mật khẩu mới phải có tối thiểu 8 ký tự";
    }

    if (newPassword !== confirmPassword) {
      tempErrors.confirmPassword = "Mật khẩu xác nhận không trùng khớp";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await resetPassword({ token, newPassword });
      toast.success(
        "Đổi mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.",
      );
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err: any) {
      toast.error(
        translateError(err.message) ||
          "Đặt lại mật khẩu thất bại. Mã khôi phục có thể đã quá hạn.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Title Group */}
      <div className="lume-auth-title-group">
        <h1 className="lume-auth-title">
          Đặt lại <span>mật khẩu</span>
        </h1>
        <p className="lume-auth-subtitle">
          Tạo mật khẩu mới an toàn cho tài khoản LUMÉ của bạn.
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="lume-auth-form">
        {/* Token */}
        <div className="lume-form-group">
          <label htmlFor="reset-token" className="lume-form-label">
            Mã khôi phục
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reset-token"
              type="text"
              placeholder="Nhập mã khôi phục từ email..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`lume-form-input has-left-icon ${errors.token ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <KeyRound size={17} />
            </div>
          </div>
          {errors.token && <span className="lume-form-error-text">{errors.token}</span>}
        </div>

        {/* New Password */}
        <div className="lume-form-group">
          <label htmlFor="reset-new-password" className="lume-form-label">
            Mật khẩu mới
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reset-new-password"
              type={showPassword ? "text" : "password"}
              placeholder="Tối thiểu 8 ký tự"
              value={newPassword}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              className={`lume-form-input has-left-icon has-right-icon ${errors.newPassword ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <Lock size={17} />
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="lume-form-input-toggle-btn"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.newPassword && <span className="lume-form-error-text">{errors.newPassword}</span>}
        </div>

        {/* Confirm New Password */}
        <div className="lume-form-group">
          <label htmlFor="reset-confirm-password" className="lume-form-label">
            Xác nhận mật khẩu mới
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reset-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`lume-form-input has-left-icon has-right-icon ${errors.confirmPassword ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <Lock size={17} />
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="lume-form-input-toggle-btn"
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.confirmPassword && <span className="lume-form-error-text">{errors.confirmPassword}</span>}
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
              <span>Đang lưu mật khẩu...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Xác nhận đổi mật khẩu</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="lume-auth-footer-switch">
        <span>Đã nhớ lại mật khẩu?</span>
        <Link to={ROUTES.LOGIN}>Quay lại Đăng nhập</Link>
      </div>
    </div>
  );
};

export default ResetPasswordForm;

