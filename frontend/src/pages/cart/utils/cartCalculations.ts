import { getMediaUrl } from '../../../shared/media/mediaUrl';
import type { CartItem } from '../../../context/CartContext';
import type { EnrichedCartItem, CartTotals } from '../types';
import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  countRentalDays,
  resolveHourlyRate,
} from '../../../shared/pricing/campaignPricing';

export const isMongoObjectId = (id?: string | null): boolean => /^[a-f\d]{24}$/i.test(id || '');

export const getProductValidationIssues = (item: CartItem): string[] => {
  const issues: string[] = [];
  if (!isMongoObjectId(item.productId)) issues.push('sản phẩm không còn hợp lệ');
  if (!item.size) issues.push('kích cỡ');
  if (!item.color) issues.push('màu sắc');
  if (!(item.rentalFrom || item.startDate)) issues.push('ngày bắt đầu thuê');
  if ((item.rentalType || 'DAILY') === 'DAILY' && !(item.rentalTo || item.endDate)) {
    issues.push('ngày trả');
  }
  if ((item.rentalType || 'DAILY') === 'HOURLY' && (!item.startTime || !item.endTime)) {
    issues.push('khung giờ thuê');
  }
  return issues;
};

export const formatDateRange = (fromStr?: string | null, toStr?: string | null): string => {
  if (!fromStr) return '';
  const formatSingle = (str: string) => {
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    if (str.includes('/')) {
      const p = str.split('/');
      if (p.length === 3) return `${p[1]}/${p[0]}`;
    }
    return str;
  };

  const formattedFrom = formatSingle(fromStr);
  if (!toStr) return formattedFrom;
  const formattedTo = formatSingle(toStr);
  const year = fromStr.split('-')[0] || new Date().getFullYear().toString();
  return `${formattedFrom} - ${formattedTo}/${year}`;
};

export const formatSingleDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (dateStr.includes('/')) return dateStr;
  return dateStr;
};

export const getDayMonth = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (dateStr.includes('/')) {
    const p = dateStr.split('/');
    if (p.length === 3) return `${p[1]}/${p[0]}`;
  }
  return dateStr;
};

export const getImageUrl = (url?: string | null): string => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';
  return getMediaUrl(url) || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';
};

export const enrichCartItems = (cart: CartItem[], realProductList: any[]): EnrichedCartItem[] => {
  return cart.map((item) => {
    if (item.itemType === 'PRODUCT') {
      const dbProduct = realProductList.find(
        (p) =>
          p._id === item.productId ||
          p._id === item.id ||
          p.slug === item.productId ||
          p.slug === item.id ||
          (item.productId && p._id.toString() === item.productId.toString()),
      );
      if (dbProduct) {
        // Ngày không hợp lệ thì tính 1 ngày (giống backend).
        const rentalFrom = item.rentalFrom || item.startDate;
        const rentalTo = item.rentalTo || item.endDate;
        let pricingFrom: string | Date = new Date();
        let pricingTo: string | Date = pricingFrom;
        if (rentalFrom && rentalTo) {
          const start = new Date(rentalFrom);
          const end = new Date(rentalTo);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
            pricingFrom = rentalFrom;
            pricingTo = rentalTo;
          }
        }

        let hours = 2;
        if (item.startTime && item.endTime) {
          const [sh, sm] = item.startTime.split(':').map(Number);
          const [eh, em] = item.endTime.split(':').map(Number);
          const sDate = new Date();
          sDate.setHours(sh, sm, 0, 0);
          const eDate = new Date();
          eDate.setHours(eh, em, 0, 0);
          hours = Math.max((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60), 2);
        }

        // Chiến dịch giá của shop (giảm/phụ thu) áp theo ngày thuê, cùng công thức với backend.
        const campaign = dbProduct.activeCampaign;
        const baseHourlyRate = resolveHourlyRate(dbProduct.basePrice, dbProduct.hourlyPrice);
        const basePrice =
          item.rentalType === 'HOURLY'
            ? applyCampaignToRate(baseHourlyRate, campaign, rentalFrom || new Date()) * hours
            : calculateDailyRentalTotal(dbProduct.basePrice, campaign, pricingFrom, pricingTo).total;
        const originalBasePrice =
          item.rentalType === 'HOURLY'
            ? baseHourlyRate * hours
            : dbProduct.basePrice * countRentalDays(pricingFrom, pricingTo);

        return {
          ...item,
          productId: dbProduct._id ? dbProduct._id.toString() : item.productId,
          depositAmount: dbProduct.depositAmount,
          basePrice,
          originalPrice: originalBasePrice,
          providerCity: dbProduct.providerId?.address?.city || item.providerCity,
          providerAddress: dbProduct.providerId?.address?.addressLine || item.providerAddress,
        };
      }
    }
    return item;
  });
};

export const calculateCartTotals = (
  enrichedCart: EnrichedCartItem[],
  selectedItemIds: string[],
): CartTotals => {
  const selectedItems = enrichedCart.filter((item) => selectedItemIds.includes(item.id));

  const selectedComboIds = new Set(
    selectedItems.filter((i) => i.comboPromotionId).map((i) => i.comboPromotionId!),
  );

  let totalComboPrice = 0;
  let totalComboDeposit = 0;

  selectedComboIds.forEach((cId) => {
    const cItems = enrichedCart.filter((i) => i.comboPromotionId === cId);
    const origTotal = cItems.reduce((sum, i) => sum + (i.basePrice || 0) * (i.quantity || 1), 0);
    const pct = cItems[0]?.comboDiscountPercent || 50;
    const cPrice = Math.round(origTotal * (1 - pct / 100));
    const cDeposit = cItems
      .filter((i) => i.itemType === 'PRODUCT')
      .reduce((sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1), 0);

    totalComboPrice += cPrice;
    totalComboDeposit += cDeposit;
  });

  const nonComboSelected = selectedItems.filter((i) => !i.comboPromotionId);
  const totalNonComboRental = nonComboSelected
    .filter((item) => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.basePrice || 0) * (item.quantity || 1), 0);
  const totalNonComboDeposit = nonComboSelected
    .filter((item) => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.depositAmount || 0) * (item.quantity || 1), 0);
  const totalNonComboPhoto = nonComboSelected
    .filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE')
    .reduce((sum, item) => sum + (item.basePrice || 0) * (item.quantity || 1), 0);

  const totalProductRental = totalNonComboRental;
  const totalProductDeposit = totalComboDeposit + totalNonComboDeposit;
  const totalPhotographerFee = totalNonComboPhoto;
  const comboDiscountTotal = Array.from(selectedComboIds).reduce((sum, cId) => {
    const cItems = enrichedCart.filter((i) => i.comboPromotionId === cId);
    const origTotal = cItems.reduce((s, i) => s + (i.basePrice || 0) * (i.quantity || 1), 0);
    const pct = cItems[0]?.comboDiscountPercent || 50;
    return sum + Math.round(origTotal * (pct / 100));
  }, 0);

  const grandTotal = totalComboPrice + totalNonComboRental + totalNonComboPhoto;
  const depositToPayNow =
    totalComboPrice +
    totalComboDeposit +
    totalNonComboRental +
    totalNonComboDeposit +
    totalNonComboPhoto;
  const remainingToPayLater = 0;

  return {
    grandTotal,
    depositToPayNow,
    totalProductRental,
    totalProductDeposit,
    totalPhotographerFee,
    comboDiscountTotal,
    remainingToPayLater,
  };
};
