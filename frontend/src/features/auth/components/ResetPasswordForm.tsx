import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Lock, ShieldAlert } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Input } from "../../../components/common/Input";
import { useToast } from "../../../components/feedback/Toast";
import { ROUTES } from "../../../config/routes";
import { useAuth } from "../hooks/useAuth";

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
        err.message ||
          "Đặt lại mật khẩu thất bại. Mã khôi phục có thể đã quá hạn.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="vh-auth-form mt-4">
      <Input
        label="Mã khôi phục"
        type="text"
        placeholder="Nhập mã khôi phục từ liên kết email"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        error={errors.token}
        leftIcon={<KeyRound size={18} />}
        required
      />

      <Input
        label="Mật khẩu mới"
        type="password"
        placeholder="••••••••"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={errors.newPassword}
        leftIcon={<Lock size={18} />}
        required
      />

      <Input
        label="Xác nhận mật khẩu mới"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
        leftIcon={<Lock size={18} />}
        required
      />

      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        leftIcon={<ShieldAlert size={16} />}
        className="w-full mt-6"
      >
        Xác nhận đổi mật khẩu
      </Button>
    </form>
  );
};
