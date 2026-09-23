export type ComboStatusKind =
  | 'active'
  | 'expiring'
  | 'scheduled'
  | 'pending'
  | 'changes'
  | 'inactive'
  | 'expired'
  | 'rejected'
  | 'unknown';

export interface ComboDisplayStatus {
  kind: ComboStatusKind;
  text: string;
  isPubliclyVisible: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTime = (value?: string | Date | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

/** Moderation status is authoritative; dates only refine an ACTIVE combo. */
export function getComboDisplayStatus(combo: any, now = Date.now()): ComboDisplayStatus {
  const moderationStatus = String(combo?.status || '').toUpperCase();
  const validFromTime = parseTime(combo?.validFrom);
  const validToTime = parseTime(combo?.validTo);
  const nowDate = new Date(now);
  const todayStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();

  switch (moderationStatus) {
    case 'PENDING_REVIEW':
      return { kind: 'pending', text: 'Chờ duyệt', isPubliclyVisible: false };
    case 'CHANGES_REQUESTED':
      return { kind: 'changes', text: 'Cần chỉnh sửa', isPubliclyVisible: false };
    case 'REJECTED':
      return { kind: 'rejected', text: 'Bị từ chối', isPubliclyVisible: false };
    case 'INACTIVE':
      return { kind: 'inactive', text: 'Đã tạm dừng', isPubliclyVisible: false };
    case 'EXPIRED':
      return { kind: 'expired', text: 'Đã hết hạn', isPubliclyVisible: false };
    case 'ACTIVE':
      if (validFromTime !== null && validFromTime > now) {
        return { kind: 'scheduled', text: 'Chưa bắt đầu', isPubliclyVisible: false };
      }
      if (validToTime !== null && validToTime < todayStart) {
        return { kind: 'expired', text: 'Đã hết hạn', isPubliclyVisible: false };
      }
      if (validToTime !== null && validToTime - now <= 7 * DAY_MS) {
        return { kind: 'expiring', text: 'Sắp hết hạn', isPubliclyVisible: true };
      }
      return { kind: 'active', text: 'Đang chạy', isPubliclyVisible: true };
    default:
      return { kind: 'unknown', text: 'Chưa xác định', isPubliclyVisible: false };
  }
}
