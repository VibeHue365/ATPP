import { Eye, ImageOff, Images, Pencil, Trash2 } from 'lucide-react';
import type { PortfolioItem } from '../../types';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';

export interface PortfolioCardProps {
  portfolioItem: PortfolioItem;
  onPreview?: (item: PortfolioItem) => void;
  onEdit?: (item: PortfolioItem) => void;
  onDelete?: (itemId: string) => void;
  previewMode?: boolean;
}

const statusConfig: Record<
  PortfolioItem['moderationStatus'],
  { label: string; className: string }
> = {
  APPROVED: {
    label: 'Đã duyệt',
    className: 'portfolio-card__status--approved',
  },
  PENDING_REVIEW: {
    label: 'Chờ duyệt',
    className: 'portfolio-card__status--pending',
  },
  REJECTED: {
    label: 'Từ chối',
    className: 'portfolio-card__status--rejected',
  },
  HIDDEN: {
    label: 'Tạm ẩn',
    className: 'portfolio-card__status--hidden',
  },
};

export function PortfolioCard({
  portfolioItem,
  onPreview,
  onEdit,
  onDelete,
  previewMode = false,
}: PortfolioCardProps) {
  const coverImage = portfolioItem.images?.[0];
  const imagesCount = portfolioItem.images?.length || 0;
  const statusInfo = statusConfig[portfolioItem.moderationStatus] || statusConfig.PENDING_REVIEW;

  return (
    <article className="portfolio-card">
      {/* 1. MEDIA CONTAINER */}
      <div className="portfolio-card__media">
        {coverImage ? (
          <img src={getMediaUrl(coverImage)} alt={portfolioItem.title || 'Tác phẩm portfolio'} />
        ) : (
          <div className="portfolio-card__image-placeholder">
            <ImageOff size={32} />
            <span>Chưa có ảnh</span>
          </div>
        )}

        {/* Status Badge with Pulsing Indicator */}
        <span className={`portfolio-card__status ${statusInfo.className}`}>
          <span className="portfolio-card__pulsing-dot" />
          {statusInfo.label}
        </span>

        {/* Image Count Pill */}
        {imagesCount > 0 && (
          <span className="portfolio-card__image-count">
            <Images size={13} /> {imagesCount} ảnh
          </span>
        )}

        {/* Hover Action Overlay */}
        {!previewMode && (
          <div className="portfolio-card__hover-overlay">
            {onPreview && (
              <button
                type="button"
                className="portfolio-card__overlay-btn"
                onClick={() => onPreview(portfolioItem)}
              >
                <Eye size={14} />
                <span>Xem ảnh lớn</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                className="portfolio-card__overlay-btn"
                onClick={() => onEdit(portfolioItem)}
              >
                <Pencil size={13} />
                <span>Sửa thông tin</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="portfolio-card__overlay-btn portfolio-card__overlay-btn--danger"
                onClick={() => onDelete(portfolioItem._id)}
              >
                <Trash2 size={13} />
                <span>Gỡ tác phẩm</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. CARD CONTENT BODY */}
      <div className="portfolio-card__body">
        <h3 className="portfolio-card__title" title={portfolioItem.title}>
          {portfolioItem.title || 'Tác phẩm chưa đặt tên'}
        </h3>
        <p className="portfolio-card__desc">
          {portfolioItem.description || 'Chưa có mô tả bối cảnh hoặc phong cách cho tác phẩm này.'}
        </p>

        {previewMode && (
          <div className="portfolio-card__footer" style={{ justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--pf-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Eye size={12} /> Hiển thị thực tế trên hồ sơ
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
