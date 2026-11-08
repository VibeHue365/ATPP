import httpClient from '@/apis/httpClient';

export interface PromotionValidation {
  id?: string;
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
}

export interface PublicPromotion {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number;
  startDate?: string;
  endDate?: string;
  providerId?: string | null;
}

export const promotionApi = {
  validate: (code: string, orderValue: number, providerIds: string[]) =>
    httpClient.post<never, PromotionValidation>('/promotions/validate', { code, orderValue, providerIds }),
  listPublic: () =>
    httpClient.get<never, PublicPromotion[]>('/promotions/public'),
  listByProvider: (providerId: string) =>
    httpClient.get<never, PublicPromotion[]>(`/promotions/provider-promotions/${providerId}`),
};
