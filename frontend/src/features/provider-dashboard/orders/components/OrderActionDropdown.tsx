import React from 'react';
import {
  Camera,
  Check,
  CheckCircle,
  Clock,
  Eye,
  Flag,
  Package,
  Play,
  X,
} from 'lucide-react';
import type { Order } from '../types';
import { PHOTO_START_EARLY_MINUTES } from '../../constants';
import { formatPhotoStartTime, getPhotoScheduleStartsAt } from '../orderHelpers';

interface OrderActionDropdownProps {
  order: Order;
  onClose: () => void;
  setSelectedBookingId: (id: string) => void;
  setIsDetailModalOpen: (open: boolean) => void;
  resolveRescheduleRequest: (order: Order, item: any, approved: boolean) => Promise<void>;
  changeOrderStatus: (_id: string, apiStatus: string) => Promise<void>;
  setReportingOrder: (order: Order | null) => void;
  setSelectedItemId: (id: string) => void;
  setIncidentDesc: (desc: string) => void;
  setIncidentPhotos: (photos: string[]) => void;
  setIncidentAmount: (amount: number) => void;
  setIncidentActionType: (type: any) => void;
}

type OrderAction = {
  label: string;
  apiStatus: string;
  icon: React.ReactNode;
  color: string;
  disabled?: boolean;
  title?: string;
};

export function OrderActionDropdown({
  order,
  onClose,
  setSelectedBookingId,
  setIsDetailModalOpen,
  resolveRescheduleRequest,
  changeOrderStatus,
  setReportingOrder,
  setSelectedItemId,
  setIncidentDesc,
  setIncidentPhotos,
  setIncidentAmount,
  setIncidentActionType,
}: OrderActionDropdownProps) {
  const isComboOrder =
    order.bookingType === 'COMBO' ||
    (order.items?.some((i: any) => i.itemType === 'PRODUCT') &&
      order.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE'));
  const isPhotoOrder = order.bookingType === 'PHOTOGRAPHY';

  const photoSchedules: any[] = Array.isArray(order.schedules) ? order.schedules : [];
  const activePhotoSchedule = photoSchedules.find((s: any) => s.status === 'IN_PROGRESS');
  const nextPhotoSchedule = photoSchedules.find((s: any) => s.status === 'CONFIRMED');
  const nextPhotoStartsAt = getPhotoScheduleStartsAt(nextPhotoSchedule);
  const nextPhotoDateKey = nextPhotoStartsAt
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(nextPhotoStartsAt)
    : null;
  const photoDayStartsAt = nextPhotoDateKey
    ? new Date(`${nextPhotoDateKey}T00:00:00+07:00`)
    : null;
  const photoCanStartAt =
    nextPhotoStartsAt && photoDayStartsAt
      ? new Date(
          Math.max(
            photoDayStartsAt.getTime(),
            nextPhotoStartsAt.getTime() - PHOTO_START_EARLY_MINUTES * 60 * 1000
          )
        )
      : null;
  const isPhotoStartLocked = Boolean(photoCanStartAt && Date.now() < photoCanStartAt.getTime());

  const photoStartAction: OrderAction = nextPhotoSchedule
    ? !nextPhotoStartsAt || !photoCanStartAt
      ? {
          label: 'Lịch chụp thiếu giờ bắt đầu',
          apiStatus: '',
          icon: <Clock size={14} />,
          color: '#D97706',
          disabled: true,
          title: 'Hãy cập nhật ngày và khung giờ chụp trước.',
        }
      : isPhotoStartLocked
      ? {
          label: `Có thể bắt đầu từ ${formatPhotoStartTime(photoCanStartAt)}`,
          apiStatus: 'SESSION_START',
          icon: <Clock size={14} />,
          color: '#D97706',
          disabled: true,
          title: `Lịch chụp bắt đầu lúc ${formatPhotoStartTime(
            nextPhotoStartsAt
          )}. Chỉ được bắt đầu sớm tối đa ${PHOTO_START_EARLY_MINUTES} phút.`,
        }
      : { label: 'Bắt đầu buổi chụp', apiStatus: 'SESSION_START', icon: <Play size={14} />, color: '#2e7d32' }
    : { label: 'Bắt đầu buổi chụp', apiStatus: 'SESSION_START', icon: <Play size={14} />, color: '#2e7d32' };

  const hasUnconfirmedPhotoSchedule = photoSchedules.some((s: any) =>
    ['HELD', 'SCHEDULED'].includes(String(s.status))
  );

  const photoSessionSteps: OrderAction[] = activePhotoSchedule
    ? [
        { label: 'Hoàn tất buổi chụp đang diễn ra', apiStatus: 'SESSION_COMPLETE', icon: <CheckCircle size={14} />, color: '#2e7d32' },
        { label: 'Bàn giao ảnh chụp', apiStatus: 'AWAITING_REVIEW', icon: <Camera size={14} />, color: '#1565C0' },
      ]
    : hasUnconfirmedPhotoSchedule
    ? [{ label: 'Lịch chụp chưa được xác nhận', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true }]
    : [{ label: 'Bàn giao ảnh chụp', apiStatus: 'AWAITING_REVIEW', icon: <Camera size={14} />, color: '#1565C0' }];

  const nextStepsMap: Record<string, OrderAction[]> = isComboOrder
    ? {
        PENDING_PAYMENT: [{ label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' }],
        DEPOSIT_PAID: [
          { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: '#D97706' },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        CONFIRMED: [
          { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: '#D97706' },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        PICKUP_PENDING: [
          { label: '⏳ Chờ khách duyệt nhận đồ...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        PICKED_UP: order.photosApproved
          ? [
              { label: 'Xác nhận đã nhận lại đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' },
              { label: 'Chờ kiểm tra đồ', apiStatus: 'RETURN_PENDING', icon: <Eye size={14} />, color: '#D97706' },
            ]
          : [photoStartAction, { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' }],
        IN_PROGRESS: order.photosApproved
          ? [{ label: 'Xác nhận đã nhận lại đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' }]
          : [...photoSessionSteps],
        AWAITING_REVIEW: order.photosApproved
          ? [{ label: '✓ Khách đã duyệt ảnh • Chờ trả áo dài', apiStatus: '', icon: <CheckCircle size={14} />, color: '#059669', disabled: true }]
          : [{ label: '⏳ Chờ khách duyệt nhận ảnh...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true }],
        COMBO_PHOTOS_APPROVED: [
          { label: 'Xác nhận đã nhận lại đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' },
          { label: 'Chờ kiểm tra đồ', apiStatus: 'RETURN_PENDING', icon: <Eye size={14} />, color: '#D97706' },
        ],
        RETURN_PENDING: [{ label: '⏳ Chờ khách duyệt đền bù...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true }],
        RETURNED: [{ label: 'Hoàn thành đơn', apiStatus: 'COMPLETED', icon: <CheckCircle size={14} />, color: '#2e7d32' }],
      }
    : isPhotoOrder
    ? {
        PENDING_PAYMENT: [{ label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' }],
        DEPOSIT_PAID: [
          { label: 'Chấp nhận lịch chụp', apiStatus: 'CONFIRMED', icon: <CheckCircle size={14} />, color: '#1565C0' },
          { label: 'Từ chối lịch chụp', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        CONFIRMED: [photoStartAction, { label: 'Hủy toàn bộ booking', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' }],
        IN_PROGRESS: [...photoSessionSteps],
        AWAITING_REVIEW: [{ label: '⏳ Chờ khách duyệt nhận ảnh...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true }],
      }
    : {
        PENDING_PAYMENT: [
          { label: 'Xác nhận đơn', apiStatus: 'CONFIRMED', icon: <CheckCircle size={14} />, color: '#1565C0' },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        DEPOSIT_PAID: [
          { label: 'Xác nhận đơn', apiStatus: 'CONFIRMED', icon: <CheckCircle size={14} />, color: '#1565C0' },
          { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: '#D97706' },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        CONFIRMED: [
          { label: 'Báo chờ nhận đồ', apiStatus: 'PICKUP_PENDING', icon: <Package size={14} />, color: '#D97706' },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        PICKUP_PENDING: [
          { label: '⏳ Chờ khách duyệt nhận đồ...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true },
          { label: 'Hủy đơn', apiStatus: 'CANCELLED', icon: <X size={14} />, color: '#d32f2f' },
        ],
        PICKED_UP: [
          { label: 'Xác nhận đã trả đồ', apiStatus: 'RETURNED', icon: <Check size={14} />, color: '#2e7d32' },
          { label: 'Chờ kiểm tra đồ', apiStatus: 'RETURN_PENDING', icon: <Eye size={14} />, color: '#D97706' },
        ],
        RETURN_PENDING: [{ label: '⏳ Chờ khách duyệt đền bù...', apiStatus: '', icon: <Clock size={14} />, color: '#D97706', disabled: true }],
        RETURNED: [{ label: 'Hoàn thành đơn', apiStatus: 'COMPLETED', icon: <CheckCircle size={14} />, color: '#2e7d32' }],
      };

  const rawStat = (order.rawStatus || '') as string;
  const hasRentalLifecycle = Array.isArray(order.items) && order.items.some((i: any) => Boolean(i.rentalFulfillment));
  const steps: OrderAction[] = (nextStepsMap[rawStat] || []).filter(
    (step) => !(hasRentalLifecycle && step.apiStatus === 'COMPLETED')
  );
  const canReport = ['CONFIRMED', 'PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'DISPUTED'].includes(rawStat);
  const pendingReschedule = order.items?.find((item: any) => item?.rescheduleRequest?.status === 'PENDING');

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 39, cursor: 'default' }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: '20px',
          top: '40px',
          width: '235px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04)',
          padding: '4px 0',
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            borderBottom: '1px solid #F1F5F9',
            fontSize: '11px',
            fontWeight: 700,
            color: '#64748B',
          }}
        >
          <span>CHỌN THAO TÁC</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
            title="Đóng menu"
          >
            <X size={14} />
          </button>
        </div>

        {/* View Details button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            setSelectedBookingId(order._id);
            setIsDetailModalOpen(true);
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#1E293B',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <Eye size={14} color="#2563EB" />
          <span>Xem chi tiết đầy đủ</span>
        </button>

        {/* Reschedule section if any */}
        {pendingReschedule && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#B45309', marginBottom: '4px' }}>
              YÊU CẦU ĐỔI LỊCH
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>
              {pendingReschedule.rescheduleRequest.newShootDate
                ? `${pendingReschedule.rescheduleRequest.newShootDate} • ${pendingReschedule.rescheduleRequest.newShootTimeSlot}`
                : `${new Date(pendingReschedule.rescheduleRequest.newRentalFrom).toLocaleDateString('vi-VN')} - ${new Date(pendingReschedule.rescheduleRequest.newRentalTo).toLocaleDateString('vi-VN')}`}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  void resolveRescheduleRequest(order, pendingReschedule, true);
                }}
                style={{ flex: 1, border: 'none', borderRadius: '6px', padding: '5px', background: '#ECFDF5', color: '#047857', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Duyệt
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  void resolveRescheduleRequest(order, pendingReschedule, false);
                }}
                style={{ flex: 1, border: 'none', borderRadius: '6px', padding: '5px', background: '#FEF2F2', color: '#B91C1C', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Từ chối
              </button>
            </div>
          </div>
        )}

        {/* Next step buttons */}
        {steps.length > 0 && (
          <div style={{ padding: '6px 14px 2px', fontSize: '10px', fontWeight: 700, color: '#94A3B8' }}>
            CẬP NHẬT TRẠNG THÁI
          </div>
        )}

        {steps.map((a: OrderAction) => {
          const isDisabled = !!a.disabled;
          return (
            <button
              key={a.apiStatus || a.label}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled && a.apiStatus) {
                  onClose();
                  void changeOrderStatus(order._id, a.apiStatus);
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                border: 'none',
                background: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                color: isDisabled ? (a.disabled ? a.color : '#94A3B8') : a.color,
                opacity: isDisabled ? 0.8 : 1,
                fontWeight: 600,
                textAlign: 'left',
              }}
              title={isDisabled ? a.title || a.label : ''}
            >
              {a.icon} {a.label}
            </button>
          );
        })}

        {/* Incident Reports */}
        {canReport && (
          <>
            {(isComboOrder || !isPhotoOrder) && (
              <button
                type="button"
                onClick={() => {
                  setReportingOrder(order);
                  const productItem = order.items?.find((i: any) => i.itemType === 'PRODUCT') || order.items?.[0];
                  setSelectedItemId(productItem?._id || '');
                  setIncidentDesc('');
                  setIncidentPhotos([]);
                  setIncidentAmount(order.depositTotal || 0);
                  setIncidentActionType('CLEANING');
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#BE123C',
                  fontWeight: 700,
                  textAlign: 'left',
                  borderTop: steps.length > 0 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <Flag size={14} /> Báo cáo hỏng đồ (Áo dài)
              </button>
            )}
            {(isComboOrder || isPhotoOrder) && (
              <button
                type="button"
                onClick={() => {
                  setReportingOrder(order);
                  const photoItem = order.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE') || order.items?.[0];
                  setSelectedItemId(photoItem?._id || '');
                  setIncidentDesc('');
                  setIncidentPhotos([]);
                  setIncidentAmount(order.depositTotal || 0);
                  setIncidentActionType('NO_SHOW');
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#D97706',
                  fontWeight: 700,
                  textAlign: 'left',
                  borderTop: steps.length > 0 || !isPhotoOrder ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <Flag size={14} /> Báo khách vắng mặt / sự cố
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default OrderActionDropdown;
