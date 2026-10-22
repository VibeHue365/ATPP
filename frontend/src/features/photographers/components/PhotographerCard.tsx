import React, { useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Star,
} from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';
import type { PhotographerPackage, PhotographerSummary } from '../types/photographer.types';

interface PhotographerCardProps {
  photographer: PhotographerSummary;
  isFavorite: boolean;
  isCompared?: boolean;
  hasAoDaiInCart: boolean;
  onOpen: (packageId?: string) => void;
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

const getPriceLabel = (pricingUnit?: string) => {
  if (pricingUnit === 'PER_DAY') return 'Giá theo ngày';
  if (pricingUnit === 'PER_SESSION') return 'Giá theo buổi';
  return 'Giá trọn gói';
};

const getPackagePillLabel = (pkg: PhotographerPackage) => {
  let label = '';
  if (pkg.name.includes('·')) {
    label = pkg.name.split('·')[1].trim();
  } else if (pkg.name.includes('-')) {
    const parts = pkg.name.split('-');
    label = parts[parts.length - 1].trim();
  } else {
    label = pkg.name.trim();
  }

  // Loại bỏ tiền tố "Gói " hoặc "gói " để pill ngắn gọn, súc tích
  label = label.replace(/^(gói|goi)\s+/i, '');

  if (label.length > 13) {
    if (pkg.pricingUnit === 'PER_DAY') label = 'Theo ngày';
    else if (pkg.pricingUnit === 'PER_SESSION') label = 'Theo buổi';
    else if (pkg.pricingUnit === 'PER_BOOKING') label = 'Trọn gói';
    else label = `${label.slice(0, 11)}…`;
  }

  return `${label} (${formatPrice(pkg.price)}đ)`;
};

export const PhotographerCard: React.FC<PhotographerCardProps> = ({
  photographer,
  isFavorite,
  hasAoDaiInCart,
  onOpen,
  onToggleFavorite,
}) => {
  const packages = photographer.packages || [];
  const totalPackages = packages.length;
  const [activePackageIndex, setActivePackageIndex] = useState(0);

  // Safe active package reference
  const safeIndex = totalPackages > 0 ? Math.min(activePackageIndex, totalPackages - 1) : 0;
  const activePackage = packages[safeIndex] || null;

  const packageName = activePackage?.name?.trim() || photographer.name;
  const packagePrice = activePackage?.price ?? photographer.price;
  const durationHours = activePackage?.durationHours ?? photographer.durationHours;
  const editedPhotosCount = activePackage?.editedPhotosCount ?? photographer.editedPhotosCount;

  // Active package image or fallback to photographer cover image
  const displayImage =
    (activePackage?.images && activePackage.images.length > 0)
      ? activePackage.images[0]
      : photographer.image;

  const handlePrevPackage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (totalPackages <= 1) return;
    setActivePackageIndex((prev) => (prev - 1 + totalPackages) % totalPackages);
  };

  const handleNextPackage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (totalPackages <= 1) return;
    setActivePackageIndex((prev) => (prev + 1) % totalPackages);
  };

  const handleSelectPackage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActivePackageIndex(index);
  };

  // Determine exactly 2 packages to display side-by-side in pill slots (preventing any overflow)
  let visibleIndices: number[] = [];
  if (totalPackages === 1) {
    visibleIndices = [0];
  } else if (totalPackages === 2) {
    visibleIndices = [0, 1];
  } else {
    // For 3+ packages, show [safeIndex, safeIndex + 1], or [last - 1, last] if on the last package
    if (safeIndex >= totalPackages - 1) {
      visibleIndices = [totalPackages - 2, totalPackages - 1];
    } else {
      visibleIndices = [safeIndex, safeIndex + 1];
    }
  }

  const thumbWidthPercent = totalPackages > 1 ? Math.max(22, 100 / totalPackages) : 100;
  const thumbLeftPercent =
    totalPackages > 1
      ? (safeIndex / (totalPackages - 1)) * (100 - thumbWidthPercent)
      : 0;

  const handleCardClick = () => {
    onOpen(activePackage?._id);
  };

  return (
    <article
      onClick={handleCardClick}
      className="pl-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* 1. Media Area */}
      <div className="pl-card-media">
        <ImageWithFallback
          src={displayImage}
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

        {/* Badge Shop có X gói */}
        <div className="pl-card-badge-count">
          <Layers size={12} className="pl-badge-icon" />
          <span>Shop có {totalPackages > 0 ? totalPackages : 1} gói</span>
        </div>

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

      {/* 2. Body Area */}
      <div className="pl-card-body">
        {/* Selector Header: Chọn gói dịch vụ + indicator 1/4 */}
        {totalPackages > 1 && (
          <div className="pl-card-selector-header">
            <span className="pl-selector-label">Chọn gói dịch vụ:</span>
            <span className="pl-selector-counter">
              {safeIndex + 1}/{totalPackages}
            </span>
          </div>
        )}

        {/* Quick package switch pills (window of 2 pills + mini slider bar matching mockup) */}
        {totalPackages > 1 && (
          <div className="pl-card-pills-container" onClick={(e) => e.stopPropagation()}>
            <div className="pl-card-pills-bar">
              {visibleIndices.map((idx) => {
                const pkg = packages[idx];
                if (!pkg) return null;
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={pkg._id || idx}
                    type="button"
                    className={`pl-pkg-pill ${isActive ? 'is-active' : ''}`}
                    onClick={(e) => handleSelectPackage(idx, e)}
                    title={pkg.name}
                  >
                    {getPackagePillLabel(pkg)}
                  </button>
                );
              })}
            </div>

            {/* Slider track + arrows directly under pills (matching mockup) */}
            <div className="pl-pills-slider-row">
              <button
                type="button"
                className="pl-pills-slider-btn"
                onClick={handlePrevPackage}
                aria-label="Gói trước"
              >
                <ChevronLeft size={13} />
              </button>
              <div
                className="pl-pills-slider-track"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  if (clickX < rect.width / 2) {
                    handlePrevPackage(e);
                  } else {
                    handleNextPackage(e);
                  }
                }}
              >
                <div
                  className="pl-pills-slider-thumb"
                  style={{
                    width: `${thumbWidthPercent}%`,
                    left: `${thumbLeftPercent}%`,
                  }}
                />
              </div>
              <button
                type="button"
                className="pl-pills-slider-btn"
                onClick={handleNextPackage}
                aria-label="Gói tiếp theo"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Tên gói chụp đang chọn */}
        <h3 className="pl-card-name" title={packageName}>
          {packageName}
        </h3>

        {/* Thông số kỹ thuật của gói chụp */}
        <div className="pl-card-specs-row">
          <span className="pl-spec-chip" title="Thời gian buổi chụp">
            <Clock3 size={12} className="pl-spec-icon" />
            <span>{durationHours ? `${durationHours}h chụp` : 'Linh hoạt'}</span>
          </span>

          <span className="pl-spec-chip" title="Số lượng ảnh được xử lý/chỉnh sửa">
            <ImageIcon size={12} className="pl-spec-icon" />
            <span>{editedPhotosCount ? `${editedPhotosCount} ảnh đã chỉnh sửa` : 'Gói chuẩn'}</span>
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

        {/* Giá & Đánh giá sao */}
        <div className="pl-card-price-rating-row">
          <div className="pl-card-price-block">
            <span className="pl-card-price-label">{getPriceLabel(activePackage?.pricingUnit)}</span>
            <div className="pl-card-price-line">
              <strong className="pl-card-price-amount">{formatPrice(packagePrice)}đ</strong>
            </div>
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

        {/* Footer: Thông tin Studio & Nút đổi qua đổi lại các gói */}
        <div className="pl-card-shop-row">
          <div
            className="pl-card-provider-group"
            title={`Studio / Nhiếp ảnh gia: ${photographer.name}`}
          >
            <Camera size={13} className="pl-card-provider-icon" />
            <span className="pl-card-provider">{photographer.name}</span>
            <span className="pl-card-verified-dot">•</span>
            <span className="pl-card-location">{formatLocation(photographer.location)}</span>
          </div>

          {/* Quick next/prev arrows for switching packages */}
          {totalPackages > 1 && (
            <div
              className="pl-card-nav-controls"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pl-card-nav-btn"
                onClick={handlePrevPackage}
                aria-label="Gói trước"
                title="Xem gói trước"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="pl-card-nav-btn"
                onClick={handleNextPackage}
                aria-label="Gói sau"
                title="Xem gói tiếp theo"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};