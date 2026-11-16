import type {
  Booking,
  BookingItem,
  BookingProvider,
  BookingStatus,
} from '@/types/booking';

export const bookingStatus: Record<
  string,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' | 'info' }
> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PENDING_PAYMENT: { label: 'Chờ ký HĐ & thanh toán', tone: 'warning' },
  DEPOSIT_PAID: { label: 'Đã đặt cọc · Chờ duyệt', tone: 'success' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  PICKUP_PENDING: { label: 'Sẵn sàng nhận áo', tone: 'info' },
  PICKED_UP: { label: 'Đang thuê cổ phục', tone: 'success' },
  RETURN_PENDING: { label: 'Chờ duyệt sự cố trả đồ', tone: 'error' },
  RETURNED: { label: 'Đã trả áo · Chờ hoàn cọc', tone: 'info' },
  IN_PROGRESS: { label: 'Đang thực hiện', tone: 'info' },
  AWAITING_REVIEW: { label: 'Chờ bạn duyệt ảnh', tone: 'warning' },
  COMBO_PHOTOS_APPROVED: { label: 'Ảnh đã duyệt · Chờ trả đồ', tone: 'success' },
  COMPLETED: { label: 'Hoàn tất & Đã hoàn cọc', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'error' },
  DISPUTED: { label: 'Đang xử lý tranh chấp', tone: 'error' },
  PARTIALLY_REFUNDED: { label: 'Hoàn tiền một phần', tone: 'warning' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'neutral' },
};

export const terminalStatuses = new Set([
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export const attentionStatuses = new Set([
  'PENDING_PAYMENT',
  'PICKUP_PENDING',
  'RETURN_PENDING',
  'AWAITING_REVIEW',
  'DISPUTED',
]);

export const itemName = (item: BookingItem) =>
  item.itemType === 'PRODUCT'
    ? item.productId && typeof item.productId === 'object'
      ? item.productId.name
      : 'Áo dài'
    : (item.photographyPackageId && typeof item.photographyPackageId === 'object'
        ? item.photographyPackageId.name
        : item.packageSnapshot?.name) || 'Gói chụp ảnh';

export const itemImage = (item: BookingItem) =>
  item.itemType === 'PRODUCT'
    ? item.productId && typeof item.productId === 'object'
      ? item.productId.images?.[0]
      : undefined
    : item.photographyPackageId && typeof item.photographyPackageId === 'object'
      ? item.photographyPackageId.images?.[0]
      : undefined;

export const itemProvider = (item: BookingItem): BookingProvider | undefined => {
  if (item.providerId && typeof item.providerId === 'object') {
    return item.providerId;
  }
  if (
    item.productId &&
    typeof item.productId === 'object' &&
    item.productId.providerId &&
    typeof item.productId.providerId === 'object'
  ) {
    return item.productId.providerId;
  }
  return undefined;
};

export const bookingDate = (booking: Booking) => {
  const photo = booking.items.find(
    (item) => item.itemType === 'PHOTOGRAPHY_PACKAGE',
  );
  const photoSched = booking.schedules?.find(
    (s) => s.scheduleType === 'PHOTOSHOOT',
  );
  const rental = booking.items.find((item) => item.itemType === 'PRODUCT');
  return (
    photo?.shootDate ||
    photoSched?.startsAt ||
    photoSched?.scheduledDate ||
    rental?.rentalFrom ||
    booking.createdAt ||
    ''
  );
};

export const bookingTitle = (booking: Booking) =>
  booking.bookingType === 'COMBO'
    ? 'Combo áo dài & chụp ảnh'
    : booking.items.length === 1
      ? itemName(booking.items[0])
      : `${itemName(booking.items[0])} +${booking.items.length - 1}`;

export const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
};

const timelineAt = (booking: Booking, statuses: BookingStatus[]) => {
  const match = booking.statusTimeline?.find((entry) =>
    statuses.includes(entry.status),
  );
  return match?.changedAt ?? null;
};

/**
 * Extracts rental evidence timestamps cleanly, falling back to `statusTimeline`
 * and current `booking.status` when BE `updateBookingStatus` does not explicitly
 * populate `rentalFulfillment.readyAt` / `returnedAt`.
 */
export function getRentalEvidenceTimestamps(booking: Booking) {
  const rentalItems = booking.items.filter((i) => i.itemType === 'PRODUCT');
  const firstReady =
    rentalItems.map((i) => i.rentalFulfillment?.readyAt).find(Boolean) ?? null;
  const firstPickedUp =
    rentalItems.map((i) => i.rentalFulfillment?.pickedUpAt).find(Boolean) ??
    null;
  const firstReturned =
    rentalItems.map((i) => i.rentalFulfillment?.returnedAt).find(Boolean) ??
    null;

  const readyAt =
    firstReady ??
    timelineAt(booking, ['PICKUP_PENDING', 'PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'COMPLETED']) ??
    (['PICKUP_PENDING', 'PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(
      booking.status,
    )
      ? timelineAt(booking, ['CONFIRMED']) ?? booking.updatedAt ?? null
      : null);

  const pickedUpAt =
    firstPickedUp ??
    timelineAt(booking, ['PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'COMPLETED']) ??
    (['PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(
      booking.status,
    )
      ? booking.updatedAt ?? null
      : null);

  const returnedAt =
    firstReturned ??
    timelineAt(booking, ['RETURNED', 'RETURN_PENDING', 'COMPLETED']) ??
    (['RETURNED', 'RETURN_PENDING', 'COMPLETED'].includes(booking.status)
      ? booking.updatedAt ?? null
      : null);

  return { readyAt, pickedUpAt, returnedAt };
}

export function formatDepositSettlementLabel(status?: string | null): string {
  switch ((status || '').toUpperCase()) {
    case 'FULLY_RELEASED':
    case 'RELEASED':
    case 'REFUNDED':
      return 'Đã giải phóng / Hoàn trả khách hàng';
    case 'PARTIALLY_RELEASED':
    case 'DEDUCTED':
      return 'Đã đối soát & khấu trừ theo biên bản sự cố';
    case 'DISPUTED':
      return 'Tạm khóa để xử lý tranh chấp';
    case 'HELD':
    case 'ESCROW_HELD':
    case 'PENDING':
      return 'Đang giữ an toàn tại TàGo Escrow';
    default:
      return status || 'Đang xử lý';
  }
}
