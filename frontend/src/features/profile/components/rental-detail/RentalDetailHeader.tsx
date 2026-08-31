import React from 'react';
import { ArrowLeft, Headphones, RotateCcw } from 'lucide-react';

interface RentalDetailHeaderProps {
  onBack: () => void;
  onOpenSupport: () => void;
  onOpenRescheduleOrExtend: () => void;
}

export const RentalDetailHeader: React.FC<RentalDetailHeaderProps> = ({
  onBack,
  onOpenSupport,
  onOpenRescheduleOrExtend
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: 0,
          color: '#8B1E2D',
          fontSize: '13.5px',
          fontWeight: 700,
          cursor: 'pointer',
          width: 'fit-content'
        }}
      >
        <ArrowLeft size={16} />
        <span>Quay lại danh sách</span>
      </button>

      {/* Title & Actions Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            color: '#231F20',
            letterSpacing: '-0.01em'
          }}
        >
          Chi tiết lịch thuê
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Support Button */}
          <button
            type="button"
            onClick={onOpenSupport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#231F20',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#F8F5F1';
              e.currentTarget.style.borderColor = '#8B1E2D';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#DED7CB';
            }}
          >
            <Headphones size={15} color="#8B1E2D" />
            <span>Hỗ trợ</span>
          </button>

          {/* Extend / Reschedule Button */}
          <button
            type="button"
            onClick={onOpenRescheduleOrExtend}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              backgroundColor: '#8B1E2D',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 750,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(139, 30, 45, 0.25)',
              transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#721824')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8B1E2D')}
          >
            <RotateCcw size={15} />
            <span>Đổi hoặc gia hạn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
