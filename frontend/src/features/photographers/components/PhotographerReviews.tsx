import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { ImageWithFallback } from '../../../shared/media/ImageWithFallback';

export interface PhotographerReview {
  _id: string;
  rating: number;
  comment?: string;
  reply?: string;
  createdAt: string;
  customerId?: {
    fullName?: string;
    email?: string;
    avatarUrl?: string;
    profile?: { fullName?: string; avatarUrl?: string };
  };
}

interface PhotographerReviewsProps {
  reviews: PhotographerReview[];
  isLoading: boolean;
}

export const PhotographerReviews: React.FC<PhotographerReviewsProps> = ({ reviews, isLoading }) => {
  const averageRating = useMemo(
    () => reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0,
    [reviews],
  );

  return (
    <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--color-light-border)', marginTop: '40px' }}>
      <h3 className="font-header" style={{ fontSize: '22px', fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: '24px', textAlign: 'left' }}>
        Đánh giá từ khách hàng ({reviews.length})
      </h3>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#8C827A' }}>Đang tải đánh giá...</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', backgroundColor: 'var(--color-light-bg)', borderRadius: '12px', border: '1px solid #EAEAE8' }}>
          <Star size={32} style={{ color: '#CCCCCC', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', color: '#8C827A', margin: 0 }}>Chưa có đánh giá nào cho nhiếp ảnh gia này.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '48px', fontWeight: 850, color: 'var(--color-primary-dark)', margin: 0 }}>{averageRating.toFixed(1)}</h4>
              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', margin: '6px 0' }}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={16} fill={star <= Math.round(averageRating) ? 'var(--color-gold)' : 'none'} color="var(--color-gold)" />)}</div>
              <span style={{ fontSize: '13px', color: '#8C827A', fontWeight: 600 }}>Đánh giá trung bình</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter((review) => Math.floor(review.rating) === stars).length;
                const percentage = (count / reviews.length) * 100;
                return <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12.5px', fontWeight: 600, color: '#2D2926' }}><span style={{ width: '40px', textAlign: 'right' }}>{stars} sao</span><div style={{ flex: 1, height: '8px', backgroundColor: '#EAEAE8', borderRadius: '9999px', overflow: 'hidden' }}><div style={{ width: `${percentage}%`, height: '100%', backgroundColor: 'var(--color-gold)', borderRadius: '9999px' }} /></div><span style={{ width: '30px', color: '#8C827A' }}>{count}</span></div>;
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid #EAEAE8', paddingTop: '24px' }}>
            {reviews.map((review) => {
              const customerName = review.customerId?.profile?.fullName || review.customerId?.fullName || review.customerId?.email || 'Khách hàng';
              const avatar = review.customerId?.profile?.avatarUrl || review.customerId?.avatarUrl;
              return <div key={review._id} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #F6F6F4', paddingBottom: '20px', textAlign: 'left' }}><ImageWithFallback src={avatar} alt={customerName} fallback={<div aria-label={customerName} style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'grid', placeItems: 'center', backgroundColor: 'var(--color-light-bg)', color: 'var(--color-primary-dark)', fontWeight: 700 }}>{customerName.charAt(0).toLocaleUpperCase('vi')}</div>} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.05)' }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: '14px', color: '#2D2926' }}>{customerName}</strong><span style={{ fontSize: '12px', color: '#8C827A' }}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span></div><div style={{ display: 'flex', gap: '2px' }}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={12} fill={star <= review.rating ? 'var(--color-gold)' : 'none'} color="var(--color-gold)" />)}</div>{review.comment && <p style={{ fontSize: '13.5px', color: '#5C544F', margin: '4px 0 0', lineHeight: 1.5 }}>{review.comment}</p>}{review.reply && <div style={{ backgroundColor: 'var(--color-light-bg)', padding: '12px 16px', borderRadius: '8px', marginTop: '10px', borderLeft: '3px solid var(--color-primary-dark)' }}><strong style={{ fontSize: '12.5px', color: 'var(--color-primary-dark)', display: 'block', marginBottom: '4px' }}>Phản hồi từ nhiếp ảnh gia:</strong><p style={{ fontSize: '13px', color: '#5C544F', margin: 0, lineHeight: 1.5 }}>{review.reply}</p></div>}</div></div>;
            })}
          </div>
        </div>
      )}
    </section>
  );
};
