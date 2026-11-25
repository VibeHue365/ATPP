
import type React from 'react';
import {
  BOOKING_GROUP_LABELS,
  getBookingStatusGroup,
  getBookingStatusMeta,
  normalizeBookingStatusCode,
} from '../../../utils/bookingStatus';

export const getPhotoScheduleStartsAt = (schedule?: Record<string, any>): Date | null => {
  if (schedule?.startsAt) {
    const startsAt = new Date(schedule.startsAt);
    if (!Number.isNaN(startsAt.getTime())) return startsAt;
  }

  const scheduledDate = schedule?.providerLocalDate
    || (schedule?.scheduledDate
      ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(schedule.scheduledDate))
      : null);
  const startTime = String(schedule?.timeSlot || '').match(/^(\d{1,2}):(\d{2})/);
  if (!scheduledDate || !startTime) return null;

  const legacyStartsAt = new Date(
    `${scheduledDate}T${startTime[1].padStart(2, '0')}:${startTime[2]}:00+07:00`,
  );
  return Number.isNaN(legacyStartsAt.getTime()) ? null : legacyStartsAt;
};

export const formatPhotoStartTime = (value: Date): string =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(value);

export const getOrderGroup = (status: string): string => {
  const group = getBookingStatusGroup(status);
  if (!group) return 'Khác';
  return BOOKING_GROUP_LABELS[group];
};

export const statusBadgeStyle = (status: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: 'white',
    whiteSpace: 'nowrap',
  };
  const code = normalizeBookingStatusCode(status);
  if (!code) return { ...base, backgroundColor: '#ccc', color: '#555' };

  switch (code) {
    case 'COMPLETED':
      return { ...base, backgroundColor: '#2e7d32' };
    case 'RETURN_PENDING':
      return { ...base, backgroundColor: '#ed6c02' };
    case 'DISPUTED':
      return { ...base, backgroundColor: '#d32f2f' };
    case 'CANCELLED':
      return { ...base, backgroundColor: '#757575' };
    case 'DRAFT':
      return { ...base, backgroundColor: '#64748b' };
    case 'PENDING_PAYMENT':
      return { ...base, backgroundColor: '#9C27B0' };
    case 'DEPOSIT_PAID':
      return { ...base, backgroundColor: '#1565C0' };
    case 'CONFIRMED':
      return { ...base, backgroundColor: 'var(--color-gold)' };
    case 'IN_PROGRESS':
      return { ...base, backgroundColor: '#059669' };
    case 'AWAITING_REVIEW':
      return { ...base, backgroundColor: '#0284C7' };
    case 'PICKUP_PENDING':
      return { ...base, backgroundColor: '#E67E22' };
    case 'PICKED_UP':
      return { ...base, backgroundColor: '#27AE60' };
    case 'COMBO_PHOTOS_APPROVED':
      return { ...base, backgroundColor: '#15803D' };
    case 'RETURNED':
      return { ...base, backgroundColor: '#558B2F' };
    case 'PARTIALLY_REFUNDED':
      return { ...base, backgroundColor: '#B45309' };
    case 'REFUNDED':
      return { ...base, backgroundColor: '#475569' };
    default: {
      const meta = getBookingStatusMeta(code);
      return { ...base, backgroundColor: meta.color };
    }
  }
};
