import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderTrustState } from './useProviderTrustState';

type TrustPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<ReturnType<typeof useProviderTrustState>,
    'searchCustId' | 'setSearchCustId' | 'trustScoreResult' | 'bookingsState' | 'setRatingBooking'
  > &
{
  handleSearchTrustScore: () => Promise<void>;
};

export function TrustPanel({
  isLoadingProvider, searchCustId, setSearchCustId, handleSearchTrustScore, trustScoreResult,
  bookingsState, setRatingBooking,
}: TrustPanelProps) {
  return (
    <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Đánh giá khách hàng & Tín nhiệm</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Đánh giá hai chiều sau khi hoàn thành dịch vụ và tra cứu độ uy tín của khách hàng.</p>
        </div>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>TRA CỨU ĐỘ TÍN NHIỆM KHÁCH HÀNG</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Nhập mã ID khách hàng để tra cứu..."
                value={searchCustId}
                onChange={(e) => setSearchCustId(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
              <button
                onClick={handleSearchTrustScore}
                style={{ padding: '11px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
              >
                Tra cứu tín nhiệm
              </button>
            </div>
            {trustScoreResult && (
              <div style={{ padding: '16px', backgroundColor: 'var(--color-light-bg)', borderRadius: '8px', border: '1px solid var(--color-light-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ĐIỂM TÍN NHIỆM TRUNG BÌNH</span>
                  <strong style={{ display: 'block', fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                    {trustScoreResult.averageRating} / 5.0
                  </strong>
                </div>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>Dựa trên {trustScoreResult.totalReviews} lượt đánh giá hành vi từ các đối tác.</span>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>ĐƠN HÀNG CHỜ ĐÁNH GIÁ HÀNH VI</h3>
            {bookingsState.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Không có đơn đặt lịch nào khả dụng để đánh giá.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookingsState.map((booking) => (
                  <div key={booking._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', border: '1px solid var(--color-light-border)', borderRadius: '8px', backgroundColor: 'white' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{booking.bookingCode}</strong>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Mã khách hàng: {booking.customerId?._id || booking.customerId?.id || String(booking.customerId || '—')}</p>
                    </div>
                    <button
                      onClick={() => setRatingBooking({ bookingId: booking._id, customerId: booking.customerId?._id || booking.customerId?.id || String(booking.customerId || '') })}
                      style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
                    >
                      Đánh giá khách hàng
                    </button>
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
