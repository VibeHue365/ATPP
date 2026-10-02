import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import type { ProductDetail } from '../types';
import { getImageUrl, DEFAULT_PRODUCT_IMAGE } from '../utils/colorUtils';

interface ProductGalleryProps {
  product: ProductDetail;
  activeImage: string;
  onSelectImage: (img: string) => void;
  isFav: boolean;
  onToggleFav: () => void;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  product,
  activeImage,
  onSelectImage,
  isFav,
  onToggleFav,
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const images = (product.images?.length ?? 0) > 0
    ? product.images
    : [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
        'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f',
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f',
      ];

  const thumbnails = images.slice(0, 4);
  const remainingImageCount = Math.max(images.length - thumbnails.length, 0);
  const activeIndex = Math.max(0, images.indexOf(activeImage));

  const selectRelativeImage = (offset: number) => {
    onSelectImage(images[(activeIndex + offset + images.length) % images.length]);
  };

  return (
    <div className="vh-pd-gallery-sticky">
      {/* Thumbnails list */}
      <div className="vh-pd-thumbnails-list">
        {thumbnails.map((img, index) => {
          const isActive = activeImage === img;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectImage(img)}
              className={`vh-pd-thumb-btn ${isActive ? 'active' : ''}`}
            >
              <img
                src={getImageUrl(img)}
                alt={`${product.name} thumbnail ${index + 1}`}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
              {index === thumbnails.length - 1 && remainingImageCount > 0 && (
                <span className="vh-pd-thumb-more" onClick={() => setIsLightboxOpen(true)}>+{remainingImageCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Image View */}
      <div className="vh-pd-main-img-box">
        <img
          src={getImageUrl(activeImage)}
          alt={product.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
          }}
        />

        {/* Premium Badge */}
        <span className="vh-pd-badge-rental">
          CHO THUÊ
        </span>

        {/* Heart floating action */}
        <button
          type="button"
          onClick={onToggleFav}
          className={`vh-pd-fav-btn ${isFav ? 'is-fav' : ''}`}
          aria-label="Lưu sản phẩm yêu thích"
        >
          <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {isLightboxOpen && (
        <div className="vh-pd-lightbox" role="dialog" aria-modal="true" aria-label="Xem tất cả ảnh sản phẩm" onClick={() => setIsLightboxOpen(false)}>
          <div className="vh-pd-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="vh-pd-lightbox-close" onClick={() => setIsLightboxOpen(false)} aria-label="Đóng thư viện ảnh"><X size={22} /></button>
            <img src={getImageUrl(activeImage)} alt={product.name} className="vh-pd-lightbox-image" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_PRODUCT_IMAGE; }} />
            {images.length > 1 && (
              <>
                <button type="button" className="vh-pd-lightbox-nav is-previous" onClick={() => selectRelativeImage(-1)} aria-label="Ảnh trước"><ChevronLeft size={28} /></button>
                <button type="button" className="vh-pd-lightbox-nav is-next" onClick={() => selectRelativeImage(1)} aria-label="Ảnh tiếp theo"><ChevronRight size={28} /></button>
              </>
            )}
            <span className="vh-pd-lightbox-count">{activeIndex + 1} / {images.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
