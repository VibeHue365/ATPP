import React, { useState } from 'react';
import { X, AlertTriangle, Upload } from 'lucide-react';
import { PhotoshootDetailHeader } from './PhotoshootDetailHeader';
import { PhotoshootMainCard } from './PhotoshootMainCard';
import { PhotoshootInfoColumns } from './PhotoshootInfoColumns';
import { PhotoshootDeliveredGallery } from './PhotoshootDeliveredGallery';
import { PhotoshootBottomActionBar } from './PhotoshootBottomActionBar';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';
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
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Chất lượng ảnh không đạt yêu cầu');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [disputePhotos, setDisputePhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

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

  // Parse shoot location robustly
  const rawLocation =
    typeof item.shootLocation === 'string'
      ? item.shootLocation
      : item.shootLocation?.name ||
        item.shootLocation?.address ||
        item.shootLocationSnapshot?.address ||
        item.locationSnapshot?.name ||
        item.locationSnapshot?.address ||
        booking?.schedules?.[0]?.locationAddress ||
        booking?.schedules?.[0]?.locationSnapshot?.address ||
        '';

  let locationName = 'Đại Nội Huế';
  let locationAddress = 'Thành phố Huế';

  if (rawLocation && rawLocation.trim()) {
    const trimmed = rawLocation.trim();
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map((p: string) => p.trim()).filter(Boolean);
      locationName = parts[0] || 'Địa điểm chụp';
      locationAddress = parts.slice(1).join(', ') || trimmed;
    } else {
      locationName = trimmed;
      locationAddress = trimmed;
    }
  } else if (item.shootLocation && typeof item.shootLocation === 'object') {
    locationName = item.shootLocation.name || item.shootLocation.address || 'Đại Nội Huế';
    locationAddress = item.shootLocation.address || item.shootLocation.name || 'Thành phố Huế';
  }

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
    PENDING_PAYMENT: 'CHỜ CỌC',
    DISPUTED: 'TRANH CHẤP',
    REFUNDED: 'ĐÃ HOÀN TIỀN',
    PARTIALLY_REFUNDED: 'HOÀN TIỀN MỘT PHẦN'
  };

  const statusLabel = statusLabels[booking?.status] || booking?.status || 'ĐANG THỰC HIỆN';
  const reschedulePending = item.rescheduleRequest?.status === 'PENDING';

  const handleOpenDispute = () => {
    setIsDisputeModalOpen(true);
  };

  const handleDisputePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingPhoto(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`Ảnh "${file.name}" vượt quá dung lượng tối đa 5MB`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        const res: any = await httpClient.post('/api/bookings/upload-reference', formData);
        if (res?.url) {
          uploadedUrls.push(res.url);
        }
      }
      if (uploadedUrls.length > 0) {
        setDisputePhotos(prev => [...prev, ...uploadedUrls]);
        toast.success(`Đã tải lên ${uploadedUrls.length} ảnh bằng chứng thành công!`);
      }
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err?.message || 'Có lỗi xảy ra khi tải ảnh'));
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeNotes.trim()) {
      toast.error('Vui lòng nhập mô tả chi tiết lý do khiếu nại!');
      return;
    }
    setIsSubmittingDispute(true);
    try {
      const combinedNote = `[${disputeReason}] ${disputeNotes.trim()}`;
      await httpClient.patch(`/api/bookings/${booking._id}/status`, {
        status: 'DISPUTED',
        note: combinedNote,
        evidencePhotos: disputePhotos,
      });
      toast.success('Gửi khiếu nại thành công! LUMÉ sẽ liên hệ và giải quyết thỏa đáng.');
      setIsDisputeModalOpen(false);
      setDisputeNotes('');
      setDisputePhotos([]);
      if (onRefreshBooking) {
        await onRefreshBooking();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Gửi khiếu nại thất bại');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

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
            <p style="margin: 0; font-weight: 700; color: #8E1B2E; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">📸 Nhiếp ảnh gia: <strong>${photographerName}</strong> (${photographerPhone})</p>
          <p style="margin: 4px 0 0 0;">📍 Địa điểm chụp: <strong>${locationName} - ${locationAddress}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8E1B2E'
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
      confirmButtonColor: '#8E1B2E'
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
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8E1B2E;">
            <span>Tổng thanh toán:</span>
            <span>${totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="margin-top: 12px; background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; padding: 6px 12px; border-radius: 6px; color: ${isPaid ? '#047857' : '#B45309'}; font-weight: 700; font-size: 12px; text-align: center;">
            ${isPaid ? '✓ ĐÃ THANH TOÁN QUA VÍ/PAYOS' : '⏳ CHỜ THANH TOÁN CỌC'}
          </div>
        </div>
      `,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#8E1B2E'
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
      if (onOpenReview) onOpenReview({ ...item, bookingId: booking._id, booking });
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
          remainingTimeText: calculateRemaining(),
          disputeResult: booking?.disputeResult
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
        onOpenDisputeOrSupport={handleOpenDispute}
        isConfirming={isConfirming}
      />

      {/* 5. Bottom Action Bar */}
      <PhotoshootBottomActionBar
        status={booking?.status}
        onCancel={() => onOpenCancel?.(booking)}
        onReschedule={() => onOpenReschedule?.(item)}
        onLocationChange={() => onOpenLocationChange?.(scheduleItem)}
        onReview={() => onOpenReview?.({ ...item, bookingId: booking._id, booking })}
        onSupport={handleSupport}
        onOpenDispute={handleOpenDispute}
        onConfirmComplete={booking?.status === 'AWAITING_REVIEW' ? handleConfirmComplete : undefined}
        isConfirming={isConfirming}
      />

      {/* 6. Customer Dispute Modal */}
      {isDisputeModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setIsDisputeModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#DC2626" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>Khiếu nại dịch vụ chụp ảnh</h3>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Đơn hàng #{code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDisputeModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Lý do khiếu nại *
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '13px',
                    color: '#1F2937',
                    backgroundColor: '#FFFFFF',
                    outline: 'none'
                  }}
                >
                  <option value="Chất lượng ảnh không đạt yêu cầu">Chất lượng ảnh không đạt yêu cầu</option>
                  <option value="Thợ ảnh không đến / vắng mặt">Thợ ảnh không đến / vắng mặt</option>
                  <option value="Thợ ảnh trễ giờ hẹn nghiêm trọng">Thợ ảnh trễ giờ hẹn nghiêm trọng</option>
                  <option value="Chưa nhận được đủ ảnh theo thỏa thuận">Chưa nhận được đủ ảnh theo thỏa thuận</option>
                  <option value="Thái độ phục vụ không phù hợp">Thái độ phục vụ không phù hợp</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Mô tả chi tiết sự cố *
                </label>
                <textarea
                  rows={4}
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  placeholder="Vui lòng nêu rõ vấn đề bạn gặp phải để LUMÉ và Studio hỗ trợ giải quyết nhanh chóng..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '13px',
                    color: '#1F2937',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ảnh bằng chứng (tùy chọn)
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px dashed #9CA3AF',
                    backgroundColor: '#F9FAFB',
                    cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
                    fontSize: '12.5px',
                    color: '#4B5563',
                    fontWeight: 600
                  }}
                >
                  <Upload size={14} />
                  <span>{isUploadingPhoto ? 'Đang tải ảnh...' : 'Tải ảnh bằng chứng'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleDisputePhotoUpload}
                    disabled={isUploadingPhoto}
                    style={{ display: 'none' }}
                  />
                </label>

                {disputePhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {disputePhotos.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                        <img
                          src={getMediaUrl(url) || url}
                          alt="Bằng chứng"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E5E7EB' }}
                        />
                        <button
                          type="button"
                          onClick={() => setDisputePhotos(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#EF4444',
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSubmittingDispute ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  {isSubmittingDispute ? 'Đang gửi...' : 'Gửi khiếu nại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
