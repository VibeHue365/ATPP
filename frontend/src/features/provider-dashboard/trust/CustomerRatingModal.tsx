import { useState, type FormEvent } from 'react';
import { Star, ShieldCheck, User, Sparkles, X } from 'lucide-react';
import type { useProviderTrustState } from './useProviderTrustState';

type CustomerRatingModalProps = Pick<
  ReturnType<typeof useProviderTrustState>,
  'setRatingBooking' | 'setCRating' | 'cRating' | 'cComment' | 'setCComment'
> & {
  ratingBooking?: any;
  handleRateCustomer: (e: FormEvent<Element>) => Promise<void>;
};

const RATING_DESCRIPTIONS: Record<number, { label: string; desc: string; color: string }> = {
  5: {
    label: 'Rất uy tín & Hoàn hảo',
    desc: 'Khách hàng đúng hẹn, giữ gìn trang phục sạch đẹp, giao tiếp lịch sự.',
    color: '#059669',
  },
  4: {
    label: 'Tốt & Đúng hẹn',
    desc: 'Trải nghiệm giao dịch thuận lợi, trả đồ đúng hẹn và hợp tác tốt.',
    color: '#10B981',
  },
  3: {
    label: 'Bình thường / Đạt yêu cầu',
    desc: 'Giao dịch hoàn tất bình thường, không có phát sinh lớn.',
    color: '#D97706',
  },
  2: {
    label: 'Cần cải thiện',
    desc: 'Có phát sinh như trả đồ muộn nhẹ hoặc làm bẩn trang phục.',
    color: '#EA580C',
  },
  1: {
    label: 'Kém / Vi phạm quy định',
    desc: 'Làm hỏng trang phục nặng, vi phạm hợp đồng hoặc không hợp tác.',
    color: '#DC2626',
  },
};

const QUICK_TAGS = [
  '✓ Trả đồ đúng hẹn',
  '✓ Giữ gìn trang phục sạch đẹp',
  '✓ Giao tiếp lịch sự, văn minh',
  '✓ Hợp tác tốt khi check-in/out',
  '✓ Thanh toán nhanh gọn',
  '⚠️ Trả đồ muộn hơn lịch hẹn',
  '⚠️ Trang phục dính vết bẩn cần tẩy',
];

export function CustomerRatingModal({
  handleRateCustomer,
  setRatingBooking,
  setCRating,
  cRating,
  cComment,
  setCComment,
  ratingBooking,
}: CustomerRatingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const activeRating = hoveredStar ?? cRating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  const handleQuickTagClick = (tag: string) => {
    if (!cComment.trim()) {
      setCComment(tag);
    } else if (!cComment.includes(tag)) {
      setCComment(`${cComment.trim()}, ${tag}`);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await handleRateCustomer(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerName =
    ratingBooking?.customerName ||
    ratingBooking?.customerId?.profile?.fullName ||
    'Khách hàng';
  const bookingCode = ratingBooking?.bookingCode || 'Đơn hoàn thành';
  const serviceTitle = ratingBooking?.serviceTitle;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
      }}
      onClick={() => setRatingBooking(null)}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'calc(100vh - 32px)',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #4A0E17 0%, #7A1923 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} color="#F59E0B" />
            </div>
            <div>
              <h4
                style={{
                  fontFamily: 'var(--font-header, inherit)',
                  fontSize: '15px',
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: '0.02em',
                }}
              >
                ĐÁNH GIÁ TÍN NHIỆM KHÁCH HÀNG
              </h4>
              <p style={{ margin: '1px 0 0 0', fontSize: '11px', opacity: 0.85 }}>
                Đánh giá hai chiều sau khi hoàn thành đơn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRatingBooking(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Customer & Booking Info Banner (Fixed) */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#FAF7F2',
            borderBottom: '1px solid #EAE6DF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={15} color="var(--color-primary, #8B1D24)" />
            <span style={{ color: '#6B7280' }}>Khách:</span>
            <strong style={{ color: '#1F2937', fontWeight: 700 }}>
              {customerName}
            </strong>
          </div>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#EDE8E1',
              color: '#4B5563',
            }}
          >
            #{bookingCode}
          </span>
        </div>

        {serviceTitle && (
          <div
            style={{
              padding: '5px 20px',
              backgroundColor: '#F3EFEA',
              fontSize: '11.5px',
              color: '#78350F',
              borderBottom: '1px solid #EAE6DF',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 0,
            }}
          >
            Dịch vụ: <strong>{serviceTitle}</strong>
          </div>
        )}

        {/* Scrollable Body Container */}
        <div
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Star Rating Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 10px',
              backgroundColor: '#FCFAF7',
              borderRadius: '10px',
              border: '1px dashed #D6CEC3',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#6B7280',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              CHẤM ĐIỂM HÀNH VI & ĐỘ UY TÍN
            </span>

            {/* Stars row */}
            <div style={{ display: 'flex', gap: '8px', margin: '2px 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  onClick={() => setCRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: star <= activeRating ? '#F59E0B' : '#E5E7EB',
                    cursor: 'pointer',
                    padding: '2px',
                    transition: 'transform 0.15s ease',
                    transform: star <= activeRating ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={`${star} sao`}
                >
                  <Star
                    size={28}
                    fill={star <= activeRating ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {/* Dynamic Rating Label & Desc */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: ratingInfo.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                }}
              >
                <span>{activeRating} / 5</span>
                <span>•</span>
                <span>{ratingInfo.label}</span>
              </div>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '11.5px',
                  color: '#6B7280',
                  lineHeight: 1.35,
                }}
              >
                {ratingInfo.desc}
              </p>
            </div>
          </div>

          {/* Quick Tags Section */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              <Sparkles size={13} color="#D97706" />
              <span>GỢI Ý NHẬN XÉT NHANH:</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {QUICK_TAGS.map((tag) => {
                const isSelected = cComment.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleQuickTagClick(tag)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: isSelected
                        ? '1px solid var(--color-primary, #8B1D24)'
                        : '1px solid #E5E7EB',
                      backgroundColor: isSelected ? '#FDF2F2' : '#F9FAFB',
                      color: isSelected ? 'var(--color-primary, #8B1D24)' : '#4B5563',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment Textarea */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#374151',
                marginBottom: '5px',
              }}
            >
              CHI TIẾT NHẬN XÉT VỀ KHÁCH HÀNG:
            </label>
            <textarea
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                height: '70px',
                fontFamily: 'inherit',
                lineHeight: 1.45,
                boxSizing: 'border-box',
              }}
              placeholder="Nhập ghi chú về hành vi khách (ví dụ: khách giữ áo sạch đẹp, trả đúng giờ)..."
              value={cComment}
              maxLength={500}
              onChange={(e) => setCComment(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary, #8B1D24)')}
              onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                fontSize: '10.5px',
                color: '#9CA3AF',
                marginTop: '2px',
              }}
            >
              {cComment.length}/500 ký tự
            </div>
          </div>
        </div>

        {/* Fixed Footer with Action Buttons */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setRatingBooking(null)}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#F3F4F6',
              color: '#374151',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              flex: 2,
              padding: '10px',
              background:
                'linear-gradient(135deg, var(--color-primary, #8B1D24) 0%, #A31D24 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              letterSpacing: '0.03em',
              boxShadow: '0 2px 8px rgba(139, 29, 36, 0.25)',
              opacity: isSubmitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={16} />
            {isSubmitting ? 'ĐANG GỬI...' : 'XÁC NHẬN GỬI ĐÁNH GIÁ'}
          </button>
        </div>
      </form>
    </div>
  );
}
