import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";
import { translateError } from "../../../utils/errorTranslator";

export const RegisterForm: React.FC = () => {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    fullName?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  }>({});

  const validate = () => {
    const tempErrors: typeof errors = {};

    if (!fullName) tempErrors.fullName = "Vui lòng nhập họ và tên";
    else if (fullName.length < 3) {
      tempErrors.fullName = "Họ tên phải chứa ít nhất 3 ký tự";
    }

    if (!email) tempErrors.email = "Vui lòng nhập địa chỉ email";
    else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "Email không hợp lệ";
    }

    if (!phone) tempErrors.phone = "Vui lòng nhập số điện thoại";
    else if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) {
      tempErrors.phone = "Số điện thoại không hợp lệ (8-20 số)";
    }

    if (!password) tempErrors.password = "Vui lòng nhập mật khẩu";
    else if (password.length < 8) {
      tempErrors.password = "Mật khẩu phải chứa ít nhất 8 ký tự";
    }

    if (password !== confirmPassword) {
      tempErrors.confirmPassword = "Mật khẩu xác nhận không trùng khớp";
    }

    if (!agreeTerms) {
      tempErrors.agreeTerms = "Bạn phải đồng ý với Điều khoản dịch vụ";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      if (!agreeTerms) {
        toast.error(
          "Vui lòng đọc và đồng ý với Điều khoản dịch vụ để tiếp tục.",
        );
      }
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        email,
        fullName,
        phone,
        password,
      });

      const demoOtpHint = result?.demoOtp
        ? ` Mã OTP demo: ${result.demoOtp}`
        : "";
      toast.success(
        `Đăng ký tài khoản thành công. Mã OTP đã được gửi.${demoOtpHint}`,
      );
      navigate(ROUTES.VERIFY_EMAIL, {
        state: {
          email,
          message:
            `Đăng ký thành công. Hãy nhập mã OTP 6 số để kích hoạt tài khoản.${demoOtpHint}`,
        },
      });
    } catch (err: any) {
      toast.error(
        translateError(err.message) ||
          "Đăng ký thất bại. Email hoặc số điện thoại có thể đã được sử dụng.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <style>{`
        .vh-register-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .vh-register-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
          marginBottom: "12px",
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

      <h2
        className="vh-greeting-title"
        style={{
          fontSize: "20px",
          fontWeight: 800,
          color: "#2D2926",
          marginBottom: "6px",
        }}
      >
        Tạo tài khoản mới
      </h2>
      <p
        className="vh-greeting-subtitle"
        style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          marginBottom: "16px",
          lineHeight: 1.5,
        }}
      >
        Bắt đầu hành trình văn hóa của bạn
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="vh-auth-form"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        <Input
          label="Họ và tên"
          type="text"
          placeholder="Nhập họ và tên..."
          value={fullName}
          onChange={(e) => {
            const val = e.target.value;
            setFullName(val);
            if (errors.fullName) {
              setErrors((prev) => ({
                ...prev,
                fullName: !val
                  ? "Vui lòng nhập họ và tên"
                  : val.length < 3
                    ? "Họ tên phải chứa ít nhất 3 ký tự"
                    : undefined,
              }));
            }
          }}
          error={errors.fullName}
          className="vh-premium-input"
          required
        />

        <Input
          label="Email"
          type="email"
          placeholder="Nhập địa chỉ email..."
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
          label="Số điện thoại"
          type="tel"
          placeholder="Nhập số điện thoại..."
          value={phone}
          onChange={(e) => {
            const val = e.target.value;
            setPhone(val);
            if (errors.phone) {
              setErrors((prev) => ({
                ...prev,
                phone: !val
                  ? "Vui lòng nhập số điện thoại"
                  : !/^[0-9+\-\s()]{8,20}$/.test(val)
                    ? "Số điện thoại không hợp lệ (8-20 số)"
                    : undefined,
              }));
            }
          }}
          error={errors.phone}
          className="vh-premium-input"
          required
        />

        <div className="vh-register-form-row">
          <Input
            label="Mật khẩu"
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu..."
            value={password}
            onChange={(e) => {
              const val = e.target.value;
              setPassword(val);
              if (errors.password || errors.confirmPassword) {
                setErrors((prev) => ({
                  ...prev,
                  password: !val
                    ? "Vui lòng nhập mật khẩu"
                    : val.length < 8
                      ? "Mật khẩu phải chứa ít nhất 8 ký tự"
                      : undefined,
                  confirmPassword:
                    errors.confirmPassword && val !== confirmPassword
                      ? "Mật khẩu xác nhận không trùng khớp"
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

          <Input
            label="Xác nhận"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Xác nhận..."
            value={confirmPassword}
            onChange={(e) => {
              const val = e.target.value;
              setConfirmPassword(val);
              if (errors.confirmPassword) {
                setErrors((prev) => ({
                  ...prev,
                  confirmPassword:
                    val !== password
                      ? "Mật khẩu xác nhận không trùng khớp"
                      : undefined,
                }));
              }
            }}
            error={errors.confirmPassword}
            className="vh-premium-input"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            required
          />
        </div>

        <div
          className="vh-form-utils"
          style={{
            margin: "2px 0 6px",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <label
            className="vh-checkbox-container"
            style={{ display: "flex", alignItems: "flex-start", gap: "6px", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              className="vh-checkbox-input"
              checked={agreeTerms}
              onChange={(e) => {
                const checked = e.target.checked;
                setAgreeTerms(checked);
                if (errors.agreeTerms) {
                  setErrors((prev) => ({
                    ...prev,
                    agreeTerms: checked
                      ? undefined
                      : "Bạn phải đồng ý với Điều khoản dịch vụ",
                  }));
                }
              }}
              style={{ marginTop: "3px", cursor: "pointer" }}
            />
            <span
              style={{
                fontWeight: 500,
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Tôi đồng ý với các{" "}
              <a
                href="#terms"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Điều khoản dịch vụ đang được cập nhật.");
                }}
                style={{ fontWeight: 700, color: "var(--color-primary)" }}
              >
                Điều khoản dịch vụ
              </a>{" "}
              và{" "}
              <a
                href="#privacy"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Chính sách bảo mật đang được cập nhật.");
                }}
                style={{ fontWeight: 700, color: "var(--color-primary)" }}
              >
                Chính sách bảo mật
              </a>{" "}
              của Silk &amp; Stone Heritage.
            </span>
          </label>
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
          Đăng ký
        </Button>
      </form>

      <div
        className="vh-auth-switch"
        style={{ marginTop: "12px", fontSize: "14px" }}
      >
        <span>Đã có tài khoản?</span>{" "}
        <Link
          to={ROUTES.LOGIN}
          style={{ fontWeight: 700, color: "var(--color-primary)" }}
        >
          Đăng nhập ngay
        </Link>
      </div>
    </div>
  );
};
