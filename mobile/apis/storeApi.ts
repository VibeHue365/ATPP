import httpClient from '@/apis/httpClient';
import type { Product } from '@/types/product';
import type { ProviderStore } from '@/types/store';

export const storeApi = {
  detail: (providerId:string) => httpClient.get<never,ProviderStore>(`/products/store-info/${providerId}`),
  products: (providerId:string) => httpClient.get<never,Product[]>(`/products?providerId=${encodeURIComponent(providerId)}`),
};

