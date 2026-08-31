import React, { useState } from 'react';
import { Gift, Percent, Crown, Check } from 'lucide-react';
import { useToast } from '../../../../components/feedback/Toast';
import type { SpecialOfferItem } from '../../types/profile.types';

interface SpecialOffersSectionProps {
  offers?: SpecialOfferItem[];
  onViewAll?: () => void;
}

export const SpecialOffersSection: React.FC<SpecialOffersSectionProps> = ({
  offers = [],
  onViewAll
}) => {
  const toast = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = (offer: SpecialOfferItem) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(offer.code);
    }
    setCopiedId(offer.id);
    toast.success(`Đã sao chép mã ưu đãi: ${offer.code}`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const getOfferIcon = (type: SpecialOfferItem['type']) => {
    if (type === 'DISCOUNT_PERCENT') return <Percent size={20} />;
    if (type === 'DISCOUNT_FIXED') return <Gift size={20} />;
    return <Crown size={20} />;
  };

  return (
    <div className="lume-offers-section">
      <div className="lume-offers-header">
        <h3 className="lume-offers-title">Ưu đãi dành riêng cho bạn</h3>
        {onViewAll && (
          <button
            type="button"
            className="lume-dashboard-card-action"
            onClick={onViewAll}
          >
            Xem tất cả ưu đãi
          </button>
        )}
      </div>

      {offers.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            backgroundColor: '#FCFAF7',
            border: '1px dashed #E5DCD0',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#8C827A',
            fontSize: '13px'
          }}
        >
          Hiện chưa có mã ưu đãi riêng nào. Hãy theo dõi các chương trình khuyến mãi mới tại Trang chủ.
        </div>
      ) : (
        <div className="lume-offers-grid">
          {offers.map((offer) => {
            const isCopied = copiedId === offer.id;
            return (
              <div key={offer.id} className="lume-offer-card">
                <div className="lume-offer-top">
                  <div className="lume-offer-icon-box">
                    {getOfferIcon(offer.type)}
                  </div>
                  <div className="lume-offer-details">
                    <h4 className="lume-offer-card-title">{offer.title}</h4>
                    <p className="lume-offer-card-desc">{offer.description}</p>
                  </div>
                </div>

                <div className="lume-offer-bottom">
                  <span className="lume-offer-expiry">HSD: {offer.expiryDate}</span>
                  <button
                    type="button"
                    className={`lume-offer-action-btn ${isCopied ? 'copied' : ''}`}
                    onClick={() => handleCopyCode(offer)}
                  >
                    {isCopied ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Đã lưu mã
                      </span>
                    ) : (
                      `Lấy mã (${offer.code})`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
