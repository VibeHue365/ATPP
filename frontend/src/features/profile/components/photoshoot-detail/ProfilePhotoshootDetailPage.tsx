import React, { useState } from 'react';
import { PhotoshootDetailHeader } from './PhotoshootDetailHeader';
import { PhotoshootMainCard } from './PhotoshootMainCard';
import { PhotoshootInfoColumns } from './PhotoshootInfoColumns';
import { PhotoshootDeliveredGallery } from './PhotoshootDeliveredGallery';
import { PhotoshootBottomActionBar } from './PhotoshootBottomActionBar';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';
import Swal from 'sweetalert2';

interface ProfilePhotoshootDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenReschedule?: (item: any) => void;
  onOpenLocationChange?: (sched: any) => void;
  onOpenCancel?: (booking: any) => void;
  onOpenReview?: (item: any) => void;
  onRefreshBooking?: () => Promise<void>;
}

export const ProfilePhotoshootDetailPage: React.FC<ProfilePhotoshootDetailPageProps> = ({
  booking,
  onBack,
  onOpenReschedule,
  onOpenLocationChange,
  onOpenCancel,
  onOpenReview,
  onRefreshBooking
}) => {
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);

  const item = booking?.items?.[0] || {};
  const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
  const provider =
    (booking?.providerIds && booking.providerIds[0] && typeof booking.providerIds[0] === 'object' ? booking.providerIds[0] : null) ||
    (item.providerId && typeof item.providerId === 'object' ? item.providerId : null) ||
    {};

  const title = pkgObj?.name || item.packageSnapshot?.name || item.name || 'Gói Chụp Ảnh Nghệ Thuật';
  const image = pkgObj?.coverImage || pkgObj?.images?.[0] || item.coverImage || item.images?.[0] || item.image;
  const code = booking?.bookingCode || (booking?._id ? 'PS-' + booking._id.slice(-4) : 'PS-LUME');
  const photographerName = provider?.businessName || provider?.fullName || pkgObj?.photographerName || 'Nhiếp ảnh gia LUMÉ';
  const photographerPhone = provider?.phone || provider?.businessPhone || '1900 9999';

  // Schedule & Time
  const rawDate = item.shootDate || item.startDate || booking?.startDate;
  const shootDateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Chưa cập nhật ngày chụp';
  const timeSlotStr = item.shootTimeSlot || '09:00 - 11:00';
  const locationName = item.shootLocation?.name || item.locationSnapshot?.name || 'Đại Nội Huế';
  const locationAddress = item.shootLocation?.address || item.locationSnapshot?.address || 'Thành phố Huế';
  const concept = item.concept || pkgObj?.concept || 'Áo dài Cổ phong / Hoàng cung';

  // Pricing
  const packagePrice = (item.unitPrice || 0) * (item.quantity || 1) || booking?.pricingSummary?.subTotal || 0;
  const serviceFee = booking?.pricingSummary?.serviceFee || 0;
  const depositFee = item.depositAmount || booking?.pricingSummary?.depositTotal || 0;
  const totalPrice = booking?.pricingSummary?.grandTotal || booking?.totalAmount || 0;
  const isPaid = booking?.status !== 'PENDING_PAYMENT' && booking?.status !== 'WAITING_PAYMENT';

  // Status mapping
  const statusLabels: Record<string, string> = {
    DEPOSIT_PAID: 'CHỜ DUYỆT',
    CONFIRMED: 'SẮP CHỤP',
    IN_PROGRESS: 'ĐANG CHỤP',
    AWAITING_REVIEW: 'CHỜ DUYỆT ẢNH',
    COMPLETED: 'HOÀN TẤT',
    CANCELLED: 'ĐÃ HỦY',
    PENDING_PAYMENT: 'CHỜ CỌC'
  };

  const statusLabel = statusLabels[booking?.status] || booking?.status || 'ĐANG THỰC HIỆN';
  const reschedulePending = item.rescheduleRequest?.status === 'PENDING';

  // Remaining time text
  const calculateRemaining = () => {
    if (!rawDate) return '';
    const diffMs = new Date(rawDate).getTime() - Date.now();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 24) {
      return `Còn ${Math.floor(diffHours / 24)} ngày nữa`;
    } else if (diffHours > 0) {
      return `Còn ${diffHours} giờ nữa`;
    } else if (diffHours < 0 && Math.abs(diffHours) < 24) {
      return 'Đang diễn ra hôm nay';
    }
    return '';
  };

  // Support hotline
  const handleSupport = () => {
    Swal.fire({
      title: 'Trung tâm Hỗ trợ Khách hàng LUMÉ',
      html: `
        <div style="text-align: left; font-size: 14px; color: #4A3F35; line-height: 1.6;">
          <p>Đội ngũ LUMÉ & Studio sẵn sàng đồng hành cùng bạn:</p>
          <div style="background: #FDF2F4; padding: 12px 16px; border-radius: 10px; border: 1px solid #F7D5DA; margin: 12px 0;">
            <p style="margin: 0; font-weight: 700; color: #8B1E2D; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">📸 Nhiếp ảnh gia: <strong>${photographerName}</strong> (${photographerPhone})</p>
          <p style="margin: 4px 0 0 0;">📍 Địa điểm chụp: <strong>${locationName} - ${locationAddress}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8B1E2D'
    });
  };

  // Open Google Maps
  const handleOpenMap = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(locationAddress + ', ' + locationName)}`, '_blank');
  };

  // Rules Modal
  const handleViewRules = () => {
    Swal.fire({
      title: 'Quy định & Chính sách Dịch vụ Chụp ảnh',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <ol style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Thời gian có mặt:</strong> Quý khách vui lòng có mặt trước giờ chụp 15 phút để chuẩn bị trang phục, phụ kiện và trao đổi phong cách cùng nhiếp ảnh gia.</li>
            <li><strong>Đổi lịch & Đổi địa điểm:</strong> Quý khách có thể yêu cầu dời ngày giờ chụp hoặc đổi địa điểm miễn phí trước ít nhất 24 giờ trước buổi chụp.</li>
            <li><strong>Bàn giao ảnh:</strong> Nhiếp ảnh gia sẽ tải lên ảnh gốc trong vòng 24h-48h sau buổi chụp và hoàn thiện ảnh chỉnh sửa theo thỏa thuận.</li>
            <li><strong>Xác nhận kết quả:</strong> Quý khách có 48 giờ để kiểm tra ảnh trong link Google Drive và bấm "Xác nhận hài lòng" hoặc gửi yêu cầu chỉnh sửa thêm.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8B1E2D'
    });
  };

  // Invoice Modal
  const handleViewInvoice = () => {
    Swal.fire({
      title: `Hóa đơn điện tử #${code}`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #4A3F35;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ECE5DB; padding-bottom: 8px; margin-bottom: 8px;">
            <span>Gói chụp:</span>
            <strong>${title}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Nhiếp ảnh gia:</span>
            <span>${photographerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Giá gói dịch vụ:</span>
            <span>${packagePrice.toLocaleString('vi-VN')}đ</span>
          </div>
          {serviceFee > 0 && (
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Phụ phí:</span>
              <span>${serviceFee.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền cọc giữ lịch:</span>
            <span>${depositFee.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8B1E2D;">
            <span>Tổng thanh toán:</span>
            <span>${totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="margin-top: 12px; background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; padding: 6px 12px; border-radius: 6px; color: ${isPaid ? '#047857' : '#B45309'}; font-weight: 700; font-size: 12px; text-align: center;">
            ${isPaid ? '✓ ĐÃ THANH TOÁN QUA VÍ/PAYOS' : '⏳ CHỜ THANH TOÁN CỌC'}
          </div>
        </div>
      `,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#8B1E2D'
    });
  };

  // Confirm Complete (Approve Photos) Handler
  const handleConfirmComplete = async () => {
    const res = await Swal.fire({
      title: 'Xác nhận hài lòng & Nghiệm thu?',
      text: 'Bạn xác nhận đã hài lòng với bộ ảnh từ nhiếp ảnh gia. Sau khi xác nhận, đơn hàng sẽ hoàn thành và bạn có thể để lại đánh giá dịch vụ.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✓ Xác nhận hài lòng',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#047857',
      cancelButtonColor: '#7D736B'
    });

    if (!res.isConfirmed || !booking?._id) return;

    try {
      setIsConfirming(true);
      await httpClient.post(`/bookings/${booking._id}/confirm-complete`, {});
      toast.success('Cảm ơn bạn đã nghiệm thu! Đơn chụp ảnh đã hoàn thành.');
      if (onRefreshBooking) await onRefreshBooking();
      if (onOpenReview) onOpenReview(item);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xác nhận.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Delivered photos array
  const deliveredPhotos: string[] = booking?.deliveredPhotos || item.deliveredPhotos || [];
  const driveUrl: string | undefined = booking?.deliveryDriveUrl || item.deliveryDriveUrl;

  // Find schedule item for location change
  const scheduleItem = booking?.schedules?.[0] || {
    bookingId: booking?._id,
    bookingItemId: item?._id,
    serviceType: 'PHOTOGRAPHY',
    serviceTitle: title,
    date: rawDate,
    timeSlot: timeSlotStr,
    location: item.shootLocation || { name: locationName, address: locationAddress }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        minWidth: 0
      }}
    >
      {/* 1. Header */}
      <PhotoshootDetailHeader
        bookingCode={code}
        onBack={onBack}
        onOpenSupport={handleSupport}
        onOpenReschedule={['CONFIRMED', 'DEPOSIT_PAID'].includes(booking?.status) ? () => onOpenReschedule?.(item) : undefined}
        onOpenLocationChange={['CONFIRMED', 'DEPOSIT_PAID'].includes(booking?.status) ? () => onOpenLocationChange?.(scheduleItem) : undefined}
      />

      {/* 2. Main Card & 5-Step Stepper */}
      <PhotoshootMainCard
        photoshootData={{
          image,
          title,
          code,
          photographerName,
          concept,
          timeSlot: timeSlotStr,
          shootDate: shootDateStr,
          locationName,
          status: booking?.status || 'CONFIRMED',
          statusLabel,
          reschedulePending,
          remainingTimeText: calculateRemaining()
        }}
      />

      {/* 3. Info Columns */}
      <PhotoshootInfoColumns
        shootDate={shootDateStr}
        shootTimeSlot={timeSlotStr}
        locationName={locationName}
        locationAddress={locationAddress}
        photographerName={photographerName}
        photographerPhone={photographerPhone}
        packagePrice={packagePrice}
        serviceFee={serviceFee}
        depositFee={depositFee}
        totalPrice={totalPrice}
        isPaid={isPaid}
        onOpenMap={handleOpenMap}
        onOpenLocationChange={['CONFIRMED', 'DEPOSIT_PAID'].includes(booking?.status) ? () => onOpenLocationChange?.(scheduleItem) : undefined}
        onViewInvoice={handleViewInvoice}
        onViewRules={handleViewRules}
      />

      {/* 4. Delivered Photo Gallery */}
      <PhotoshootDeliveredGallery
        photos={deliveredPhotos}
        driveUrl={driveUrl}
        bookingCode={code}
        status={booking?.status}
        onViewPhoto={(url) => {
          Swal.fire({
            imageUrl: url,
            imageAlt: title,
            showConfirmButton: false,
            showCloseButton: true,
            background: 'transparent'
          });
        }}
        onConfirmComplete={booking?.status === 'AWAITING_REVIEW' ? handleConfirmComplete : undefined}
        onOpenDisputeOrSupport={handleSupport}
        isConfirming={isConfirming}
      />

      {/* 5. Bottom Action Bar */}
      <PhotoshootBottomActionBar
        status={booking?.status}
        onCancel={() => onOpenCancel?.(booking)}
        onReschedule={() => onOpenReschedule?.(item)}
        onLocationChange={() => onOpenLocationChange?.(scheduleItem)}
        onReview={() => onOpenReview?.(item)}
        onSupport={handleSupport}
      />
    </div>
  );
};
