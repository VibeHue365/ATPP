import React from 'react';
import { Heart } from 'lucide-react';

export interface FavoriteButtonProps {
  isFavorite?: boolean;
  onToggle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: number;
  className?: string;
  title?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite = false,
  onToggle,
  size = 18,
  className = '',
  title = 'Yêu thích',
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid var(--landing-border, #E8DEDF)',
        boxShadow: 'var(--landing-shadow-sm, 0 2px 10px rgba(41, 35, 36, 0.04))',
        color: isFavorite ? 'var(--landing-primary, #7D3543)' : 'var(--landing-text-muted, #988B8D)',
      }}
    >
      <Heart
        size={size}
        className={isFavorite ? 'fill-current' : ''}
      />
    </button>
  );
};
