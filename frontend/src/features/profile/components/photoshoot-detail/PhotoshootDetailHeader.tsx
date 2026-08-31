import React from 'react';
import { ArrowLeft, Headphones, CalendarClock, MapPin } from 'lucide-react';

interface PhotoshootDetailHeaderProps {
  bookingCode?: string;
  onBack: () => void;
  onOpenSupport: () => void;
  onOpenReschedule?: () => void;
  onOpenLocationChange?: () => void;
}

export const PhotoshootDetailHeader: React.FC<PhotoshootDetailHeaderProps> = ({
  bookingCode,
  onBack,
  onOpenSupport,
  onOpenReschedule,
  onOpenLocationChange
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}
    >
      {/* Back button & Breadcrumb */}
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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#231F20' }}>
            Chi tiết lịch chụp ảnh
          </h2>
          <span style={{ fontSize: '12px', color: '#8C827A' }}>
            Mã đơn: <strong style={{ color: '#8B1E2D' }}>{bookingCode || 'PS-LUME'}</strong>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onOpenLocationChange && (
          <button
            type="button"
            onClick={onOpenLocationChange}
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
        )}

        {onOpenReschedule && (
          <button
            type="button"
            onClick={onOpenReschedule}
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
            <span>Đổi lịch chụp</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSupport}
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
  );
};
