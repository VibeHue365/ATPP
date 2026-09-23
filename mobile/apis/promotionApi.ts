import httpClient from '@/apis/httpClient';

export interface PromotionValidation {
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
}

export const promotionApi = {
  validate: (code: string, orderValue: number, providerIds: string[]) =>
    httpClient.post<never, PromotionValidation>('/promotions/validate', { code, orderValue, providerIds }),
};
