import React from 'react';
import { Calendar, Camera, Heart, Sparkles, Star } from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';
import type { PhotographerSummary } from '../types/photographer.types';

interface PhotographerCardProps {
  photographer: PhotographerSummary;
  isFavorite: boolean;
  isCompared: boolean;
  hasAoDaiInCart: boolean;
  onOpen: () => void;
  onCompareChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleFavorite: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onViewPortfolio: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const PhotographerCard: React.FC<PhotographerCardProps> = ({
  photographer,
  isFavorite,
  isCompared,
  hasAoDaiInCart,
  onOpen,
  onCompareChange,
  onToggleFavorite,
  onViewPortfolio,
}) => {
  const isBookable = photographer.isBookable;

  return (
    <article onClick={onOpen} className="pl-card">
      <div className="pl-card-media">
        <ImageWithFallback
          src={photographer.image}
          alt={photographer.name}
          fallback={
            <div
              aria-label="Chưa có ảnh đại diện"
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                backgroundColor: 'var(--color-light-bg)',
                color: 'var(--color-primary-dark)',
              }}
            >
              <Camera size={34} />
            </div>
          }
          className="pl-card-image"
        />
        <div className="pl-card-style-tag">
          <span>{photographer.styleTag}</span>
        </div>
        {hasAoDaiInCart && (
          <div className="pl-card-match-badge">
            <Sparkles size={10} />
            Phù hợp 98%
          </div>
        )}
        <div onClick={(event) => event.stopPropagation()} className="pl-card-compare">
          <input
            type="checkbox"
            id={`compare-cb-${photographer.id}`}
            checked={isCompared}
            onChange={onCompareChange}
            className="pl-card-compare-checkbox"
          />
          <label htmlFor={`compare-cb-${photographer.id}`} className="pl-card-compare-label">
            SO SÁNH
          </label>
        </div>
        <div className="pl-card-rating">
          <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
          <span>{photographer.rating.toFixed(1)}</span>
          <span className="pl-card-rating-count">({photographer.reviewsCount})</span>
        </div>
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          className={`pl-card-favorite-btn ${isFavorite ? 'active' : ''}`}
        >
          <Heart size={16} fill={isFavorite ? '#A11E22' : 'none'} color={isFavorite ? '#A11E22' : '#8C827A'} />
        </button>
      </div>
      <div className="pl-card-body">
        <div className="pl-card-info">
          <h3 className="pl-card-name">{photographer.name}</h3>
          {photographer.quote && <p className="pl-card-quote">{photographer.quote}</p>}
        </div>
        {!isBookable && <span className="pl-card-not-bookable">Chưa mở lịch đặt</span>}
        <div className="pl-card-actions">
          <button className="pl-card-btn-portfolio" onClick={onViewPortfolio}>
            <Camera size={14} />
            Portfolio
          </button>
          <button
            className="pl-card-btn-booking"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <Calendar size={14} />
            {isBookable ? 'Đặt lịch' : 'Xem hồ sơ'}
          </button>
        </div>
      </div>
    </article>
  );
};