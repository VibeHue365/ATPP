import type { Booking, BookingItem } from '@/types/booking';

export type RentalStageKey =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'DEPOSIT_PAID'
  | 'PREPARING'
  | 'READY_NEEDS_HANDOVER_PHOTOS'
  | 'HANDOVER_AWAITING_CUSTOMER'
  | 'IN_RENTAL'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'COMBO_PHOTOS_APPROVED'
  | 'CUSTOMER_RETURN_REQUESTED'
  | 'INCIDENT_PENDING_CUSTOMER'
  | 'RETURNED_NEEDS_INSPECTION'
  | 'CLEANING_AFTER_REFUND'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'error';

export type OrderFilterKey =
  | 'all'
  | 'urgent'
  | 'pickup'
  | 'rented'
  | 'refund'
  | 'pending_payment'
  | 'completed';

export interface OrderFilterCounts {
  all: number;
  urgent: number;
  pickup: number;
  rented: number;
  refund: number;
  pending_payment: number;
  completed: number;
}

export interface RentalDisplayState {
  stage: RentalStageKey;
  label: string;
  shortLabel: string;
  tone: StatusTone;
  nextStepText: string;
  actionRequired: boolean;
  isPhotoshootOnly: boolean;
  isCombo: boolean;
  hasRentalItems: boolean;
  hasIncident: boolean;
}

export function isProductItem(item?: Partial<BookingItem> | null): boolean {
  if (!item) return false;
  return item.itemType === 'PRODUCT' || (Boolean(item.productId) && item.itemType !== 'PHOTOGRAPHY_PACKAGE');
}

export function isPhotographyItem(item?: Partial<BookingItem> | null): boolean {
  if (!item) return false;
  return (
    item.itemType === 'PHOTOGRAPHY_PACKAGE' ||
    Boolean(item.photographyPackageId)
  );
}

export function getRentalItems(booking?: Partial<Booking> | null, onlyMine = false): BookingItem[] {
  const items = Array.isArray(booking?.items) ? booking.items : [];
  return items.filter(
    (item) => isProductItem(item) && (!onlyMine || item.isMyItem !== false),
  );
}

export function getPhotoItems(booking?: Partial<Booking> | null, onlyMine = false): BookingItem[] {
  const items = Array.isArray(booking?.items) ? booking.items : [];
  return items.filter(
    (item) => isPhotographyItem(item) && (!onlyMine || item.isMyItem !== false),
  );
}

/**
 * Filter rental items eligible for a customer return request.
 * When per-item rentalFulfillment status exists, rely strictly on it so multi-item bookings
 * never re-select items already marked CUSTOMER_RETURN_REQUESTED or RETURNED.
 */
export function getReturnEligibleRentalItems(booking?: Partial<Booking> | null): BookingItem[] {
  const rentalItems = getRentalItems(booking, false);
  const bStatus = String(booking?.status || '').toUpperCase();
  return rentalItems.filter((item) => {
    const rfStatus = String(item.rentalFulfillment?.status || '').toUpperCase();
    if (rfStatus) {
      return rfStatus === 'PICKED_UP';
    }
    return bStatus === 'PICKED_UP' || bStatus === 'COMBO_PHOTOS_APPROVED';
  });
}

export function getBookingIncident(
  booking?: Partial<Booking> | null,
  externalIncident?: { _id?: string; status?: string; description?: string; requestedAmount?: number } | null,
) {
  return externalIncident || booking?.incident || booking?.activeIncident || null;
}

export function hasActiveReturnIncident(
  booking?: Partial<Booking> | null,
  item?: Partial<BookingItem> | null,
  externalIncident?: { status?: string } | null,
): boolean {
  const inc = getBookingIncident(booking, externalIncident);
  const incStatus = String(inc?.status || '').toUpperCase();
  if (incStatus && ['PENDING_CUSTOMER', 'DISPUTED'].includes(incStatus)) {
    return true;
  }
  const issueStatus = String(item?.rentalFulfillment?.issueStatus || '').toUpperCase();
  if (issueStatus === 'REPORTED' || issueStatus === 'UNDER_REVIEW') {
    return true;
  }
  return Boolean(booking?.hasIncident && booking?.status === 'RETURN_PENDING' && inc);
}

export function hasPickupEvidence(item?: Partial<BookingItem> | null, booking?: Partial<Booking> | null): boolean {
  const itemFiles = item?.rentalFulfillment?.pickupEvidence?.files;
  if (Array.isArray(itemFiles) && itemFiles.length > 0) return true;
  const legacyBookingFiles = booking?.handoverPhotos;
  return Array.isArray(legacyBookingFiles) && legacyBookingFiles.length > 0 && item?.rentalFulfillment?.status === 'READY_FOR_PICKUP';
}

export function getItemSkuOrCode(item?: Partial<BookingItem> | null): string | null {
  if (!item) return null;
  if (item.inventoryItem?.sku) return item.inventoryItem.sku;
  if (item.inventoryItemId) {
    const raw = typeof item.inventoryItemId === 'object'
      ? (item.inventoryItemId as any)._id || (item.inventoryItemId as any).sku
      : String(item.inventoryItemId);
    if (raw) return `#${String(raw).slice(-6).toUpperCase()}`;
  }
  if (item._id) return `#${String(item._id).slice(-5).toUpperCase()}`;
  return null;
}

export function resolveRentalItemStage(
  booking: Partial<Booking>,
  item?: Partial<BookingItem> | null,
  externalIncident?: { status?: string } | null,
): RentalStageKey {
  const bStatus = String(booking.status || 'CONFIRMED').toUpperCase();
  if (bStatus === 'DRAFT') return 'DRAFT';
  if (bStatus === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  if (bStatus === 'DEPOSIT_PAID') return 'DEPOSIT_PAID';
  if (bStatus === 'CANCELLED') return 'CANCELLED';
  if (bStatus === 'DISPUTED') return 'DISPUTED';
  if (bStatus === 'REFUNDED') return 'REFUNDED';
  if (bStatus === 'PARTIALLY_REFUNDED') return 'PARTIALLY_REFUNDED';
  if (bStatus === 'COMPLETED') return 'COMPLETED';

  const rf = item?.rentalFulfillment;
  const rfStatus = String(rf?.status || '').toUpperCase();
  const invStatus = String(rf?.inventoryStatus || '').toUpperCase();
  const depStatus = String(rf?.depositSettlementStatus || '').toUpperCase();
  const incActive = hasActiveReturnIncident(booking, item, externalIncident);

  if (incActive && ['RETURN_PENDING', 'RETURNED', 'PICKED_UP'].includes(bStatus)) {
    return 'INCIDENT_PENDING_CUSTOMER';
  }

  if (rfStatus) {
    if (rfStatus === 'COMPLETED') return 'COMPLETED';
    if (rfStatus === 'CANCELLED') return 'CANCELLED';
    if (rfStatus === 'RETURNED') {
      if (invStatus === 'CLEANING' || depStatus === 'FULLY_RELEASED') {
        return 'CLEANING_AFTER_REFUND';
      }
      return 'RETURNED_NEEDS_INSPECTION';
    }
    if (rfStatus === 'CUSTOMER_RETURN_REQUESTED') {
      return 'CUSTOMER_RETURN_REQUESTED';
    }
    if (rfStatus === 'PICKED_UP') {
      return 'IN_RENTAL';
    }
    if (rfStatus === 'READY_FOR_PICKUP') {
      return hasPickupEvidence(item, booking)
        ? 'HANDOVER_AWAITING_CUSTOMER'
        : 'READY_NEEDS_HANDOVER_PHOTOS';
    }
    if (rfStatus === 'PENDING') {
      return 'PREPARING';
    }
  }

  // Fallback by booking status when item.rentalFulfillment is absent
  if (bStatus === 'CONFIRMED') return 'PREPARING';
  if (bStatus === 'PICKUP_PENDING') {
    return hasPickupEvidence(item, booking)
      ? 'HANDOVER_AWAITING_CUSTOMER'
      : 'READY_NEEDS_HANDOVER_PHOTOS';
  }
  if (bStatus === 'PICKED_UP') return 'IN_RENTAL';
  if (bStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (bStatus === 'AWAITING_REVIEW') return 'AWAITING_REVIEW';
  if (bStatus === 'COMBO_PHOTOS_APPROVED') return 'COMBO_PHOTOS_APPROVED';
  if (bStatus === 'RETURN_PENDING') {
    return incActive ? 'INCIDENT_PENDING_CUSTOMER' : 'CUSTOMER_RETURN_REQUESTED';
  }
  if (bStatus === 'RETURNED') {
    if (invStatus === 'CLEANING' || depStatus === 'FULLY_RELEASED') {
      return 'CLEANING_AFTER_REFUND';
    }
    return 'RETURNED_NEEDS_INSPECTION';
  }

  return 'PREPARING';
}

const STAGE_PRIORITY_FOR_SUMMARY: RentalStageKey[] = [
  'INCIDENT_PENDING_CUSTOMER',
  'CUSTOMER_RETURN_REQUESTED',
  'RETURNED_NEEDS_INSPECTION',
  'CLEANING_AFTER_REFUND',
  'HANDOVER_AWAITING_CUSTOMER',
  'READY_NEEDS_HANDOVER_PHOTOS',
  'PREPARING',
  'IN_RENTAL',
  'COMPLETED',
];

export function resolveBookingDisplayState(
  booking: Partial<Booking>,
  viewerRole: 'customer' | 'provider' = 'customer',
  externalIncident?: { status?: string } | null,
): RentalDisplayState {
  const bStatus = String(booking.status || 'CONFIRMED').toUpperCase();
  const rentalItems = getRentalItems(booking, false);
  const photoItems = getPhotoItems(booking, false);
  const hasRentalItems = rentalItems.length > 0 || booking.bookingType === 'AODAI_RENTAL';
  const isCombo =
    booking.bookingType === 'COMBO' || (rentalItems.length > 0 && photoItems.length > 0);
  const isPhotoshootOnly =
    booking.bookingType === 'PHOTOGRAPHY' || (photoItems.length > 0 && rentalItems.length === 0);

  let stage: RentalStageKey;
  if (
    ['DRAFT', 'PENDING_PAYMENT', 'DEPOSIT_PAID', 'CANCELLED', 'DISPUTED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'COMPLETED'].includes(
      bStatus,
    )
  ) {
    stage = bStatus as RentalStageKey;
  } else if (isPhotoshootOnly) {
    if (bStatus === 'IN_PROGRESS') stage = 'IN_PROGRESS';
    else if (bStatus === 'AWAITING_REVIEW') stage = 'AWAITING_REVIEW';
    else if (bStatus === 'COMBO_PHOTOS_APPROVED') stage = 'COMBO_PHOTOS_APPROVED';
    else stage = 'PREPARING';
  } else {
    const itemStages = rentalItems.map((it) =>
      resolveRentalItemStage(booking, it, externalIncident),
    );
    const hasPendingRentalItem = itemStages.some(
      (s) => !['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(s),
    );
    if (isCombo && bStatus === 'IN_PROGRESS') {
      stage = 'IN_PROGRESS';
    } else if (isCombo && bStatus === 'AWAITING_REVIEW') {
      stage = 'AWAITING_REVIEW';
    } else if (isCombo && bStatus === 'COMBO_PHOTOS_APPROVED' && !hasPendingRentalItem) {
      stage = 'COMBO_PHOTOS_APPROVED';
    } else if (itemStages.length > 0) {
      stage =
        STAGE_PRIORITY_FOR_SUMMARY.find((candidate) => itemStages.includes(candidate)) ??
        resolveRentalItemStage(booking, rentalItems[0], externalIncident);
    } else {
      stage = resolveRentalItemStage(booking, null, externalIncident);
    }
  }

  const incActive =
    stage === 'INCIDENT_PENDING_CUSTOMER' ||
    rentalItems.some((it) => hasActiveReturnIncident(booking, it, externalIncident));

  const copy = buildStageCopy(stage, viewerRole, { isPhotoshootOnly, isCombo });
  return {
    stage,
    ...copy,
    isPhotoshootOnly,
    isCombo,
    hasRentalItems,
    hasIncident: incActive,
  };
}

function buildStageCopy(
  stage: RentalStageKey,
  viewerRole: 'customer' | 'provider',
  ctx: { isPhotoshootOnly: boolean; isCombo: boolean },
): {
  label: string;
  shortLabel: string;
  tone: StatusTone;
  nextStepText: string;
  actionRequired: boolean;
} {
  const isProvider = viewerRole === 'provider';

  switch (stage) {
    case 'DRAFT':
      return {
        label: 'Bản nháp',
        shortLabel: 'Nháp',
        tone: 'neutral',
        nextStepText: 'Đơn chưa gửi thanh toán.',
        actionRequired: false,
      };
    case 'PENDING_PAYMENT':
      return {
        label: 'Chờ ký HĐ & thanh toán',
        shortLabel: 'Chờ TT',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Chờ khách hàng hoàn tất ký hợp đồng và thanh toán qua PayOS.'
          : 'Vui lòng xác nhận hợp đồng điện tử và thanh toán để giữ lịch.',
        actionRequired: !isProvider,
      };
    case 'DEPOSIT_PAID':
      return {
        label: 'Đã đặt cọc · Chờ duyệt',
        shortLabel: 'Chờ duyệt',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Khách đã thanh toán cọc. Bấm "Xác nhận & Chuẩn bị" để giữ đơn.'
          : 'Tiền cọc đang được TàGo Escrow bảo vệ. Chờ cửa hàng xác nhận đơn.',
        actionRequired: isProvider,
      };
    case 'PREPARING':
      if (ctx.isPhotoshootOnly) {
        return {
          label: 'Đã duyệt lịch chụp',
          shortLabel: 'Đã duyệt lịch',
          tone: 'success',
          nextStepText: isProvider
            ? 'Đến giờ hẹn hãy bấm "Bắt đầu buổi chụp".'
            : 'Nhiếp ảnh gia đã xác nhận lịch và đang chuẩn bị cho buổi chụp.',
          actionRequired: false,
        };
      }
      return {
        label: 'Đang chuẩn bị cổ phục',
        shortLabel: 'Đang soạn đồ',
        tone: 'info',
        nextStepText: isProvider
          ? 'Soạn, ủi áo dài xong hãy bấm "Sẵn sàng giao đồ" (bước 1 bàn giao).'
          : 'Tiệm đang kiểm tra, là ủi và chuẩn bị trang phục cho bạn.',
        actionRequired: isProvider,
      };
    case 'READY_NEEDS_HANDOVER_PHOTOS':
      return {
        label: 'Đã soạn · Chờ ảnh bàn giao',
        shortLabel: 'Chờ ảnh giao',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Áo dài đã sẵn sàng. Hãy chụp & tải ảnh hiện trạng bàn giao cho khách.'
          : 'Tiệm đã soạn xong trang phục và đang tải ảnh hiện trạng bàn giao.',
        actionRequired: isProvider,
      };
    case 'HANDOVER_AWAITING_CUSTOMER':
      return {
        label: 'Đã gửi ảnh · Chờ khách nhận',
        shortLabel: 'Chờ khách nhận',
        tone: 'info',
        nextStepText: isProvider
          ? 'Đã gửi ảnh bàn giao. Đợi khách kiểm tra áo và bấm xác nhận nhận đồ.'
          : 'Hãy kiểm tra ảnh hiện trạng tại tiệm rồi bấm "Xác nhận đã nhận cổ phục".',
        actionRequired: !isProvider,
      };
    case 'IN_RENTAL':
      return {
        label: 'Đang thuê cổ phục',
        shortLabel: 'Đang thuê',
        tone: 'success',
        nextStepText: isProvider
          ? 'Khách đang giữ trang phục trong thời gian thuê.'
          : 'Bạn đang giữ trang phục. Khi mang trả hãy bấm "Yêu cầu trả cổ phục".',
        actionRequired: false,
      };
    case 'IN_PROGRESS':
      return {
        label: 'Đang thực hiện buổi chụp',
        shortLabel: 'Đang chụp',
        tone: 'info',
        nextStepText: isProvider
          ? 'Sau buổi chụp hãy tải album ảnh / link Drive để bàn giao cho khách.'
          : 'Buổi chụp ảnh đang diễn ra theo lịch hẹn.',
        actionRequired: isProvider,
      };
    case 'AWAITING_REVIEW':
      return {
        label: 'Đã giao ảnh · Chờ khách duyệt',
        shortLabel: 'Chờ duyệt ảnh',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Album đã gửi, đang chờ khách xác nhận hài lòng.'
          : 'Album ảnh đã sẵn sàng! Vui lòng xem ảnh và bấm "Xác nhận hài lòng".',
        actionRequired: !isProvider,
      };
    case 'COMBO_PHOTOS_APPROVED':
      return {
        label: 'Đã duyệt ảnh · Chờ trả đồ',
        shortLabel: 'Chờ trả đồ',
        tone: 'success',
        nextStepText: isProvider
          ? 'Khách đã duyệt ảnh Combo, đợi khách gửi yêu cầu hoàn trả áo dài.'
          : 'Album đã duyệt xong. Bạn vui lòng bấm "Yêu cầu trả cổ phục" khi trả áo.',
        actionRequired: !isProvider,
      };
    case 'CUSTOMER_RETURN_REQUESTED':
      return {
        label: 'Khách hẹn trả · Chờ nhận lại',
        shortLabel: 'Chờ nhận lại',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Khách đã gửi yêu cầu & ảnh trả đồ. Kiểm tra hàng và bấm "Xác nhận đã nhận lại".'
          : 'Bạn đã gửi yêu cầu trả cổ phục. Chờ cửa hàng xác nhận đã nhận lại áo.',
        actionRequired: isProvider,
      };
    case 'INCIDENT_PENDING_CUSTOMER':
      return {
        label: 'Có sự cố trả đồ · Chờ duyệt',
        shortLabel: 'Sự cố trả đồ',
        tone: 'error',
        nextStepText: isProvider
          ? 'Đã gửi biên bản sự cố & mức đền bù, đang chờ khách hàng phản hồi.'
          : 'Cửa hàng đã báo cáo sự cố lúc trả đồ. Vui lòng xem bằng chứng và phản hồi.',
        actionRequired: !isProvider,
      };
    case 'RETURNED_NEEDS_INSPECTION':
      return {
        label: 'Đã nhận lại · Chờ kiểm tra cọc',
        shortLabel: 'Chờ kiểm tra cọc',
        tone: 'warning',
        nextStepText: isProvider
          ? 'Đã nhận lại áo. Bấm "Không có sự cố & Hoàn cọc" hoặc "Báo sự cố" nếu hư hỏng.'
          : 'Tiệm đã nhận lại áo dài và đang kiểm tra hiện trạng để giải phóng tiền cọc.',
        actionRequired: isProvider,
      };
    case 'CLEANING_AFTER_REFUND':
      return {
        label: 'Đã hoàn cọc · Đang giặt ủi',
        shortLabel: 'Đang giặt ủi',
        tone: 'info',
        nextStepText: isProvider
          ? 'Tiền cọc Escrow đã giải phóng. Giặt ủi xong hãy bấm "Hoàn tất giặt ủi & Mở kho".'
          : 'Tiền cọc đã được xử lý giải phóng. Tiệm đang giặt ủi hoàn tất đơn.',
        actionRequired: isProvider,
      };
    case 'DISPUTED':
      return {
        label: 'Đang xử lý tranh chấp',
        shortLabel: 'Tranh chấp',
        tone: 'error',
        nextStepText: 'Admin TàGo Care đang xem xét bằng chứng hai bên để phân xử tiền cọc.',
        actionRequired: true,
      };
    case 'COMPLETED':
      return {
        label: 'Hoàn tất & Đã đối soát',
        shortLabel: 'Hoàn tất',
        tone: 'success',
        nextStepText: 'Đơn hàng đã khép lại trọn vẹn và tiền cọc (nếu có) đã được quyết toán.',
        actionRequired: false,
      };
    case 'CANCELLED':
      return {
        label: 'Đã hủy',
        shortLabel: 'Đã hủy',
        tone: 'error',
        nextStepText: 'Đơn hàng đã hủy và đối soát hoàn tiền theo chính sách.',
        actionRequired: false,
      };
    case 'PARTIALLY_REFUNDED':
      return {
        label: 'Hoàn tiền một phần',
        shortLabel: 'Hoàn 1 phần',
        tone: 'warning',
        nextStepText: 'Hệ thống đã hoàn trả một phần thanh toán/tiền cọc cho đơn hàng.',
        actionRequired: false,
      };
    case 'REFUNDED':
      return {
        label: 'Đã hoàn tiền',
        shortLabel: 'Đã hoàn tiền',
        tone: 'neutral',
        nextStepText: 'Toàn bộ khoản thanh toán/cọc đủ điều kiện đã được hoàn trả.',
        actionRequired: false,
      };
  }
}

export function classifyProviderOrderFilter(booking: Partial<Booking>): {
  isUrgent: boolean;
  isPickup: boolean;
  isRented: boolean;
  isRefund: boolean;
  isPendingPayment: boolean;
  isCompleted: boolean;
} {
  const display = resolveBookingDisplayState(booking, 'provider');
  const stage = display.stage;

  const isPendingPayment = stage === 'PENDING_PAYMENT' || stage === 'DRAFT';
  const isCompleted =
    stage === 'COMPLETED' ||
    stage === 'CANCELLED' ||
    stage === 'REFUNDED' ||
    stage === 'PARTIALLY_REFUNDED';

  const isPickup =
    !display.isPhotoshootOnly &&
    ['DEPOSIT_PAID', 'PREPARING', 'READY_NEEDS_HANDOVER_PHOTOS', 'HANDOVER_AWAITING_CUSTOMER'].includes(
      stage,
    );

  const isRented =
    ['IN_RENTAL', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED'].includes(stage) ||
    (display.isPhotoshootOnly && ['DEPOSIT_PAID', 'PREPARING'].includes(stage));

  const isRefund = [
    'CUSTOMER_RETURN_REQUESTED',
    'INCIDENT_PENDING_CUSTOMER',
    'RETURNED_NEEDS_INSPECTION',
    'CLEANING_AFTER_REFUND',
    'DISPUTED',
  ].includes(stage);

  const isUrgent =
    stage === 'DEPOSIT_PAID' ||
    stage === 'READY_NEEDS_HANDOVER_PHOTOS' ||
    stage === 'CUSTOMER_RETURN_REQUESTED' ||
    stage === 'RETURNED_NEEDS_INSPECTION' ||
    stage === 'CLEANING_AFTER_REFUND' ||
    stage === 'DISPUTED' ||
    (!display.isPhotoshootOnly && stage === 'PREPARING');

  return {
    isUrgent,
    isPickup,
    isRented,
    isRefund,
    isPendingPayment,
    isCompleted,
  };
}

export function computeProviderOrderCounts(orders: Partial<Booking>[]): OrderFilterCounts {
  const counts: OrderFilterCounts = {
    all: orders.length,
    urgent: 0,
    pickup: 0,
    rented: 0,
    refund: 0,
    pending_payment: 0,
    completed: 0,
  };

  for (const order of orders) {
    const cls = classifyProviderOrderFilter(order);
    if (cls.isUrgent) counts.urgent += 1;
    if (cls.isPickup) counts.pickup += 1;
    if (cls.isRented) counts.rented += 1;
    if (cls.isRefund) counts.refund += 1;
    if (cls.isPendingPayment) counts.pending_payment += 1;
    if (cls.isCompleted) counts.completed += 1;
  }

  return counts;
}

export function matchesProviderOrderFilter(
  booking: Partial<Booking>,
  filter: OrderFilterKey,
): boolean {
  if (filter === 'all') return true;
  const cls = classifyProviderOrderFilter(booking);
  if (filter === 'urgent') return cls.isUrgent;
  if (filter === 'pickup') return cls.isPickup;
  if (filter === 'rented') return cls.isRented;
  if (filter === 'refund') return cls.isRefund;
  if (filter === 'pending_payment') return cls.isPendingPayment;
  if (filter === 'completed') return cls.isCompleted;
  return true;
}

export function getBookingStateSignature(booking: Partial<Booking>): string {
  const bStatus = String(booking.status || '');
  const itemSigs = getRentalItems(booking, false)
    .map((it) => {
      const st = resolveRentalItemStage(booking, it);
      const evCount = it.rentalFulfillment?.pickupEvidence?.files?.length ?? 0;
      const retEvCount = it.rentalFulfillment?.customerReturnEvidence?.files?.length ?? 0;
      return `${it._id || ''}:${st}:${evCount}:${retEvCount}`;
    })
    .join('|');
  const incStatus = String(getBookingIncident(booking)?.status || '');
  return `${bStatus}::${itemSigs}::${incStatus}`;
}
