import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';

interface ProfileReviewModalProps {
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProfileReviewModal: React.FC<ProfileReviewModalProps> = ({
  item,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Vui lòng nhập nhận xét của bạn');
      return;
    }

    setIsSubmitting(true);
    try {
      await httpClient.post('/reviews', {
        bookingId: item.bookingId,
        bookingItemId: item.itemId || item._id,
        rating,
        comment: comment.trim(),
        productId: item.productId || undefined,
        photographyPackageId: item.photographyPackageId || undefined
      });

      toast.success('Gửi đánh giá dịch vụ thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        <div
          style={{
            backgroundColor: '#8B1E2D',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px'
          }}
        >
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Đánh giá chất lượng dịch vụ</h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Star Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#7D736B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CHỌN MỨC ĐỘ HÀI LÒNG
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    transition: 'transform 0.15s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Star
                    size={28}
                    fill={star <= rating ? '#D4AF37' : 'none'}
                    color="#D4AF37"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#574D4F', marginBottom: '6px', textTransform: 'uppercase' }}>
              NỘI DUNG NHẬN XÉT
            </label>
            <textarea
              rows={4}
              placeholder="Chia sẻ cảm nhận về phom dáng áo dài, tay nghề thợ ảnh hoặc chất lượng phục vụ..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #DED7CB',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#8B1E2D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 750,
              fontSize: '13.5px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Đang gửi đánh giá...' : 'GỬI ĐÁNH GIÁ NGAY'}
          </button>
        </div>
      </form>
    </div>
  );
};
