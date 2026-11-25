import { toLocalDateKey } from '../shared/dateHelpers';

export type ProviderScheduleEntryType = 'BOOKING' | 'AODAI_PICKUP' | 'AODAI_RETURN';

export interface ProviderScheduleEntry {
  dateKey: string;
  order: any & { scheduleEntryType: ProviderScheduleEntryType; scheduleEntryId: string };
}

const isRentalOrder = (order: any) =>
  order.bookingType === 'AODAI_RENTAL' ||
  order.bookingType === 'COMBO' ||
  order.items?.some((item: any) => ['PRODUCT', 'AODAI_RENTAL'].includes(item.itemType));

const safeDateKey = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : toLocalDateKey(date);
};

/** Turns a rental booking into its two real handover appointments on the provider calendar. */
export function buildProviderScheduleEntries(orders: any[]): ProviderScheduleEntry[] {
  return orders.flatMap((order) => {
    const id = String(order._id || order.id || order.bookingId || 'booking');
    const startValue = order.startDate || order.rawOrderDate || order.orderDate || order.createdAt;
    const startKey = safeDateKey(startValue);

    if (!isRentalOrder(order)) {
      return startKey ? [{
        dateKey: startKey,
        order: { ...order, scheduleEntryType: 'BOOKING' as const, scheduleEntryId: `${id}-booking` },
      }] : [];
    }

    const returnValue = order.endDate || order.items?.find((item: any) => item.rentalTo)?.rentalTo;
    const returnKey = safeDateKey(returnValue);
    const entries: ProviderScheduleEntry[] = [];
    if (startKey) {
      entries.push({
        dateKey: startKey,
        order: { ...order, scheduleEntryType: 'AODAI_PICKUP', scheduleEntryId: `${id}-pickup`, scheduleDate: startValue },
      });
    }
    if (returnKey) {
      entries.push({
        dateKey: returnKey,
        order: { ...order, scheduleEntryType: 'AODAI_RETURN', scheduleEntryId: `${id}-return`, scheduleDate: returnValue },
      });
    }
    return entries;
  });
}
