import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const id = useId();

  return (
    <div className={`vh-input-group ${error ? 'vh-input-has-error' : ''} ${disabled ? 'vh-input-disabled' : ''} ${className}`}>
      {label && <label htmlFor={id} className="vh-input-label">{label}</label>}
      <div className="vh-input-wrapper">
        {leftIcon && <span className="vh-input-icon-left">{leftIcon}</span>}
        <input
          id={id}
          className={`vh-input-field ${leftIcon ? 'vh-input-has-left' : ''} ${rightIcon ? 'vh-input-has-right' : ''}`}
          disabled={disabled}
          {...props}
        />
        {rightIcon && <span className="vh-input-icon-right">{rightIcon}</span>}
      </div>
      {error && <span className="vh-input-error-msg">{error}</span>}
    </div>
  );
};
