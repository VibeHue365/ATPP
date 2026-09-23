
import type React from 'react';

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
  const s = (status || '').toUpperCase();
  if (['CHỜ XỬ LÝ', 'CHỜ THANH TOÁN', 'PENDING', 'PENDING_PAYMENT'].includes(s)) {
    return 'Chờ xử lý';
  }
  if ([
    'ĐÃ ĐẶT CỌC', 'ĐANG THỰC HIỆN', 'CHỜ NHẬN ĐỒ', 'ĐANG THUÊ',
    'CHỜ KHÁCH DUYỆT SỰ CỐ', 'ĐÃ TRẢ ĐỒ', 'TRANH CHẤP', 'ĐANG XỬ LÝ',
    'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP',
    'RETURN_PENDING', 'RETURNED', 'DISPUTED'
  ].includes(s)) {
    return 'Đang thực hiện';
  }
  if (['HOÀN THÀNH', 'COMPLETED'].includes(s)) {
    return 'Hoàn thành';
  }
  if (['ĐÃ HỦY', 'CANCELLED'].includes(s)) {
    return 'Đã hủy';
  }
  return 'Khác';
};

export const statusBadgeStyle = (status: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-block', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
    letterSpacing: '0.05em', color: 'white', whiteSpace: 'nowrap',
  };
  if (status === 'HOÀN THÀNH') return { ...base, backgroundColor: '#2e7d32' };
  if (status === 'CHỜ KHÁCH DUYỆT SỰ CỐ') return { ...base, backgroundColor: '#ed6c02' };
  if (status === 'TRANH CHẤP') return { ...base, backgroundColor: '#d32f2f' };
  if (status === 'ĐÃ HỦY') return { ...base, backgroundColor: '#757575' };
  if (status === 'CHỜ XỬ LÝ') return { ...base, backgroundColor: 'var(--color-primary)' };
  if (status === 'CHỜ THANH TOÁN') return { ...base, backgroundColor: '#9C27B0' };
  if (status === 'ĐÃ ĐẶT CỌC') return { ...base, backgroundColor: '#1565C0' };
  if (status === 'ĐANG THỰC HIỆN') return { ...base, backgroundColor: 'var(--color-gold)' };
  if (status === 'ĐANG CHỤP') return { ...base, backgroundColor: '#059669' };
  if (status === 'CHỜ KHÁCH XÁC NHẬN') return { ...base, backgroundColor: '#0284C7' };
  if (status === 'CHỜ NHẬN ĐỒ') return { ...base, backgroundColor: '#E67E22' };
  if (status === 'ĐANG THUÊ') return { ...base, backgroundColor: '#27AE60' };
  if (status === 'ĐÃ DUYỆT ẢNH • CHỜ TRẢ ĐỒ') return { ...base, backgroundColor: '#15803D' };
  if (status === 'ĐÃ TRẢ ĐỒ') return { ...base, backgroundColor: '#558B2F' };
  return { ...base, backgroundColor: '#ccc', color: '#555' };
};
