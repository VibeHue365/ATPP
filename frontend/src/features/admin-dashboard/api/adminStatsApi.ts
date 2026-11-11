import { httpClient } from '../../../services/httpClient';
import type { AdminStats, AdminAiInsightsResponse } from '../types';

export interface CustomerDetailResponse {
  user: {
    id: string;
    fullName: string;
    avatar: string;
    email: string;
    phone: string;
    createdAt?: string;
    updatedAt?: string;
    isVerified: boolean;
    status: 'ACTIVE' | 'SUSPENDED';
    address: string;
  };
  stats: {
    totalBookings: number;
    completedBookings: number;
    totalSpent: number;
    totalRefunds: number;
    totalDisputes: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  bookings: Array<{
    id: string;
    bookingCode: string;
    status: string;
    totalAmount: number;
    depositAmount: number;
    createdAt: string;
    items?: Array<{
      title?: string;
      productName?: string;
      quantity?: number;
      price?: number;
    }>;
  }>;
  refunds: Array<{
    id: string;
    refundCode: string;
    amount: number;
    status: string;
    method?: string;
    createdAt: string;
  }>;
  disputes: Array<{
    id: string;
    disputeCode: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

export const adminStatsApi = {
  get: (period = 'month') => httpClient.get<AdminStats>(`/admin/stats?period=${period}`),
  getAiAnalytics: (question?: string) =>
    httpClient.get<AdminAiInsightsResponse>(
      `/admin/stats/ai-analytics${question ? `?question=${encodeURIComponent(question)}` : ''}`
    ),
  askCopilot: (question: string) =>
    httpClient.post<AdminAiInsightsResponse>('/admin/stats/ai-analytics/ask', { question }),
  getCustomerDetail: (id: string) => httpClient.get<CustomerDetailResponse>(`/admin/stats/customers/${id}/detail`),
};
