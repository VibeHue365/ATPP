import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { PortfolioItem } from '../types';
import type { useProviderPortfolioState } from './useProviderPortfolioState';

type PortfolioPreviewModalProps = Pick<
  ReturnType<typeof useProviderPortfolioState>,
  'setPreviewPortfolioItem' | 'setPreviewImageIndex' | 'previewImageIndex'
> & {
  previewPortfolioItem: NonNullable<PortfolioItem | null>;
};

export function PortfolioPreviewModal({
  setPreviewPortfolioItem,
  previewPortfolioItem,
  setPreviewImageIndex,
  previewImageIndex,
}: PortfolioPreviewModalProps) {
  const images = previewPortfolioItem.images || [];
  const currentImage = images[previewImageIndex] || '';

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewPortfolioItem(null);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setPreviewImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setPreviewImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, setPreviewImageIndex, setPreviewPortfolioItem]);

  return (
    <div
      onClick={() => setPreviewPortfolioItem(null)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 6, 9, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        cursor: 'zoom-out',
        userSelect: 'none',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={() => setPreviewPortfolioItem(null)}
        style={{
          position: 'absolute',
          right: '24px',
          top: '24px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          cursor: 'pointer',
          zIndex: 10002,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Đóng (Esc)"
      >
        <X size={20} />
      </button>

      {/* Navigation Buttons */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
            }}
            style={{
              position: 'absolute',
              left: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              zIndex: 10002,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Ảnh trước (←)"
          >
            <ChevronLeft size={26} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
            }}
            style={{
              position: 'absolute',
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              zIndex: 10002,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Ảnh tiếp theo (→)"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {/* Main Image Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          maxWidth: '85vw',
          maxHeight: '85vh',
          cursor: 'default',
        }}
      >
        <img
          src={getMediaUrl(currentImage)}
          alt={previewPortfolioItem.title}
          style={{
            maxWidth: '100%',
            maxHeight: '68vh',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          }}
        />

        {/* Caption */}
        <div style={{ textAlign: 'center', color: '#FFFFFF', maxWidth: '650px' }}>
          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'var(--pf-font-serif, serif)',
              letterSpacing: '0.02em',
            }}
          >
            {previewPortfolioItem.title}
            {images.length > 1 && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  opacity: 0.75,
                  marginLeft: '8px',
                }}
              >
                ({previewImageIndex + 1}/{images.length})
              </span>
            )}
          </h4>
          {previewPortfolioItem.description && (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: 1.5,
              }}
            >
              {previewPortfolioItem.description}
            </p>
          )}
        </div>

        {/* Thumbnail Strip (if multiple images) */}
        {images.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              maxWidth: '80vw',
              padding: '6px',
            }}
          >
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setPreviewImageIndex(idx)}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: idx === previewImageIndex ? '2px solid #FFFFFF' : '2px solid transparent',
                  opacity: idx === previewImageIndex ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <img
                  src={getMediaUrl(img)}
                  alt={`Thumbnail ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
