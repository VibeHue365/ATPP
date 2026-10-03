import React from 'react';
import { ArrowRight } from 'lucide-react';

interface CartMobileStickyBarProps {
  selectedCount: number;
  depositToPayNow: number;
  grandTotal: number;
  isLoading: boolean;
  onCheckout: () => void;
}

export const CartMobileStickyBar: React.FC<CartMobileStickyBarProps> = ({
  selectedCount,
  depositToPayNow,
  grandTotal,
  isLoading,
  onCheckout,
}) => {
  const isCheckoutDisabled = selectedCount === 0 || isLoading;

  return (
    <div className="vh-cart-mobile-sticky-bar">
      <div className="vh-cart-mobile-sticky-info">
        <span className="vh-cart-mobile-sticky-label">
          Cần thanh toán ({selectedCount} mục)
        </span>
        <div className="vh-cart-mobile-sticky-price-row">
          <strong className="vh-cart-mobile-sticky-price">
            {depositToPayNow.toLocaleString('vi-VN')}đ
          </strong>
        </div>
        {grandTotal > depositToPayNow && (
          <span className="vh-cart-mobile-sticky-subtext">
            Tổng dịch vụ: {grandTotal.toLocaleString('vi-VN')}đ
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={isCheckoutDisabled}
        className={`vh-cart-mobile-sticky-btn ${
          isCheckoutDisabled ? 'disabled' : 'active'
        }`}
      >
        {isLoading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Đang xử lý...</span>
          </>
        ) : (
          <>
            <span>Thanh toán{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
            <ArrowRight size={15} />
          </>
        )}
      </button>
    </div>
  );
};

export default CartMobileStickyBar;
