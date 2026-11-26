import type { Order } from './types';
import { toLocalDateKey } from '../shared/dateHelpers';
import { getBookingStatusGroup, normalizeBookingStatusCode } from '../../../utils/bookingStatus';

export const RENTAL_ORDER_TAB_PREFIX = 'rental:';

export type RentalOrderFilter =
  | 'PREPARE'
  | 'SEND_HANDOVER'
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'RENTING'
  | 'RETURN_DUE_TODAY'
  | 'OVERDUE';

const rentalFilterDefinitions: Array<{
  filter: RentalOrderFilter;
  label: string;
  itemLabel: string;
}> = [
  { filter: 'PREPARE', label: 'Cần soạn áo', itemLabel: 'áo cần soạn' },
  { filter: 'SEND_HANDOVER', label: 'Chờ gửi bàn giao', itemLabel: 'áo chờ gửi bàn giao' },
  { filter: 'AWAITING_CUSTOMER_CONFIRMATION', label: 'Chờ khách xác nhận', itemLabel: 'áo chờ khách xác nhận' },
  { filter: 'RENTING', label: 'Đang thuê', itemLabel: 'áo đang thuê' },
  { filter: 'RETURN_DUE_TODAY', label: 'Cần nhận hôm nay', itemLabel: 'áo cần nhận hôm nay' },
  { filter: 'OVERDUE', label: 'Quá hạn', itemLabel: 'áo quá hạn' },
];

export const orderHasRentalItems = (order: Order) =>
  (order.items || []).some((item) => Boolean(item?.rentalFulfillment));

const getRentalItems = (order: Order) =>
  (order.items || []).filter((item) =>
    item?.rentalFulfillment && item.rentalFulfillment.status !== 'CANCELLED',
  );

const orderCanMatchRentalFilter = (order: Order, filter: RentalOrderFilter) => {
  const bookingGroup = getBookingStatusGroup(order.rawStatus || order.status);
  if (bookingGroup === 'CANCELLED' || bookingGroup === 'DISPUTED') return false;
  if (bookingGroup === 'COMPLETED') return false;
  if (filter === 'PREPARE') {
    const bookingStatus = normalizeBookingStatusCode(order.rawStatus || order.status);
    return bookingStatus === 'DEPOSIT_PAID' || bookingStatus === 'CONFIRMED' || bookingStatus === 'PICKUP_PENDING';
  }
  return true;
};

export const getRentalOrderTabId = (filter: RentalOrderFilter) =>
  `${RENTAL_ORDER_TAB_PREFIX}${filter}`;

export const parseRentalOrderTab = (tab: string): RentalOrderFilter | null => {
  if (!tab.startsWith(RENTAL_ORDER_TAB_PREFIX)) return null;
  const filter = tab.slice(RENTAL_ORDER_TAB_PREFIX.length) as RentalOrderFilter;
  return rentalFilterDefinitions.some((definition) => definition.filter === filter)
    ? filter
    : null;
};

const itemMatchesRentalFilter = (
  item: NonNullable<Order['items']>[number],
  filter: RentalOrderFilter,
  todayKey: string,
) => {
  const fulfillment = item?.rentalFulfillment;
  const status = fulfillment?.status || 'PENDING';
  const pickupFiles = fulfillment?.pickupEvidence?.files;
  const hasPickupEvidence = Array.isArray(pickupFiles) && pickupFiles.length > 0;
  const dueValue = fulfillment?.returnDueAt || item?.rentalTo;
  const dueDate = dueValue ? new Date(dueValue) : null;
  const hasValidDueDate = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));
  const dueDateKey = hasValidDueDate && dueDate ? toLocalDateKey(dueDate) : null;
  const isAwaitingReturn = status === 'PICKED_UP' || status === 'CUSTOMER_RETURN_REQUESTED';
  const isOverdue = status === 'OVERDUE' || Boolean(
    isAwaitingReturn && dueDate && hasValidDueDate && dueDate.getTime() < Date.now(),
  );

  if (filter === 'PREPARE') return status === 'PENDING';
  if (filter === 'SEND_HANDOVER') return status === 'READY_FOR_PICKUP' && !hasPickupEvidence;
  if (filter === 'AWAITING_CUSTOMER_CONFIRMATION') return status === 'READY_FOR_PICKUP' && hasPickupEvidence;
  if (filter === 'OVERDUE') return isOverdue;
  if (filter === 'RETURN_DUE_TODAY') {
    return isAwaitingReturn && !isOverdue && dueDateKey === todayKey;
  }
  if (filter === 'RENTING') {
    return isAwaitingReturn && !isOverdue && dueDateKey !== todayKey;
  }
  return false;
};

export const buildRentalOrderTabs = (orders: Order[]) => {
  const todayKey = toLocalDateKey();

  return rentalFilterDefinitions.map(({ filter, label }) => ({
    id: getRentalOrderTabId(filter),
    label,
    count: orders.filter((order) =>
      orderCanMatchRentalFilter(order, filter) &&
      getRentalItems(order).some((item) => itemMatchesRentalFilter(item, filter, todayKey)),
    ).length,
  }));
};

export const orderMatchesRentalFilter = (order: Order, filter: RentalOrderFilter) => {
  if (!orderCanMatchRentalFilter(order, filter)) return false;
  const todayKey = toLocalDateKey();
  return getRentalItems(order).some((item) => itemMatchesRentalFilter(item, filter, todayKey));
};

export const getRentalOrderMatchLabel = (order: Order, filter: RentalOrderFilter) => {
  if (!orderCanMatchRentalFilter(order, filter)) return null;
  const todayKey = toLocalDateKey();
  const rentalItems = getRentalItems(order);
  const matchedCount = rentalItems.filter((item) => itemMatchesRentalFilter(item, filter, todayKey)).length;
  if (matchedCount === 0) return null;
  const definition = rentalFilterDefinitions.find((entry) => entry.filter === filter);
  return `${matchedCount}/${rentalItems.length} ${definition?.itemLabel || 'áo cần xử lý'}`;
};
