export type StatusTone =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'purple';

export type BookingGroupKey =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface StatusMeta<Code extends string = string> {
  code: Code;
  label: string;
  shortLabel?: string;
  tone: StatusTone;
  bg: string;
  color: string;
  border: string;
  group?: BookingGroupKey;
}

const TONE_PALETTE: Record<
  StatusTone,
  { bg: string; color: string; border: string }
> = {
  neutral: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  info: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  warning: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  success: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  danger: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  purple: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
};

function makeMeta<Code extends string>(
  code: Code,
  label: string,
  tone: StatusTone,
  extra?: { shortLabel?: string; group?: BookingGroupKey },
): StatusMeta<Code> {
  const palette = TONE_PALETTE[tone];
  return {
    code,
    label,
    shortLabel: extra?.shortLabel ?? label,
    tone,
    ...palette,
    group: extra?.group,
  };
}

export const BOOKING_STATUS_CODES = [
  'DRAFT',
  'PENDING_PAYMENT',
  'DEPOSIT_PAID',
  'CONFIRMED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'RETURN_PENDING',
  'RETURNED',
  'OVERDUE',
  'LOST_ITEM',
  'IN_PROGRESS',
  'AWAITING_REVIEW',
  'COMBO_PHOTOS_APPROVED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;

export type CanonicalBookingStatus = (typeof BOOKING_STATUS_CODES)[number];

export const BOOKING_STATUS_META: Record<
  CanonicalBookingStatus,
  StatusMeta<CanonicalBookingStatus>
> = {
  DRAFT: makeMeta('DRAFT', 'Bản nháp', 'neutral', { group: 'PENDING' }),
  PENDING_PAYMENT: makeMeta('PENDING_PAYMENT', 'Chờ thanh toán', 'warning', {
    group: 'PENDING',
  }),
  DEPOSIT_PAID: makeMeta('DEPOSIT_PAID', 'Đã đặt cọc · Chờ duyệt', 'warning', {
    shortLabel: 'Đã đặt cọc',
    group: 'PENDING',
  }),
  CONFIRMED: makeMeta('CONFIRMED', 'Đã xác nhận', 'info', { group: 'ACTIVE' }),
  PICKUP_PENDING: makeMeta('PICKUP_PENDING', 'Chờ bàn giao / nhận áo', 'warning', {
    shortLabel: 'Chờ bàn giao',
    group: 'ACTIVE',
  }),
  PICKED_UP: makeMeta('PICKED_UP', 'Đang thuê', 'success', { group: 'ACTIVE' }),
  RETURN_PENDING: makeMeta('RETURN_PENDING', 'Chờ nhận trả đồ', 'warning', {
    shortLabel: 'Chờ trả đồ',
    group: 'ACTIVE',
  }),
  RETURNED: makeMeta('RETURNED', 'Đã trả đồ · Chờ hoàn cọc', 'info', {
    shortLabel: 'Đã trả đồ',
    group: 'ACTIVE',
  }),
  OVERDUE: makeMeta('OVERDUE', 'Quá hạn trả đồ', 'danger', {
    shortLabel: 'Quá hạn',
    group: 'ACTIVE',
  }),
  LOST_ITEM: makeMeta('LOST_ITEM', 'Mất đồ · Tịch thu cọc', 'danger', {
    shortLabel: 'Mất đồ',
    group: 'CANCELLED',
  }),
  IN_PROGRESS: makeMeta('IN_PROGRESS', 'Đang thực hiện buổi chụp', 'purple', {
    shortLabel: 'Đang chụp',
    group: 'ACTIVE',
  }),
  AWAITING_REVIEW: makeMeta('AWAITING_REVIEW', 'Đã giao ảnh · Chờ duyệt', 'info', {
    shortLabel: 'Chờ duyệt ảnh',
    group: 'ACTIVE',
  }),
  COMBO_PHOTOS_APPROVED: makeMeta(
    'COMBO_PHOTOS_APPROVED',
    'Đã duyệt ảnh · Chờ trả đồ',
    'info',
    { shortLabel: 'Đã duyệt ảnh', group: 'ACTIVE' },
  ),
  COMPLETED: makeMeta('COMPLETED', 'Hoàn tất', 'success', { group: 'COMPLETED' }),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'danger', { group: 'CANCELLED' }),
  DISPUTED: makeMeta('DISPUTED', 'Đang tranh chấp', 'danger', {
    group: 'DISPUTED',
  }),
  PARTIALLY_REFUNDED: makeMeta(
    'PARTIALLY_REFUNDED',
    'Hoàn tiền một phần',
    'warning',
    { group: 'DISPUTED' },
  ),
  REFUNDED: makeMeta('REFUNDED', 'Đã hoàn tiền', 'neutral', {
    group: 'DISPUTED',
  }),
};

export const BOOKING_GROUP_LABELS: Record<BookingGroupKey, string> = {
  PENDING: 'Chờ xử lý',
  ACTIVE: 'Đang thực hiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  DISPUTED: 'Tranh chấp / Hoàn tiền',
};

export const BOOKING_STATUS_OPTIONS = BOOKING_STATUS_CODES.map((code) => ({
  value: code,
  label: BOOKING_STATUS_META[code].label,
}));

export function isValidBookingStatus(
  value: unknown,
): value is CanonicalBookingStatus {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(BOOKING_STATUS_META, value.toUpperCase())
  );
}

const LEGACY_BOOKING_LABEL_TO_CODE: Record<string, CanonicalBookingStatus> = {
  'BẢN NHÁP': 'DRAFT',
  'CHỜ XỬ LÝ': 'PENDING_PAYMENT',
  'CHỜ THANH TOÁN': 'PENDING_PAYMENT',
  'CHỜ XÁC NHẬN': 'DEPOSIT_PAID',
  'ĐÃ ĐẶT CỌC': 'DEPOSIT_PAID',
  'ĐÃ ĐẶT CỌC · CHỜ DUYỆT': 'DEPOSIT_PAID',
  'ĐÃ XÁC NHẬN': 'CONFIRMED',
  'ĐANG THỰC HIỆN': 'CONFIRMED',
  'CHỜ BÀN GIAO': 'PICKUP_PENDING',
  'CHỜ NHẬN ĐỒ': 'PICKUP_PENDING',
  'CHỜ BÀN GIAO / NHẬN ÁO': 'PICKUP_PENDING',
  'ĐANG THUÊ': 'PICKED_UP',
  'ĐANG TRẢI NGHIỆM': 'PICKED_UP',
  'ĐANG CHỤP': 'IN_PROGRESS',
  'ĐANG THỰC HIỆN BUỔI CHỤP': 'IN_PROGRESS',
  'CHỜ KHÁCH XÁC NHẬN': 'AWAITING_REVIEW',
  'CHỜ KHÁCH XÁC NHẬN ẢNH': 'AWAITING_REVIEW',
  'CHỜ XÁC NHẬN ẢNH': 'AWAITING_REVIEW',
  'CHỜ DUYỆT': 'AWAITING_REVIEW',
  'ĐÃ GIAO ẢNH · CHỜ DUYỆT': 'AWAITING_REVIEW',
  'ĐÃ DUYỆT ẢNH': 'COMBO_PHOTOS_APPROVED',
  'ĐÃ DUYỆT ẢNH · CHỜ TRẢ ĐỒ': 'COMBO_PHOTOS_APPROVED',
  'ĐÃ DUYỆT ẢNH • CHỜ TRẢ ĐỒ': 'COMBO_PHOTOS_APPROVED',
  'CHỜ KIỂM TRA ĐỒ': 'RETURN_PENDING',
  'CHỜ KHÁCH DUYỆT SỰ CỐ': 'RETURN_PENDING',
  'CHỜ NHẬN TRẢ ĐỒ': 'RETURN_PENDING',
  'CHỜ XÁC NHẬN TRẢ ĐỒ': 'RETURN_PENDING',
  'ĐÃ TRẢ': 'RETURNED',
  'ĐÃ TRẢ ĐỒ': 'RETURNED',
  'ĐÃ TRẢ ĐỒ · CHỜ HOÀN CỌC': 'RETURNED',
  'HOÀN TẤT': 'COMPLETED',
  'HOÀN THÀNH': 'COMPLETED',
  'ĐÃ HOÀN TẤT': 'COMPLETED',
  'ĐÃ HOÀN THÀNH': 'COMPLETED',
  'ĐÃ HỦY': 'CANCELLED',
  'ĐƠN ĐÃ HỦY': 'CANCELLED',
  'TRANH CHẤP': 'DISPUTED',
  'ĐANG TRANH CHẤP': 'DISPUTED',
  'CÓ TRANH CHẤP': 'DISPUTED',
  'ĐÃ HOÀN TIỀN MỘT PHẦN': 'PARTIALLY_REFUNDED',
  'HOÀN TIỀN MỘT PHẦN': 'PARTIALLY_REFUNDED',
  'ĐÃ HOÀN TIỀN': 'REFUNDED',
};

export function normalizeBookingStatusCode(
  status: string | undefined | null,
): CanonicalBookingStatus | null {
  if (!status) return null;
  const upper = status.trim().toUpperCase();
  if (isValidBookingStatus(upper)) return upper;
  return LEGACY_BOOKING_LABEL_TO_CODE[upper] ?? null;
}

export function getBookingStatusMeta(
  status: string | undefined | null,
  options?: { hasPendingIncident?: boolean },
): StatusMeta {
  const code = normalizeBookingStatusCode(status);
  if (code) {
    if (code === 'RETURN_PENDING' && options?.hasPendingIncident) {
      return makeMeta(code, 'Chờ khách duyệt sự cố', 'danger', {
        shortLabel: 'Chờ duyệt sự cố',
        group: 'ACTIVE',
      });
    }
    return BOOKING_STATUS_META[code];
  }
  return makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral');
}

export function getBookingStatusLabel(
  status: string | undefined | null,
  options?: { hasPendingIncident?: boolean; uppercase?: boolean },
): string {
  const label = getBookingStatusMeta(status, options).label;
  return options?.uppercase ? label.toUpperCase() : label;
}

export function getBookingStatusGroup(
  status: string | undefined | null,
): BookingGroupKey | null {
  const code = normalizeBookingStatusCode(status);
  return code ? BOOKING_STATUS_META[code].group ?? null : null;
}

// ─── Rental Fulfillment (7 trạng thái) ───────────────────────────────────────
export type CanonicalRentalFulfillmentStatus =
  | 'PENDING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CUSTOMER_RETURN_REQUESTED'
  | 'RETURNED'
  | 'OVERDUE'
  | 'LOST_ITEM'
  | 'COMPLETED'
  | 'CANCELLED';

export const RENTAL_FULFILLMENT_STATUS_META: Record<
  CanonicalRentalFulfillmentStatus,
  StatusMeta<CanonicalRentalFulfillmentStatus>
> = {
  PENDING: makeMeta('PENDING', 'Cần chuẩn bị', 'warning'),
  READY_FOR_PICKUP: makeMeta('READY_FOR_PICKUP', 'Sẵn sàng giao', 'info'),
  PICKED_UP: makeMeta('PICKED_UP', 'Khách đang thuê', 'purple'),
  CUSTOMER_RETURN_REQUESTED: makeMeta(
    'CUSTOMER_RETURN_REQUESTED',
    'Khách hẹn trả',
    'warning',
  ),
  RETURNED: makeMeta('RETURNED', 'Đã nhận lại', 'neutral'),
  OVERDUE: makeMeta('OVERDUE', 'Quá hạn', 'danger'),
  LOST_ITEM: makeMeta('LOST_ITEM', 'Mất đồ', 'danger'),
  COMPLETED: makeMeta('COMPLETED', 'Hoàn tất', 'success'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'danger'),
};

export function getRentalFulfillmentMeta(
  status: string | undefined | null,
): StatusMeta {
  const key = (status || '').toUpperCase() as CanonicalRentalFulfillmentStatus;
  return (
    RENTAL_FULFILLMENT_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Payment Transaction & Booking Payment ───────────────────────────────────
export const PAYMENT_TX_STATUS_META: Record<string, StatusMeta> = {
  PENDING: makeMeta('PENDING', 'Chờ thanh toán', 'warning'),
  PROCESSING: makeMeta('PROCESSING', 'Đang xử lý', 'info'),
  SUCCESS: makeMeta('SUCCESS', 'Thành công', 'success'),
  PAID: makeMeta('PAID', 'Đã thanh toán', 'success'),
  FAILED: makeMeta('FAILED', 'Thất bại', 'danger'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'neutral'),
};

export function getPaymentTxStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    PAYMENT_TX_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Refund Status (7 trạng thái) ────────────────────────────────────────────
export const REFUND_STATUS_META: Record<string, StatusMeta> = {
  PENDING: makeMeta('PENDING', 'Chờ duyệt hoàn tiền', 'warning'),
  APPROVED: makeMeta('APPROVED', 'Đã duyệt hoàn tiền', 'info'),
  PROCESSING: makeMeta('PROCESSING', 'Đang xử lý hoàn tiền', 'info'),
  REJECTED: makeMeta('REJECTED', 'Từ chối hoàn tiền', 'danger'),
  COMPLETED: makeMeta('COMPLETED', 'Đã hoàn tiền', 'success'),
  FAILED: makeMeta('FAILED', 'Hoàn tiền thất bại', 'danger'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy yêu cầu', 'neutral'),
};

export function getRefundStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    REFUND_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Dispute & Incident Status (4 + 4 trạng thái) ────────────────────────────
export const DISPUTE_STATUS_META: Record<string, StatusMeta> = {
  OPEN: makeMeta('OPEN', 'Mới mở', 'warning'),
  UNDER_REVIEW: makeMeta('UNDER_REVIEW', 'Đang thẩm định', 'info'),
  RESOLVED: makeMeta('RESOLVED', 'Đã giải quyết', 'success'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'neutral'),
};

export const INCIDENT_STATUS_META: Record<string, StatusMeta> = {
  PENDING_CUSTOMER: makeMeta('PENDING_CUSTOMER', 'Chờ khách phản hồi', 'warning'),
  ACCEPTED: makeMeta('ACCEPTED', 'Khách đã đồng ý', 'success'),
  DISPUTED: makeMeta('DISPUTED', 'Khách khiếu nại', 'danger'),
  RESOLVED: makeMeta('RESOLVED', 'Đã giải quyết', 'success'),
};

export function getDisputeStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    DISPUTE_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

export function getIncidentStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    INCIDENT_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Verification, Provider & User Status ────────────────────────────────────
export const VERIFICATION_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: makeMeta('DRAFT', 'Bản nháp', 'neutral'),
  SUBMITTED: makeMeta('SUBMITTED', 'Đã gửi duyệt', 'info'),
  UNDER_REVIEW: makeMeta('UNDER_REVIEW', 'Đang thẩm định', 'purple'),
  NEEDS_CHANGES: makeMeta('NEEDS_CHANGES', 'Cần bổ sung', 'warning'),
  APPROVED: makeMeta('APPROVED', 'Đã duyệt', 'success'),
  REJECTED: makeMeta('REJECTED', 'Đã từ chối', 'danger'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'neutral'),
};

export const PROVIDER_STATUS_META: Record<string, StatusMeta> = {
  PENDING_APPROVAL: makeMeta('PENDING_APPROVAL', 'Chờ phê duyệt', 'warning'),
  ACTIVE: makeMeta('ACTIVE', 'Hoạt động', 'success'),
  REJECTED: makeMeta('REJECTED', 'Từ chối', 'danger'),
  SUSPENDED: makeMeta('SUSPENDED', 'Tạm khóa', 'danger'),
};

export const USER_STATUS_META: Record<string, StatusMeta> = {
  PENDING_EMAIL_VERIFICATION: makeMeta(
    'PENDING_EMAIL_VERIFICATION',
    'Chờ xác minh email',
    'warning',
  ),
  ACTIVE: makeMeta('ACTIVE', 'Hoạt động', 'success'),
  SUSPENDED: makeMeta('SUSPENDED', 'Tạm khóa', 'warning'),
  BANNED: makeMeta('BANNED', 'Đã khóa', 'danger'),
  DELETED: makeMeta('DELETED', 'Đã xóa', 'neutral'),
};

export function getVerificationStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    VERIFICATION_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

export function getProviderStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    PROVIDER_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

export function getUserStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    USER_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Settlement Status (4 trạng thái) ────────────────────────────────────────
export const SETTLEMENT_STATUS_META: Record<string, StatusMeta> = {
  READY_TO_SETTLE: makeMeta('READY_TO_SETTLE', 'Chờ quyết toán', 'warning'),
  ON_HOLD: makeMeta('ON_HOLD', 'Đang tạm giữ', 'danger'),
  SETTLED: makeMeta('SETTLED', 'Đã quyết toán', 'success'),
  CANCELLED: makeMeta('CANCELLED', 'Đã hủy', 'neutral'),
};

export function getSettlementStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    SETTLEMENT_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

// ─── Notification Type (7 loại) ──────────────────────────────────────────────
export const NOTIFICATION_TYPE_META: Record<string, StatusMeta> = {
  BOOKING: makeMeta('BOOKING', 'Đơn đặt lịch', 'info'),
  PAYMENT: makeMeta('PAYMENT', 'Thanh toán', 'success'),
  HANDOVER: makeMeta('HANDOVER', 'Giao nhận đồ', 'purple'),
  REFUND: makeMeta('REFUND', 'Hoàn tiền', 'warning'),
  DISPUTE: makeMeta('DISPUTE', 'Tranh chấp', 'danger'),
  WEATHER: makeMeta('WEATHER', 'Thời tiết di sản', 'info'),
  SYSTEM: makeMeta('SYSTEM', 'Hệ thống', 'neutral'),
};

export function getNotificationTypeMeta(type: string | undefined | null): StatusMeta {
  const key = (type || '').toUpperCase();
  return (
    NOTIFICATION_TYPE_META[key] ??
    makeMeta(type || 'SYSTEM', 'Hệ thống', 'neutral')
  );
}

// ─── Moderation, Combo & Reschedule Status ───────────────────────────────────
export const MODERATION_STATUS_META: Record<string, StatusMeta> = {
  PENDING_REVIEW: makeMeta('PENDING_REVIEW', 'Chờ duyệt', 'warning'),
  APPROVED: makeMeta('APPROVED', 'Đã duyệt', 'success'),
  REJECTED: makeMeta('REJECTED', 'Đã từ chối', 'danger'),
  CHANGES_REQUESTED: makeMeta('CHANGES_REQUESTED', 'Cần chỉnh sửa', 'warning'),
  HIDDEN: makeMeta('HIDDEN', 'Đã ẩn', 'neutral'),
};

export const COMBO_STATUS_META: Record<string, StatusMeta> = {
  PENDING_REVIEW: makeMeta('PENDING_REVIEW', 'Chờ duyệt', 'warning'),
  ACTIVE: makeMeta('ACTIVE', 'Đang hoạt động', 'success'),
  INACTIVE: makeMeta('INACTIVE', 'Tạm ngưng', 'neutral'),
  EXPIRED: makeMeta('EXPIRED', 'Hết hạn', 'neutral'),
  REJECTED: makeMeta('REJECTED', 'Đã từ chối', 'danger'),
  CHANGES_REQUESTED: makeMeta('CHANGES_REQUESTED', 'Cần chỉnh sửa', 'warning'),
};

export const RESCHEDULE_STATUS_META: Record<string, StatusMeta> = {
  PENDING: makeMeta('PENDING', 'Chờ duyệt đổi lịch', 'warning'),
  PROCESSING: makeMeta('PROCESSING', 'Đang xử lý', 'info'),
  APPROVED: makeMeta('APPROVED', 'Đã duyệt đổi lịch', 'success'),
  REJECTED: makeMeta('REJECTED', 'Từ chối đổi lịch', 'danger'),
};

export function getModerationStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    MODERATION_STATUS_META[key] ??
    makeMeta(status || 'PENDING_REVIEW', 'Chờ duyệt', 'warning')
  );
}

export function getComboStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    COMBO_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}

export function getRescheduleStatusMeta(status: string | undefined | null): StatusMeta {
  const key = (status || '').toUpperCase();
  return (
    RESCHEDULE_STATUS_META[key] ??
    makeMeta(status || 'UNKNOWN', 'Đang cập nhật', 'neutral')
  );
}
