import React from 'react';
import { Heart, Star, MapPin, CheckCircle } from 'lucide-react';

interface PhotographerHeroProps {
  name: string;
  quote?: string;
  isFavorite: boolean;
  onToggleFavorite: (event: React.MouseEvent<HTMLButtonElement>) => void;
  avatarUrl?: string;
  coverUrl?: string;
  rating?: number;
  reviewsCount?: number;
  city?: string;
}

export const PhotographerHero: React.FC<PhotographerHeroProps> = ({
  name,
  quote,
  isFavorite,
  onToggleFavorite,
  avatarUrl,
  coverUrl,
  rating = 0,
  reviewsCount = 0,
  city,
}) => {
  const bannerStyle = {
    backgroundImage: coverUrl ? `url(${coverUrl})` : 'linear-gradient(135deg, #1E1B19 0%, #2D2926 100%)',
  };

  return (
    <div className="pd-hero-section">
      <div className="pd-hero-banner" style={bannerStyle}>
        <div className="pd-hero-overlay" />
        <button
          onClick={onToggleFavorite}
          className={`pd-hero-favorite-btn ${isFavorite ? 'active' : ''}`}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          title={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
        >
          <Heart size={20} fill={isFavorite ? 'var(--color-primary)' : 'none'} />
        </button>
      </div>

      <div className="pd-hero-body">
        <div className="pd-hero-avatar-box">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} />
          ) : (
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              {name.charAt(0)}
            </div>
          )}
        </div>

        <div className="pd-hero-info">
          <div className="pd-hero-name-row">
            <h1 className="pd-hero-name">{name}</h1>
            <span className="pd-verified-badge" title="Đối tác đã xác thực">
              <CheckCircle size={18} fill="currentColor" color="white" />
            </span>
          </div>

          <div className="pd-hero-meta-row">
            <div className="pd-hero-meta-item rating">
              <Star size={14} fill="currentColor" />
              <span>{rating.toFixed(1)}</span>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                ({reviewsCount} đánh giá)
              </span>
            </div>
            {city && (
              <div className="pd-hero-meta-item">
                <MapPin size={14} color="var(--color-primary)" />
                <span>{city}</span>
              </div>
            )}
          </div>

          {quote && <p className="pd-hero-quote">{quote}</p>}
        </div>
      </div>
    </div>
  );
};
