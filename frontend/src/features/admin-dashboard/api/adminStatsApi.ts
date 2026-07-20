import { httpClient } from '../../../services/httpClient';
import type { AdminStats } from '../types';

export const adminStatsApi = {
  get: () => httpClient.get<AdminStats>('/admin/stats'),
};