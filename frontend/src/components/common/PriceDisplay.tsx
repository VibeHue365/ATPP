import React from 'react';

export interface PriceDisplayProps {
  price: number | string;
  originalPrice?: number | string;
  suffix?: string;
  className?: string;
}

const formatCurrency = (val: number | string): string => {
  if (typeof val === 'number') {
    return `${val.toLocaleString('vi-VN')}đ`;
  }
  return val.endsWith('đ') ? val : `${val}đ`;
};

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  originalPrice,
  suffix,
  className = '',
}) => {
  return (
    <div className={`flex items-baseline gap-2 flex-wrap ${className}`}>
      <span 
        className="text-lg font-extrabold font-header"
        style={{ color: 'var(--landing-text-primary, #292324)' }}
      >
        {formatCurrency(price)}
      </span>

      {originalPrice != null && (
        <span 
          className="text-xs line-through"
          style={{ color: 'var(--landing-text-muted, #988B8D)' }}
        >
          {formatCurrency(originalPrice)}
        </span>
      )}

      {suffix && (
        <span 
          className="text-xs font-medium"
          style={{ color: 'var(--landing-text-secondary, #6F6264)' }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
};
