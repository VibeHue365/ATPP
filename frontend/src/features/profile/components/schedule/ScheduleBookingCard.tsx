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
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { getBookingStatusMeta } from '../../../../utils/bookingStatus';
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
  const isCombo =
    booking.bookingType === 'COMBO' ||
    (booking.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
      booking.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId));
  const prodItem = booking.items?.find((i: any) => i.itemType === 'PRODUCT' || i.productId);
  const pkgItem = booking.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId);

  const items = booking.items || [];
  const item = (isCombo ? prodItem : null) || items[0] || {};
  const isPhoto = !isCombo && item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const pkgObj = (isCombo ? pkgItem?.photographyPackageId : item.photographyPackageId) && typeof (isCombo ? pkgItem?.photographyPackageId : item.photographyPackageId) === 'object' ? (isCombo ? pkgItem.photographyPackageId : item.photographyPackageId) : null;
  const prodObj = (isCombo ? prodItem?.productId : (!isPhoto && item.productId)) && typeof (isCombo ? prodItem?.productId : item.productId) === 'object' ? (isCombo ? prodItem.productId : item.productId) : null;

  let itemName = '';
  if (isCombo) {
    itemName = booking.comboName || (pkgObj?.name && prodObj?.name ? `${pkgObj.name} • ${prodObj.name}` : null) || booking.name || 'Combo Áo Dài & Chụp Ảnh Nghệ Thuật';
  } else {
    const uniqueNames: string[] = [];
    items.forEach((i: any) => {
      const p = !isPhoto && i.productId && typeof i.productId === 'object' ? i.productId : null;
      const k = isPhoto && i.photographyPackageId && typeof i.photographyPackageId === 'object' ? i.photographyPackageId : null;
      const n = p?.name || k?.name || i.packageSnapshot?.name || i.name || i.productName;
      if (n && !uniqueNames.includes(n)) uniqueNames.push(n);
    });
    const totalQty = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
    if (uniqueNames.length === 1) {
      itemName = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
    } else if (uniqueNames.length > 1) {
      itemName = `${uniqueNames[0]} + ${items.length - 1} sản phẩm khác`;
    } else {
      itemName = prodObj?.name || pkgObj?.name || item.name || (isPhoto ? 'Gói Chụp Ảnh Cổ Phong' : 'Áo Dài Nhật Bình');
    }
  }
  const itemImage = prodObj?.images?.[0] || pkgObj?.coverImage || item.image || item.productImage;
  const providerName =
    booking.providerIds?.[0]?.businessName ||
    booking.providerIds?.[0]?.fullName ||
    item.providerId?.businessName ||
    item.providerId?.fullName ||
    'Đối tác TàGo';

  // Date formatting
  const rawDate = item.shootDate || item.startDate || item.rentalFrom || booking.startDate;
  const dateFormatted = rawDate
    ? new Date(rawDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
  const timeSlot = item.shootTimeSlot || item.timeSlot || booking.schedules?.[0]?.timeSlot || '';
  const location =
    (typeof item.shootLocation === 'string' ? item.shootLocation : item.shootLocation?.name || item.shootLocation?.address) ||
    item.shootLocationSnapshot?.address ||
    booking.schedules?.[0]?.locationAddress ||
    booking.deliveryAddress?.address ||
    'TP. Huế';

  // Status info
  const meta = getBookingStatusMeta(booking.status);
  const currentStatus = {
    label: meta.label.toUpperCase(),
    bg: meta.bg,
    color: meta.color,
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
              <User size={14} color="#8E1B2E" />
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

            {booking.status === 'AWAITING_REVIEW' && (
              <span className="lume-countdown-badge urgent" style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}>
                <Clock size={11} /> ĐÃ CÓ ẢNH • CHỜ BẠN DUYỆT
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
        {['COMPLETED', 'RETURNED'].includes(booking.status) && (
          <button
            type="button"
            className="lume-schedule-action-btn primary"
            onClick={() => onOpenReview({ ...item, bookingId: booking._id, booking })}
          >
            <Star size={14} />
            <span>Đánh giá dịch vụ</span>
          </button>
        )}

        {/* Review & Approve Photos button */}
        {booking.status === 'AWAITING_REVIEW' && (
          <button
            type="button"
            className="lume-schedule-action-btn green"
            style={{
              backgroundColor: '#047857',
              color: '#FFFFFF',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
            }}
            onClick={() => onViewDetails(booking)}
          >
            <CheckCircle2 size={14} />
            <span>Duyệt nhận ảnh</span>
          </button>
        )}

        {/* 7. Cancel Booking */}
        {!['COMPLETED', 'CANCELLED', 'RETURNED', 'AWAITING_REVIEW', 'IN_PROGRESS'].includes(booking.status) && (
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
