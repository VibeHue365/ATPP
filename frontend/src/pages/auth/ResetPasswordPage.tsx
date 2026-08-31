import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../../components/feedback/Toast";
import { ResetPasswordForm } from "../../features/auth/components/ResetPasswordForm";

export const ResetPasswordPage: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      toast.success("Mã đặt lại mật khẩu đã được nạp tự động.");
    }
  }, [searchParams, toast]);

  return (
    <div className="w-full">
      <ResetPasswordForm initialToken={token} />
    </div>
  );
};

export default ResetPasswordPage;

