import React from 'react';
import { Check, Sparkles, Shirt, Palette, Gem } from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

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
  };
}

export const RentalMainCard: React.FC<RentalMainCardProps> = ({ rentalData }) => {
  if (!rentalData) return null;

  // Compute step active/completed states
  const rawStatus = rentalData.status;
  let activeStep = rentalData.currentStepIndex || 3;
  if (['RETURNED', 'COMPLETED'].includes(rawStatus)) {
    activeStep = 4;
  } else if (['PICKED_UP', 'RENTING', 'IN_PROGRESS', 'RETURN_PENDING'].includes(rawStatus)) {
    activeStep = 3;
  } else if (rawStatus === 'PICKUP_PENDING') {
    activeStep = 2;
  } else {
    activeStep = 1;
  }

  const progressWidth =
    activeStep === 4 ? '100%' : activeStep === 3 ? '66%' : activeStep === 2 ? '33%' : '0%';

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

      {/* 2. Right Content & Stepper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        {/* Top Header: Badge + Title + Code */}
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: ['RETURNED', 'COMPLETED'].includes(rawStatus) ? '#ECFDF5' : '#FFEDD5',
              color: ['RETURNED', 'COMPLETED'].includes(rawStatus) ? '#047857' : '#C2410C',
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
            <Sparkles size={14} color="#8B1E2D" />
            <span>Thương hiệu: <strong style={{ color: '#231F20' }}>{rentalData.brand || 'LUMÉ'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Palette size={14} color="#8B1E2D" />
            <span>Màu sắc: <strong style={{ color: '#231F20' }}>{rentalData.color || 'Đa sắc'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Shirt size={14} color="#8B1E2D" />
            <span>Chất liệu: <strong style={{ color: '#231F20' }}>{rentalData.material || 'Lụa cao cấp'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#574D4F' }}>
            <Gem size={14} color="#8B1E2D" />
            <span>Phụ kiện đi kèm: <strong style={{ color: '#231F20' }}>{rentalData.accessories || 'Mấn đội đầu'}</strong></span>
          </div>
        </div>

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
            {/* Step 1: Sẵn sàng */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 1 ? '#10B981' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                <Check size={16} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 750, color: '#231F20' }}>Sẵn sàng</span>
              <span style={{ fontSize: '10.5px', color: '#8C827A' }}>{rentalData.readyTime}</span>
            </div>

            {/* Step 2: Đã nhận */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 2 ? '#10B981' : '#EAE5DC',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                {activeStep >= 2 ? <Check size={16} /> : '2'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 750, color: '#231F20' }}>Đã nhận</span>
              <span style={{ fontSize: '10.5px', color: '#8C827A' }}>{rentalData.pickupTime}</span>
            </div>

            {/* Step 3: Đang thuê (Active) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep > 3 ? '#10B981' : activeStep === 3 ? '#EA580C' : '#EAE5DC',
                  color: '#FFFFFF',
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
              <span style={{ fontSize: '12px', fontWeight: 800, color: activeStep === 3 ? '#EA580C' : '#231F20' }}>Đang thuê</span>
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
                  fontWeight: 800
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
    </div>
  );
};
