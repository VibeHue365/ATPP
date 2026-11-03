import React from 'react';
import { XCircle, CalendarClock, MapPin, Star, Headphones, CheckCircle2 } from 'lucide-react';

interface PhotoshootBottomActionBarProps {
  status?: string;
  onCancel?: () => void;
  onReschedule?: () => void;
  onLocationChange?: () => void;
  onReview?: () => void;
  onSupport?: () => void;
  onOpenDispute?: () => void;
  onConfirmComplete?: () => void;
  isConfirming?: boolean;
}

export const PhotoshootBottomActionBar: React.FC<PhotoshootBottomActionBarProps> = ({
  status,
  onCancel,
  onReschedule,
  onLocationChange,
  onReview,
  onSupport,
  onOpenDispute,
  onConfirmComplete,
  isConfirming = false
}) => {
  const isCompleted = status === 'COMPLETED';
  const isCancelled = status === 'CANCELLED';
  const isDisputed = status === 'DISPUTED';
  const isRefunded = status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED';
  const canModify = !isCompleted && !isCancelled && !isDisputed && !isRefunded && status !== 'IN_PROGRESS' && status !== 'AWAITING_REVIEW';
  const canDispute = !isDisputed && !isRefunded && !isCancelled && !isCompleted;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EFE9E1',
        padding: '16px 24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}
    >
      {/* Left: Cancellation or Notice */}
      <div>
        {isDisputed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 700, fontSize: '13px' }}>
            <span>⚖️ Đơn hàng đang được Admin giải quyết khiếu nại</span>
          </div>
        )}
        {canModify && onCancel && (
          <button
            type="button"
            onClick={onCancel}
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
            <span>Hủy lịch chụp</span>
          </button>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {canModify && onLocationChange && (
          <button
            type="button"
            onClick={onLocationChange}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#4A3F35',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MapPin size={15} color="#8E1B2E" />
            <span>Đổi địa điểm</span>
          </button>
        )}

        {canModify && onReschedule && (
          <button
            type="button"
            onClick={onReschedule}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#4A3F35',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CalendarClock size={15} color="#8E1B2E" />
            <span>Đổi lịch chụp</span>
          </button>
        )}

        {status === 'AWAITING_REVIEW' && onConfirmComplete && (
          <button
            type="button"
            onClick={onConfirmComplete}
            disabled={isConfirming}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{isConfirming ? 'Đang xử lý...' : '✓ Duyệt ảnh & Hoàn tất'}</span>
          </button>
        )}

        {isCompleted && onReview && (
          <button
            type="button"
            onClick={onReview}
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
              gap: '6px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
            }}
          >
            <Star size={15} />
            <span>Đánh giá dịch vụ</span>
          </button>
        )}

        {canDispute && onOpenDispute && (
          <button
            type="button"
            onClick={onOpenDispute}
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
            <span>Khiếu nại / Báo sự cố</span>
          </button>
        )}

        {onSupport && (
          <button
            type="button"
            onClick={onSupport}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              backgroundColor: '#8E1B2E',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 750,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(139, 30, 45, 0.25)'
            }}
          >
            <Headphones size={15} />
            <span>Trung tâm trợ giúp</span>
          </button>
        )}
      </div>
    </div>
  );
};
