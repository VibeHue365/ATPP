import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
import { useToast } from "../../../components/feedback/Toast";
import { useAuth } from "../hooks/useAuth";

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
      toast.error(err.message || "Không thể gửi yêu cầu khôi phục mật khẩu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="vh-auth-form mt-4">
      <Input
        label="Địa chỉ email của bạn"
        type="email"
        placeholder="example@gmail.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<Mail size={18} />}
        required
      />

      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        leftIcon={<Send size={16} />}
        className="w-full mt-4"
      >
        Gửi yêu cầu khôi phục
      </Button>
    </form>
  );
};
