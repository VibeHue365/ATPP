import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Phone, Sparkles, User } from "lucide-react";
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

  // Password strength calculation
  const getPasswordStrength = (pwd: string): { score: number; text: string; colorClass: string } => {
    if (!pwd) return { score: 0, text: "", colorClass: "" };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score += 1;

    if (score === 1) return { score: 1, text: "Mật khẩu yếu", colorClass: "weak" };
    if (score === 2) return { score: 2, text: "Mật khẩu trung bình", colorClass: "medium" };
    return { score: 3, text: "Mật khẩu an toàn", colorClass: "strong" };
  };

  const strength = getPasswordStrength(password);

  const validate = () => {
    const tempErrors: typeof errors = {};

    if (!fullName.trim()) tempErrors.fullName = "Vui lòng nhập họ và tên";
    else if (fullName.trim().length < 3) {
      tempErrors.fullName = "Họ tên phải chứa ít nhất 3 ký tự";
    }

    if (!email.trim()) tempErrors.email = "Vui lòng nhập địa chỉ email";
    else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "Email không đúng định dạng";
    }

    if (!phone.trim()) tempErrors.phone = "Vui lòng nhập số điện thoại";
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
        toast.error("Vui lòng đọc và đồng ý với Điều khoản dịch vụ để tiếp tục.");
      }
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
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
          email: email.trim(),
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
    <div className="w-full">
      {/* Title Group */}
      <div className="lume-auth-title-group">
        <h1 className="lume-auth-title">
          Tạo tài khoản <span>mới</span>
        </h1>
        <p className="lume-auth-subtitle">
          Tham gia cộng đồng LUMÉ để thuê áo dài và đặt lịch chụp ảnh cao cấp.
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} noValidate className="lume-auth-form">
        {/* Full Name */}
        <div className="lume-form-group">
          <label htmlFor="reg-fullname" className="lume-form-label">
            Họ và tên
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reg-fullname"
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              autoComplete="name"
              onChange={(e) => {
                const val = e.target.value;
                setFullName(val);
                if (errors.fullName) {
                  setErrors((prev) => ({
                    ...prev,
                    fullName: !val.trim()
                      ? "Vui lòng nhập họ và tên"
                      : val.trim().length < 3
                      ? "Họ tên phải chứa ít nhất 3 ký tự"
                      : undefined,
                  }));
                }
              }}
              className={`lume-form-input has-left-icon ${errors.fullName ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <User size={17} />
            </div>
          </div>
          {errors.fullName && <span className="lume-form-error-text">{errors.fullName}</span>}
        </div>

        {/* Email */}
        <div className="lume-form-group">
          <label htmlFor="reg-email" className="lume-form-label">
            Địa chỉ email
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reg-email"
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
                    email: !val.trim()
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

        {/* Phone */}
        <div className="lume-form-group">
          <label htmlFor="reg-phone" className="lume-form-label">
            Số điện thoại
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="reg-phone"
              type="tel"
              placeholder="0912 345 678"
              value={phone}
              autoComplete="tel"
              onChange={(e) => {
                const val = e.target.value;
                setPhone(val);
                if (errors.phone) {
                  setErrors((prev) => ({
                    ...prev,
                    phone: !val.trim()
                      ? "Vui lòng nhập số điện thoại"
                      : !/^[0-9+\-\s()]{8,20}$/.test(val)
                      ? "Số điện thoại không hợp lệ (8-20 số)"
                      : undefined,
                  }));
                }
              }}
              className={`lume-form-input has-left-icon ${errors.phone ? 'is-error' : ''}`}
              required
            />
            <div className="lume-form-input-icon-left">
              <Phone size={17} />
            </div>
          </div>
          {errors.phone && <span className="lume-form-error-text">{errors.phone}</span>}
        </div>

        {/* Passwords (Side by side) */}
        <div className="lume-form-row">
          {/* Password */}
          <div className="lume-form-group">
            <label htmlFor="reg-password" className="lume-form-label">
              Mật khẩu
            </label>
            <div className="lume-form-input-wrapper">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                autoComplete="new-password"
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  if (errors.password || errors.confirmPassword) {
                    setErrors((prev) => ({
                      ...prev,
                      password: !val
                        ? "Vui lòng nhập mật khẩu"
                        : val.length < 8
                        ? "Tối thiểu 8 ký tự"
                        : undefined,
                      confirmPassword:
                        errors.confirmPassword && val !== confirmPassword
                          ? "Mật khẩu xác nhận không khớp"
                          : undefined,
                    }));
                  }
                }}
                className={`lume-form-input has-left-icon has-right-icon ${errors.password ? 'is-error' : ''}`}
                required
              />
              <div className="lume-form-input-icon-left">
                <Lock size={16} />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="lume-form-input-toggle-btn"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="lume-form-error-text">{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div className="lume-form-group">
            <label htmlFor="reg-confirm-password" className="lume-form-label">
              Xác nhận lại
            </label>
            <div className="lume-form-input-wrapper">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => {
                  const val = e.target.value;
                  setConfirmPassword(val);
                  if (errors.confirmPassword) {
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword:
                        val !== password
                          ? "Mật khẩu xác nhận không khớp"
                          : undefined,
                    }));
                  }
                }}
                className={`lume-form-input has-left-icon has-right-icon ${errors.confirmPassword ? 'is-error' : ''}`}
                required
              />
              <div className="lume-form-input-icon-left">
                <Lock size={16} />
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                className="lume-form-input-toggle-btn"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <span className="lume-form-error-text">{errors.confirmPassword}</span>}
          </div>
        </div>

        {/* Password Strength Meter */}
        {password.length > 0 && (
          <div className="lume-password-strength">
            <div className="lume-password-strength-bar">
              <div className={`lume-password-strength-segment ${strength.score >= 1 ? strength.colorClass : ''}`} />
              <div className={`lume-password-strength-segment ${strength.score >= 2 ? strength.colorClass : ''}`} />
              <div className={`lume-password-strength-segment ${strength.score >= 3 ? strength.colorClass : ''}`} />
            </div>
            <span className="lume-password-strength-label">{strength.text}</span>
          </div>
        )}

        {/* Terms Agreement Checkbox */}
        <div className="lume-auth-options-row" style={{ alignItems: 'flex-start' }}>
          <label className="lume-auth-checkbox-label" style={{ alignItems: 'flex-start', marginTop: '2px' }}>
            <input
              type="checkbox"
              className="lume-auth-checkbox"
              style={{ marginTop: '2px' }}
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
            />
            <span style={{ fontSize: '12px', lineHeight: 1.5 }}>
              Tôi đồng ý với{" "}
              <a
                href="#terms"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Điều khoản dịch vụ đang được cập nhật.");
                }}
                className="font-bold text-[#B52B47] hover:underline"
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
                className="font-bold text-[#B52B47] hover:underline"
              >
                Chính sách bảo mật
              </a>{" "}
              của LUMÉ Heritage.
            </span>
          </label>
        </div>
        {errors.agreeTerms && <span className="lume-form-error-text">{errors.agreeTerms}</span>}

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
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <span>Đăng ký tài khoản</span>
          )}
        </button>
      </form>

      {/* Partner Promotion Callout */}
      <div className="lume-auth-partner-card">
        <div className="lume-auth-partner-card-left">
          <Sparkles size={16} className="text-[#B52B47] shrink-0" />
          <span>Bạn là Chủ Studio hay Nhiếp ảnh gia?</span>
        </div>
        <Link to={ROUTES.PROVIDER_REGISTER} className="lume-auth-partner-card-link">
          Đăng ký đối tác ↗
        </Link>
      </div>

      {/* Switch to Login */}
      <div className="lume-auth-footer-switch">
        <span>Đã có tài khoản?</span>
        <Link to={ROUTES.LOGIN}>Đăng nhập ngay</Link>
      </div>
    </div>
  );
};

export default RegisterForm;

