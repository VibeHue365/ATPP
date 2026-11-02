import httpClient from '@/apis/httpClient';
import type { CartItem } from '@/types/cart';

export type PromotionBookingType = 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO';

interface PromotionSummary {
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
}

/** A voucher the backend accepted for this cart, with the discount it calculated. */
export interface AppliedPromotion {
  code: string;
  name: string;
  discountAmount: number;
}

interface ApplicablePromotionsResponse {
  applicable?: Array<{ promotion: PromotionSummary; discountAmount: number }>;
  ineligible?: Array<{ promotion: PromotionSummary; reason: string }>;
}

/** Same booking type rule as the web cart. */
export function promotionBookingType(items: CartItem[]): PromotionBookingType {
  const hasPhoto = items.some(item => item.itemType === 'PHOTOGRAPHY_PACKAGE');
  const hasRental = items.some(item => item.itemType === 'PRODUCT');
  return hasPhoto && hasRental ? 'COMBO' : hasPhoto ? 'PHOTOGRAPHY' : 'AODAI_RENTAL';
}

export const promotionApi = {
  /** Checks a typed code against `/promotions/applicable`, the endpoint the web cart uses. */
  apply: async (code: string, items: CartItem[]): Promise<AppliedPromotion> => {
    const normalized = code.trim().toUpperCase();
    const eligibleItems = items.filter(item => item.itemType === 'PRODUCT' || item.itemType === 'PHOTOGRAPHY_PACKAGE');
    const result = await httpClient.post<never, ApplicablePromotionsResponse>('/promotions/applicable', {
      bookingType: promotionBookingType(eligibleItems),
      items: eligibleItems.map(item => ({
        id: item.id,
        productId: item.productId ?? undefined,
        photographyPackageId: item.photographyPackageId ?? undefined,
        providerId: String(item.metadata?.providerId ?? ''),
        itemType: item.itemType,
        unitPrice: item.basePrice ?? 0,
        quantity: item.quantity || 1,
        depositAmount: item.depositAmount ?? 0,
      })),
      travelFee: 0,
      serviceFee: 0,
    });
    const match = result.applicable?.find(entry => entry.promotion.code.toUpperCase() === normalized);
    if (match) return { code: match.promotion.code, name: match.promotion.name, discountAmount: match.discountAmount };
    const rejected = result.ineligible?.find(entry => entry.promotion.code.toUpperCase() === normalized);
    throw new Error(rejected?.reason || 'Mã ưu đãi không tồn tại hoặc đã hết hạn');
  },
};
