import { Ionicons } from '@expo/vector-icons';
import type { NotificationItem } from '@/types/notification';

export type NotificationCategory =
  | 'CONTRACT'
  | 'PAYMENT'
  | 'HANDOVER'
  | 'RETURN'
  | 'REFUND'
  | 'DISPUTE'
  | 'WEATHER'
  | 'BOOKING'
  | 'SYSTEM';

export interface FormattedNotification {
  id: string;
  category: NotificationCategory;
  categoryLabel: string;
  title: string;
  content: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  bookingId: string;
  contractId: string;
  paymentCode: string;
  statusCode: string | null;
  actionRequired: boolean;
}

const STATUS_CONTENT_VI: Record<
  string,
  { title: string; copy: (code: string) => string; category: NotificationCategory; actionRequired: boolean }
> = {
  PENDING_PAYMENT: {
    title: 'Đơn chờ ký hợp đồng & thanh toán',
    copy: (code) =>
      `${code} đang chờ bạn xác nhận Hợp đồng điện tử và hoàn tất thanh toán giữ chỗ.`,
    category: 'CONTRACT',
    actionRequired: true,
  },
  DEPOSIT_PAID: {
    title: 'Đã ghi nhận tiền đặt cọc',
    copy: (code) =>
      `${code} đã đặt cọc thành công. Tiệm đang tiếp nhận và chuẩn bị trang phục cho bạn.`,
    category: 'PAYMENT',
    actionRequired: false,
  },
  CONFIRMED: {
    title: 'Đơn đã được xác nhận',
    copy: (code) =>
      `${code} đã được xác nhận và khóa lịch. Tiệm đang chuẩn bị cổ phục / lịch chụp cho bạn.`,
    category: 'BOOKING',
    actionRequired: false,
  },
  PICKUP_PENDING: {
    title: 'Cổ phục đã sẵn sàng bàn giao',
    copy: (code) =>
      `${code} đã chuẩn bị xong kèm ảnh hiện trạng! Hãy ghé tiệm nhận đồ và xác nhận trên ứng dụng.`,
    category: 'HANDOVER',
    actionRequired: true,
  },
  PICKED_UP: {
    title: 'Đơn đang trong thời gian thuê',
    copy: (code) =>
      `${code} đã xác nhận bàn giao cổ phục. Chúc bạn có trải nghiệm chụp ảnh tuyệt vời tại Cố đô!`,
    category: 'HANDOVER',
    actionRequired: false,
  },
  RETURN_PENDING: {
    title: 'Cần xác nhận biên bản sự cố trả đồ',
    copy: (code) =>
      `${code} có ghi nhận sự cố khi trả đồ từ cửa hàng. Vui lòng kiểm tra bằng chứng và phản hồi ngay.`,
    category: 'DISPUTE',
    actionRequired: true,
  },
  RETURNED: {
    title: 'Tiệm đã nhận lại cổ phục',
    copy: (code) =>
      `${code} đã được hoàn trả trang phục. Tiệm đang kiểm tra hoàn tất để giải ngân tiền cọc.`,
    category: 'RETURN',
    actionRequired: false,
  },
  IN_PROGRESS: {
    title: 'Buổi chụp ảnh đã bắt đầu',
    copy: (code) =>
      `${code} đang trong quá trình thực hiện buổi chụp ảnh di sản.`,
    category: 'BOOKING',
    actionRequired: false,
  },
  AWAITING_REVIEW: {
    title: 'Album ảnh đã được bàn giao',
    copy: (code) =>
      `${code} đã nhận được ảnh từ nhiếp ảnh gia. Vui lòng xem ảnh và bấm "Xác nhận hài lòng".`,
    category: 'HANDOVER',
    actionRequired: true,
  },
  COMBO_PHOTOS_APPROVED: {
    title: 'Đã duyệt ảnh Combo · Chờ trả đồ',
    copy: (code) =>
      `${code} đã hoàn tất duyệt ảnh. Bạn vui lòng hoàn trả cổ phục đúng hạn để nhận lại cọc.`,
    category: 'RETURN',
    actionRequired: false,
  },
  COMPLETED: {
    title: 'Hoàn tất đơn & Giải phóng cọc',
    copy: (code) =>
      `${code} đã hoàn tất trọn vẹn và xử lý giải phóng tiền cọc. Cảm ơn bạn đã đồng hành cùng TàGo!`,
    category: 'REFUND',
    actionRequired: false,
  },
  DISPUTED: {
    title: 'Đơn đang xử lý tranh chấp',
    copy: (code) =>
      `${code} đã được chuyển cho bộ phận TàGo Care hòa giải và đối soát bằng chứng.`,
    category: 'DISPUTE',
    actionRequired: true,
  },
  CANCELLED: {
    title: 'Đơn hàng đã được hủy',
    copy: (code) =>
      `${code} đã hủy và được hệ thống cập nhật trạng thái hoàn tiền theo quy định.`,
    category: 'BOOKING',
    actionRequired: false,
  },
};

export const NOTIFICATION_CATEGORY_STYLE: Record<
  NotificationCategory,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  CONTRACT: {
    icon: 'document-text-outline',
    color: '#9A3412',
    bg: '#FFF7ED',
    label: 'HỢP ĐỒNG',
  },
  PAYMENT: {
    icon: 'card-outline',
    color: '#BA0049',
    bg: '#FFF0F3',
    label: 'THANH TOÁN',
  },
  HANDOVER: {
    icon: 'bag-handle-outline',
    color: '#B45309',
    bg: '#FFFBEB',
    label: 'BÀN GIAO ĐỒ',
  },
  RETURN: {
    icon: 'swap-horizontal-outline',
    color: '#0369A1',
    bg: '#F0F9FF',
    label: 'TRẢ ĐỒ',
  },
  REFUND: {
    icon: 'return-down-back-outline',
    color: '#047857',
    bg: '#EDF9F2',
    label: 'HOÀN TIỀN CỌC',
  },
  DISPUTE: {
    icon: 'alert-circle-outline',
    color: '#DC2626',
    bg: '#FDECEE',
    label: 'SỰ CỐ / HỖ TRỢ',
  },
  WEATHER: {
    icon: 'cloud-outline',
    color: '#0284C7',
    bg: '#E0F2FE',
    label: 'THỜI TIẾT',
  },
  BOOKING: {
    icon: 'calendar-outline',
    color: '#BA0049',
    bg: '#FFF0F3',
    label: 'LỊCH HẸN',
  },
  SYSTEM: {
    icon: 'notifications-outline',
    color: '#5F5E5E',
    bg: '#F5F3F3',
    label: 'HỆ THỐNG',
  },
};

export function formatNotification(item: NotificationItem): FormattedNotification {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const nestedBooking =
    typeof meta.booking === 'object' && meta.booking !== null
      ? (meta.booking as Record<string, unknown>)
      : {};

  const bookingId = String(meta.bookingId ?? nestedBooking._id ?? '');
  const contractId = String(meta.contractId ?? '');
  const paymentCode = String(meta.paymentCode ?? meta.code ?? '');

  // Detect raw BE message like: "Đơn hàng VH-... của bạn đã chuyển sang trạng thái: PICKUP_PENDING"
  const rawContent = String(item.content || '');
  const rawTitle = String(item.title || '');
  const statusMatch = rawContent.match(
    /(?:trạng thái|status)\s*:\s*([A-Z_]{3,32})/i,
  );
  const metaStatus =
    typeof meta.newStatus === 'string'
      ? meta.newStatus.toUpperCase()
      : typeof meta.status === 'string'
        ? meta.status.toUpperCase()
        : null;
  const detectedStatus = statusMatch?.[1]?.toUpperCase() ?? metaStatus;

  const codeMatch = rawContent.match(/#\s*([A-Za-z0-9-]+)|Đơn(?:\s+hàng)?\s+([A-Z0-9-]{4,24})/i);
  const bookingCode = String(
    meta.bookingCode ??
      nestedBooking.bookingCode ??
      codeMatch?.[1] ??
      codeMatch?.[2] ??
      '',
  ).trim();
  const codeLabel = bookingCode ? `Đơn #${bookingCode.replace(/^#/, '')}` : 'Đơn hàng';

  if (detectedStatus && STATUS_CONTENT_VI[detectedStatus]) {
    const mapped = STATUS_CONTENT_VI[detectedStatus];
    const style = NOTIFICATION_CATEGORY_STYLE[mapped.category];
    return {
      id: item._id,
      category: mapped.category,
      categoryLabel: style.label,
      title: mapped.title,
      content: mapped.copy(codeLabel),
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      bookingId,
      contractId,
      paymentCode,
      statusCode: detectedStatus,
      actionRequired: mapped.actionRequired,
    };
  }

  // Fallback mapping by notification type & Vietnamese keyword
  let category: NotificationCategory = 'SYSTEM';
  const rawType = (item.type || '').toUpperCase();
  const joined = `${rawTitle} ${rawContent}`.toLowerCase();

  if (joined.includes('hợp đồng') || rawType === 'CONTRACT') {
    category = 'CONTRACT';
  } else if (rawType === 'PAYMENT' || joined.includes('thanh toán')) {
    category = 'PAYMENT';
  } else if (rawType === 'DISPUTE' || joined.includes('sự cố') || joined.includes('tranh chấp')) {
    category = 'DISPUTE';
  } else if (rawType === 'REFUND' || joined.includes('hoàn cọc') || joined.includes('hoàn tiền')) {
    category = 'REFUND';
  } else if (rawType === 'HANDOVER' || joined.includes('bàn giao')) {
    category = 'HANDOVER';
  } else if (joined.includes('trả đồ') || joined.includes('trả áo')) {
    category = 'RETURN';
  } else if (
    rawType === 'WEATHER' ||
    joined.includes('thời tiết') ||
    joined.includes('plan b') ||
    joined.includes('cảnh báo mưa')
  ) {
    category = 'WEATHER';
  } else if (rawType === 'BOOKING' || joined.includes('đơn') || joined.includes('lịch')) {
    category = 'BOOKING';
  }

  const style = NOTIFICATION_CATEGORY_STYLE[category];
  const weatherNeedsAction =
    category === 'WEATHER' &&
    (joined.includes('plan b') ||
      joined.includes('cảnh báo') ||
      joined.includes('đề xuất') ||
      joined.includes('chờ duyệt'));
  return {
    id: item._id,
    category,
    categoryLabel: style.label,
    title: rawTitle || 'Thông báo từ TàGo',
    content: rawContent,
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    bookingId,
    contractId,
    paymentCode,
    statusCode: detectedStatus,
    actionRequired:
      category === 'CONTRACT' ||
      category === 'HANDOVER' ||
      category === 'DISPUTE' ||
      weatherNeedsAction,
  };
}
