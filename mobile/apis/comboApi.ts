import httpClient from '@/apis/httpClient';
import type { ComboDeal } from '@/types/combo';

export const comboApi = {
  list: () => httpClient.get<never, ComboDeal[]>('/combo-promotions/public'),
  detail: (id: string) => httpClient.get<never, ComboDeal>(`/combo-promotions/${id}`),
};

