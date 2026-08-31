import React from 'react';
import { Check, Camera, Sparkles, MapPin, Clock, Calendar, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

interface PhotoshootMainCardProps {
  photoshootData: {
    image?: string;
    title: string;
    code: string;
    photographerName?: string;
    concept?: string;
    timeSlot?: string;
    shootDate?: string;
    locationName?: string;
    duration?: string;
    participants?: string;
    status: string;
    statusLabel: string;
    reschedulePending?: boolean;
    remainingTimeText?: string;
  };
}

export const PhotoshootMainCard: React.FC<PhotoshootMainCardProps> = ({ photoshootData }) => {
  if (!photoshootData) return null;

  const rawStatus = photoshootData.status;

  // Compute active step (1 to 5)
  let activeStep = 2;
  if (['COMPLETED'].includes(rawStatus)) {
    activeStep = 5;
  } else if (['AWAITING_REVIEW'].includes(rawStatus)) {
    activeStep = 4;
  } else if (['IN_PROGRESS'].includes(rawStatus)) {
    activeStep = 3;
  } else if (['CONFIRMED'].includes(rawStatus)) {
    activeStep = 2;
  } else {
    // DEPOSIT_PAID or PENDING
    activeStep = 1;
  }

  const progressWidth =
    activeStep === 5
      ? '100%'
      : activeStep === 4
      ? '75%'
      : activeStep === 3
      ? '50%'
      : activeStep === 2
      ? '25%'
      : '0%';

  // Dynamic badge color
  const badgeStyle =
    rawStatus === 'COMPLETED'
      ? { bg: '#ECFDF5', color: '#047857' }
      : rawStatus === 'AWAITING_REVIEW'
      ? { bg: '#FEF3C7', color: '#B45309' }
      : rawStatus === 'IN_PROGRESS'
      ? { bg: '#EFF6FF', color: '#1D4ED8' }
      : rawStatus === 'CONFIRMED'
      ? { bg: '#EFF6FF', color: '#1D4ED8' }
      : { bg: '#FFFBEB', color: '#B45309' };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '170px 1fr',
        gap: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        alignItems: 'start'
      }}
    >
      {/* 1. Left Thumbnail Image */}
      <div
        style={{
          width: '170px',
          height: '210px',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#F8F5F1',
          border: '1px solid #ECE5DB',
          flexShrink: 0
        }}
      >
        <ImageWithFallback
          src={photoshootData.image}
          alt={photoshootData.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          fallback={
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
              <Camera size={40} />
            </div>
          }
        />
      </div>

      {/* 2. Right Content & Stepper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        {/* Top Header: Badge + Title + Photographer */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: badgeStyle.bg,
                color: badgeStyle.color,
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.03em'
              }}
            >
              {photoshootData.statusLabel}
            </span>

            {photoshootData.reschedulePending && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                ĐANG CHỜ DUYỆT ĐỔI LỊCH
              </span>
            )}
          </div>

          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
            {photoshootData.title}
          </h2>

          <div style={{ fontSize: '12.5px', color: '#7D736B', fontWeight: 600 }}>
            Mã đơn: <span style={{ color: '#231F20', fontWeight: 700 }}>{photoshootData.code}</span>
            {photoshootData.photographerName && (
              <> • Nhiếp ảnh gia: <span style={{ color: '#8B1E2D', fontWeight: 750 }}>{photoshootData.photographerName}</span></>
            )}
          </div>
        </div>

        {/* 2x2 Attribute Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px 20px',
            backgroundColor: '#FCFAF8',
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #F0ECE4'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Calendar size={14} color="#8B1E2D" />
            <span>Ngày chụp: <strong style={{ color: '#231F20' }}>{photoshootData.shootDate || 'Theo lịch hẹn'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Clock size={14} color="#8B1E2D" />
            <span>Khung giờ: <strong style={{ color: '#231F20' }}>{photoshootData.timeSlot || '09:00 - 11:00'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <MapPin size={14} color="#8B1E2D" />
            <span>Địa điểm: <strong style={{ color: '#231F20' }}>{photoshootData.locationName || 'Đại Nội Huế'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Sparkles size={14} color="#8B1E2D" />
            <span>Concept: <strong style={{ color: '#231F20' }}>{photoshootData.concept || 'Áo dài Cổ phong'}</strong></span>
          </div>
        </div>

        {/* Horizontal 5-Step Stepper */}
        <div style={{ position: 'relative', margin: '4px 0 0 0' }}>
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
            {/* Active Line portion */}
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

          {/* Stepper items */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            {/* Step 1: Đã cọc / Chờ duyệt */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '80px' }}>
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
                  fontWeight: 800,
                  boxShadow: activeStep === 1 ? '0 0 0 3px #FED7AA' : 'none'
                }}
              >
                {activeStep > 1 ? <Check size={16} /> : '1'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 750, color: activeStep === 1 ? '#B45309' : '#231F20' }}>Chờ duyệt</span>
              <span style={{ fontSize: '10px', color: '#8C827A' }}>{activeStep > 1 ? 'Đã duyệt' : 'Chờ thợ nhận'}</span>
            </div>

            {/* Step 2: Đã xác nhận */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '80px' }}>
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
                  fontWeight: 800,
                  boxShadow: activeStep === 2 ? '0 0 0 3px #BFDBFE' : 'none'
                }}
              >
                {activeStep > 2 ? <Check size={16} /> : '2'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 750, color: activeStep === 2 ? '#1D4ED8' : '#231F20' }}>Đã xác nhận</span>
              <span style={{ fontSize: '10px', color: '#8C827A' }}>{activeStep >= 2 ? 'Sẵn sàng chụp' : 'Chờ xác nhận'}</span>
            </div>

            {/* Step 3: Đang chụp / Hậu kỳ */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '80px' }}>
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
                  fontWeight: 800,
                  boxShadow: activeStep === 3 ? '0 0 0 3px #BFDBFE' : 'none'
                }}
              >
                {activeStep > 3 ? <Check size={16} /> : '3'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: activeStep === 3 ? 800 : 700, color: activeStep === 3 ? '#1D4ED8' : '#231F20' }}>Đang chụp</span>
              <span style={{ fontSize: '10px', color: '#8C827A' }}>{activeStep > 3 ? 'Đã chụp xong' : 'Thực hiện/Xử lý'}</span>
            </div>

            {/* Step 4: Duyệt ảnh */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '80px' }}>
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
                  fontWeight: 800,
                  boxShadow: activeStep === 4 ? '0 0 0 3px #FED7AA' : 'none'
                }}
              >
                {activeStep > 4 ? <Check size={16} /> : '4'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: activeStep === 4 ? 800 : 600, color: activeStep === 4 ? '#B45309' : '#231F20' }}>Duyệt ảnh</span>
              <span style={{ fontSize: '10px', color: '#8C827A' }}>{activeStep >= 4 ? 'Đã giao ảnh' : 'Chờ trả ảnh'}</span>
            </div>

            {/* Step 5: Hoàn tất */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', maxWidth: '80px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 5 ? '#10B981' : '#EAE5DC',
                  color: activeStep >= 5 ? '#FFFFFF' : '#8C827A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep >= 5 ? <Check size={16} /> : '5'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: activeStep >= 5 ? 750 : 600, color: activeStep >= 5 ? '#10B981' : '#8C827A' }}>Hoàn tất</span>
              <span style={{ fontSize: '10px', color: '#8C827A' }}>{activeStep >= 5 ? 'Đã nghiệm thu' : 'Chưa xong'}</span>
            </div>
          </div>
        </div>

        {/* Status Alert Banner */}
        <div
          style={{
            backgroundColor: rawStatus === 'AWAITING_REVIEW' ? '#FFFBEB' : '#EFF6FF',
            borderRadius: '10px',
            border: rawStatus === 'AWAITING_REVIEW' ? '1px solid #FED7AA' : '1px solid #BFDBFE',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color={rawStatus === 'AWAITING_REVIEW' ? '#B45309' : '#1D4ED8'} />
            <span style={{ fontSize: '12.5px', color: rawStatus === 'AWAITING_REVIEW' ? '#92400E' : '#1E40AF', fontWeight: 600 }}>
              {rawStatus === 'DEPOSIT_PAID' && 'Đơn hàng đã đặt cọc thành công. Nhiếp ảnh gia sẽ liên hệ xác nhận lịch trong ít phút.'}
              {rawStatus === 'CONFIRMED' && (photoshootData.remainingTimeText ? `Lịch chụp đã được xác nhận. ${photoshootData.remainingTimeText}.` : 'Lịch chụp đã được xác nhận. Hãy chuẩn bị sẵn sàng cho buổi chụp nhé!')}
              {rawStatus === 'IN_PROGRESS' && 'Buổi chụp ảnh đang diễn ra hoặc thợ đang trong quy trình hậu kỳ & chỉnh sửa ảnh.'}
              {rawStatus === 'AWAITING_REVIEW' && 'Nhiếp ảnh gia đã tải lên kho ảnh kết quả. Bạn có 48 giờ để kiểm tra và duyệt ảnh.'}
              {rawStatus === 'COMPLETED' && 'Đơn chụp ảnh đã hoàn tất trọn vẹn. Cảm ơn bạn đã lựa chọn LUMÉ!'}
              {rawStatus === 'CANCELLED' && 'Đơn chụp ảnh này đã bị hủy.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
