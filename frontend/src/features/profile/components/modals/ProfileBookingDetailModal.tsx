import React from 'react';
import {
  Camera,
  Download,
  XCircle,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { Modal } from '../../../../components/common/Modal';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { downloadPhotosAsZip, downloadSinglePhoto } from '../../../../utils/downloadUtils';
import { API_BASE_URL } from '../../../../config/env';
import { useToast } from '../../../../components/feedback/Toast';

interface ProfileBookingDetailModalProps {
  booking: any;
  user: any;
  onClose: () => void;
  onOpenReschedule: (item: any) => void;
  onOpenCancel: (booking: any) => void;
  onContinuePayment: (bookingId: string) => void;
  onOpenReview: (item: any) => void;
  bookingIncident?: any;
  onIncidentResponse?: (agree: boolean) => void;
  onOpenLocationChange?: (schedule: any) => void;
}

export const ProfileBookingDetailModal: React.FC<ProfileBookingDetailModalProps> = ({
  booking,
  user,
  onClose,
  onOpenReschedule,
  onOpenCancel,
  onContinuePayment,
  onOpenReview,
  bookingIncident,
  onIncidentResponse,
  onOpenLocationChange
}) => {
  const toast = useToast();
  if (!booking) return null;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#7F8C8D', bg: '#F2F4F4' },
    PENDING_PAYMENT: { label: 'Chờ cọc', color: '#D35400', bg: '#FDEBD0' },
    DEPOSIT_PAID: { label: 'Đã đặt cọc', color: '#2980B9', bg: '#EBF5FB' },
    CONFIRMED: { label: 'Đã xác nhận', color: '#27AE60', bg: '#E8F8F5' },
    PICKUP_PENDING: { label: 'Chờ nhận đồ', color: '#8E44AD', bg: '#F5EEF8' },
    PICKED_UP: { label: 'Đang thuê', color: '#16A085', bg: '#E8F8F5' },
    RETURN_PENDING: { label: 'Chờ trả đồ', color: '#F39C12', bg: '#FEF9E7' },
    RETURNED: { label: 'Đã trả đồ', color: '#2ECC71', bg: '#E8F8F5' },
    COMPLETED: { label: 'Hoàn thành', color: '#27AE60', bg: '#E8F8F5' },
    CANCELLED: { label: 'Đã hủy', color: '#C0392B', bg: '#FDEDEC' },
    DISPUTED: { label: 'Tranh chấp', color: '#78281F', bg: '#F9EBEA' },
    REFUNDED: { label: 'Đã hoàn tiền', color: '#7F8C8D', bg: '#F2F4F4' }
  };

  const paymentStatusLabels: Record<string, { label: string; color: string; bg: string }> = {
    UNPAID: { label: 'Chưa thanh toán', color: '#C0392B', bg: '#FDEDEC' },
    PARTIALLY_PAID: { label: 'Thanh toán một phần', color: '#D35400', bg: '#FDEBD0' },
    PAID: { label: 'Đã thanh toán', color: '#27AE60', bg: '#E8F8F5' },
    REFUNDED: { label: 'Đã hoàn tiền', color: '#7F8C8D', bg: '#F2F4F4' }
  };

  const matchStatus = statusLabels[booking.status] || { label: booking.status, color: '#333', bg: '#EEE' };
  const payStatus = booking.paymentSummary?.paymentStatus || booking.paymentStatus || 'UNPAID';
  const matchPayStatus = paymentStatusLabels[payStatus] || { label: payStatus, color: '#333', bg: '#EEE' };

  // Financial values
  const grandTotal = booking.pricingSummary?.grandTotal || booking.totalAmount || 0;
  const discountAmount = booking.discountAmount || 0;
  const isPaid = booking.status !== 'PENDING_PAYMENT' && booking.status !== 'WAITING_PAYMENT';

  // Delivered photos
  const photos = booking.deliveredPhotos && booking.deliveredPhotos.length > 0 ? booking.deliveredPhotos : [];
  const driveUrl = booking.deliveryDriveUrl;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`CHI TIẾT ĐƠN HÀNG: ${booking.bookingCode}`}
      maxWidth="720px"
    >
      <div className="lume-modal-content-box animate-fade-in">
        {/* Status badges row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE6E1', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7D736B' }}>Trạng thái đơn:</span>
            <span
              style={{
                display: 'inline-flex',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 750,
                backgroundColor: matchStatus.bg,
                color: matchStatus.color,
                textTransform: 'uppercase'
              }}
            >
              {matchStatus.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7D736B' }}>Thanh toán:</span>
            <span
              style={{
                display: 'inline-flex',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 750,
                backgroundColor: matchPayStatus.bg,
                color: matchPayStatus.color,
                textTransform: 'uppercase'
              }}
            >
              {matchPayStatus.label}
            </span>
          </div>
        </div>

        {/* Customer Information Banner */}
        <div style={{ backgroundColor: '#FCFAF7', padding: '16px', borderRadius: '12px', border: '1px solid #ECE5DB' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#8B1E2D', marginBottom: '8px', textTransform: 'uppercase' }}>
            Thông tin người đặt
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', color: '#4A3F35' }}>
            <span>Người đặt: <strong>{user?.fullName || booking.customerName || 'Khách hàng'}</strong></span>
            <span>Số điện thoại: <strong>{user?.phone || booking.customerPhone || 'Chưa cập nhật'}</strong></span>
            <span style={{ gridColumn: 'span 2' }}>Email: <strong>{user?.email || booking.customerEmail || '—'}</strong></span>
          </div>
        </div>

        {/* Incident / Damage notice if applicable */}
        {bookingIncident && (
          <div style={{ backgroundColor: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C53030', fontWeight: 750, fontSize: '13px' }}>
              <AlertTriangle size={15} /> <span>YÊU CẦU ĐỀN BÙ SỰ CỐ: {(bookingIncident.requestedAmount || 0).toLocaleString('vi-VN')}đ</span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#4A5568', margin: 0 }}>
              {bookingIncident.description || 'Sự cố hỏng trang phục cần bồi thường.'}
            </p>
            {bookingIncident.status === 'PENDING_CUSTOMER' && onIncidentResponse && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => onIncidentResponse(true)}
                  style={{ padding: '6px 14px', backgroundColor: '#27AE60', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đồng ý đền bù
                </button>
                <button
                  type="button"
                  onClick={() => onIncidentResponse(false)}
                  style={{ padding: '6px 14px', backgroundColor: '#C0392B', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Khiếu nại Admin
                </button>
              </div>
            )}
          </div>
        )}

        {/* Photography Delivered Photos */}
        {(photos.length > 0 || driveUrl) && (
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1D4ED8', fontWeight: 800, fontSize: '13.5px' }}>
                <Camera size={16} />
                <span>ẢNH KẾT QUẢ TỪ NHIẾP ẢNH GIA</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {driveUrl && (
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#2563EB',
                      color: 'white',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    🔗 Mở Kho Ảnh Gốc (Google Drive)
                  </a>
                )}
                {photos.length > 0 && (
                  <button
                    onClick={() => {
                      const zipName = `anh_chup_${booking.bookingCode || 'ket_qua'}.zip`;
                      void downloadPhotosAsZip(photos, zipName, toast);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#1D4ED8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={12} /> Tải tất cả ({photos.length})
                  </button>
                )}
              </div>
            </div>

            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {photos.map((photo: string, index: number) => {
                  const photoUrl = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                  return (
                    <div key={index} style={{ position: 'relative', width: '76px', height: '76px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #BFDBFE' }}>
                      <a href={photoUrl} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                        <img src={photoUrl} alt={`Ảnh ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                      <button
                        type="button"
                        onClick={() => void downloadSinglePhoto(photoUrl, `photo_${index + 1}.jpg`)}
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          right: '3px',
                          background: 'rgba(29, 78, 216, 0.85)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px',
                          cursor: 'pointer'
                        }}
                        title="Tải xuống"
                      >
                        <Download size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Cancellation Reason Display */}
        {booking.status === 'CANCELLED' && booking.cancellation?.reason && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 750, fontSize: '13px' }}>
              <XCircle size={15} /> <span>LÝ DO HỦY ĐƠN</span>
            </div>
            <p style={{ fontSize: '13px', color: '#7F1D1D', margin: 0, fontWeight: 500 }}>
              {booking.cancellation.reason}
            </p>
          </div>
        )}

        {/* Location change trigger if photoshoots present */}
        {booking.status === 'CONFIRMED' && booking.schedules?.length > 0 && onOpenLocationChange && (
          <div style={{ padding: '12px 14px', backgroundColor: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: '#1E40AF', fontWeight: 600 }}>
              Địa điểm chụp: {booking.schedules[0]?.locationSnapshot?.address || booking.schedules[0]?.locationAddress || 'Lăng Khải Định, Huế'}
            </span>
            <button
              type="button"
              onClick={() => onOpenLocationChange(booking.schedules[0])}
              style={{ padding: '5px 12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              Đổi địa điểm
            </button>
          </div>
        )}

        {/* Items details */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#8B1E2D', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
            Danh sách dịch vụ & sản phẩm
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {booking.items?.map((item: any, idx: number) => {
              const isProduct = item.itemType === 'PRODUCT';
              const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
              const prodObj = isProduct && item.productId && typeof item.productId === 'object' ? item.productId : null;

              const itemName = prodObj?.name || pkgObj?.name || item.name || (isProduct ? 'Sản phẩm áo dài' : 'Gói chụp ảnh');
              const itemImage = prodObj?.images?.[0] || pkgObj?.coverImage || item.image || item.productImage;

              return (
                <div key={idx} style={{ display: 'flex', gap: '14px', border: '1px solid #ECE5DB', borderRadius: '10px', padding: '14px', backgroundColor: '#FFFFFF' }}>
                  <ImageWithFallback
                    src={itemImage || (isProduct ? undefined : 'https://images.unsplash.com/photo-1537633552985-df8429e8048b')}
                    alt={itemName}
                    fallback={<div style={{ width: '70px', height: '85px', borderRadius: '6px', background: '#F8F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#8C827A' }}>Ảnh</div>}
                    style={{ width: '70px', height: '85px', objectFit: 'cover', borderRadius: '6px' }}
                  />

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ fontSize: '14px', fontWeight: 750, color: '#231F20', margin: 0 }}>{itemName}</h5>
                        {booking.status === 'COMPLETED' && (
                          item.isReviewed ? (
                            <span style={{ color: '#10B981', fontSize: '11.5px', fontWeight: 700 }}>Đã đánh giá</span>
                          ) : (
                            <button
                              onClick={() => onOpenReview(item)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#8B1E2D',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Đánh giá
                            </button>
                          )
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#7D736B', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {isProduct ? (
                          <span>Kích cỡ: <strong>{item.selectedSize || item.size || 'M'}</strong> • Màu sắc: <strong>{item.selectedColor || item.color || 'Đỏ'}</strong></span>
                        ) : (
                          <span>Khung giờ chụp: <strong>{item.shootTimeSlot || '09:00 - 11:00'}</strong> • Ngày: <strong>{formatDate(item.shootDate)}</strong></span>
                        )}
                        {item.shootLocation && <span>Địa điểm: <strong>{item.shootLocation}</strong></span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', borderTop: '1px dashed #ECE5DB', paddingTop: '6px' }}>
                      <span style={{ fontSize: '11.5px', color: '#7D736B' }}>
                        {item.unitPrice?.toLocaleString('vi-VN')}đ x {item.quantity || 1}
                      </span>
                      <strong style={{ fontSize: '13.5px', color: '#8B1E2D' }}>
                        {((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}đ
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary */}
        <div style={{ marginLeft: 'auto', width: '320px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #ECE5DB', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Tổng tiền dịch vụ:</span>
            <span style={{ fontWeight: 600 }}>{grandTotal.toLocaleString('vi-VN')}đ</span>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#059669' }}>
              <span>Ưu đãi giảm giá:</span>
              <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#231F20', borderTop: '1px dashed #ECE5DB', paddingTop: '8px' }}>
            <span>Tổng thanh toán:</span>
            <span style={{ color: '#8B1E2D' }}>{grandTotal.toLocaleString('vi-VN')}đ</span>
          </div>

          {isPaid && (
            <div style={{ fontSize: '11px', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', marginTop: '4px', fontWeight: 700 }}>
              ✅ Đã thanh toán đầy đủ qua PayOS
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #ECE5DB', paddingTop: '16px' }}>
          {(booking.status === 'CONFIRMED' || booking.status === 'DEPOSIT_PAID') && (
            <button
              onClick={() => onOpenReschedule(booking.items?.[0])}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: '#2563EB',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Calendar size={14} /> Đổi lịch hẹn
            </button>
          )}

          {booking.status === 'PENDING_PAYMENT' && (
            <button
              onClick={() => onContinuePayment(booking._id)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 750,
                backgroundColor: '#8B1E2D',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Tiếp tục thanh toán
            </button>
          )}

          {!['COMPLETED', 'CANCELLED', 'RETURNED'].includes(booking.status) && (
            <button
              onClick={() => onOpenCancel(booking)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Hủy đơn
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#574D4F',
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
