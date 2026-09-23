import {
  Flag, Star
} from 'lucide-react';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderReviewsState } from './useProviderReviewsState';

type ReviewsPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<ReturnType<typeof useProviderReviewsState>,
    'reviewsData' | 'setReplyingReviewId' | 'setReplyText'
  > &
{
  handleReportReview: (reviewId: string) => Promise<void>;
};

export function ReviewsPanel({ isLoadingProvider, reviewsData, handleReportReview, setReplyingReviewId, setReplyText }: ReviewsPanelProps) {
  return (
    <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá & Phản hồi</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Theo dõi mức độ đánh giá trung bình và trả lời các thắc mắc, phản hồi từ khách hàng.</p>
        </div>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải thống kê đánh giá...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>RATING TRUNG BÌNH</span>
              <strong style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '8px 0' }}>{reviewsData?.averageRating || 0} / 5.0</strong>
              <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} fill={s <= Math.round(reviewsData?.averageRating || 0) ? 'currentColor' : 'none'} />
                ))}
              </div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>TỔNG LƯỢT ĐÁNH GIÁ</span>
              <strong style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text-primary)', margin: '8px 0' }}>{reviewsData?.totalReviews || 0}</strong>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Lượt nhận xét thực tế từ khách</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH BÌNH LUẬN NỔI BẬT</h3>
            {!reviewsData?.reviews || reviewsData.reviews.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Chưa có lượt đánh giá nào cho cửa hàng của bạn.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {reviewsData.reviews.map((r: any) => (
                  <div key={r._id} style={{ padding: '16px', border: '1px solid var(--color-light-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={11} fill={s <= r.rating ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '8px 0 0 0' }}>{r.comment || 'Không có bình luận.'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleReportReview(r._id)}
                          style={{ padding: '4px 10px', backgroundColor: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: '6px', color: '#C53030', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Flag size={11} />
                          Báo cáo Spam
                        </button>
                        <button
                          onClick={() => { setReplyingReviewId(r._id); setReplyText(r.reply || ''); }}
                          style={{ padding: '4px 12px', backgroundColor: 'var(--color-dark-bg)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Phản hồi
                        </button>
                      </div>
                    </div>

                    {/* Reply display */}
                    {r.reply && (
                      <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-light-bg)', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                        <strong>Phản hồi của shop: </strong> {r.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
