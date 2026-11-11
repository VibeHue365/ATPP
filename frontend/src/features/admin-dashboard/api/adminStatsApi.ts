import { httpClient } from '../../../services/httpClient';
import type { AdminStats, AdminAiInsightsResponse } from '../types';

export const adminStatsApi = {
  get: (period = 'month') => httpClient.get<AdminStats>(`/admin/stats?period=${period}`),
  getAiAnalytics: (question?: string) =>
    httpClient.get<AdminAiInsightsResponse>(
      `/admin/stats/ai-analytics${question ? `?question=${encodeURIComponent(question)}` : ''}`
    ),
  askCopilot: (question: string) =>
    httpClient.post<AdminAiInsightsResponse>('/admin/stats/ai-analytics/ask', { question }),
};
