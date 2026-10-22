import React from 'react';
import { Camera, Check, Clock3, Heart, Image as ImageIcon, MapPin, Sparkles, Star } from 'lucide-react';
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

const formatLocation = (loc?: string) => {
  if (!loc) return 'Huế';
  const trimmed = loc.trim();
  if (/^thành phố hồ chí minh$/i.test(trimmed) || /^hồ chí minh$/i.test(trimmed)) {
    return 'TP. HCM';
  }
  return trimmed.replace(/^thành phố\s+/i, 'TP. ');
};

export const PhotographerCard: React.FC<PhotographerCardProps> = ({
  photographer,
  isFavorite,
  hasAoDaiInCart,
  onOpen,
  onToggleFavorite,
}) => {
  const primaryPackage = photographer.packages?.[0];
  const packageName = primaryPackage?.name?.trim() || photographer.name;
  const packagePrice = primaryPackage?.price ?? photographer.price;
  const durationHours = primaryPackage?.durationHours ?? photographer.durationHours;
  const editedPhotosCount = primaryPackage?.editedPhotosCount ?? photographer.editedPhotosCount;

  return (
    <article
      onClick={onOpen}
      className="pl-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="pl-card-media">
        <ImageWithFallback
          src={photographer.image}
          alt={packageName}
          fallback={
            <div
              aria-label="Chưa có ảnh gói chụp"
              className="pl-card-fallback"
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
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          className={`pl-card-favorite-btn ${isFavorite ? 'active' : ''}`}
        >
          <Heart
            size={16}
            fill={isFavorite ? '#8B1E2D' : 'none'}
            color={isFavorite ? '#8B1E2D' : '#5E5054'}
          />
        </button>
      </div>

      <div className="pl-card-body">
        {/* 1. Tên gói chụp (cho phép hiển thị tối đa 2 dòng, chiều cao đồng đều) */}
        <h3 className="pl-card-name" title={packageName}>
          {packageName}
        </h3>

        {/* 2. Giá gói & Đánh giá sao nổi bật */}
        <div className="pl-card-price-rating-row">
          <div className="pl-card-price-line">
            <strong className="pl-card-price-amount">{formatPrice(packagePrice)}đ</strong>
            <span className="pl-card-price-unit">/ gói</span>
          </div>

          <div
            className="pl-card-rating-badge"
            title={
              photographer.rating > 0
                ? `Đánh giá ${photographer.rating.toFixed(1)} sao (${photographer.reviewsCount || 0} nhận xét)`
                : 'Chưa có đánh giá'
            }
          >
            <Star size={12} className="pl-star-icon" fill="#F59E0B" color="#F59E0B" />
            <span className="pl-rating-value">
              {photographer.rating > 0 ? photographer.rating.toFixed(1) : '5.0'}
            </span>
            {photographer.reviewsCount > 0 && (
              <span className="pl-rating-count">({photographer.reviewsCount})</span>
            )}
          </div>
        </div>

        {/* 3. Thông số gói chụp (Thời gian, số ảnh, khớp giỏ hàng) dạng chip tinh tế */}
        <div className="pl-card-specs-row">
          <span className="pl-spec-chip" title="Thời gian buổi chụp">
            <Clock3 size={12} className="pl-spec-icon" />
            <span>{durationHours ? `${durationHours}h chụp` : 'Linh hoạt'}</span>
          </span>

          <span className="pl-spec-chip" title="Số lượng ảnh được xử lý/chỉnh sửa">
            <ImageIcon size={12} className="pl-spec-icon" />
            <span>{editedPhotosCount ? `${editedPhotosCount} ảnh` : 'Gói chuẩn'}</span>
          </span>

          {hasAoDaiInCart && (
            <span
              className="pl-spec-chip pl-spec-chip--match"
              title="Phù hợp với áo dài đã chọn trong giỏ hàng"
            >
              <Sparkles size={11} className="pl-match-sparkle" />
              <span>Khớp giỏ hàng</span>
            </span>
          )}
        </div>

        {/* 4. Studio / Nhiếp ảnh gia + Huy hiệu xác minh + Địa điểm cân đối */}
        <div className="pl-card-shop-row">
          <div
            className="pl-card-provider-group"
            title={`Nhiếp ảnh gia / Studio: ${photographer.name}`}
          >
            <Camera size={13} className="pl-card-provider-icon" />
            <span className="pl-card-provider">{photographer.name}</span>
            <span className="pl-card-verified-badge" title="Đối tác đã xác minh">
              <Check size={9} strokeWidth={3.5} className="pl-verified-check" />
            </span>
          </div>

          <div
            className="pl-card-location"
            title={`Khu vực: ${photographer.location || 'Huế'}`}
          >
            <MapPin size={12} className="pl-location-icon" />
            <span>{formatLocation(photographer.location)}</span>
          </div>
        </div>
      </div>
    </article>
  );
};