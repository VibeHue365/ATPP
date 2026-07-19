import React from 'react';
import { Camera, Images, ZoomIn } from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';
import type { PhotographerPortfolioItem } from '../types/photographer.types';

interface PhotographerPortfolioGridProps {
  portfolioItems: PhotographerPortfolioItem[];
  legacyPortfolio: string[];
  onImageClick: (imageSrc: string) => void;
}

const PortfolioFallback = () => (
  <div className="pd-portfolio-image-fallback">
    <Camera size={28} />
  </div>
);

export const PhotographerPortfolioGrid: React.FC<PhotographerPortfolioGridProps> = ({
  portfolioItems,
  legacyPortfolio,
  onImageClick,
}) => {
  const hasPortfolioItems = portfolioItems.length > 0;
  const hasLegacyPortfolio = legacyPortfolio.length > 0;

  return (
    <section className="pd-portfolio-section" aria-labelledby="photographer-portfolio-title">
      <div className="pd-portfolio-heading">
        <div>
          <h3 id="photographer-portfolio-title" className="pd-section-title pd-portfolio-title">
            Tác phẩm nổi bật
          </h3>
          <p className="pd-portfolio-subtitle">Khám phá phong cách và những khoảnh khắc do nhiếp ảnh gia thực hiện.</p>
        </div>
        {(hasPortfolioItems || hasLegacyPortfolio) && (
          <span className="pd-portfolio-total">
            {hasPortfolioItems ? portfolioItems.length : legacyPortfolio.length} tác phẩm
          </span>
        )}
      </div>

      <div className="pd-portfolio-grid">
        {hasPortfolioItems ? (
          portfolioItems.map((item) => {
            const images = item.images.filter(Boolean);
            if (!images.length) return null;
            const badges = item.badges
              ?.map((badge) => badge.label || badge.name)
              .filter((label): label is string => Boolean(label))
              .slice(0, 2) ?? [];

            return (
              <button
                key={item._id}
                type="button"
                className="pd-portfolio-card"
                onClick={() => onImageClick(images[0])}
                aria-label={`Xem tác phẩm ${item.title}, gồm ${images.length} ảnh`}
              >
                <ImageWithFallback
                  src={images[0]}
                  alt={item.title}
                  fallback={<PortfolioFallback />}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                />
                <span className="pd-portfolio-image-count">
                  <Images size={13} /> {images.length} ảnh
                </span>
                <span className="pd-portfolio-overlay">
                  <ZoomIn size={20} color="white" className="pd-portfolio-zoom-icon" />
                  <strong className="pd-portfolio-card-title">{item.title}</strong>
                  {item.description && <span className="pd-portfolio-card-desc">{item.description}</span>}
                  {badges.length > 0 && <span className="pd-portfolio-card-badges">{badges.join(' · ')}</span>}
                </span>
              </button>
            );
          })
        ) : hasLegacyPortfolio ? (
          legacyPortfolio.filter(Boolean).map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className="pd-portfolio-card"
              onClick={() => onImageClick(image)}
              aria-label={`Xem ảnh tác phẩm ${index + 1}`}
            >
              <ImageWithFallback
                src={image}
                alt={`Tác phẩm ${index + 1}`}
                fallback={<PortfolioFallback />}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span className="pd-portfolio-overlay pd-portfolio-overlay--center">
                <ZoomIn size={24} color="white" />
                <span className="pd-portfolio-card-title">Xem ảnh tác phẩm</span>
              </span>
            </button>
          ))
        ) : (
          <div className="pd-portfolio-empty">
            <Camera size={28} />
            <strong>Chưa có tác phẩm công khai</strong>
            <span>Nhiếp ảnh gia sẽ sớm cập nhật những tác phẩm đã được duyệt.</span>
          </div>
        )}
      </div>
    </section>
  );
};