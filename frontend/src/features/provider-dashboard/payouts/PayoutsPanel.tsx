import {
  DollarSign
} from 'lucide-react';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderPayoutsState } from './useProviderPayoutsState';

type PayoutsPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider' | 'setSelectedBookingId' | 'setIsDetailModalOpen'
> &
  Pick<ReturnType<typeof useProviderPayoutsState>,
    'payouts'
  >;

export function PayoutsPanel({ isLoadingProvider, payouts, setSelectedBookingId, setIsDetailModalOpen }: PayoutsPanelProps) {
  return (
    <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Lịch sử quyết toán từ hệ thống</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Danh sách các khoản thanh toán đã được hệ thống chuyển khoản cho bạn sau khi đơn hàng hoàn thành.</p>
        </div>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu quyết toán...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 20px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px' }}>DANH SÁCH CÁC KHOẢN QUYẾT TOÁN</h3>
            {payouts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-text-secondary)' }}>
                <DollarSign size={40} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
                <p style={{ fontWeight: 700 }}>Chưa có khoản quyết toán nào</p>
                <p style={{ fontSize: '12.5px', marginTop: '4px' }}>Khi đơn hàng được hoàn thành, tiền quyết toán sẽ tự động gửi vào tài khoản ngân hàng của bạn.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>MÃ ĐƠN HÀNG</th>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>MÃ QUYẾT TOÁN</th>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>MÃ BOOKING</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>SỐ TIỀN THỰC NHẬN</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>DOANH THU GỐC</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>PHÍ NỀN TẢNG</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>NGÀY THỰC HIỆN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p: any) => (
                      <tr
                        key={p._id || p.settlementCode}
                        onClick={() => {
                          const bId = p.bookingId?._id || p.bookingId;
                          if (bId) {
                            setSelectedBookingId(bId);
                            setIsDetailModalOpen(true);
                          }
                        }}
                        style={{ borderBottom: '1px solid var(--color-light-border)', cursor: 'pointer' }}
                        className="hover:bg-stone-50 transition"
                      >
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1F2937' }}>{(() => { const bId = p.bookingId?._id || (typeof p.bookingId === 'string' ? p.bookingId : (p.bookingId?.id || null)); return bId ? `#${String(bId).slice(-6).toUpperCase()}` : '—'; })()}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 700 }}>{p.settlementCode || p.id}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>{p.bookingId?.bookingCode || p.bookingCode || '—'}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{(p.payableAmount ?? p.netAmount ?? p.amount ?? 0).toLocaleString('vi-VN')}đ</td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                          {(p.grossAmount ?? 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {(() => {
                            const fee = (p.commissionAmount ?? 0) + (p.allocatedPlatformFee ?? p.fixedPlatformFee ?? 0);
                            const rate = p.commissionRate ? `${(p.commissionRate * 100).toFixed(0)}%` : null;
                            return (
                              <span>
                                <span style={{ fontWeight: 700, color: '#DC2626' }}>-{fee.toLocaleString('vi-VN')}đ</span>
                                {rate && <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>HH: {rate}</span>}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{new Date(p.settledAt || p.createdAt || p.date).toLocaleDateString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
