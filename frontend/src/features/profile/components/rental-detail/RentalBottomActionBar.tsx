import React from 'react';
import { XCircle, Clock, Headphones, CheckSquare, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';

interface RentalBottomActionBarProps {
  status?: string;
  incident?: any;
  respondingIncident?: boolean;
  onCancel: () => void;
  onExtend: () => void;
  onSupport: () => void;
  onReturn: () => void;
  onOpenMap?: () => void;
  onConfirmPickup?: () => void;
  onAgreeIncident?: () => void;
  onDisagreeIncident?: () => void;
}

export const RentalBottomActionBar: React.FC<RentalBottomActionBarProps> = ({
  status,
  incident,
  respondingIncident,
  onCancel,
  onExtend,
  onSupport,
  onReturn,
  onOpenMap,
  onConfirmPickup,
  onAgreeIncident,
  onDisagreeIncident
}) => {
  const currentStatus = status || 'CONFIRMED';
  const isPendingCustomerIncident =
    (currentStatus === 'RETURN_PENDING' || currentStatus === 'PENDING_CUSTOMER') &&
    incident?.status === 'PENDING_CUSTOMER';
  const isDisputed = currentStatus === 'DISPUTED' || incident?.status === 'DISPUTED';
  const isIncidentAccepted = incident?.status === 'ACCEPTED';
  const canCancel = !isPendingCustomerIncident && !isDisputed && ['PENDING_PAYMENT', 'WAITING_PAYMENT', 'CONFIRMED', 'DEPOSIT_PAID', 'PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus);
  const isPickupStage = ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'CONFIRMED', 'DEPOSIT_PAID'].includes(currentStatus);
  const canExtend = !isPendingCustomerIncident && !isDisputed && ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus);
  const canReturn = !isPendingCustomerIncident && !isDisputed && ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus);
  const isReturnPending = currentStatus === 'RETURN_PENDING';
  const isCompleted = ['RETURNED', 'COMPLETED'].includes(currentStatus);

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
      {/* 1. Hủy đơn thuê (chỉ hiển thị trước khi nhận đồ) */}
      {canCancel && (
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
      )}

      {/* 2. Đến điểm nhận áo (khi shop đã chuẩn bị đồ xong) */}
      {isPickupStage && onOpenMap && (
        <button
          type="button"
          onClick={onOpenMap}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP' ? '#8B1E2D' : '#FFFFFF',
            border: currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP' ? 'none' : '1px solid #DED7CB',
            color: currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP' ? '#FFFFFF' : '#231F20',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP' ? '0 2px 8px rgba(139, 30, 45, 0.25)' : 'none',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => {
            if (currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP') {
              e.currentTarget.style.backgroundColor = '#721824';
            } else {
              e.currentTarget.style.backgroundColor = '#F8F5F1';
              e.currentTarget.style.borderColor = '#8B1E2D';
            }
          }}
          onMouseOut={(e) => {
            if (currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP') {
              e.currentTarget.style.backgroundColor = '#8B1E2D';
            } else {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#DED7CB';
            }
          }}
        >
          <MapPin size={15} color={currentStatus === 'PICKUP_PENDING' || currentStatus === 'READY_FOR_PICKUP' ? '#FFFFFF' : '#8B1E2D'} />
          <span>Đến điểm nhận áo</span>
        </button>
      )}

      {/* 2b. Xác nhận đã nhận áo (khi shop đã sẵn sàng giao hoặc đang chờ nhận đồ) */}
      {['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus) && onConfirmPickup && (
        <button
          type="button"
          onClick={onConfirmPickup}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '10px',
            backgroundColor: '#059669',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 750,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#047857';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#059669';
          }}
        >
          <CheckSquare size={15} />
          <span>Xác nhận đã nhận áo</span>
        </button>
      )}

      {/* 3. Gia hạn thời gian (chỉ khi đang thuê) */}
      {canExtend && (
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
      )}

      {/* 4. Liên hệ hỗ trợ */}
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

      {/* 5. Trả áo (chỉ khi khách đã nhận đồ và đang thuê) */}
      {canReturn && (
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
      )}

      {/* 6. Khiếu nại / Đồng ý đền bù khi có sự cố chờ duyệt */}
      {isPendingCustomerIncident && (
        <>
          <button
            type="button"
            onClick={onDisagreeIncident}
            disabled={respondingIncident}
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
              cursor: respondingIncident ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              if (!respondingIncident) {
                e.currentTarget.style.backgroundColor = '#FEF2F2';
                e.currentTarget.style.borderColor = '#DC2626';
              }
            }}
            onMouseOut={(e) => {
              if (!respondingIncident) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#FECACA';
              }
            }}
          >
            <AlertTriangle size={15} color="#DC2626" />
            <span>{respondingIncident ? 'Đang gửi...' : 'Khiếu nại lên Admin'}</span>
          </button>

          <button
            type="button"
            onClick={onAgreeIncident}
            disabled={respondingIncident}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 22px',
              borderRadius: '10px',
              backgroundColor: '#059669',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 750,
              cursor: respondingIncident ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              if (!respondingIncident) e.currentTarget.style.backgroundColor = '#047857';
            }}
            onMouseOut={(e) => {
              if (!respondingIncident) e.currentTarget.style.backgroundColor = '#059669';
            }}
          >
            <CheckSquare size={15} />
            <span>
              {respondingIncident
                ? 'Đang xử lý...'
                : `Đồng ý đền bù (${(incident?.requestedAmount || 0).toLocaleString('vi-VN')}đ)`}
            </span>
          </button>
        </>
      )}

      {/* 6b. Trạng thái đang tranh chấp */}
      {isDisputed && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <AlertTriangle size={15} color="#991B1B" />
          <span>Đang tranh chấp (Chờ Ban Quản Trị xử lý)</span>
        </div>
      )}

      {/* 6c. Trạng thái đã đồng ý đền bù */}
      {isIncidentAccepted && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <CheckCircle2 size={15} />
          <span>Đã đồng ý đền bù sự cố</span>
        </div>
      )}

      {/* 6d. Trạng thái chờ shop kiểm tra trả áo thông thường */}
      {isReturnPending && !isPendingCustomerIncident && !isDisputed && !isIncidentAccepted && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            color: '#B45309',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <Clock size={15} />
          <span>Đang chờ shop kiểm tra &amp; hoàn cọc</span>
        </div>
      )}

      {/* 7. Trạng thái đã hoàn tất */}
      {isCompleted && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <CheckCircle2 size={15} />
          <span>Đã hoàn tất đơn thuê</span>
        </div>
      )}
    </div>
  );
};
