import { httpClient } from '../../../services/httpClient';
import type { AdminStats, BookingConversionMetrics, ShopsOverviewMetrics } from '../types';

export const adminStatsApi = {
  get: (period = 'month') => httpClient.get<AdminStats>(`/admin/stats?period=${period}`),
  getBookingConversion: () => httpClient.get<BookingConversionMetrics>('/api/v1/admin-stats/booking-conversion'),
  getShopsOverview: () => httpClient.get<ShopsOverviewMetrics>('/api/v1/admin-stats/shops-overview'),
};
