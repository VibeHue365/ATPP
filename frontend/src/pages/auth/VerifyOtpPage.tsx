import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../components/feedback/Toast";
import { VerifyOtpForm } from "../../features/auth/components/VerifyOtpForm";

export const VerifyOtpPage: React.FC = () => {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { email?: string; message?: string } | null;
  const stateEmail = state?.email || "";

  useEffect(() => {
    if (state?.message) {
      toast.info(state.message);
      navigate(location.pathname, {
        replace: true,
        state: state.email ? { email: state.email } : null,
      });
    }
  }, [location.pathname, navigate, state, toast]);

  return (
    <div className="w-full">
      <VerifyOtpForm initialEmail={stateEmail} />
    </div>
  );
};

export default VerifyOtpPage;

