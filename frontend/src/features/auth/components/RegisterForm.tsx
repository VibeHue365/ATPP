import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";

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
      await register({
        email,
        fullName,
        phone,
        password,
      });

      toast.success("Đăng ký tài khoản thành công. Mã OTP đã được gửi.");
      navigate(ROUTES.VERIFY_EMAIL, {
        state: {
          email,
          message:
            "Đăng ký thành công. Hãy nhập mã OTP 6 số để kích hoạt tài khoản.",
        },
      });
    } catch (err: any) {
      toast.error(
        err.message ||
          "Đăng ký thất bại. Email hoặc số điện thoại có thể đã được sử dụng.",
      );
    } finally {
      setIsLoading(false);
    }
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
          marginBottom: "10px",
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
        style={{ fontSize: "20px", marginBottom: "2px" }}
      >
        Tạo tài khoản mới
      </h2>
      <p
        className="vh-greeting-subtitle"
        style={{ fontSize: "12px", marginBottom: "16px" }}
      >
        Bắt đầu hành trình văn hóa của bạn
      </p>

      <form
        onSubmit={handleSubmit}
        className="vh-auth-form"
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <Input
          label="Họ và tên"
          type="text"
          placeholder="Họ và tên"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          className="vh-underline-input"
          required
        />

        <Input
          label="Email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          className="vh-underline-input"
          required
        />

        <Input
          label="Số điện thoại"
          type="tel"
          placeholder="Số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          className="vh-underline-input"
          required
        />

        <div className="vh-form-row">
          <Input
            label="Mật khẩu"
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            className="vh-underline-input"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="vh-password-toggle-btn"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            required
          />

          <Input
            label="Xác nhận"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Xác nhận"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            className="vh-underline-input"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="vh-password-toggle-btn"
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            required
          />
        </div>

        <div
          className="vh-form-utils"
          style={{
            margin: "4px 0 10px",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <label
            className="vh-checkbox-container"
            style={{ alignItems: "flex-start" }}
          >
            <input
              type="checkbox"
              className="vh-checkbox-input"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{ marginTop: "2px" }}
            />
            <span
              style={{
                fontWeight: 500,
                fontSize: "11px",
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
            height: "38px",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "0.05em",
          }}
        >
          Đăng ký
        </Button>
      </form>

      <div
        className="vh-auth-switch"
        style={{ marginTop: "14px", fontSize: "13px" }}
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
