import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, Clock } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';

export const ProfilePaymentsTab: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    httpClient
      .get<any[]>('/payments/history')
      .then((res: any) => {
        setPayments(Array.isArray(res) ? res : res?.data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch payment history:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="lume-dashboard-card" style={{ gap: '24px' }}>
      <div className="lume-dashboard-card-header" style={{ marginBottom: 0 }}>
        <h3 className="lume-dashboard-card-title">Phương thức thanh toán & Lịch sử giao dịch</h3>
      </div>

      {/* Payment methods badge banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px',
          backgroundColor: '#FCFAF7',
          borderRadius: '12px',
          border: '1px solid #ECE5DB'
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#FDF2F4',
            color: '#8B1E2D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <CreditCard size={22} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, color: '#231F20' }}>
            Cổng thanh toán bảo mật PayOS (VietQR / Thẻ ATM / Visa)
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#8C827A' }}>
            Tất cả các giao dịch cọc & thanh toán trọn gói đều được đối soát và mã hóa bảo mật 256-bit.
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#8B1E2D', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 14px 0' }}>
          Lịch sử giao dịch gần đây
        </h4>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8C827A', fontSize: '13px' }}>
            Đang tải lịch sử giao dịch...
          </div>
        ) : payments.length === 0 ? (
          <div
            style={{
              padding: '36px',
              textAlign: 'center',
              backgroundColor: '#FCFAF7',
              borderRadius: '12px',
              border: '1px dashed #E2DACF',
              color: '#8C827A',
              fontSize: '13px'
            }}
          >
            Chưa có giao dịch thanh toán nào được ghi nhận.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ECE5DB', color: '#7D736B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '10px 12px' }}>Mã GD / Đơn</th>
                  <th style={{ padding: '10px 12px' }}>Thời gian</th>
                  <th style={{ padding: '10px 12px' }}>Mục đích</th>
                  <th style={{ padding: '10px 12px' }}>Số tiền</th>
                  <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const isSuccess = p.status === 'PAID' || p.status === 'SUCCESS';
                  return (
                    <tr key={p._id || p.id} style={{ borderBottom: '1px solid #F3EFE9' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#231F20' }}>
                        {p.transactionCode || p.orderCode || p.bookingCode || 'GD-ONLINE'}
                      </td>
                      <td style={{ padding: '12px', color: '#574D4F', fontSize: '12px' }}>
                        {formatDate(p.createdAt || p.date)}
                      </td>
                      <td style={{ padding: '12px', color: '#574D4F' }}>
                        {p.purpose === 'DEPOSIT_PAYMENT'
                          ? 'Đặt cọc giữ chỗ'
                          : p.purpose === 'FULL_PAYMENT'
                          ? 'Thanh toán trọn gói'
                          : p.description || 'Thanh toán dịch vụ'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 800, color: '#8B1E2D' }}>
                        {(p.amount || 0).toLocaleString('vi-VN')}đ
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isSuccess ? '#ECFDF5' : '#FEF3C7',
                            color: isSuccess ? '#047857' : '#B45309'
                          }}
                        >
                          {isSuccess ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          <span>{isSuccess ? 'Thành công' : 'Chờ xử lý'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
