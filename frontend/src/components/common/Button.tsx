import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  return (
    <button
      className={`vh-btn vh-btn-${variant} vh-btn-${size} ${isLoading ? 'vh-btn-loading' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="vh-spinner-icon">
          <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 150" />
          </svg>
        </span>
      )}
      {!isLoading && leftIcon && <span className="vh-btn-icon-left">{leftIcon}</span>}
      <span className="vh-btn-text">{children}</span>
      {!isLoading && rightIcon && <span className="vh-btn-icon-right">{rightIcon}</span>}
    </button>
  );
};
