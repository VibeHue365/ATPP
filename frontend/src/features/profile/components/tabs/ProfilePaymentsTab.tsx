import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Wallet
} from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';

export const ProfilePaymentsTab: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'PAYMENT' | 'REFUND'>('ALL');

  const fetchPayments = () => {
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
  };

  useEffect(() => {
    fetchPayments();
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

  const getPurposeDetails = (p: any) => {
    const isRefund = p.purpose === 'DEPOSIT_REFUND';
    const booking = p.bookingId && typeof p.bookingId === 'object' ? p.bookingId : null;
    const bStatus = booking?.status;
    const isCancelled = bStatus === 'CANCELLED' || (booking?.cancellation?.refundAmount && booking?.cancellation?.refundAmount > 0);
    const isDisputed = bStatus === 'DISPUTED' || (booking?.disputeResult?.refundAmount && booking?.disputeResult?.refundAmount > 0);
    const reasonLower = (p.refundReason || '').toLowerCase();

    if (isRefund) {
      if (isDisputed || reasonLower.includes('dispute') || reasonLower.includes('tranh chấp') || reasonLower.includes('khiếu nại')) {
        return {
          title: 'Hoàn tiền giải quyết tranh chấp',
          subtitle: booking?.disputeResult?.resolution || 'Giải quyết khiếu nại thành công',
          isRefund: true
        };
      }
      if (isCancelled || p.refundReason === 'LATE_PAYMENT_CLOSED_BOOKING' || reasonLower.includes('cancel') || reasonLower.includes('hủy')) {
        return {
          title: 'Hoàn tiền hủy đơn hàng',
          subtitle: booking?.cancellation?.reason || (p.refundReason !== 'LATE_PAYMENT_CLOSED_BOOKING' && p.refundReason ? p.refundReason : 'Đơn hàng đã được hủy'),
          isRefund: true
        };
      }
      if (bStatus === 'COMPLETED' || bStatus === 'RETURNED' || p.refundReason === 'RENTAL_DEPOSIT_RETURN' || booking?.rentalDepositRefund?.amount > 0) {
        return {
          title: 'Hoàn trả tiền cọc giữ đồ',
          subtitle: 'Hoàn tất trả đồ & kiểm tra sản phẩm',
          isRefund: true
        };
      }
      return {
        title: 'Hoàn trả tiền đặt cọc',
        subtitle: p.refundReason || 'Giao dịch hoàn tiền bảo đảm',
        isRefund: true
      };
    }

    if (p.purpose === 'DEPOSIT_PAYMENT') {
      return {
        title: 'Đặt cọc giữ chỗ',
        subtitle: 'Thanh toán cọc xác nhận lịch',
        isRefund: false
      };
    }

    if (p.purpose === 'FULL_PAYMENT') {
      return {
        title: 'Thanh toán trọn gói',
        subtitle: 'Thanh toán toàn bộ đơn hàng',
        isRefund: false
      };
    }

    if (p.purpose === 'REMAINING_PAYMENT') {
      return {
        title: 'Thanh toán số tiền còn lại',
        subtitle: 'Tất toán phần còn lại của đơn',
        isRefund: false
      };
    }

    if (p.purpose === 'CANCELLATION_FEE') {
      return {
        title: 'Phí hủy đơn hàng',
        subtitle: 'Khấu trừ phí theo chính sách',
        isRefund: false
      };
    }

    if (p.purpose === 'DAMAGE_FEE') {
      return {
        title: 'Bồi thường hư hại sản phẩm',
        subtitle: 'Khấu trừ chi phí xử lý hư hại',
        isRefund: false
      };
    }

    if (p.purpose === 'LATE_RETURN_FEE') {
      return {
        title: 'Phí trả đồ trễ hẹn',
        subtitle: 'Phí phát sinh trễ ngày trả đồ',
        isRefund: false
      };
    }

    return {
      title: p.description || 'Thanh toán dịch vụ',
      subtitle: '',
      isRefund: false
    };
  };

  // Calculations for summary stats
  const totalPaid = payments
    .filter((p) => p.purpose !== 'DEPOSIT_REFUND' && (p.status === 'SUCCESS' || p.status === 'PAID'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalRefunded = payments
    .filter((p) => p.purpose === 'DEPOSIT_REFUND' && (p.status === 'SUCCESS' || p.status === 'PAID'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const paymentCount = payments.filter((p) => p.purpose !== 'DEPOSIT_REFUND').length;
  const refundCount = payments.filter((p) => p.purpose === 'DEPOSIT_REFUND').length;

  // Filtered payments list
  const filteredPayments = payments.filter((p) => {
    if (filterType === 'PAYMENT') return p.purpose !== 'DEPOSIT_REFUND';
    if (filterType === 'REFUND') return p.purpose === 'DEPOSIT_REFUND';
    return true;
  });

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
            Tất cả các giao dịch cọc, thanh toán trọn gói và hoàn tiền cọc đều được đối soát và mã hóa bảo mật 256-bit.
          </p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Total Paid Card */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#FFF7F7',
            borderRadius: '12px',
            border: '1px solid #FCD4D4',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#FFE4E4',
              color: '#8B1E2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowUpRight size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng tiền đã thanh toán
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#8B1E2D', marginTop: '2px' }}>
              - {totalPaid.toLocaleString('vi-VN')}đ
            </div>
            <div style={{ fontSize: '11px', color: '#A3928E', marginTop: '2px' }}>
              {paymentCount} giao dịch thanh toán
            </div>
          </div>
        </div>

        {/* Total Refunded Card */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#F0FDF4',
            borderRadius: '12px',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#DCFCE7',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng tiền đã hoàn trả (Cọc & Hủy)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
              + {totalRefunded.toLocaleString('vi-VN')}đ
            </div>
            <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
              {refundCount} giao dịch hoàn tiền
            </div>
          </div>
        </div>

        {/* Total Transactions Card */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng lịch sử giao dịch
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#231F20', marginTop: '2px' }}>
              {payments.length} bản ghi
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Bao gồm thanh toán & dòng tiền hoàn cọc
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            margin: '0 0 16px 0'
          }}
        >
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: '#8B1E2D',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: 0
            }}
          >
            Lịch sử giao dịch gần đây
          </h4>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: filterType === 'ALL' ? '#8B1E2D' : '#E2DACF',
                backgroundColor: filterType === 'ALL' ? '#8B1E2D' : '#FFFFFF',
                color: filterType === 'ALL' ? '#FFFFFF' : '#574D4F',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Tất cả ({payments.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('PAYMENT')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: filterType === 'PAYMENT' ? '#8B1E2D' : '#E2DACF',
                backgroundColor: filterType === 'PAYMENT' ? '#8B1E2D' : '#FFFFFF',
                color: filterType === 'PAYMENT' ? '#FFFFFF' : '#574D4F',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Thanh toán ({paymentCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('REFUND')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: filterType === 'REFUND' ? '#059669' : '#E2DACF',
                backgroundColor: filterType === 'REFUND' ? '#059669' : '#FFFFFF',
                color: filterType === 'REFUND' ? '#FFFFFF' : '#059669',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Hoàn cọc & Hoàn tiền ({refundCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#8C827A', fontSize: '13px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #F3F4F6', borderTopColor: '#8B1E2D', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px auto' }} />
            Đang tải lịch sử giao dịch...
          </div>
        ) : filteredPayments.length === 0 ? (
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
            Chưa có giao dịch nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #ECE5DB', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#FAF7F2',
                    borderBottom: '1px solid #ECE5DB',
                    color: '#7D736B',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  <th style={{ padding: '12px 14px' }}>Mã GD / Đơn</th>
                  <th style={{ padding: '12px 14px' }}>Thời gian</th>
                  <th style={{ padding: '12px 14px' }}>Mục đích</th>
                  <th style={{ padding: '12px 14px' }}>Phương thức</th>
                  <th style={{ padding: '12px 14px' }}>Số tiền</th>
                  <th style={{ padding: '12px 14px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const isSuccess = p.status === 'PAID' || p.status === 'SUCCESS';
                  const isProcessing = p.status === 'PROCESSING';
                  const purposeInfo = getPurposeDetails(p);
                  const isRefund = purposeInfo.isRefund;
                  const booking = p.bookingId && typeof p.bookingId === 'object' ? p.bookingId : null;
                  const bookingCode = booking?.bookingCode || (typeof p.bookingId === 'string' ? p.bookingId.slice(-8).toUpperCase() : null);
                  const bType = booking?.bookingType;

                  const displayCode = p.paymentCode || (p.payos?.orderCode ? `GD-${p.payos.orderCode}` : (p.transactionCode || 'GD-ONLINE'));

                  return (
                    <tr
                      key={p._id || p.id || p.paymentCode}
                      style={{
                        borderBottom: '1px solid #F3EFE9',
                        backgroundColor: isRefund ? '#FAFCFA' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Mã GD / Đơn */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        {bookingCode}
                      </td>

                      {/* Thời gian */}
                      <td style={{ padding: '14px', color: '#574D4F', fontSize: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {formatDate(p.paidAt || p.createdAt || p.date)}
                      </td>

                      {/* Mục đích */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: isRefund ? '#DCFCE7' : '#FDF2F4',
                              color: isRefund ? '#059669' : '#8B1E2D',
                              flexShrink: 0
                            }}
                          >
                            {isRefund ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          </span>
                          <span style={{ fontWeight: 700, color: '#231F20', fontSize: '13px' }}>
                            {purposeInfo.title}
                          </span>
                        </div>
                        {purposeInfo.subtitle && (
                          <div style={{ fontSize: '11px', color: '#8C827A', marginTop: '3px', paddingLeft: '26px' }}>
                            {purposeInfo.subtitle}
                          </div>
                        )}
                        {bType && (
                          <div style={{ fontSize: '10px', color: '#8C827A', marginTop: '2px', paddingLeft: '26px' }}>
                            {bType === 'PHOTOGRAPHY'
                              ? '📷 Gói chụp ảnh'
                              : bType === 'COMBO'
                                ? '✨ Combo Thuê & Chụp'
                                : '👘 Thuê áo dài'}
                          </div>
                        )}
                      </td>

                      {/* Phương thức */}
                      <td style={{ padding: '14px', color: '#574D4F', fontSize: '12px', verticalAlign: 'middle' }}>
                        {p.paymentMethod === 'PAYOS_REFUND'
                          ? 'Hoàn tiền PayOS'
                          : p.paymentMethod || 'PayOS (VietQR)'}
                      </td>

                      {/* Số tiền */}
                      <td style={{ padding: '14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: '14px',
                            color: isRefund ? '#059669' : '#8B1E2D'
                          }}
                        >
                          {isRefund ? '+' : '-'} {(p.amount || 0).toLocaleString('vi-VN')}đ
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: isRefund ? '#047857' : '#8B1E2D',
                            marginTop: '2px'
                          }}
                        >
                          {isRefund ? '↓ Tiền vào' : '↑ Tiền ra'}
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isSuccess
                              ? '#ECFDF5'
                              : isProcessing
                                ? '#EFF6FF'
                                : p.status === 'PENDING'
                                  ? '#FEF3C7'
                                  : '#FEE2E2',
                            color: isSuccess
                              ? '#047857'
                              : isProcessing
                                ? '#1D4ED8'
                                : p.status === 'PENDING'
                                  ? '#B45309'
                                  : '#DC2626'
                          }}
                        >
                          {isSuccess ? (
                            <CheckCircle2 size={13} />
                          ) : isProcessing ? (
                            <RotateCcw size={13} />
                          ) : (
                            <Clock size={13} />
                          )}
                          <span>
                            {isSuccess
                              ? 'Thành công'
                              : isProcessing
                                ? isRefund
                                  ? 'Đang hoàn tiền'
                                  : 'Đang xử lý'
                                : p.status === 'PENDING'
                                  ? 'Chờ thanh toán'
                                  : p.status === 'CANCELLED'
                                    ? 'Đã hủy'
                                    : 'Thất bại'}
                          </span>
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
