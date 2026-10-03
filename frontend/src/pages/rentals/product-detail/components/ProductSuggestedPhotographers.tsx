import React from 'react';
import { Star } from 'lucide-react';
import type { SuggestedPhotographer } from '../types';

interface ProductSuggestedPhotographersProps {
  photographers: SuggestedPhotographer[];
  onNavigatePhotographer: (id: string) => void;
}

export const ProductSuggestedPhotographers: React.FC<ProductSuggestedPhotographersProps> = ({
  photographers,
  onNavigatePhotographer,
}) => {
  if (!photographers || photographers.length === 0) return null;

  return (
    <section style={{ marginTop: '80px' }}>
      <div
        style={{
          marginBottom: '40px',
          textAlign: 'left',
          maxWidth: '100%',
          alignItems: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <span
          className="vh-section-badge"
          style={{ display: 'inline-block', marginBottom: '12px' }}
        >
          Nhiếp Ảnh Gia Gợi Ý
        </span>
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'var(--font-header)',
            color: '#1c1917',
            marginTop: '4px',
          }}
        >
          Hoàn thiện trải nghiệm với các gói chụp ảnh chuyên nghiệp
        </h2>
      </div>

      <div className="vh-pd-photographers-grid">
        {photographers.map((photographer) => (
          <div
            key={photographer.id}
            className="vh-premium-card"
            style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid var(--color-light-border)',
            }}
          >
            <div
              className="vh-card-image-wrapper"
              style={{ height: '240px' }}
            >
              <img
                src={photographer.image}
                alt={photographer.name}
                className="vh-card-image"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/hoang_minh.webp';
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                <Star size={11} className="fill-amber-400 stroke-amber-400" />
                <span>
                  {typeof photographer.rating === 'number'
                    ? photographer.rating.toFixed(1)
                    : '5.0'}
                </span>
                {photographer.count > 0 ? (
                  <span
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontWeight: 400,
                    }}
                  >
                    ({photographer.count})
                  </span>
                ) : (
                  <span
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    (Mới)
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4
                className="font-header font-bold text-stone-900"
                style={{ fontSize: '18px' }}
              >
                {photographer.name}
              </h4>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  marginTop: '8px',
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {photographer.desc}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--color-light-border)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      textTransform: 'uppercase',
                    }}
                  >
                    Gói chụp từ
                  </span>
                  <strong
                    className="font-header"
                    style={{
                      fontSize: '18px',
                      color: 'var(--color-primary-dark)',
                    }}
                  >
                    {photographer.price}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigatePhotographer(photographer.id)}
                  className="vh-btn vh-btn-outline vh-btn-sm"
                  style={{ borderRadius: '6px' }}
                >
                  Đặt ngay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
