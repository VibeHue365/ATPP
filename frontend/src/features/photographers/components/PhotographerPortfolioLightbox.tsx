import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getMediaUrl } from '../../../shared/media/mediaUrl';

export interface PhotographerPortfolioImage {
  src: string;
  title: string;
  description?: string;
  imageNumber: number;
  imageCount: number;
}

interface PhotographerPortfolioLightboxProps {
  images: PhotographerPortfolioImage[];
  activeIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const PhotographerPortfolioLightbox = ({
  images,
  activeIndex,
  onClose,
  onPrevious,
  onNext,
}: PhotographerPortfolioLightboxProps) => {
  const image = images[activeIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && images.length > 1) onPrevious();
      if (event.key === 'ArrowRight' && images.length > 1) onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose, onNext, onPrevious]);

  if (!image) return null;

  return (
    <div className="pd-lightbox-overlay" role="dialog" aria-modal="true" aria-label={`Xem ${image.title}`} onClick={onClose}>
      <button type="button" className="pd-lightbox-close" onClick={onClose} aria-label="Đóng trình xem ảnh">
        <X size={24} />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="pd-lightbox-nav pd-lightbox-prev" onClick={(event) => { event.stopPropagation(); onPrevious(); }} aria-label="Ảnh trước">
            <ChevronLeft size={24} />
          </button>
          <button type="button" className="pd-lightbox-nav pd-lightbox-next" onClick={(event) => { event.stopPropagation(); onNext(); }} aria-label="Ảnh tiếp theo">
            <ChevronRight size={24} />
          </button>
        </>
      )}
      <div className="pd-lightbox-content-box" onClick={(event) => event.stopPropagation()}>
        <img src={getMediaUrl(image.src)} alt={image.title} className="pd-lightbox-image" />
        <div className="pd-lightbox-meta">
          <div>
            <h4 className="pd-lightbox-caption">{image.title}</h4>
            {image.description && <p className="pd-lightbox-description">{image.description}</p>}
          </div>
          <span className="pd-lightbox-counter">Ảnh {activeIndex + 1}/{images.length} · Tác phẩm {image.imageNumber}/{image.imageCount}</span>
        </div>
      </div>
    </div>
  );
};
