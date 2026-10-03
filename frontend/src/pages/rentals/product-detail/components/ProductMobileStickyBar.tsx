import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import type { RentalMode } from '../types';

interface ProductMobileStickyBarProps {
  computedPrice: number;
  depositAmount: number;
  rentalMode: RentalMode;
  onRentNow: () => void;
  onAddToCart: () => void;
}

export const ProductMobileStickyBar: React.FC<ProductMobileStickyBarProps> = ({
  computedPrice,
  depositAmount,
  rentalMode,
  onRentNow,
  onAddToCart,
}) => {
  return (
    <div className="vh-pd-mobile-sticky-bar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontSize: '10px', color: '#8C827A', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
          Giá {rentalMode === 'HOURLY' ? 'thuê theo giờ' : 'thuê ngày'}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <strong style={{ fontSize: '18px', fontWeight: 800, color: '#8B1E22', letterSpacing: '-0.02em' }}>
            {computedPrice.toLocaleString('vi-VN')}đ
          </strong>
        </div>
        {depositAmount > 0 && (
          <span style={{ fontSize: '10px', color: '#8C7355', fontWeight: 600 }}>
            (Cọc: +{depositAmount.toLocaleString('vi-VN')}đ)
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onAddToCart}
          className="vh-pd-mobile-cart-btn"
          title="Thêm vào giỏ hàng"
          aria-label="Thêm vào giỏ hàng"
        >
          <ShoppingBag size={18} />
        </button>

        <button
          type="button"
          onClick={onRentNow}
          className="vh-pd-mobile-rent-btn"
        >
          <span>Thuê ngay</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default ProductMobileStickyBar;
