import React from 'react';
import { Star } from 'lucide-react';
import type { ProductDetail } from '../types';
import { SmartTagList } from '../../../../features/smart-tagging/components/SmartTagList';

interface ProductHeaderInfoProps {
  product: ProductDetail;
  onNavigateStore: (providerId: string) => void;
}

export const ProductHeaderInfo: React.FC<ProductHeaderInfoProps> = ({
  product,
  onNavigateStore,
}) => {
  const providerId =
    typeof product.providerId === 'object' && product.providerId
      ? (product.providerId as any)._id
      : product.providerId;

  return (
    <div>
      <span
        className="vh-pd-brand-link font-header"
        onClick={() => {
          if (providerId) onNavigateStore(providerId);
        }}
        title="Xem gian hàng của Shop"
      >
        Hãng: {product.providerId?.businessName || 'Huế Cổ Phục Studio'} ↗
      </span>

      <h1 className="font-header text-2xl sm:text-3xl lg:text-4xl text-stone-900 font-bold mt-1 leading-tight">
        {product.name}
      </h1>

      <div style={{ marginTop: '10px' }}>
        <SmartTagList badges={product.badges} />
      </div>

      {product.customTags && product.customTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {product.customTags.map((tag) => (
            <span
              key={tag.normalizedLabel}
              className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Star rating summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '2px',
            color: 'var(--color-gold)',
          }}
        >
          {[1, 2, 3, 4, 5].map((starIdx) => (
            <Star
              key={starIdx}
              size={14}
              fill={
                starIdx <= Math.round(product.rating.averageRating)
                  ? 'currentColor'
                  : 'none'
              }
              color="currentColor"
            />
          ))}
        </div>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {product.rating.averageRating.toFixed(1)}
        </span>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}
        >
          ({product.rating.totalReviews} đánh giá)
        </span>
      </div>
    </div>
  );
};
