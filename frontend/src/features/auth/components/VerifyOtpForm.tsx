import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";
import { translateError } from "../../../utils/errorTranslator";

interface VerifyOtpFormProps {
  initialEmail?: string;
}

export const VerifyOtpForm: React.FC<VerifyOtpFormProps> = ({
  initialEmail = "",
}) => {
  const { verifyEmail, resendOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Vui lòng cung cấp địa chỉ email");
      return;
    }

    if (!otp || otp.length < 6) {
      toast.error("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail({ email, otp });
      toast.success("Xác thực tài khoản thành công. Vui lòng đăng nhập.");
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          email,
          message: "Tài khoản đã được kích hoạt thành công. Vui lòng đăng nhập.",
        },
      });
    } catch (err: any) {
      toast.error(translateError(err.message) || "Mã OTP không hợp lệ hoặc đã hết hạn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error("Vui lòng nhập email trước khi gửi lại");
      return;
    }

    setIsResending(true);
    try {
      await resendOtp({ email });
      toast.success("Mã OTP mới đã được gửi thành công.");
      setCooldown(60);
    } catch (err: any) {
      toast.error(
        translateError(err.message) || "Không thể gửi lại mã OTP. Vui lòng thử lại sau.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full">
      {/* Title Group */}
      <div className="lume-auth-title-group">
        <h1 className="lume-auth-title">
          Xác thực <span>tài khoản</span>
        </h1>
        <p className="lume-auth-subtitle">
          Nhập mã OTP 6 số đã được gửi tới email của bạn để kích hoạt tài khoản.
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="lume-auth-form">
        <div className="lume-form-group">
          <label htmlFor="otp-email" className="lume-form-label">
            Địa chỉ email
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="otp-email"
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

        <div className="lume-form-group">
          <label htmlFor="otp-code" className="lume-form-label">
            Mã xác thực OTP (6 chữ số)
          </label>
          <div className="lume-form-input-wrapper">
            <input
              id="otp-code"
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otp}
              autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="lume-form-input has-left-icon font-mono text-center tracking-[0.3em] font-bold text-lg"
              required
            />
            <div className="lume-form-input-icon-left">
              <ShieldCheck size={17} />
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="lume-auth-submit-btn"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 150" />
              </svg>
              <span>Đang kích hoạt...</span>
            </>
          ) : (
            <span>Kích hoạt tài khoản</span>
          )}
        </button>
      </form>

      {/* Resend OTP Block */}
      <div className="mt-4 pt-4 border-t border-[#E8DEDF]/70 flex items-center justify-between text-xs text-[#6F6264]">
        <span>Chưa nhận được mã OTP?</span>
        {cooldown > 0 ? (
          <span className="font-semibold text-[#B52B47]">Gửi lại sau {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="font-bold text-[#B52B47] hover:underline bg-transparent border-none p-0 cursor-pointer flex items-center gap-1.5"
          >
            {isResending && <RefreshCw size={12} className="animate-spin" />}
            <span>Gửi lại mã OTP</span>
          </button>
        )}
      </div>

      {/* Switch Link */}
      <div className="lume-auth-footer-switch">
        <span>Đã có tài khoản?</span>
        <Link to={ROUTES.LOGIN}>Đăng nhập ngay</Link>
      </div>
    </div>
  );
};

export default VerifyOtpForm;

