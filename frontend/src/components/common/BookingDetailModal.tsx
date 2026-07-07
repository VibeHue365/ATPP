import React, { useState, useEffect } from 'react';
import { httpClient } from '../../services/httpClient';
import { Modal } from './Modal';
import { ShieldAlert, User, Clock, FileText } from 'lucide-react';

interface BookingDetailModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerClick?: (customerId: string) => void;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  bookingId,
  isOpen,
  onClose,
  onCustomerClick
}) => {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetails();
    } else {
      setBooking(null);
      setError(null);
    }
  }, [isOpen, bookingId]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get<any>(`/bookings/${bookingId}`);
      setBooking(res);
    } catch (err: any) {
      console.error('Lỗi khi lấy chi tiết đơn hàng:', err);
      setError('Không thể tải chi tiết đơn hàng này. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; bg: string; color: string }> = {
      PENDING_PAYMENT: { text: 'Chờ thanh toán', bg: '#FEF3C7', color: '#D97706' },
      CONFIRMED: { text: 'Đã xác nhận', bg: '#E0F2FE', color: '#0284C7' },
      PICKUP_PENDING: { text: 'Chờ nhận đồ', bg: '#EEF2F6', color: '#4B5563' },
      PICKED_UP: { text: 'Đang thuê', bg: '#F5F3FF', color: '#7C3AED' },
      RETURN_PENDING: { text: 'Chờ duyệt sự cố', bg: '#FFF1F2', color: '#E11D48' },
      RETURNED: { text: 'Đã trả đồ', bg: '#ECFDF5', color: '#059669' },
      COMPLETED: { text: 'Đã hoàn thành', bg: '#D1FAE5', color: '#065F46' },
      CANCELLED: { text: 'Đã hủy', bg: '#FEE2E2', color: '#B91C1C' },
      DISPUTED: { text: 'Tranh chấp', bg: '#FEE2E2', color: '#991B1B' }
    };

    const config = statusMap[status] || { text: status, bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: config.bg,
        color: config.color,
        textTransform: 'uppercase'
      }}>
        {config.text}
      </span>
    );
  };

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('vi-VN') + 'đ';
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  // Tính toán thời hạn dịch vụ chung dựa trên các items
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (booking?.items && booking.items.length > 0) {
    const dates = booking.items.map((item: any) => ({
      from: item.rentalFrom || item.shootDate,
      to: item.rentalTo || item.shootDate
    })).filter((d: any) => d.from);
    if (dates.length > 0) {
      startDate = dates.reduce((min: string, d: any) => d.from < min ? d.from : min, dates[0].from);
      endDate = dates.reduce((max: string, d: any) => d.to < max ? d.to : max, dates[0].to);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết hóa đơn đặt lịch"
      maxWidth="680px"
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #E5E7EB',
            borderTopColor: '#4A0E17',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#EF4444' }}>
          <ShieldAlert size={32} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>{error}</p>
        </div>
      ) : booking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#1F2937' }}>
          {/* Header Info */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FAF6F0',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #E8E2D5'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#7A7A7A' }}>MÃ ĐƠN HÀNG:</span>
                <strong style={{ fontSize: '15px', color: '#4A0E17' }}>{booking.bookingCode}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>
                Ngày đặt: {formatDate(booking.createdAt)}
              </div>
            </div>
            <div>{getStatusBadge(booking.status)}</div>
          </div>

          {/* Customer / Service Provider info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid #F3F4F6', paddingBottom: '6px' }}>
                <User size={14} color="#B89047" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A0E17', textTransform: 'uppercase' }}>Khách hàng</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {onCustomerClick ? (
                  <span 
                    onClick={() => {
                      const custId = booking.customerId?._id || booking.customerId;
                      if (custId) onCustomerClick(custId);
                    }}
                    style={{ color: '#2563EB', textDecoration: 'underline', cursor: 'pointer', fontWeight: 750 }}
                    title="Bấm để xem thông tin tín nhiệm khách hàng"
                  >
                    {booking.customerName || 'Khách hàng'}
                  </span>
                ) : (
                  booking.customerName || 'Khách vãng lai'
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>SĐT: {booking.customerPhone || '—'}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid #F3F4F6', paddingBottom: '6px' }}>
                <Clock size={14} color="#B89047" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A0E17', textTransform: 'uppercase' }}>Thời hạn dịch vụ</span>
              </div>
              <div style={{ fontSize: '12px', color: '#374151' }}>
                Bắt đầu: <strong>{formatDate(startDate)}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                Kết thúc: <strong>{formatDate(endDate)}</strong>
              </div>
            </div>
          </div>

          {/* List Items */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 750, color: '#4A0E17', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} />
              Chi tiết sản phẩm / Dịch vụ
            </h4>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>TÊN DỊCH VỤ / MẪU MÃ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>TÙY CHỌN</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>ĐƠN GIÁ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563', fontSize: '11px' }}>THÀNH TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.items && booking.items.length > 0 ? (
                    booking.items.map((item: any) => {
                      const isProduct = item.itemType === 'PRODUCT' || !!item.productId;
                      const name = isProduct 
                        ? (item.productId?.name || 'Sản phẩm áo dài')
                        : (item.photographyPackageId?.name || 'Gói chụp ảnh');
                      
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                              Loại: {isProduct ? 'Thuê áo dài' : 'Lịch chụp ảnh'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                              {isProduct 
                                ? `Thời gian thuê: ${formatDate(item.rentalFrom)} - ${formatDate(item.rentalTo)}`
                                : `Ngày chụp: ${formatDate(item.shootDate)}`
                              }
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px' }}>
                            {isProduct ? (
                              <span>Size {item.selectedSize || '—'} • Màu {item.selectedColor || '—'}</span>
                            ) : (
                              <span>Khung giờ: {item.shootTimeSlot || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(item.unitPrice * (item.quantity || 1))}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                        Không có chi tiết mặt hàng
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing & Billing Summary */}
          <div style={{
            backgroundColor: '#FAF9F6',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#4B5563' }}>Tiền thuê dịch vụ:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(booking.paymentSummary?.subTotal || booking.pricingSummary?.subTotal)}</span>
            </div>
            {booking.pricingSummary?.serviceFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#4B5563' }}>Phí dịch vụ Heritage:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(booking.pricingSummary.serviceFee)}</span>
              </div>
            )}
            {booking.paymentSummary?.depositTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#4B5563' }}>Tiền cọc giữ đồ (Sẽ hoàn lại khi trả đồ):</span>
                <span style={{ fontWeight: 600, color: '#D97706' }}>{formatCurrency(booking.paymentSummary.depositTotal)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #D1D5DB', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800 }}>
              <span style={{ color: '#4A0E17' }}>TỔNG CỘNG HÓA ĐƠN:</span>
              <span style={{ color: '#4A0E17' }}>{formatCurrency(booking.pricingSummary?.grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
              <span style={{ color: '#047857', fontWeight: 700 }}>Số tiền đã thanh toán:</span>
              <span style={{ color: '#047857', fontWeight: 800 }}>{formatCurrency(booking.paymentSummary?.totalPaid)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>
          Không tìm thấy đơn hàng tương ứng.
        </div>
      )}
    </Modal>
  );
};
export default BookingDetailModal;
