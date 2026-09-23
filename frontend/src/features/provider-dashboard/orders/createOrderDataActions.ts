import type { useToast } from '../../../components/feedback/Toast';
import { bookingsApi } from '../api/providerDashboardApi';
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
        if (b.items && b.items.length > 0) {
          totalAmt = b.items.reduce((sum: number, item: any) => {
            const price = Number(item.unitPrice ?? item.price ?? 0);
            const qty = item.quantity ?? 1;
            const discount = item.comboDiscountAmount ?? item.discountAmount ?? 0;
            const lineTotal = Number(item.subtotal ?? item.totalPrice ?? 0);
            return sum + Math.max(0, (lineTotal > 0 ? lineTotal : price * qty) - discount);
          }, 0);
        }
        if (b.bookingType === 'COMBO' && b.pricingSummary?.grandTotal) {
          totalAmt = b.pricingSummary.grandTotal;
        } else if (totalAmt === 0) {
          totalAmt = Number(b.pricingSummary?.grandTotal ?? b.paymentSummary?.totalPaid ?? b.totalAmount ?? b.total ?? 0);
        }

        const statusMap: Record<string, string> = {
          PENDING: 'CHỜ XỬ LÝ',
          PENDING_PAYMENT: 'CHỜ THANH TOÁN',
          DEPOSIT_PAID: 'ĐÃ ĐẶT CỌC',
          CONFIRMED: 'ĐANG THỰC HIỆN',
          IN_PROGRESS: 'ĐANG CHỤP',
          AWAITING_REVIEW: 'CHỜ KHÁCH XÁC NHẬN ẢNH',
          PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
          PICKED_UP: 'ĐANG THUÊ',
          COMBO_PHOTOS_APPROVED: 'ĐÃ DUYỆT ẢNH • CHỜ TRẢ ĐỒ',
          RETURN_PENDING: 'CHỜ KHÁCH DUYỆT SỰ CỐ',
          RETURNED: 'ĐÃ TRẢ ĐỒ',
          COMPLETED: 'HOÀN THÀNH',
          CANCELLED: 'ĐÃ HỦY',
          DISPUTED: 'ĐANG TRANH CHẤP',
          PARTIALLY_REFUNDED: 'ĐÃ HOÀN TIỀN MỘT PHẦN',
          REFUNDED: 'ĐÃ HOÀN TIỀN',
        };

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

        return {
          _id: b._id,
          id: `#${b._id?.slice(-6).toUpperCase()}`,
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
          status: statusMap[b.status] || b.status,
          totalAmount: totalAmt,
          items: b.items,
          schedules: b.schedules,
          depositTotal: b.pricingSummary?.depositTotal || (totalAmt > 0 ? Math.round(totalAmt * 0.5) : 0),
          rawStatus: b.status,
          bookingType: b.bookingType,
          photosApproved: Boolean(b.photosApproved),
          pickupLocation: b.pickupLocation || b.pickupAddress || b.serviceLocation || 'Đại Nội Huế - Số 23 Đặng Thái Thân, TP. Huế',
          customerNotes: b.customerNotes || b.notes || b.note || 'Chụp ảnh và thuê áo dài cho kỷ niệm tốt nghiệp.',
          pricingSummary: b.pricingSummary,
          paymentSummary: b.paymentSummary,
          pickupDamageReport: b.pickupDamageReport || null,
        };
      });

      const isOrdersChanged = (prev: Order[], next: Order[]) => {
        if (prev.length !== next.length) return true;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i]._id !== next[i]._id) return true;
          if (prev[i].rawStatus !== next[i].rawStatus) return true;
          if (prev[i].status !== next[i].status) return true;
          if (prev[i].photosApproved !== next[i].photosApproved) return true;
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
