import React from 'react';
import {
  Check,
  Sparkles,
  Shirt,
  Palette,
  Gem,
  ShieldCheck,
  AlertTriangle,
  CheckSquare,
  XCircle,
  Info,
  Image as ImageIcon
} from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';
import { getMediaUrl } from '../../../../shared/media/mediaUrl';
import { RentalEvidenceImage } from '../../../rentals/components/RentalEvidenceImage';

export interface RentalItemDetail {
  id?: string;
  title: string;
  image?: string;
  size?: string;
  color?: string;
  material?: string;
  brand?: string;
  accessories?: string;
  price?: number;
  quantity?: number;
}

interface RentalMainCardProps {
  rentalData: {
    image?: string;
    title: string;
    code: string;
    size?: string;
    brand?: string;
    color?: string;
    material?: string;
    accessories?: string;
    status: string;
    statusLabel: string;
    readyTime: string;
    pickupTime: string;
    dueTime: string;
    remainingTime: string;
    currentStepIndex?: number;
    items?: RentalItemDetail[];
  };
  pickupInspection?: {
    handoverPhotos?: any[];
    bookingId?: string;
    itemId?: string;
    isSubmitting?: boolean;
    onConfirm?: () => void;
    onReportDamage?: () => void;
    onReject?: () => void;
    onViewPhoto?: (url: string) => void;
  };
}

export const RentalMainCard: React.FC<RentalMainCardProps> = ({
  rentalData,
  pickupInspection
}) => {
  if (!rentalData) return null;

  // Compute step active/completed states
  const rawStatus = rentalData.status;
  let activeStep = rentalData.currentStepIndex || 1;
  if (['RETURNED', 'COMPLETED', 'COMBO_PHOTOS_APPROVED'].includes(rawStatus)) {
    activeStep = 4;
  } else if (['PICKED_UP', 'RENTING', 'IN_PROGRESS', 'RETURN_PENDING'].includes(rawStatus)) {
    activeStep = 3;
  } else if (['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(rawStatus)) {
    activeStep = 2;
  } else {
    activeStep = 1;
  }

  const progressWidth =
    activeStep === 4 ? '100%' : activeStep === 3 ? '66%' : activeStep === 2 ? '33%' : '0%';

  const hasMultipleItems = Boolean(rentalData.items && rentalData.items.length > 1);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        padding: '24px',
        display: hasMultipleItems ? 'flex' : 'grid',
        flexDirection: hasMultipleItems ? 'column' : undefined,
        gridTemplateColumns: hasMultipleItems ? undefined : '170px 1fr',
        gap: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        alignItems: 'start'
      }}
    >
      {/* CASE 1: ĐƠN CÓ NHIỀU ÁO DÀI (MULTI-ITEM LIST - PHƯƠNG ÁN 1A) */}
      {hasMultipleItems ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          {/* Top Header: Badge + Title + Code */}
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor:
                  rawStatus === 'DISPUTED' || rentalData.statusLabel === 'TRANH CHẤP'
                    ? '#FEE2E2'
                    : rentalData.statusLabel === 'CHỜ DUYỆT SỰ CỐ'
                    ? '#FFF1F2'
                    : ['RETURNED', 'COMPLETED', 'COMBO_PHOTOS_APPROVED'].includes(rawStatus)
                    ? '#ECFDF5'
                    : '#FFEDD5',
                color:
                  rawStatus === 'DISPUTED' || rentalData.statusLabel === 'TRANH CHẤP'
                    ? '#991B1B'
                    : rentalData.statusLabel === 'CHỜ DUYỆT SỰ CỐ'
                    ? '#E11D48'
                    : ['RETURNED', 'COMPLETED', 'COMBO_PHOTOS_APPROVED'].includes(rawStatus)
                    ? '#047857'
                    : '#C2410C',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                marginBottom: '6px'
              }}
            >
              {rentalData.statusLabel}
            </span>

            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
              Danh sách trang phục thuê ({rentalData.items?.length} áo dài)
            </h2>

            <div style={{ fontSize: '12.5px', color: '#7D736B', fontWeight: 600 }}>
              Mã thuê: <span style={{ color: '#231F20', fontWeight: 700 }}>{rentalData.code}</span>
            </div>
          </div>

          {/* Grid danh sách từng áo dài chi tiết */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '14px',
              width: '100%'
            }}
          >
            {rentalData.items?.map((it, idx) => (
              <div
                key={it.id || idx}
                style={{
                  backgroundColor: '#FCFAF8',
                  borderRadius: '12px',
                  border: '1px solid #ECE5DB',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center'
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: '90px',
                    height: '118px',
                    minWidth: '90px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#F8F5F1',
                    border: '1px solid #E5DCD0'
                  }}
                >
                  <ImageWithFallback
                    src={it.image}
                    alt={it.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    fallback={
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                        <Shirt size={28} />
                      </div>
                    }
                  />
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
                      {it.title}
                    </h4>
                    {it.price !== undefined && (
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#8E1B2E', whiteSpace: 'nowrap' }}>
                        {it.price.toLocaleString('vi-VN')}đ{it.quantity && it.quantity > 1 ? ` x${it.quantity}` : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11.5px', marginTop: '2px' }}>
                    <span style={{ backgroundColor: '#F3EFE9', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, color: '#4A3F35' }}>
                      Size {it.size || 'M'}
                    </span>
                    <span style={{ backgroundColor: '#F3EFE9', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, color: '#4A3F35' }}>
                      Màu {it.color || 'Đa sắc'}
                    </span>
                    {it.material && (
                      <span style={{ backgroundColor: '#F3EFE9', padding: '2px 7px', borderRadius: '4px', color: '#6A5F55' }}>
                        {it.material}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '11.5px', color: '#7D736B', marginTop: '2px' }}>
                    <span>Thương hiệu: <strong style={{ color: '#231F20' }}>{it.brand || 'TàGo Premium'}</strong></span>
                    {it.accessories && (
                      <span style={{ marginLeft: '10px' }}>Phụ kiện: <strong style={{ color: '#231F20' }}>{it.accessories}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* CASE 2: ĐƠN CÓ 1 ÁO DÀI (BỐ CỤC MẶC ĐỊNH) */
        <>
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
              src={rentalData.image}
              alt={rentalData.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              fallback={
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                  <Shirt size={40} />
                </div>
              }
            />
          </div>

          {/* 2. Right Content Header & Attributes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor:
                    rawStatus === 'DISPUTED' || rentalData.statusLabel === 'TRANH CHẤP'
                      ? '#FEE2E2'
                      : rentalData.statusLabel === 'CHỜ DUYỆT SỰ CỐ'
                      ? '#FFF1F2'
                      : ['RETURNED', 'COMPLETED', 'COMBO_PHOTOS_APPROVED'].includes(rawStatus)
                      ? '#ECFDF5'
                      : '#FFEDD5',
                  color:
                    rawStatus === 'DISPUTED' || rentalData.statusLabel === 'TRANH CHẤP'
                      ? '#991B1B'
                      : rentalData.statusLabel === 'CHỜ DUYỆT SỰ CỐ'
                      ? '#E11D48'
                      : ['RETURNED', 'COMPLETED', 'COMBO_PHOTOS_APPROVED'].includes(rawStatus)
                      ? '#047857'
                      : '#C2410C',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  marginBottom: '6px'
                }}
              >
                {rentalData.statusLabel}
              </span>

              <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#231F20' }}>
                {rentalData.title}
              </h2>

              <div style={{ fontSize: '12.5px', color: '#7D736B', fontWeight: 600 }}>
                Mã thuê: <span style={{ color: '#231F20', fontWeight: 700 }}>{rentalData.code}</span>
                {rentalData.size && (
                  <> • Size <span style={{ color: '#231F20', fontWeight: 700 }}>{rentalData.size}</span></>
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
                <Sparkles size={14} color="#8E1B2E" />
                <span>Thương hiệu: <strong style={{ color: '#231F20' }}>{rentalData.brand || 'TàGo Premium'}</strong></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
                <Palette size={14} color="#8E1B2E" />
                <span>Màu sắc: <strong style={{ color: '#231F20' }}>{rentalData.color || 'Đa sắc'}</strong></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
                <Shirt size={14} color="#8E1B2E" />
                <span>Chất liệu: <strong style={{ color: '#231F20' }}>{rentalData.material || 'Lụa cao cấp'}</strong></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
                <Gem size={14} color="#8E1B2E" />
                <span>Phụ kiện đi kèm: <strong style={{ color: '#231F20' }}>{rentalData.accessories || 'Mấn đội đầu'}</strong></span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CHUNG: PHẦN TIẾN TRÌNH STEPPER & HẠN TRẢ ĐỒ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', gridColumn: hasMultipleItems ? undefined : '2 / 3' }}>

        {/* Horizontal 4-Step Stepper */}
        <div style={{ position: 'relative', margin: '4px 0 0 0' }}>
          {/* Connector Line */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '30px',
              right: '30px',
              height: '3px',
              backgroundColor: '#EAE5DC',
              zIndex: 1
            }}
          >
            {/* Active Green Line portion */}
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
            {/* Step 1: Chuẩn bị / Sẵn sàng */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 1 ? '#10B981' : activeStep === 1 ? '#EA580C' : '#EAE5DC',
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
              <span style={{ fontSize: '12px', fontWeight: 750, color: activeStep === 1 ? '#EA580C' : '#231F20' }}>
                {activeStep > 1 ? 'Đã chuẩn bị' : 'Chuẩn bị'}
              </span>
              <span style={{ fontSize: '10.5px', color: activeStep === 1 ? '#EA580C' : '#8C827A' }}>
                {rentalData.readyTime || (activeStep === 1 ? 'Đang chuẩn bị' : 'Sẵn sàng')}
              </span>
            </div>

            {/* Step 2: Chờ nhận / Đã nhận */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 2 ? '#10B981' : activeStep === 2 ? '#EA580C' : '#EAE5DC',
                  color: activeStep >= 2 ? '#FFFFFF' : '#8C827A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  boxShadow: activeStep === 2 ? '0 0 0 3px #FED7AA' : 'none'
                }}
              >
                {activeStep > 2 ? <Check size={16} /> : '2'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 750, color: activeStep === 2 ? '#EA580C' : activeStep > 2 ? '#231F20' : '#8C827A' }}>
                {activeStep > 2 ? 'Đã nhận' : 'Chờ nhận'}
              </span>
              <span style={{ fontSize: '10.5px', color: activeStep === 2 ? '#EA580C' : '#8C827A' }}>
                {activeStep >= 2 ? (rentalData.pickupTime || 'Tại cửa hàng') : 'Chờ nhận áo'}
              </span>
            </div>

            {/* Step 3: Đang thuê (Active) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 3 ? '#10B981' : activeStep === 3 ? '#EA580C' : '#EAE5DC',
                  color: activeStep >= 3 ? '#FFFFFF' : '#8C827A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  boxShadow: activeStep === 3 ? '0 0 0 3px #FED7AA' : 'none'
                }}
              >
                {activeStep > 3 ? <Check size={16} /> : '3'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: activeStep === 3 ? '#EA580C' : activeStep > 3 ? '#231F20' : '#8C827A' }}>Đang thuê</span>
              <span style={{ fontSize: '10.5px', color: activeStep === 3 ? '#EA580C' : '#8C827A', fontWeight: activeStep === 3 ? 600 : 400 }}>Thời gian thuê</span>
            </div>

            {/* Step 4: Trả áo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 4 ? '#10B981' : '#EAE5DC',
                  color: activeStep >= 4 ? '#FFFFFF' : '#8C827A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  boxShadow: activeStep === 4 ? '0 0 0 3px #A7F3D0' : 'none'
                }}
              >
                {activeStep >= 4 ? <Check size={16} /> : '4'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: activeStep >= 4 ? 750 : 600, color: activeStep >= 4 ? '#10B981' : '#8C827A' }}>Trả áo</span>
              <span style={{ fontSize: '10.5px', color: '#8C827A' }}>{activeStep >= 4 ? 'Đã hoàn tất' : 'Chưa hoàn thành'}</span>
            </div>
          </div>
        </div>

        {/* Due Date Alert Banner */}
        <div
          style={{
            backgroundColor: '#FFF7EE',
            border: '1px solid #FED7AA',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: '#9A3412', fontWeight: 600, display: 'block' }}>Hạn trả</span>
            <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#231F20' }}>
              {rentalData.dueTime}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#C2410C', fontWeight: 700, display: 'block' }}>Còn lại</span>
            <span style={{ fontSize: '17px', fontWeight: 900, color: '#EA580C' }}>
              {rentalData.remainingTime}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Phần nổi lên về kiểm tra và bàn giao trang phục ở phần tổng quan */}
      {pickupInspection && (
        <div
          style={{
            gridColumn: '1 / -1',
            marginTop: '8px',
            backgroundColor: '#FFFDF9',
            borderRadius: '14px',
            border: '1.5px solid #FCD34D',
            boxShadow: '0 4px 18px rgba(217, 119, 6, 0.1)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#92400E' }}>
                  Kiểm tra áo khi nhận
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#B45309' }}>
                  Bắt buộc đối soát hiện trạng trang phục trước khi nhận đồ tại cửa hàng
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                color: '#991B1B',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 750
              }}
            >
              Chờ bạn đối soát
            </div>
          </div>

          {/* Instruction */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #FDE68A',
              borderLeft: '4px solid #D97706',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <Info size={16} color="#D97706" style={{ marginTop: '2px', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '12.5px', color: '#78350F', lineHeight: 1.5, fontWeight: 500 }}>
              Vui lòng so sánh ảnh shop cung cấp với tình trạng thực tế của áo và phụ kiện. Nếu phát hiện vết bẩn, rách, thiếu phụ kiện hoặc sai sản phẩm, hãy báo cáo trước khi xác nhận nhận áo.
            </p>
          </div>

          {/* Shop Handover Photos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 750, color: '#231F20' }}>
              Ảnh bàn giao từ Shop {Array.isArray(pickupInspection.handoverPhotos) && pickupInspection.handoverPhotos.length > 0 ? `(${pickupInspection.handoverPhotos.length} ảnh):` : ''}
            </span>

            {!Array.isArray(pickupInspection.handoverPhotos) || pickupInspection.handoverPhotos.length === 0 ? (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px dashed #D1D5DB',
                  color: '#6B7280',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ImageIcon size={16} color="#9CA3AF" />
                <span>Shop chưa cung cấp ảnh bàn giao. Bạn nên tự chụp ảnh hiện trạng trước khi nhận.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {pickupInspection.handoverPhotos.map((photo: any, index: number) => {
                  const rawUrl = typeof photo === 'string' ? photo : (photo as any)?.url || '';
                  const fileId = typeof photo === 'object' ? (photo as any)?.fileId : undefined;
                  const resolvedUrl = getMediaUrl(rawUrl) || rawUrl;
                  return (
                    <div
                      key={index}
                      onClick={() => pickupInspection.onViewPhoto?.(resolvedUrl)}
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1.5px solid #FCD34D',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        position: 'relative',
                        backgroundColor: '#F8F5F1'
                      }}
                      title="Bấm để xem ảnh lớn"
                    >
                      {fileId && pickupInspection.bookingId && pickupInspection.itemId ? (
                        <RentalEvidenceImage
                          bookingId={pickupInspection.bookingId}
                          itemId={pickupInspection.itemId}
                          fileId={fileId}
                          alt={`Ảnh shop bàn giao #${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <ImageWithFallback
                          src={resolvedUrl}
                          alt={`Ảnh shop bàn giao #${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          fallback={
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ImageIcon size={20} color="#8C827A" />
                            </div>
                          }
                        />
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#FFFFFF',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          textAlign: 'center',
                          padding: '2px 0'
                        }}
                      >
                        Ảnh #{index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3 Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #F3EDE4',
              flexWrap: 'wrap'
            }}
          >
            {/* Action A: Xác nhận nhận */}
            <button
              type="button"
              onClick={pickupInspection.onConfirm}
              disabled={pickupInspection.isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 750,
                cursor: pickupInspection.isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#047857';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#059669';
              }}
            >
              <CheckSquare size={14} />
              <span>Áo đúng tình trạng – Xác nhận nhận</span>
            </button>

            {/* Action B: Báo có vấn đề */}
            <button
              type="button"
              onClick={pickupInspection.onReportDamage}
              disabled={pickupInspection.isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                color: '#92400E',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: pickupInspection.isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#FDE68A';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF3C7';
              }}
            >
              <AlertTriangle size={14} />
              <span>Có vấn đề nhưng vẫn nhận áo</span>
            </button>

            {/* Action C: Từ chối nhận */}
            <button
              type="button"
              onClick={pickupInspection.onReject}
              disabled={pickupInspection.isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: pickupInspection.isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#FEE2E2';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF2F2';
              }}
            >
              <XCircle size={14} />
              <span>Từ chối nhận áo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
