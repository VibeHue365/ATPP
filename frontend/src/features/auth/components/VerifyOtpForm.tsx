import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";

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
          message: "Tài khoản đã được kích hoạt. Vui lòng đăng nhập.",
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Mã OTP không hợp lệ hoặc đã hết hạn.");
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
        err.message || "Không thể gửi lại mã OTP. Vui lòng thử lại sau.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="vh-auth-form">
        <Input
          label="Địa chỉ email"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={18} />}
          required
        />

        <Input
          label="Mã xác thực OTP (6 chữ số)"
          type="text"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          leftIcon={<ShieldCheck size={18} />}
          required
        />

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full mt-4"
        >
          Kích hoạt tài khoản
        </Button>
      </form>

      <div className="vh-otp-resend">
        <span>Không nhận được mã xác thực?</span>{" "}
        {cooldown > 0 ? (
          <span className="vh-cooldown-text">Gửi lại sau {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="vh-resend-btn"
          >
            {isResending ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : null}
            <span>Gửi lại mã OTP</span>
          </button>
        )}
      </div>
    </>
  );
};
