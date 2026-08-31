import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
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

  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

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
      tempErrors.email = "Email không hợp lệ";
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
    toast.info("Tính năng đăng nhập Facebook đang được phát triển.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <Link
        to={ROUTES.LANDING}
        className="vh-auth-back-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textDecoration: "none",
          marginBottom: "24px",
          alignSelf: "flex-start",
          transition: "var(--transition-smooth)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--color-primary)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--color-text-secondary)")
        }
      >
        <ArrowLeft size={14} />
        Quay lại trang chủ
      </Link>

      <h1 
        className="vh-brand-title"
        style={{
          fontFamily: "'Libre Caslon Text', serif",
          fontSize: "36px",
          fontWeight: 700,
          background: "linear-gradient(135deg, #4A0E17 0%, #B89047 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "8px",
          lineHeight: 1.2,
        }}
      >
        Silk &amp; Stone
      </h1>

      <h2 
        className="vh-greeting-title"
        style={{
          fontSize: "20px",
          fontWeight: 800,
          color: "#2D2926",
          marginBottom: "6px",
        }}
      >
        Chào mừng bạn trở lại
      </h2>
      <p 
        className="vh-greeting-subtitle"
        style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          marginBottom: "28px",
          lineHeight: 1.5,
        }}
      >
        Vui lòng đăng nhập để tiếp tục hành trình văn hóa.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="vh-auth-form"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <Input
          label="Email đăng nhập"
          type="email"
          placeholder="Nhập email của bạn..."
          value={email}
          onChange={(e) => {
            const val = e.target.value;
            setEmail(val);
            if (errors.email) {
              setErrors((prev) => ({
                ...prev,
                email: !val
                  ? "Vui lòng nhập địa chỉ email"
                  : !/\S+@\S+\.\S+/.test(val)
                    ? "Email không hợp lệ"
                    : undefined,
              }));
            }
          }}
          error={errors.email}
          className="vh-premium-input"
          required
        />

        <Input
          label="Mật khẩu"
          type={showPassword ? "text" : "password"}
          placeholder="Nhập mật khẩu..."
          value={password}
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
          error={errors.password}
          className="vh-premium-input"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="vh-password-toggle-btn"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                color: "var(--color-text-secondary)",
                outline: "none",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          required
        />

        <div
          className="vh-form-utils"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "2px 0 10px",
          }}
        >
          <label className="vh-checkbox-container" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="checkbox"
              className="vh-checkbox-input"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--color-text-primary)",
              }}
            >
              Ghi nhớ đăng nhập
            </span>
          </label>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="vh-auth-link-sm"
            style={{
              margin: 0,
              fontWeight: 700,
              color: "var(--color-primary)",
              fontSize: "13px",
            }}
          >
            Quên mật khẩu?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="w-full"
          style={{
            height: "44px",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "0.02em",
            backgroundColor: "var(--color-primary)",
            border: "none",
            boxShadow: "0 4px 12px rgba(161, 30, 34, 0.2)",
            transition: "all 0.2s ease",
            cursor: "pointer",
            color: "white",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-primary-light)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(161, 30, 34, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-primary)";
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(161, 30, 34, 0.2)";
          }}
        >
          Đăng nhập
        </Button>
      </form>

      <div className="vh-auth-divider" style={{ margin: "20px 0" }}>
        <span>Hoặc tiếp tục với</span>
      </div>

      <div className="vh-social-grid">
        <button
          type="button"
          className="vh-social-btn"
          onClick={handleGoogleLogin}
        >
          <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24">
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
          Google
        </button>

        <button
          type="button"
          className="vh-social-btn"
          onClick={handleFacebookLogin}
        >
          <svg
            style={{ width: "18px", height: "18px" }}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
              fill="#1877F2"
            />
          </svg>
          Facebook
        </button>
      </div>

      <div className="vh-auth-switch" style={{ marginTop: "20px", fontSize: "14px" }}>
        <span>Chưa có tài khoản?</span>{" "}
        <Link
          to={ROUTES.REGISTER}
          style={{ fontWeight: 700, color: "var(--color-primary)" }}
        >
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
};
