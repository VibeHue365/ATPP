import React from 'react';
import { Calendar, Camera, Clock3, Heart, Image as ImageIcon, Sparkles, Star } from 'lucide-react';
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

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(price);

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
  const primaryPackage = photographer.packages[0];
  const packageName = primaryPackage?.name?.trim() || photographer.name;
  const packagePrice = primaryPackage?.price ?? photographer.price;
  const durationHours = primaryPackage?.durationHours ?? photographer.durationHours;
  const editedPhotosCount = primaryPackage?.editedPhotosCount ?? photographer.editedPhotosCount;

  return (
    <article onClick={onOpen} className="pl-card">
      <div className="pl-card-media">
        <ImageWithFallback
          src={photographer.image}
          alt={packageName}
          fallback={
            <div
              aria-label="Chưa có ảnh gói chụp"
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                backgroundColor: '#FBE5E9',
                color: '#B52B47',
              }}
            >
              <Camera size={34} />
            </div>
          }
          className="pl-card-image"
          loading="lazy"
          decoding="async"
        />
        <div className="pl-card-style-tag"><span>{photographer.styleTag}</span></div>
        {hasAoDaiInCart && (
          <div className="pl-card-match-badge"><Sparkles size={10} />Phù hợp 98%</div>
        )}
        <div onClick={(event) => event.stopPropagation()} className="pl-card-compare">
          <input
            type="checkbox"
            id={`compare-cb-${photographer.id}`}
            checked={isCompared}
            onChange={onCompareChange}
            className="pl-card-compare-checkbox"
          />
          <label htmlFor={`compare-cb-${photographer.id}`} className="pl-card-compare-label">SO SÁNH</label>
        </div>
        <div className="pl-card-rating">
          <Star size={12} fill="#F4B548" stroke="#F4B548" />
          <span>{photographer.rating.toFixed(1)}</span>
          <span className="pl-card-rating-count">({photographer.reviewsCount})</span>
        </div>
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          className={`pl-card-favorite-btn ${isFavorite ? 'active' : ''}`}
        >
          <Heart size={16} fill={isFavorite ? '#B52B47' : 'none'} color={isFavorite ? '#B52B47' : '#8C827A'} />
        </button>
      </div>

      <div className="pl-card-body">
        <div className="pl-card-info">
          <span className="pl-card-provider">{photographer.name}</span>
          <h3 className="pl-card-name">{packageName}</h3>
          <p className="pl-card-quote">{photographer.location || photographer.quote || 'Gói chụp linh hoạt theo nhu cầu'}</p>
        </div>
        <div className="pl-card-package-meta">
          <span><Clock3 size={12} />{durationHours ? `${durationHours} giờ chụp` : 'Lịch linh hoạt'}</span>
          <span><ImageIcon size={12} />{editedPhotosCount ? `${editedPhotosCount} ảnh chỉnh` : 'Ảnh chỉnh theo gói'}</span>
        </div>
        <div className="pl-card-price-line"><strong>{formatPrice(packagePrice)}đ</strong><span>/ gói</span></div>
        {!isBookable && <span className="pl-card-not-bookable">Chưa mở lịch đặt</span>}
        <div className="pl-card-actions">
          <button className="pl-card-btn-portfolio" onClick={onViewPortfolio}>
            <Camera size={14} />Xem chi tiết
          </button>
          <button
            className="pl-card-btn-booking"
            onClick={(event) => { event.stopPropagation(); onOpen(); }}
          >
            <Calendar size={14} />{isBookable ? 'Đặt lịch' : 'Xem hồ sơ'}
          </button>
        </div>
      </div>
    </article>
  );
};