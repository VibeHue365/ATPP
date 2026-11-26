import type { useToast } from '../../../components/feedback/Toast';
import { bookingsApi } from '../api/providerDashboardApi';
import { formatLocationAddress } from '../../../utils/addressFormat';
import { getBookingStatusLabel, isBookingDepositSettled } from '../../../utils/bookingStatus';
import type { Order } from '../types';
import type { useProviderOrderState } from './useProviderOrderState';

type Dependencies = Pick<ReturnType<typeof useProviderOrderState>,
  'setLoadingOrders' | 'setOrders' | 'actionMenuId'
> &
{
  toast: ReturnType<typeof useToast>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createOrderDataActions({ setLoadingOrders, setOrders, actionMenuId, toast }: Dependencies) {
  const fetchOrders = async (silent = false, force = false) => {
    if (!silent) setLoadingOrders(true);
    try {
      const bRes: any = await bookingsApi.list();
      const mapped: Order[] = (Array.isArray(bRes) ? bRes : []).map((b: any) => {
        const cust = b.customerId;
        const custName = cust?.profile?.fullName || cust?.email?.split('@')[0] || 'Khách hàng';
        const custEmail = cust?.email || '';
        const initials = custName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

        const items = b.items || [];
        let productName = 'Sản phẩm thuê';
        if (items.length > 0) {
          const isCombo = b.bookingType === 'COMBO' || (items.some((i: any) => i.itemType === 'PRODUCT' || i.productId) && items.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId));

          if (isCombo) {
            const explicitComboName = b.comboName || b.comboTitle || b.comboPromotionName || b.comboPromotionId?.name || b.comboId?.name ||
              items.find((i: any) => i.comboName || i.comboPromotionId?.name)?.comboName ||
              items.find((i: any) => i.comboPromotionId?.name)?.comboPromotionId?.name;

            const photoItem = items.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId);
            const photoName = photoItem?.name || photoItem?.photographyPackageId?.name || photoItem?.productName || b.productName || 'Gói Chụp Ảnh Combo';

            const rawComboName = explicitComboName || photoName;
            if (rawComboName.toLowerCase().includes('combo')) {
              productName = rawComboName;
            } else {
              productName = `Combo: ${rawComboName}`;
            }
          } else {
            const uniqueNames: string[] = [];
            items.forEach((i: any) => {
              const n = i?.name || i?.productId?.name || i?.photographyPackageId?.name;
              if (n && !uniqueNames.includes(n)) uniqueNames.push(n);
            });
            if (uniqueNames.length === 1) {
              const totalQty = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
              productName = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
            } else if (uniqueNames.length > 1) {
              productName = `${uniqueNames[0]} + ${uniqueNames.length - 1} sản phẩm khác`;
            } else {
              productName = (items.map((i: any) => i?.name || i?.productId?.name || i?.photographyPackageId?.name).filter(Boolean).join(' + ')) || 'Sản phẩm thuê';
            }
          }
        }
        const dateStr = b.createdAt
          ? new Date(b.createdAt).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          : '';

        let totalAmt = 0;
        if (b.pricingSummary?.grandTotal) {
          totalAmt = Number(b.pricingSummary.grandTotal);
        } else if (b.paymentSummary?.totalPaid) {
          totalAmt = Number(b.paymentSummary.totalPaid);
        } else if (b.totalAmount) {
          totalAmt = Number(b.totalAmount);
        } else if (b.items && b.items.length > 0) {
          const itemsSubtotal = b.items.reduce((sum: number, item: any) => {
            const price = Number(item.unitPrice ?? item.price ?? 0);
            const qty = item.quantity ?? 1;
            const discount = item.comboDiscountAmount ?? item.discountAmount ?? 0;
            const lineTotal = Number(item.subtotal ?? item.totalPrice ?? 0);
            return sum + Math.max(0, (lineTotal > 0 ? lineTotal : price * qty) - discount);
          }, 0);
          totalAmt = itemsSubtotal + Number(b.pricingSummary?.depositTotal ?? 0);
        } else {
          totalAmt = Number(b.total ?? 0);
        }

        const formattedStatus = getBookingStatusLabel(b.status, {
          hasPendingIncident: b.incident?.status === 'PENDING_CUSTOMER',
          isDepositSettled: isBookingDepositSettled(b),
          uppercase: true,
        });

        const updatedStr = b.updatedAt
          ? new Date(b.updatedAt).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          : dateStr;

        const calculatedDeposit = Number(
          b.pricingSummary?.depositTotal ??
          b.items?.reduce((sum: number, it: any) => sum + (it.depositAmount || 0), 0) ??
          0
        );

        return {
          _id: b._id,
          id: b.bookingCode
            ? `#${b.bookingCode}`
            : `#${b._id?.slice(-6).toUpperCase()}`,
          bookingCode: b.bookingCode || '',
          customerName: custName,
          customerEmail: custEmail,
          customerPhone: cust?.phone || cust?.profile?.phoneNumber || b.contactPhone || b.customerPhone || '0901 234 567',
          customerAvatar: cust?.avatar || cust?.profile?.avatar || '',
          customerInitials: initials,
          productName,
          orderDate: dateStr,
          rawOrderDate: b.createdAt,
          updatedDate: updatedStr,
          total: `${totalAmt.toLocaleString('vi-VN')}đ`,
          status: formattedStatus,
          totalAmount: totalAmt,
          items: b.items,
          schedules: b.schedules,
          depositTotal: calculatedDeposit,
          rawStatus: b.status,
          bookingType: b.bookingType,
          photosApproved: Boolean(b.photosApproved),
          pickupLocation: (() => {
            const snapshotLoc = Array.isArray(b.items)
              ? b.items
                  .map((it: any) => formatLocationAddress(it?.pickupReturnLocationSnapshot))
                  .find((addr: string) => Boolean(addr))
              : '';
            const provObj = (typeof b.provider === 'object' && b.provider) || (typeof b.providerId === 'object' && b.providerId) || null;
            const customPickup =
              provObj?.rentalSettings?.useBusinessAddressForPickup === false
                ? provObj?.rentalSettings?.pickupLocation
                : null;
            const provAddr =
              formatLocationAddress(customPickup) ||
              formatLocationAddress(provObj?.address);
            return (
              snapshotLoc ||
              formatLocationAddress(b.pickupLocation) ||
              formatLocationAddress(b.pickupAddress) ||
              formatLocationAddress(b.serviceLocation) ||
              provAddr ||
              'Tại cửa hàng đối tác'
            );
          })(),
          customerNotes: b.customerNotes || b.notes || b.note || 'Chụp ảnh và thuê áo dài cho kỷ niệm tốt nghiệp.',
          pricingSummary: b.pricingSummary,
          paymentSummary: b.paymentSummary,
          pickupDamageReport: b.pickupDamageReport || null,
          incident: b.incident || null,
          cancellation: b.cancellation || null,
          cancellationReason: b.cancellation?.reason || b.cancellationReason || b.cancelReason || '',
          statusTimeline: b.statusTimeline || [],
          overdueTracking: b.overdueTracking || null,
          dominoRecovery: b.dominoRecovery || null,
        };
      });

      const isOrdersChanged = (prev: Order[], next: Order[]) => {
        if (prev.length !== next.length) return true;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i]._id !== next[i]._id) return true;
          if (prev[i].rawStatus !== next[i].rawStatus) return true;
          if (prev[i].status !== next[i].status) return true;
          if (prev[i].photosApproved !== next[i].photosApproved) return true;
          if ((prev[i] as any)?.incident?.status !== (next[i] as any)?.incident?.status) return true;
          if (prev[i].overdueTracking?.minutesOverdue !== next[i].overdueTracking?.minutesOverdue) return true;
          if (prev[i].overdueTracking?.calculatedLateFee !== next[i].overdueTracking?.calculatedLateFee) return true;
          if (prev[i].dominoRecovery?.status !== next[i].dominoRecovery?.status) return true;
          const previousRentalState = (prev[i].items || [])
            .map((item: any) => [
              item?._id || '',
              item?.rentalFulfillment?.status || '',
              item?.rentalFulfillment?.pickupEvidence?.files?.length || 0,
              item?.rentalFulfillment?.returnDueAt || item?.rentalTo || '',
              item?.rescheduleRequest?.status || '',
            ].join(':'))
            .join('|');
          const nextRentalState = (next[i].items || [])
            .map((item: any) => [
              item?._id || '',
              item?.rentalFulfillment?.status || '',
              item?.rentalFulfillment?.pickupEvidence?.files?.length || 0,
              item?.rentalFulfillment?.returnDueAt || item?.rentalTo || '',
              item?.rescheduleRequest?.status || '',
            ].join(':'))
            .join('|');
          if (previousRentalState !== nextRentalState) return true;
          const previousScheduleState = (prev[i].schedules || [])
            .map((schedule) => `${schedule._id || ''}:${schedule.status || ''}:${schedule.startsAt || schedule.scheduledDate || ''}`)
            .join('|');
          const nextScheduleState = (next[i].schedules || [])
            .map((schedule) => `${schedule._id || ''}:${schedule.status || ''}:${schedule.startsAt || schedule.scheduledDate || ''}`)
            .join('|');
          if (previousScheduleState !== nextScheduleState) return true;
        }
        return false;
      };

      setOrders(prevOrders => {
        if (actionMenuId !== null && !force) return prevOrders;
        const changed = isOrdersChanged(prevOrders, mapped);
        return changed ? mapped : prevOrders;
      });
    } catch (err: any) {
      if (!silent) toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  return { fetchOrders };
}
