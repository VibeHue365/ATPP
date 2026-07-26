import { httpClient } from '../../../services/httpClient';
import type { AdminStats } from '../types';

export const adminStatsApi = {
  get: (period = 'month') => httpClient.get<AdminStats>(`/admin/stats?period=${period}`),
};