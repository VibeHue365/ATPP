import React from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  User,
  Eye,
  CalendarCheck,
  CreditCard,
  Star,
  Download,
  XCircle
} from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import '../ProfilePage.css';

interface ScheduleBookingCardProps {
  booking: any;
  onViewDetails: (booking: any) => void;
  onOpenReschedule: (item: any) => void;
  onOpenLocationChange?: (schedule: any) => void;
  onOpenCancel: (booking: any) => void;
  onOpenReview: (item: any) => void;
  onContinuePayment: (bookingId: string) => void;
}

export const ScheduleBookingCard: React.FC<ScheduleBookingCardProps> = ({
  booking,
  onViewDetails,
  onOpenReschedule,
  onOpenLocationChange,
  onOpenCancel,
  onOpenReview,
  onContinuePayment
}) => {
  const item = booking.items?.[0] || {};
  const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
  const prodObj = !isPhoto && item.productId && typeof item.productId === 'object' ? item.productId : null;

  const itemName = prodObj?.name || pkgObj?.name || item.name || (isPhoto ? 'Gói Chụp Ảnh Cổ Phong' : 'Áo Dài Nhật Bình');
  const itemImage = prodObj?.images?.[0] || pkgObj?.coverImage || item.image || item.productImage;
  const providerName =
    booking.providerIds?.[0]?.businessName ||
    booking.providerIds?.[0]?.fullName ||
    item.providerId?.businessName ||
    item.providerId?.fullName ||
    'Đối tác LUMÉ';

  // Date formatting
  const rawDate = item.shootDate || item.startDate || item.rentalFrom || booking.startDate;
  const dateFormatted = rawDate
    ? new Date(rawDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
  const timeSlot = item.shootTimeSlot || (isPhoto ? '09:00 - 11:00' : undefined);
  const location = item.shootLocation || booking.deliveryAddress?.address || 'TP. Huế';

  // Status info
  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    CONFIRMED: { label: 'SẮP DIỄN RA', bg: '#EFF6FF', color: '#1D4ED8' },
    DEPOSIT_PAID: { label: 'ĐÃ ĐẶT CỌC', bg: '#EBF5FB', color: '#2980B9' },
    PENDING_PAYMENT: { label: 'CHỜ THANH TOÁN', bg: '#FEF3C7', color: '#B45309' },
    PICKUP_PENDING: { label: 'CHỜ NHẬN ĐỒ', bg: '#F5EEF8', color: '#8E44AD' },
    PICKED_UP: { label: 'ĐANG THUÊ', bg: '#ECFDF5', color: '#047857' },
    RETURN_PENDING: { label: 'CHỜ TRẢ ĐỒ', bg: '#FEF9E7', color: '#F39C12' },
    RETURNED: { label: 'ĐÃ TRẢ ĐỒ', bg: '#F2F4F4', color: '#574D4F' },
    COMPLETED: { label: 'HOÀN THÀNH', bg: '#E8F8F5', color: '#27AE60' },
    CANCELLED: { label: 'ĐÃ HỦY', bg: '#FDEDEC', color: '#C0392B' }
  };

  const currentStatus = statusConfig[booking.status] || {
    label: booking.status,
    bg: '#F2F4F4',
    color: '#574D4F'
  };

  // Pricing
  const grandTotal = booking.pricingSummary?.grandTotal || booking.totalAmount || 0;
  const isPaid = booking.status !== 'PENDING_PAYMENT' && booking.status !== 'WAITING_PAYMENT';
  const isDeposit = booking.status === 'DEPOSIT_PAID';

  // Has delivered photos
  const hasPhotos = booking.deliveredPhotos && booking.deliveredPhotos.length > 0;
  const hasDrive = Boolean(booking.deliveryDriveUrl);

  return (
    <div className="lume-schedule-card">
      {/* Top row: Code + Type + Status */}
      <div className="lume-schedule-card-top">
        <div className="lume-schedule-code-group">
          <span className="lume-schedule-code">#{booking.bookingCode || `DH-${booking._id.slice(-6)}`}</span>
          <span className={`lume-schedule-type-badge ${isPhoto ? 'photo' : 'rental'}`}>
            {isPhoto ? '📷 Lịch chụp ảnh' : '👘 Thuê áo dài'}
          </span>
          <span className="lume-schedule-date-created">
            Tạo ngày: {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}
          </span>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 800,
            backgroundColor: currentStatus.bg,
            color: currentStatus.color,
            letterSpacing: '0.03em'
          }}
        >
          {currentStatus.label}
        </span>
      </div>

      {/* Main card body */}
      <div className="lume-schedule-card-body">
        <div className="lume-schedule-thumbnail-wrapper" style={{ width: '90px', height: '110px', minWidth: '90px', maxWidth: '90px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid #ECE5DB', backgroundColor: '#F8F5F1' }}>
          <ImageWithFallback
            src={itemImage || (isPhoto ? 'https://images.unsplash.com/photo-1537633552985-df8429e8048b' : undefined)}
            alt={itemName}
            className="lume-schedule-thumbnail"
            style={{ width: '100%', height: '100%', maxWidth: '90px', maxHeight: '110px', objectFit: 'cover', display: 'block' }}
            fallback={
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F5F1', color: '#8C827A', fontSize: '11px' }}>
                Ảnh
              </div>
            }
          />
        </div>

        <div className="lume-schedule-card-main-details">
          <h3 className="lume-schedule-item-title">{itemName}</h3>

          <div className="lume-schedule-meta-row">
            <span className="lume-schedule-meta-item">
              <User size={14} color="#8B1E2D" />
              <span>{providerName}</span>
            </span>

            <span className="lume-schedule-meta-item highlight">
              <Calendar size={14} />
              <span>{dateFormatted} {timeSlot ? `• ${timeSlot}` : ''}</span>
            </span>

            <span className="lume-schedule-meta-item">
              <MapPin size={14} color="#8C827A" />
              <span>{location}</span>
            </span>
          </div>

          {/* Additional details: size / color or countdown pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            {!isPhoto && (item.selectedSize || item.size) && (
              <span style={{ fontSize: '11.5px', color: '#7D736B', background: '#F5EFE6', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Size: {item.selectedSize || item.size}
              </span>
            )}

            {(booking.status === 'CONFIRMED' || booking.status === 'DEPOSIT_PAID') && (
              <span className="lume-countdown-badge urgent">
                <Clock size={11} /> SẮP ĐẾN HẠN
              </span>
            )}

            {booking.status === 'PICKED_UP' && (
              <span className="lume-countdown-badge active">
                <Clock size={11} /> ĐANG TRONG THỜI GIAN THUÊ
              </span>
            )}
          </div>
        </div>

        {/* Pricing Box */}
        <div className="lume-schedule-price-box">
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#8C827A', display: 'block' }}>Tổng thanh toán</span>
            <span className="lume-schedule-total-price">{grandTotal.toLocaleString('vi-VN')}đ</span>
          </div>

          <span
            className="lume-schedule-pay-status"
            style={{
              backgroundColor: isPaid ? '#ECFDF5' : '#FEF3C7',
              color: isPaid ? '#047857' : '#B45309'
            }}
          >
            {isPaid ? (isDeposit ? 'Đã cọc giữ chỗ' : 'Đã thanh toán đủ') : 'Chờ thanh toán'}
          </span>
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="lume-schedule-card-footer">
        {/* 1. View Details (Always available) */}
        <button
          type="button"
          className="lume-schedule-action-btn secondary"
          onClick={() => onViewDetails(booking)}
        >
          <Eye size={14} />
          <span>Xem chi tiết</span>
        </button>

        {/* 2. Download / View Delivered Photos */}
        {(hasPhotos || hasDrive) && (
          <button
            type="button"
            className="lume-schedule-action-btn blue"
            onClick={() => onViewDetails(booking)}
          >
            <Download size={14} />
            <span>Mở kho ảnh kết quả</span>
          </button>
        )}

        {/* 3. Reschedule Slot (UC-E06) */}
        {(booking.status === 'CONFIRMED' || booking.status === 'DEPOSIT_PAID') && (
          <button
            type="button"
            className="lume-schedule-action-btn blue"
            onClick={() => onOpenReschedule(item)}
          >
            <CalendarCheck size={14} />
            <span>Đổi lịch hẹn</span>
          </button>
        )}

        {/* 4. Location Change for Photoshoots */}
        {isPhoto && booking.status === 'CONFIRMED' && booking.schedules?.length > 0 && onOpenLocationChange && (
          <button
            type="button"
            className="lume-schedule-action-btn secondary"
            onClick={() => onOpenLocationChange(booking.schedules[0])}
          >
            <MapPin size={14} />
            <span>Đổi địa điểm</span>
          </button>
        )}

        {/* 5. Continue PayOS Payment */}
        {booking.status === 'PENDING_PAYMENT' && (
          <button
            type="button"
            className="lume-schedule-action-btn primary"
            onClick={() => onContinuePayment(booking._id)}
          >
            <CreditCard size={14} />
            <span>Tiếp tục thanh toán</span>
          </button>
        )}

        {/* 6. Review Service */}
        {booking.status === 'COMPLETED' && (
          <button
            type="button"
            className="lume-schedule-action-btn primary"
            onClick={() => onOpenReview(item)}
          >
            <Star size={14} />
            <span>Đánh giá dịch vụ</span>
          </button>
        )}

        {/* 7. Cancel Booking */}
        {!['COMPLETED', 'CANCELLED', 'RETURNED'].includes(booking.status) && (
          <button
            type="button"
            className="lume-schedule-action-btn danger"
            onClick={() => onOpenCancel(booking)}
          >
            <XCircle size={14} />
            <span>Hủy lịch</span>
          </button>
        )}
      </div>
    </div>
  );
};
