import React from 'react';
import { ArrowRight, Building, CreditCard, QrCode, ShieldCheck } from 'lucide-react';
import type { CartTotals } from '../types';

interface CartOrderSummaryProps {
  selectedItemsCount: number;
  totals: CartTotals;
  checkedGroups: any[];
  hasRentalProduct: boolean;
  hasCityMismatch: boolean;
  isLoading: boolean;
  onCheckout: () => void;
}

export const CartOrderSummary: React.FC<CartOrderSummaryProps> = ({
  selectedItemsCount,
  totals,
  checkedGroups,
  hasRentalProduct,
  hasCityMismatch,
  isLoading,
  onCheckout,
}) => {
  const isCheckoutDisabled = selectedItemsCount === 0 || isLoading;

  return (
    <aside className="vh-cart-sidebar">
      {/* Tóm tắt đơn hàng box */}
      <div className="vh-cart-summary-box">
        <h3 className="font-header vh-cart-summary-title">Tóm tắt đơn hàng</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: '#5D4037',
            }}
          >
            <span>Tổng tiền dịch vụ ({selectedItemsCount} mục)</span>
            <span style={{ color: '#2D2926', fontWeight: 700 }}>
              {totals.grandTotal.toLocaleString('vi-VN')}đ
            </span>
          </div>

          {totals.totalProductRental > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#5D4037',
              }}
            >
              <span>Tiền thuê Áo dài</span>
              <span style={{ color: '#2D2926', fontWeight: 600 }}>
                {totals.totalProductRental.toLocaleString('vi-VN')}đ
              </span>
            </div>
          )}

          {totals.totalProductDeposit > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#5D4037',
              }}
            >
              <span>Tiền cọc Áo dài</span>
              <span style={{ color: '#2D2926', fontWeight: 600 }}>
                {totals.totalProductDeposit.toLocaleString('vi-VN')}đ
              </span>
            </div>
          )}

          {totals.totalPhotographerFee > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#5D4037',
              }}
            >
              <span>Phí Thợ chụp ảnh</span>
              <span style={{ color: '#2D2926', fontWeight: 600 }}>
                {totals.totalPhotographerFee.toLocaleString('vi-VN')}đ
              </span>
            </div>
          )}

          {totals.comboDiscountTotal > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#27AE60',
                  marginTop: '4px',
                }}
              >
                <span>Giảm giá Combo</span>
                <span style={{ fontWeight: 700 }}>
                  -{totals.comboDiscountTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#E8F8F5',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#27AE60',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginTop: '6px',
                  textAlign: 'left',
                }}
              >
                {checkedGroups
                  .filter((g: any) => g.type === 'SUCCESS')
                  .map((group, gIdx) => {
                    const prod = group.items.find((i: any) => i.itemType === 'PRODUCT');
                    const photo = group.items.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
                    return (
                      <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {prod && prod.comboDiscountPercent !== 0 && (
                          <div>
                            • Cửa hàng giảm {prod.comboDiscountPercent ?? 10}% áo dài (-
                            {(
                              ((prod.basePrice || 0) * (prod.comboDiscountPercent ?? 10)) /
                              100
                            ).toLocaleString('vi-VN')}
                            đ)
                          </div>
                        )}
                        {photo && photo.comboDiscountPercent !== 0 && (
                          <div>
                            • Thợ ảnh giảm {photo.comboDiscountPercent ?? 10}% gói chụp (-
                            {(
                              ((photo.basePrice || 0) * (photo.comboDiscountPercent ?? 10)) /
                              100
                            ).toLocaleString('vi-VN')}
                            đ)
                          </div>
                        )}
                        {photo && photo.comboDiscountPercent === 0 && (
                          <div style={{ color: '#7F8C8D' }}>
                            • Thợ ảnh {photo.photographerName} không áp dụng giảm giá Combo
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <div style={{ height: '1px', backgroundColor: '#EAE1D4', margin: '20px 0' }} />

        {/* Pay Now Section */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#2D2926',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            CẦN THANH TOÁN NGAY
          </div>
          <div className="font-header vh-cart-summary-paynow">
            {totals.depositToPayNow.toLocaleString('vi-VN')}đ
          </div>
        </div>

        {/* Nested box for pay later */}
        {totals.remainingToPayLater > 0 && (
          <div
            style={{
              backgroundColor: '#F5EFE6',
              padding: '12px 16px',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: '#5D4037',
              marginBottom: '16px',
            }}
          >
            <span>Tiền trả sau cho thợ chụp</span>
            <strong style={{ color: '#2D2926' }}>
              {totals.remainingToPayLater.toLocaleString('vi-VN')}đ
            </strong>
          </div>
        )}

        {/* Store pickup notice */}
        {hasRentalProduct && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              padding: '12px',
              backgroundColor: '#FFF8E9',
              border: '1px solid #F2D9A6',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#6E5318',
            }}
          >
            <Building size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', lineHeight: 1.55 }}>
              <strong>Nhận và trả áo dài tại cùng một điểm.</strong>
              <br />
              Điểm do cửa hàng thiết lập được snapshot khi tạo booking. Địa chỉ và nút chỉ đường chỉ
              hiện trong chi tiết booking, không hiển thị công khai trước đó.
            </div>
          </div>
        )}

        {/* Geographic Mismatch Warning */}
        {hasCityMismatch && (
          <div
            style={{
              color: '#C0392B',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FDE8E8',
              padding: '10px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              textAlign: 'left',
              border: '1px solid #F8B4B4',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C0392B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Lệch khu vực địa lý Áo dài & Thợ ảnh!</span>
          </div>
        )}

        {/* Checkout button */}
        <button
          onClick={onCheckout}
          disabled={isCheckoutDisabled}
          className={`font-body vh-cart-checkout-btn ${isCheckoutDisabled ? 'disabled' : 'active'}`}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>ĐANG XỬ LÝ...</span>
            </>
          ) : (
            <>
              <span>TIẾN HÀNH THANH TOÁN</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Secure Payment details */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div
            style={{
              fontSize: '11px',
              color: '#A29382',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}
          >
            THANH TOÁN AN TOÀN QUA
          </div>
          <div
            style={{ display: 'flex', gap: '16px', justifyContent: 'center', color: '#A29382' }}
          >
            <QrCode size={20} />
            <Building size={20} />
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* Quality Guarantee Shield box */}
      <div className="vh-cart-guarantee-box">
        <div style={{ color: '#8B1E22', marginTop: '2px' }}>
          <ShieldCheck size={20} />
        </div>
        <div style={{ fontSize: '12px', color: '#5D4037', lineHeight: 1.5 }}>
          Cam kết chất lượng: Hoàn tiền 100% nếu trang phục không đúng mô tả.
        </div>
      </div>
    </aside>
  );
};

export default CartOrderSummary;
