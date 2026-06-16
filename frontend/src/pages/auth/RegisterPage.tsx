import React from 'react';
import { RegisterForm } from '../../features/auth/components/RegisterForm';

export const RegisterPage: React.FC = () => {
  return (
    <div className="vh-register-view">
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;

