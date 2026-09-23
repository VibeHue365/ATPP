import type { FormEvent } from 'react';
import type { useProviderReviewsState } from './useProviderReviewsState';

type ReviewReplyModalProps = Pick<ReturnType<typeof useProviderReviewsState>,
  'setReplyingReviewId' | 'replyText' | 'setReplyText'
> &
{
  handleReplyReview: (e: FormEvent<Element>) => Promise<void>;
};

export function ReviewReplyModal({ handleReplyReview, setReplyingReviewId, replyText, setReplyText }: ReviewReplyModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleReplyReview} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>PHẢN HỒI ĐÁNH GIÁ CỦA KHÁCH HÀNG</h4>
          <button type="button" onClick={() => setReplyingReviewId(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <textarea
            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '100px', fontFamily: 'inherit' }}
            placeholder="Nhập nội dung phản hồi nhận xét..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            required
          />
          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
          >
            GỬI PHẢN HỒI
          </button>
        </div>
      </form>
    </div>
  );
}
