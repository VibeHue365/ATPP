import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { ArrowLeft } from 'lucide-react';
import { ForgotPasswordForm } from '../../features/auth/components/ForgotPasswordForm';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <div className="vh-forgot-view">
      <Link to={ROUTES.LOGIN} className="vh-auth-back-link">
        <ArrowLeft size={16} />
        <span>Quay về Đăng nhập</span>
      </Link>

      <div className="vh-auth-header-card mt-2">
        <h2>Quên mật khẩu?</h2>
        <p>Nhập email của bạn để nhận liên kết đặt lại mật khẩu mới</p>
      </div>

      <ForgotPasswordForm />
    </div>
  );
};

export default ForgotPasswordPage;

