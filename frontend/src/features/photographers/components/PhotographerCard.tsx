import React from 'react';
import { Camera, Clock3, Heart, Image as ImageIcon, Sparkles, Star } from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';
import type { PhotographerSummary } from '../types/photographer.types';

interface PhotographerCardProps {
  photographer: PhotographerSummary;
  isFavorite: boolean;
  isCompared?: boolean;
  hasAoDaiInCart: boolean;
  onOpen: () => void;
  onCompareChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleFavorite: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onViewPortfolio?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(price);

export const PhotographerCard: React.FC<PhotographerCardProps> = ({
  photographer,
  isFavorite,
  hasAoDaiInCart,
  onOpen,
  onToggleFavorite,
}) => {
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

        {photographer.styleTag && (
          <div className="pl-card-style-tag">
            <span>{photographer.styleTag}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          className={`pl-card-favorite-btn ${isFavorite ? 'active' : ''}`}
        >
          <Heart
            size={15}
            fill={isFavorite ? '#8B1E2D' : 'none'}
            color={isFavorite ? '#8B1E2D' : '#5E5054'}
          />
        </button>
      </div>

      <div className="pl-card-body">
        {/* 1. Tên gói chụp (đậm) */}
        <h3 className="pl-card-name" title={packageName}>{packageName}</h3>

        {/* 2. Giá gói (nổi bật, đỏ rượu) */}
        <div className="pl-card-price-line">
          <strong>{formatPrice(packagePrice)}đ</strong>
          <span>/ gói</span>
        </div>

        {/* 3. Điểm phù hợp / Điểm nhấn */}
        {hasAoDaiInCart ? (
          <div className="pl-card-match-badge" title="Phù hợp với áo dài đã chọn trong giỏ">
            <Sparkles size={11} className="pl-match-sparkle" />
            <span>Khớp trang phục giỏ hàng (98%)</span>
          </div>
        ) : (
          <div className="pl-card-package-meta">
            <span><Clock3 size={11} />{durationHours ? `${durationHours}h chụp` : 'Linh hoạt'}</span>
            <span>•</span>
            <span><ImageIcon size={11} />{editedPhotosCount ? `${editedPhotosCount} ảnh` : 'Gói chuẩn'}</span>
            <span>•</span>
            <span className="pl-card-rating-inline">
              <Star size={11} fill="#FACC15" stroke="#FACC15" />
              {photographer.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* 4. Studio / Nhiếp ảnh gia + dấu xác minh + địa điểm */}
        <div className="pl-card-shop-row">
          <span className="pl-card-provider" title={photographer.name}>{photographer.name}</span>
          <span className="pl-card-verified-badge">
            <span className="pl-verified-check">✓</span> Đã xác minh
          </span>
          <span className="pl-card-meta-dot">•</span>
          <span>{photographer.location || 'Huế'}</span>
        </div>
      </div>
    </article>
  );
};