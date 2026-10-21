import { httpClient } from '../../../../services/httpClient';
import type { ProviderOverviewResponse } from '../types';

export interface GetOverviewParams {
  period?: 'week' | 'month' | 'year';
  service?: string;
  month?: string;
  signal?: AbortSignal;
}

export const overviewApi = {
  getOverview(params?: GetOverviewParams) {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set('period', params.period);
    if (params?.service && params.service !== 'all') {
      searchParams.set('service', params.service);
    }
    if (params?.month) {
      searchParams.set('month', params.month);
    }
    const queryString = searchParams.toString();
    const url = `/providers/me/overview${queryString ? `?${queryString}` : ''}`;
    return httpClient.get<ProviderOverviewResponse>(url, {
      signal: params?.signal,
    });
  },
};
