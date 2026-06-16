import React from 'react';
import { LoginForm } from '../../features/auth/components/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <div className="vh-login-view">
      <LoginForm />
    </div>
  );
};

export default LoginPage;

