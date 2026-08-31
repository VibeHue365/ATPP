import React from 'react';
import { Check, Clock, Circle, Image as ImageIcon } from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

interface RentalTimelineAndPhotosProps {
  timelineSteps?: {
    id: string;
    title: string;
    description: string;
    timestamp?: string;
    status: 'COMPLETED' | 'ACTIVE' | 'PENDING';
  }[];
  photos?: {
    id: string;
    title: string;
    timestamp: string;
    image: string;
  }[];
  onViewPhoto?: (photo: any) => void;
}

export const RentalTimelineAndPhotos: React.FC<RentalTimelineAndPhotosProps> = ({
  timelineSteps = [],
  photos = [],
  onViewPhoto
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}
    >
      {/* 1. Left: Quá trình thuê (Vertical Timeline) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
          Quá trình thuê
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {timelineSteps.map((step, idx) => {
            const isCompleted = step.status === 'COMPLETED';
            const isActive = step.status === 'ACTIVE';
            const isLast = idx === timelineSteps.length - 1;

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  position: 'relative',
                  paddingBottom: isLast ? 0 : '24px'
                }}
              >
                {/* Connecting Line */}
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '11px',
                      top: '24px',
                      bottom: 0,
                      width: '2px',
                      backgroundColor: isCompleted ? '#10B981' : '#EAE5DC'
                    }}
                  />
                )}

                {/* Status Dot / Icon */}
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#10B981' : isActive ? '#EA580C' : '#F2EFEB',
                    color: isCompleted || isActive ? '#FFFFFF' : '#8C827A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    zIndex: 2,
                    flexShrink: 0
                  }}
                >
                  {isCompleted ? <Check size={14} /> : isActive ? <Clock size={12} /> : <Circle size={10} />}
                </div>

                {/* Text Details */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '13.5px',
                        fontWeight: 800,
                        color: isActive ? '#EA580C' : isCompleted ? '#231F20' : '#8C827A'
                      }}
                    >
                      {step.title}
                    </h4>
                    {step.timestamp && (
                      <span style={{ fontSize: '11px', color: '#8C827A' }}>
                        {step.timestamp}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      margin: '3px 0 0 0',
                      fontSize: '12px',
                      color: isActive ? '#8B1E2D' : '#7D736B',
                      fontWeight: isActive ? 600 : 400
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right: Hình ảnh xác nhận (Handover Photos) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
          Hình ảnh xác nhận
        </h3>

        {photos.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              backgroundColor: '#FCFAF8',
              borderRadius: '12px',
              border: '1px dashed #E2DACF',
              color: '#8C827A',
              fontSize: '12.5px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ImageIcon size={28} color="#C4B7A6" />
            <span style={{ fontWeight: 600, color: '#574D4F' }}>Chưa có ảnh bàn giao đồ</span>
            <span style={{ fontSize: '11px', color: '#8C827A' }}>
              Ảnh chụp tình trạng trang phục sẽ được cập nhật khi bạn nhận đồ tại cửa hàng.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => onViewPhoto?.(photo)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3/4',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#F8F5F1',
                  border: '1px solid #ECE5DB',
                  position: 'relative'
                }}
              >
                <ImageWithFallback
                  src={photo.image}
                  alt={photo.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  fallback={
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                      <ImageIcon size={24} />
                    </div>
                  }
                />

                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Check size={13} />
                </div>
              </div>

              <div>
                <h4 style={{ margin: 0, fontSize: '12.5px', fontWeight: 750, color: '#231F20' }}>
                  {photo.title}
                </h4>
                <span style={{ fontSize: '11px', color: '#8C827A' }}>
                  {photo.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
        )}

        <p style={{ margin: 'auto 0 0 0', fontSize: '11.5px', color: '#8C827A', fontStyle: 'italic', textAlign: 'center' }}>
          * Nếu có vấn đề, vui lòng liên hệ chúng tôi ngay để được hỗ trợ.
        </p>
      </div>
    </div>
  );
};
