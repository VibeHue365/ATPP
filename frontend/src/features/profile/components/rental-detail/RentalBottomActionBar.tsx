import React from 'react';
import { XCircle, Clock, Headphones, CheckSquare } from 'lucide-react';

interface RentalBottomActionBarProps {
  onCancel: () => void;
  onExtend: () => void;
  onSupport: () => void;
  onReturn: () => void;
}

export const RentalBottomActionBar: React.FC<RentalBottomActionBarProps> = ({
  onCancel,
  onExtend,
  onSupport,
  onReturn
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        flexWrap: 'wrap'
      }}
    >
      {/* 1. Hủy đơn thuê */}
      <button
        type="button"
        onClick={onCancel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 18px',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #FECACA',
          color: '#DC2626',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#FEF2F2';
          e.currentTarget.style.borderColor = '#DC2626';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF';
          e.currentTarget.style.borderColor = '#FECACA';
        }}
      >
        <XCircle size={15} />
        <span>Hủy đơn thuê</span>
      </button>

      {/* 2. Gia hạn thời gian */}
      <button
        type="button"
        onClick={onExtend}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 18px',
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
        <Clock size={15} color="#8B1E2D" />
        <span>Gia hạn thời gian</span>
      </button>

      {/* 3. Liên hệ hỗ trợ */}
      <button
        type="button"
        onClick={onSupport}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 18px',
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
        <span>Liên hệ hỗ trợ</span>
      </button>

      {/* 4. Trả áo */}
      <button
        type="button"
        onClick={onReturn}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 24px',
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
        <CheckSquare size={15} />
        <span>Trả áo</span>
      </button>
    </div>
  );
};
