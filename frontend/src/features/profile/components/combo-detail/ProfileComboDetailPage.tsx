import React, { useState } from 'react';
import {
  ArrowLeft,
  Headphones,
  CalendarClock,
  MapPin,
  Sparkles,
  Shirt,
  Camera,
  Check,
  AlertCircle,
  ExternalLink,
  Download,
  CheckCircle2,
  Star,
  XCircle,
  Image as ImageIcon
} from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { downloadPhotosAsZip } from '../../../../utils/downloadUtils';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';
import Swal from 'sweetalert2';

interface ProfileComboDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenReschedule?: (item: any) => void;
  onOpenLocationChange?: (sched: any) => void;
  onOpenCancel?: (booking: any) => void;
  onOpenReview?: (item: any) => void;
  onRefreshBooking?: () => Promise<void>;
}

export const ProfileComboDetailPage: React.FC<ProfileComboDetailPageProps> = ({
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
  const [activeTabSection, setActiveTabSection] = useState<'ALL' | 'AODAI' | 'PHOTOSHOOT'>('ALL');

  const items = booking?.items || [];
  const rentalItem = items.find((i: any) => i.itemType !== 'PHOTOGRAPHY_PACKAGE') || items[0] || {};
  const photoItem = items.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE') || items[1] || {};

  const rentalProd = rentalItem.productId && typeof rentalItem.productId === 'object' ? rentalItem.productId : null;
  const photoPkg = photoItem.photographyPackageId && typeof photoItem.photographyPackageId === 'object' ? photoItem.photographyPackageId : null;

  const rawProviders = booking?.providerIds || [];
  const rentalProvider = (rawProviders[0] && typeof rawProviders[0] === 'object' ? rawProviders[0] : null) || {};
  const photoProvider = (rawProviders[1] && typeof rawProviders[1] === 'object' ? rawProviders[1] : null) || rentalProvider;

  const comboCode = booking?.bookingCode || (booking?._id ? 'CB-' + booking._id.slice(-4) : 'CB-LUME');
  const comboTitle = booking?.packageSnapshot?.name || 'Combo Trọn Gói Áo Dài & Chụp Ảnh Ngoại Cảnh';

  // Dates
  const rentalStart = rentalItem.rentalFrom || rentalItem.startDate || booking?.startDate;
  const rentalEnd = rentalItem.rentalTo || rentalItem.endDate || booking?.endDate;
  const shootDate = photoItem.shootDate || rentalStart;
  const shootTime = photoItem.shootTimeSlot || '09:00 - 11:00';
  const shootLocation = photoItem.shootLocation?.name || photoItem.locationSnapshot?.name || 'Đại Nội Huế';
  const shootAddress = photoItem.shootLocation?.address || photoItem.locationSnapshot?.address || 'Thành phố Huế';

  // Pricing
  const comboDiscount = booking?.pricingSummary?.comboDiscountTotal || 0;
  const depositTotal = booking?.pricingSummary?.depositTotal || 0;
  const grandTotal = booking?.pricingSummary?.grandTotal || booking?.totalAmount || 0;
  const isPaid = booking?.status !== 'PENDING_PAYMENT' && booking?.status !== 'WAITING_PAYMENT';

  // Stepper calculations (6 steps)
  const rawStatus = booking?.status || 'CONFIRMED';
  let activeStep = 2;
  if (['COMPLETED'].includes(rawStatus)) {
    activeStep = 6;
  } else if (['RETURNED'].includes(rawStatus)) {
    activeStep = 5;
  } else if (['AWAITING_REVIEW'].includes(rawStatus)) {
    activeStep = 4;
  } else if (['IN_PROGRESS', 'PICKED_UP'].includes(rawStatus)) {
    activeStep = 3;
  } else if (['CONFIRMED'].includes(rawStatus)) {
    activeStep = 2;
  } else {
    // DEPOSIT_PAID
    activeStep = 1;
  }

  const progressWidth =
    activeStep === 6
      ? '100%'
      : activeStep === 5
      ? '80%'
      : activeStep === 4
      ? '60%'
      : activeStep === 3
      ? '40%'
      : activeStep === 2
      ? '20%'
      : '0%';

  const statusLabels: Record<string, string> = {
    DEPOSIT_PAID: 'CHỜ DUYỆT',
    CONFIRMED: 'ĐÃ XÁC NHẬN',
    IN_PROGRESS: 'ĐANG TRẢI NGHIỆM',
    PICKED_UP: 'ĐANG THUÊ & CHỤP',
    AWAITING_REVIEW: 'CHỜ DUYỆT ẢNH',
    RETURNED: 'ĐÃ TRẢ ÁO',
    COMPLETED: 'HOÀN TẤT',
    CANCELLED: 'ĐÃ HỦY',
    PENDING_PAYMENT: 'CHỜ CỌC'
  };

  const statusLabel = statusLabels[rawStatus] || rawStatus;

  // Support hotline
  const handleSupport = () => {
    Swal.fire({
      title: 'Trung tâm Hỗ trợ Combo LUMÉ',
      html: `
        <div style="text-align: left; font-size: 14px; color: #4A3F35; line-height: 1.6;">
          <p>Đội ngũ LUMÉ & Đối tác đồng hành cùng bạn:</p>
          <div style="background: #FDF2F4; padding: 12px 16px; border-radius: 10px; border: 1px solid #F7D5DA; margin: 12px 0;">
            <p style="margin: 0; font-weight: 700; color: #8B1E2D; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ Combo 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">🏢 Tiệm áo dài: <strong>${rentalProvider?.businessName || 'LUMÉ Huế'}</strong></p>
          <p style="margin: 4px 0 0 0;">📸 Nhiếp ảnh gia: <strong>${photoProvider?.businessName || 'Studio Nhiếp ảnh LUMÉ'}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8B1E2D'
    });
  };

  // Rules Modal
  const handleViewRules = () => {
    Swal.fire({
      title: 'Quy định & Chính sách Trải nghiệm Combo',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <ol style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Nhận áo dài:</strong> Quý khách đến nhận áo dài trước giờ chụp tại cửa hàng để thử vừa vặn size và chuẩn bị phụ kiện.</li>
            <li><strong>Buổi chụp ảnh:</strong> Có mặt tại điểm chụp trước 15 phút. Nhiếp ảnh gia sẽ chuẩn bị góc chụp và hỗ trợ tạo dáng suốt buổi.</li>
            <li><strong>Bàn giao ảnh:</strong> Ảnh gốc được gửi qua Google Drive trong 24h-48h sau buổi chụp. Quý khách có 48h để duyệt ảnh.</li>
            <li><strong>Trả đồ & Hoàn cọc:</strong> Sau khi trả áo dài nguyên vẹn và xác nhận duyệt ảnh, tiền cọc sẽ được hoàn trả đầy đủ ngay lập tức.</li>
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
      title: `Hóa đơn điện tử Combo #${comboCode}`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #4A3F35;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ECE5DB; padding-bottom: 8px; margin-bottom: 8px;">
            <span>Gói combo:</span>
            <strong>${comboTitle}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>1. Thuê trang phục:</span>
            <span>${(rentalItem.unitPrice || 0).toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>2. Gói chụp ảnh:</span>
            <span>${(photoItem.unitPrice || 0).toLocaleString('vi-VN')}đ</span>
          </div>
          {comboDiscount > 0 && (
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #047857; font-weight: 700;">
              <span>Ưu đãi giảm giá Combo:</span>
              <span>-${comboDiscount.toLocaleString('vi-VN')}đ</span>
            </div>
          )}
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền cọc giữ lịch:</span>
            <span>${depositTotal.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8B1E2D;">
            <span>Tổng thanh toán:</span>
            <span>${grandTotal.toLocaleString('vi-VN')}đ</span>
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
      title: 'Xác nhận hài lòng & Duyệt ảnh Combo?',
      text: 'Bạn xác nhận đã hài lòng với bộ ảnh từ nhiếp ảnh gia. Sau khi xác nhận và hoàn trả áo dài, đơn hàng sẽ hoàn tất toàn bộ.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✓ Duyệt ảnh',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#047857',
      cancelButtonColor: '#7D736B'
    });

    if (!res.isConfirmed || !booking?._id) return;

    try {
      setIsConfirming(true);
      await httpClient.post(`/bookings/${booking._id}/confirm-complete`, {});
      toast.success('Đã duyệt ảnh thành công! Cảm ơn bạn đã trải nghiệm dịch vụ.');
      if (onRefreshBooking) await onRefreshBooking();
      if (onOpenReview) onOpenReview(photoItem);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xác nhận.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Delivered photos array
  const deliveredPhotos: string[] = booking?.deliveredPhotos || photoItem.deliveredPhotos || [];
  const driveUrl: string | undefined = booking?.deliveryDriveUrl || photoItem.deliveryDriveUrl;

  const scheduleItem = booking?.schedules?.[0] || {
    bookingId: booking?._id,
    bookingItemId: photoItem?._id,
    serviceType: 'COMBO',
    serviceTitle: comboTitle,
    date: shootDate,
    timeSlot: shootTime,
    location: photoItem.shootLocation || { name: shootLocation, address: shootAddress }
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #ECE5DB',
              color: '#4A3F35',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#8B1E2D" />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#231F20' }}>
                Chi tiết Combo Trọn Gói
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: '#8C827A' }}>
              Mã đơn: <strong style={{ color: '#8B1E2D' }}>{comboCode}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {['CONFIRMED', 'DEPOSIT_PAID'].includes(rawStatus) && (
            <>
              <button
                type="button"
                onClick={() => onOpenLocationChange?.(scheduleItem)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #ECE5DB',
                  color: '#4A3F35',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <MapPin size={14} color="#8B1E2D" />
                <span>Đổi địa điểm</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenReschedule?.(photoItem)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #ECE5DB',
                  color: '#4A3F35',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <CalendarClock size={14} color="#8B1E2D" />
                <span>Đổi lịch combo</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSupport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FDF2F4',
              border: '1px solid #F7D5DA',
              color: '#8B1E2D',
              fontSize: '12.5px',
              fontWeight: 750,
              cursor: 'pointer'
            }}
          >
            <Headphones size={14} />
            <span>Hỗ trợ</span>
          </button>
        </div>
      </div>

      {/* 2. Main Combo Overview Card & 6-Step Stepper */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
      >
        {/* Top: Header & Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: rawStatus === 'COMPLETED' ? '#ECFDF5' : rawStatus === 'AWAITING_REVIEW' ? '#FEF3C7' : '#EFF6FF',
                color: rawStatus === 'COMPLETED' ? '#047857' : rawStatus === 'AWAITING_REVIEW' ? '#B45309' : '#1D4ED8',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                marginBottom: '6px'
              }}
            >
              {statusLabel}
            </span>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
              {comboTitle}
            </h2>
            <div style={{ fontSize: '12.5px', color: '#7D736B' }}>
              Bao gồm: <strong style={{ color: '#8B1E2D' }}>1 Trang phục Áo dài cao cấp</strong> + <strong style={{ color: '#1D4ED8' }}>1 Gói chụp ảnh ngoại cảnh Huế</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTabSection('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: activeTabSection === 'ALL' ? '1px solid #8B1E2D' : '1px solid #ECE5DB',
                backgroundColor: activeTabSection === 'ALL' ? '#8B1E2D' : '#FCFAF8',
                color: activeTabSection === 'ALL' ? '#FFFFFF' : '#4A3F35',
                cursor: 'pointer'
              }}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSection('AODAI')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: activeTabSection === 'AODAI' ? '1px solid #8B1E2D' : '1px solid #ECE5DB',
                backgroundColor: activeTabSection === 'AODAI' ? '#8B1E2D' : '#FCFAF8',
                color: activeTabSection === 'AODAI' ? '#FFFFFF' : '#4A3F35',
                cursor: 'pointer'
              }}
            >
              Áo dài
            </button>
            <button
              type="button"
              onClick={() => setActiveTabSection('PHOTOSHOOT')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: activeTabSection === 'PHOTOSHOOT' ? '1px solid #8B1E2D' : '1px solid #ECE5DB',
                backgroundColor: activeTabSection === 'PHOTOSHOOT' ? '#8B1E2D' : '#FCFAF8',
                color: activeTabSection === 'PHOTOSHOOT' ? '#FFFFFF' : '#4A3F35',
                cursor: 'pointer'
              }}
            >
              Chụp ảnh
            </button>
          </div>
        </div>

        {/* Stepper 6 bước */}
        <div style={{ position: 'relative', margin: '8px 0 4px 0' }}>
          {/* Connector Line */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '20px',
              right: '20px',
              height: '3px',
              backgroundColor: '#EAE5DC',
              zIndex: 1
            }}
          >
            <div
              style={{
                width: progressWidth,
                height: '100%',
                backgroundColor: '#10B981',
                borderRadius: '999px',
                transition: 'width 0.3s'
              }}
            />
          </div>

          {/* Stepper Items */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            {/* Step 1: Chờ duyệt */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 1 ? (activeStep === 1 ? '#B45309' : '#10B981') : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep > 1 ? <Check size={15} /> : '1'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 750, color: activeStep === 1 ? '#B45309' : '#231F20' }}>Chờ duyệt</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep > 1 ? 'Đã duyệt' : 'Chờ xác nhận'}</span>
            </div>

            {/* Step 2: Đã xác nhận */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 2 ? '#10B981' : activeStep === 2 ? '#1D4ED8' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep > 2 ? <Check size={15} /> : '2'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 750, color: activeStep === 2 ? '#1D4ED8' : '#231F20' }}>Đã xác nhận</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep >= 2 ? 'Sẵn sàng' : 'Chờ duyệt'}</span>
            </div>

            {/* Step 3: Nhận áo & Chụp */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 3 ? '#10B981' : activeStep === 3 ? '#1D4ED8' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep > 3 ? <Check size={15} /> : '3'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: activeStep === 3 ? 800 : 700, color: activeStep === 3 ? '#1D4ED8' : '#231F20' }}>Nhận & Chụp</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep > 3 ? 'Đã thực hiện' : 'Đang thuê/chụp'}</span>
            </div>

            {/* Step 4: Duyệt ảnh */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 4 ? '#10B981' : activeStep === 4 ? '#B45309' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep > 4 ? <Check size={15} /> : '4'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: activeStep === 4 ? 800 : 700, color: activeStep === 4 ? '#B45309' : '#231F20' }}>Duyệt ảnh</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep >= 4 ? 'Đã giao ảnh' : 'Chờ trả ảnh'}</span>
            </div>

            {/* Step 5: Trả áo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 5 ? '#10B981' : activeStep === 5 ? '#1D4ED8' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep > 5 ? <Check size={15} /> : '5'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: activeStep === 5 ? 800 : 700, color: activeStep === 5 ? '#1D4ED8' : '#231F20' }}>Trả áo</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep >= 5 ? 'Đã trả áo' : 'Hạn trả áo'}</span>
            </div>

            {/* Step 6: Hoàn tất */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '70px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 6 ? '#10B981' : '#EAE5DC',
                  color: activeStep >= 6 ? '#FFFFFF' : '#8C827A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep >= 6 ? <Check size={15} /> : '6'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: activeStep >= 6 ? 800 : 600, color: activeStep >= 6 ? '#10B981' : '#8C827A' }}>Hoàn tất</span>
              <span style={{ fontSize: '9.5px', color: '#8C827A' }}>{activeStep >= 6 ? 'Nghiệm thu' : 'Chưa xong'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Details Sections (2 Columns for Ao Dai + Photoshoot) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Ao Dai Card */}
        {(activeTabSection === 'ALL' || activeTabSection === 'AODAI') && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EFE9E1',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F3EFE9', paddingBottom: '10px' }}>
              <Shirt size={18} color="#8B1E2D" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
                Phần 1: Trang Phục Áo Dài Thuê
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#F8F5F1', border: '1px solid #ECE5DB', flexShrink: 0 }}>
                <ImageWithFallback
                  src={rentalProd?.images?.[0] || rentalItem.images?.[0] || rentalItem.coverImage || rentalItem.image}
                  alt={rentalItem.name || 'Áo dài'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  fallback={
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                      <Shirt size={24} />
                    </div>
                  }
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#231F20' }}>
                  {rentalProd?.name || rentalItem.name || 'Áo dài Nhật Bình'}
                </h4>
                <span style={{ color: '#7D736B' }}>
                  Size: <strong>{rentalItem.selectedSize || rentalItem.size || 'M'}</strong> • Màu: <strong>{rentalItem.selectedColor || rentalItem.color || 'Đa sắc'}</strong>
                </span>
                <span style={{ color: '#7D736B' }}>
                  Điểm nhận áo: <strong>{rentalProvider?.businessName || 'LUMÉ Huế'}</strong>
                </span>
                <span style={{ color: '#7D736B' }}>
                  Hạn trả đồ: <strong>{rentalEnd ? new Date(rentalEnd).toLocaleDateString('vi-VN') : 'Theo thỏa thuận'}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Photoshoot Card */}
        {(activeTabSection === 'ALL' || activeTabSection === 'PHOTOSHOOT') && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EFE9E1',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F3EFE9', paddingBottom: '10px' }}>
              <Camera size={18} color="#1D4ED8" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
                Phần 2: Gói Chụp Ảnh Ngoại Cảnh
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#F8F5F1', border: '1px solid #ECE5DB', flexShrink: 0 }}>
                <ImageWithFallback
                  src={photoPkg?.coverImage || photoPkg?.images?.[0] || photoItem.images?.[0] || photoItem.coverImage || photoItem.image}
                  alt={photoItem.name || 'Gói chụp ảnh'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  fallback={
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                      <Camera size={24} />
                    </div>
                  }
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#231F20' }}>
                  {photoPkg?.name || photoItem.name || 'Gói Chụp Ảnh Ngoại Cảnh Cố Đô'}
                </h4>
                <span style={{ color: '#7D736B' }}>
                  Nhiếp ảnh gia: <strong>{photoProvider?.businessName || photoProvider?.fullName || 'Nhiếp ảnh gia LUMÉ'}</strong>
                </span>
                <span style={{ color: '#7D736B' }}>
                  Thời gian: <strong>{shootDate ? new Date(shootDate).toLocaleDateString('vi-VN') : 'Theo lịch'} ({shootTime})</strong>
                </span>
                <span style={{ color: '#7D736B' }}>
                  Địa điểm: <strong>{shootLocation}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Delivered Photo Gallery (if photos or drive URL present) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} color="#8B1E2D" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
                Kho ảnh kết quả Combo
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#8C827A' }}>
              {deliveredPhotos.length > 0 || driveUrl
                ? `Đã nhận được ${deliveredPhotos.length} ảnh xem trước và đường dẫn tải ảnh chất lượng cao.`
                : 'Ảnh chụp sau buổi làm việc sẽ được cập nhật tại đây.'}
            </span>
          </div>

          {(deliveredPhotos.length > 0 || driveUrl) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {driveUrl && (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Mở Kho Ảnh Gốc (Google Drive)</span>
                </a>
              )}

              {deliveredPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const zipName = `combo_anh_${comboCode}.zip`;
                    void downloadPhotosAsZip(deliveredPhotos, zipName, toast);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#1E40AF',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>Tải tất cả ({deliveredPhotos.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Awaiting review action banner */}
        {rawStatus === 'AWAITING_REVIEW' && (
          <div
            style={{
              backgroundColor: '#FFFBEB',
              borderRadius: '12px',
              border: '1px solid #FCD34D',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={20} color="#B45309" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '13.5px', fontWeight: 800, color: '#92400E' }}>
                  Xác nhận kết quả buổi chụp Combo
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#78350F' }}>
                  Vui lòng kiểm tra ảnh trong link Google Drive. Nếu hài lòng, bấm <strong>Duyệt ảnh</strong> để nghiệm thu gói chụp.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isConfirming}
              onClick={handleConfirmComplete}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: isConfirming ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={15} />
              <span>{isConfirming ? 'Đang xử lý...' : '✓ Duyệt ảnh Combo'}</span>
            </button>
          </div>
        )}

        {/* Photo Gallery Grid */}
        {deliveredPhotos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
            {deliveredPhotos.map((photoUrl, idx) => (
              <div
                key={idx}
                style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ECE5DB', backgroundColor: '#F8F5F1', cursor: 'pointer' }}
                onClick={() => {
                  Swal.fire({ imageUrl: photoUrl, showConfirmButton: false, showCloseButton: true, background: 'transparent' });
                }}
              >
                <ImageWithFallback
                  src={photoUrl}
                  alt={`Ảnh combo ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  fallback={
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                      <ImageIcon size={24} />
                    </div>
                  }
                />
              </div>
            ))}
          </div>
        ) : !driveUrl ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              backgroundColor: '#FCFAF8',
              borderRadius: '12px',
              border: '1px dashed #E2DACF',
              color: '#8C827A',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Camera size={28} color="#C4B7A6" />
            <span style={{ fontWeight: 700, color: '#4A3F35' }}>Chưa có ảnh bàn giao từ buổi chụp</span>
            <span style={{ fontSize: '11.5px', color: '#8C827A' }}>
              Ảnh chụp combo sẽ được tải lên đây sau khi kết thúc buổi chụp ngoại cảnh.
            </span>
          </div>
        ) : null}
      </div>

      {/* 5. Pricing & Actions */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px 24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#7D736B' }}>Tổng thanh toán Combo:</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#8B1E2D' }}>
              {grandTotal.toLocaleString('vi-VN')}đ
            </div>
          </div>

          <button
            type="button"
            onClick={handleViewInvoice}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #ECE5DB',
              color: '#4A3F35',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Xem hóa đơn
          </button>

          <button
            type="button"
            onClick={handleViewRules}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #ECE5DB',
              color: '#4A3F35',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Quy định Combo
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rawStatus === 'COMPLETED' && onOpenReview && (
            <button
              type="button"
              onClick={() => onOpenReview(photoItem)}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                backgroundColor: '#F59E0B',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Star size={15} />
              <span>Đánh giá Combo</span>
            </button>
          )}

          {['CONFIRMED', 'DEPOSIT_PAID'].includes(rawStatus) && onOpenCancel && (
            <button
              type="button"
              onClick={() => onOpenCancel(booking)}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle size={15} />
              <span>Hủy đơn</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
