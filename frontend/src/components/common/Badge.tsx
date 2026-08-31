import React from 'react';

export interface BadgeProps {
  tone?: 'primary' | 'neutral' | 'success' | 'gold';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'primary',
  children,
  className = '',
}) => {
  const getStyleByTone = () => {
    switch (tone) {
      case 'primary':
        return {
          backgroundColor: 'var(--landing-primary-soft, #F3E7E9)',
          color: 'var(--landing-primary, #7D3543)',
          border: '1px solid var(--landing-border, #E8DEDF)',
        };
      case 'gold':
        return {
          backgroundColor: 'rgba(182, 145, 91, 0.1)',
          color: '#B6915B',
          border: '1px solid rgba(182, 145, 91, 0.2)',
        };
      case 'success':
        return {
          backgroundColor: '#E8F5E9',
          color: '#2E7D32',
          border: '1px solid #C8E6C9',
        };
      case 'neutral':
      default:
        return {
          backgroundColor: '#F3EBEC',
          color: '#6F6264',
          border: '1px solid #E8DEDF',
        };
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${className}`}
      style={getStyleByTone()}
    >
      {children}
    </span>
  );
};
