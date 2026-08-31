import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useToast } from "../../../components/feedback/Toast";
import { API_BASE_URL } from "../../../config/env";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";
import { translateError } from "../../../utils/errorTranslator";

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const state = location.state as { email?: string; message?: string } | null;
    if (state?.email) {
      setEmail(state.email);
    }
    if (state?.message) {
      toast.info(state.message);
    }
  }, [location.state, toast]);

  const validate = () => {
    const tempErrors: { email?: string; password?: string } = {};
    if (!email) tempErrors.email = "Vui lòng nhập địa chỉ email";
    else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "Email không đúng định dạng";
    }

    if (!password) tempErrors.password = "Vui lòng nhập mật khẩu";
    else if (password.length < 8) {
      tempErrors.password = "Mật khẩu phải chứa ít nhất 8 ký tự";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const loggedInUser = (await login({ email, password, rememberMe })) as any;
      toast.success("Đăng nhập thành công. Chào mừng bạn trở lại.");

      if (loggedInUser?.roles?.includes('ADMIN') || loggedInUser?.roles?.includes('admin')) {
        navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
      } else if (loggedInUser?.roles?.includes('PROVIDER')) {
        navigate(ROUTES.PROVIDER_DASHBOARD, { replace: true });
      } else {
        const fromState = (location.state as any)?.from;
        let destination: string = ROUTES.LANDING;
        if (typeof fromState === 'string' && fromState.trim()) {
          destination = fromState;
        } else if (fromState?.pathname) {
          destination = `${fromState.pathname}${fromState.search || ''}${fromState.hash || ''}`;
        }
        if (destination.startsWith('/auth')) {
          destination = ROUTES.LANDING;
        }
        navigate(destination as any, { replace: true });
      }
    } catch (err: any) {
      toast.error(
        translateError(err.message) || "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleFacebookLogin = () => {
    toast.info("Tính năng đăng nhập Facebook đang được tích hợp.");
  };

  return (
    <div className="w-full">
      {/* Title Group */}
      <div className="lume-auth-title-group">
        <h1 className="lume-auth-title">
          Chào mừng bạn <span>trở lại</span>
        </h1>
        <p className="lume-auth-subtitle">
          Đăng nhập để tiếp tục hành trình trải nghiệm di sản và đặt lịch chụp ảnh.
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} noValidate className="lume-auth-form">
        {/* Email Input */}
        <div className="lume-form-group">
          <label htmlFor="login-email" className="lume-form-label">
            Email tài khoản
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="login-email"
              type="email"
              placeholder="nhap.email@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                if (errors.email) {
                  setErrors((prev) => ({
                    ...prev,
                    email: !val
                      ? "Vui lòng nhập địa chỉ email"
                      : !/\S+@\S+\.\S+/.test(val)
                      ? "Email không đúng định dạng"
                      : undefined,
                  }));
                }
              }}
              className={`lume-form-input has-left-icon ${errors.email ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <Mail size={17} />
            </div>
          </div>
          {errors.email && <span className="lume-form-error-text">{errors.email}</span>}
        </div>

        {/* Password Input */}
        <div className="lume-form-group">
          <label htmlFor="login-password" className="lume-form-label">
            Mật khẩu
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                const val = e.target.value;
                setPassword(val);
                if (errors.password) {
                  setErrors((prev) => ({
                    ...prev,
                    password: !val
                      ? "Vui lòng nhập mật khẩu"
                      : val.length < 8
                      ? "Mật khẩu phải chứa ít nhất 8 ký tự"
                      : undefined,
                  }));
                }
              }}
              className={`lume-form-input has-left-icon has-right-icon ${errors.password ? 'is-error' : ''}`}
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
          {errors.password && <span className="lume-form-error-text">{errors.password}</span>}
        </div>

        {/* Remember Me & Forgot Password Row */}
        <div className="lume-auth-options-row">
          <label className="lume-auth-checkbox-label">
            <input
              type="checkbox"
              className="lume-auth-checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <Link to={ROUTES.FORGOT_PASSWORD} className="lume-auth-forgot-link">
            Quên mật khẩu?
          </Link>
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
              <span>Đang xác thực...</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="lume-auth-divider">
        <span>Hoặc tiếp tục với</span>
      </div>

      {/* Social Buttons */}
      <div className="lume-auth-social-grid">
        <button
          type="button"
          className="lume-auth-social-btn"
          onClick={handleGoogleLogin}
        >
          <svg style={{ width: "17px", height: "17px" }} viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Google</span>
        </button>

        <button
          type="button"
          className="lume-auth-social-btn"
          onClick={handleFacebookLogin}
        >
          <svg
            style={{ width: "17px", height: "17px" }}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
              fill="#1877F2"
            />
          </svg>
          <span>Facebook</span>
        </button>
      </div>

      {/* Switch to Register */}
      <div className="lume-auth-footer-switch">
        <span>Chưa có tài khoản?</span>
        <Link to={ROUTES.REGISTER}>Đăng ký ngay</Link>
      </div>
    </div>
  );
};

export default LoginForm;

