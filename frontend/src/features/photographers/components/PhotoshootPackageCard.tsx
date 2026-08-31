import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { PriceDisplay } from '../../../components/common/PriceDisplay';
import type { PhotoshootPackageItem } from '../data/photoshoot-package.fixture';

export interface PhotoshootPackageCardProps {
  item: PhotoshootPackageItem;
}

export const PhotoshootPackageCard: React.FC<PhotoshootPackageCardProps> = ({ item }) => {
  const ratingValue: number =
    typeof item.rating === 'number'
      ? item.rating
      : typeof item.rating === 'object' && item.rating !== null
      ? (item.rating as any).averageRating ?? 4.9
      : 4.9;

  const reviewCountValue: number =
    typeof item.reviewCount === 'number'
      ? item.reviewCount
      : typeof item.rating === 'object' && item.rating !== null
      ? (item.rating as any).totalReviews ?? 12
      : 12;

  return (
    <div
      className="lume-photoshoot-card group flex flex-col justify-between transition-all border"
      style={{
        backgroundColor: 'var(--landing-surface)',
        borderColor: 'var(--landing-border)',
      }}
    >
      {/* Image Area Container */}
      <div className="lume-photoshoot-card__media relative w-full aspect-[3/4] overflow-hidden bg-stone-100">
        <Link 
          to={ROUTES.PHOTOGRAPHERS} 
          className="block w-full h-full text-decoration-none"
          tabIndex={-1}
        >
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Badge Overlay */}
        {item.badge && (
          <div className="lume-photoshoot-card__badge absolute z-10">
            <span 
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: 'var(--landing-primary)' }}
            >
              {item.badge}
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="lume-photoshoot-card__content flex flex-col flex-1 justify-between">
        <div className="lume-photoshoot-card__details flex flex-col">
          {/* Duration & Photographer Subtitle */}
          <div className="lume-photoshoot-card__meta flex items-center justify-between text-[11px] font-bold">
            <span 
              className="flex items-center gap-1 uppercase tracking-wider"
              style={{ color: 'var(--landing-primary)' }}
            >
              <Clock size={12} />
              <span>{item.durationMinutes || 90} phút</span>
            </span>

            <span 
              className="line-clamp-1 font-medium text-[10px]"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              {item.photographerName}
            </span>
          </div>

          {/* Package Name Link */}
          <Link
            to={ROUTES.PHOTOGRAPHERS}
            className="lume-photoshoot-card__title font-header font-bold text-base text-decoration-none line-clamp-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {item.name}
          </Link>

          {/* Rating Row */}
          <div className="lume-photoshoot-card__rating flex items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-1 text-xs font-bold text-stone-800">
              <Star size={13} className="fill-amber-400 stroke-amber-400" />
              <span>{Number.isFinite(ratingValue) ? ratingValue.toFixed(1) : '4.9'}</span>
            </div>
            <span 
              className="text-[11px] font-medium"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              ({reviewCountValue} đánh giá)
            </span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div 
          className="lume-photoshoot-card__price-row pt-3 border-t flex items-center justify-between mt-1"
          style={{ borderColor: 'var(--landing-border)' }}
        >
          <div className="flex flex-col">
            <span 
              className="lume-photoshoot-card__price-label text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              Giá gói
            </span>
            <PriceDisplay price={item.price || 500000} suffix="/gói" />
          </div>

          <Link
            to={ROUTES.PHOTOGRAPHERS}
            className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
            style={{ color: 'var(--landing-primary)' }}
          >
            <span>Đặt lịch</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
