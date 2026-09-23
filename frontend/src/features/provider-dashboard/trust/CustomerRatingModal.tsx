import {
  Star
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { useProviderTrustState } from './useProviderTrustState';

type CustomerRatingModalProps = Pick<ReturnType<typeof useProviderTrustState>,
  'setRatingBooking' | 'setCRating' | 'cRating' | 'cComment' | 'setCComment'
> &
{
  handleRateCustomer: (e: FormEvent<Element>) => Promise<void>;
};

export function CustomerRatingModal({
  handleRateCustomer, setRatingBooking, setCRating, cRating, cComment, setCComment,
}: CustomerRatingModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleRateCustomer} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>ĐÁNH GIÁ KHÁCH HÀNG (TWO-WAY REVIEW)</h4>
          <button type="button" onClick={() => setRatingBooking(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>MỨC ĐỘ UY TÍN / TÍN NHIỆM</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCRating(star)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', padding: '4px' }}
                >
                  <Star size={24} fill={star <= cRating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
          <textarea
            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '80px', fontFamily: 'inherit' }}
            placeholder="Ghi nhận xét về khách hàng (ví dụ: trả trang phục đúng hạn, giữ gìn sạch sẽ)..."
            value={cComment}
            onChange={(e) => setCComment(e.target.value)}
          />
          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
          >
            XÁC NHẬN ĐÁNH GIÁ KHÁCH
          </button>
        </div>
      </form>
    </div>
  );
}
