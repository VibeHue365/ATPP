import React from 'react';

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Loading: React.FC<LoadingProps> = ({
  fullScreen = false,
  message = 'Đang tải dữ liệu...',
  size = 'md',
}) => {
  const content = (
    <div className={`vh-loading vh-loading-${size}`}>
      <div className="vh-loading-spinner">
        <div className="vh-loading-double-bounce1"></div>
        <div className="vh-loading-double-bounce2"></div>
      </div>
      {message && <p className="vh-loading-text">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="vh-loading-overlay">{content}</div>;
  }

  return content;
};
