import type { ComboDeal } from '../types/combo.types';
import { API_BASE_URL } from '../../../config/env';

export const DEFAULT_AODAI_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
export const DEFAULT_PACKAGE_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb';

export interface ComboPricingSummary {
  originalPrice: number;
  discountedPrice: number;
  savingsAmount: number;
}

export const resolveImageUrl = (url?: string, fallback: string = DEFAULT_AODAI_IMAGE_FALLBACK): string => {
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const calculateComboPricing = (combo: ComboDeal): ComboPricingSummary => {
  const originalPrice = (combo.productId?.basePrice || 0) + (combo.photographyPackageId?.price || 0);
  const discountedPrice = combo.comboPrice 
    ? combo.comboPrice 
    : Math.round(originalPrice * (1 - (combo.discountPercent || 0) / 100));
  const savingsAmount = Math.max(0, originalPrice - discountedPrice);

  return { originalPrice, discountedPrice, savingsAmount };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
};

export const formatComboDateText = (combo: ComboDeal): string => {
  if (combo.validFrom && combo.validTo) {
    const fromStr = new Date(combo.validFrom).toLocaleDateString('vi-VN');
    const toStr = new Date(combo.validTo).toLocaleDateString('vi-VN');
    return `Áp dụng: ${fromStr} — ${toStr}`;
  }
  if (combo.shootDate) {
    const shootStr = new Date(combo.shootDate).toLocaleDateString('vi-VN');
    const timeSlotStr = combo.shootTimeSlot ? ` (${combo.shootTimeSlot})` : '';
    return `Lịch chụp: ${shootStr}${timeSlotStr}`;
  }
  return 'Lịch chụp linh hoạt';
};

