import React from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';
import type { PhotographerDetails, PhotographerPackage, PhotographyQuote } from '../types/photographer.types';

interface PhotographyBookingSidebarProps {
  photographer: PhotographerDetails;
  selectedPackage: PhotographerPackage | null;
  selectedDate: string;
  selectedTimeSlot: string;
  selectedLocation: string;
  selectedConcept: string;
  quote: PhotographyQuote | null;
  quoteError: string | null;
  isQuoteLoading: boolean;
  agreeTerms: boolean;
  isBusy: boolean;
  isBooking: boolean;
  canAddToCart?: boolean;
  onAgreeTermsChange: (checked: boolean) => void;
  onBookNow: () => void;
  onAddToCart: () => void;
}

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

export const PhotographyBookingSidebar: React.FC<PhotographyBookingSidebarProps> = ({
  photographer,
  selectedPackage,
  selectedDate,
  selectedTimeSlot,
  selectedLocation,
  selectedConcept,
  quote,
  quoteError,
  isQuoteLoading,
  agreeTerms,
  isBusy,
  isBooking,
  canAddToCart = true,
  onAgreeTermsChange,
  onBookNow,
  onAddToCart,
}) => {
  const total = quote?.valid && quote.totals ? quote.totals.totalAmount : null;
  const deposit = total === null ? null : Math.round(total * 0.3);
  const isDisabled = isBusy || isBooking || isQuoteLoading || Boolean(quoteError) || quote?.valid === false || !quote;
  const isAddToCartDisabled = isDisabled || !canAddToCart;
  const location = selectedLocation || 'Chưa chọn địa điểm';
  const quoteMessage = quote?.valid === false ? quote.errors[0]?.message : quoteError;

  const formatSingleDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  return (
    <aside style={{ position: 'sticky', top: '85px', zIndex: 10 }}>
      <div className="vh-premium-card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '12px' }}>
          <ImageWithFallback
            src={photographer.coverImage || photographer.portfolio[0]}
            alt={photographer.businessName}
            fallback={<div aria-label={photographer.businessName} style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'grid', placeItems: 'center', backgroundColor: 'var(--color-light-bg)', color: 'var(--color-primary-dark)', fontWeight: 700, fontSize: '15px' }}>{photographer.businessName.charAt(0)}</div>}
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ textAlign: 'left' }}>
            <h3 className="font-header" style={{ fontSize: '16px', color: 'var(--color-text-primary)', margin: 0, fontWeight: 700 }}>{photographer.businessName}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Star size={11} fill="#F59E0B" stroke="#F59E0B" />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{photographer.rating.averageRating.toFixed(1)}</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)' }}>({photographer.rating.totalReviews} đánh giá)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
          <SummaryRow label="Gói chụp" value={selectedPackage?.name || 'Chưa chọn'} />
          <SummaryRow label="Lịch chụp" value={selectedDate ? `${formatSingleDate(selectedDate)} (${selectedTimeSlot})` : 'Chưa chọn'} />
          {location !== 'Chưa chọn địa điểm' && <SummaryRow label="Địa điểm" value={location} />}
          {selectedConcept && <SummaryRow label="Concept" value={selectedConcept} />}
        </div>

        <div style={{ backgroundColor: 'var(--color-light-bg)', padding: '12px 14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Báo giá hiện tại:</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{isQuoteLoading ? 'Đang tính…' : total === null ? 'Chưa có' : formatCurrency(total)}</strong>
          </div>
          {quote?.valid && quote.breakdown.map((item, index) => (
            <div key={`${item.type}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
              <span>{item.label}</span><span>{formatCurrency(item.amount)}</span>
            </div>
          ))}
          {deposit !== null && (
            <>
              <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 650 }}>Đặt cọc (30%):</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>{formatCurrency(deposit)}</strong>
              </div>
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'right' }}>Còn lại {formatCurrency((total ?? 0) - deposit)} thanh toán sau.</span>
            </>
          )}
        </div>

        {quoteMessage && <div className="pd-quote-error">{quoteMessage}</div>}
        {isBusy && <div className="pd-quote-error">Khung giờ này vừa có người khác giữ chỗ. Vui lòng chọn thời gian khác.</div>}

        <label className="vh-checkbox-container" style={{ fontSize: '11.5px', lineHeight: 1.4, alignItems: 'flex-start', textAlign: 'left', gap: '6px' }}>
          <input type="checkbox" className="vh-checkbox-input" checked={agreeTerms} onChange={(event) => onAgreeTermsChange(event.target.checked)} style={{ marginTop: '2px', width: '14px', height: '14px', flexShrink: 0 }} />
          <span>Tôi đồng ý chính sách cọc và cam kết chụp đúng giờ.</span>
        </label>

        {!canAddToCart && <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--color-text-secondary)', textAlign: 'left', lineHeight: 1.45 }}>Lịch nhiều buổi được giữ chỗ và thanh toán trực tiếp để bảo toàn toàn bộ lịch đã chọn.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={onBookNow} disabled={isDisabled} className="vh-btn vh-btn-primary" style={{ width: '100%', borderRadius: '10px', padding: '11px 16px', fontWeight: 700, fontSize: '13.5px', backgroundColor: isDisabled ? '#8C827A' : 'var(--color-primary-dark)', color: '#FFFFFF', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
            {isBooking ? 'ĐANG XỬ LÝ...' : <>ĐẶT LỊCH NGAY <ArrowRight size={14} /></>}
          </button>
          <button onClick={onAddToCart} disabled={isAddToCartDisabled} className="vh-btn" style={{ width: '100%', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, fontSize: '13px', backgroundColor: 'transparent', color: isAddToCartDisabled ? '#8C827A' : 'var(--color-primary-dark)', border: isAddToCartDisabled ? '1.5px solid #8C827A' : '1.5px solid var(--color-primary-dark)', cursor: isAddToCartDisabled ? 'not-allowed' : 'pointer' }}>
            {isBooking ? 'ĐANG XỬ LÝ...' : <>THÊM VÀO GIỎ HÀNG <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </aside>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12.5px', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
    <span>{label}:</span><strong style={{ color: 'var(--color-text-primary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={value}>{value}</strong>
  </div>
);