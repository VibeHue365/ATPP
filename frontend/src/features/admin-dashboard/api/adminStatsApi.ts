import { API_BASE_URL } from '../../../config/env';
import { httpClient } from '../../../services/httpClient';
import { tokenStorage } from '../../../services/tokenStorage';
import type {
  AdminStats,
  AdminAiInsightsResponse,
  BookingConversionMetrics,
  LowRatingPhotographerReport,
  PhotographerOverviewMetrics,
  ShopsOverviewMetrics,
  UserGrowthMetrics,
} from '../types';

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
  getBookingConversion: () =>
    httpClient.get<BookingConversionMetrics>('/api/v1/admin-stats/booking-conversion'),
  getShopsOverview: () => httpClient.get<ShopsOverviewMetrics>('/api/v1/admin-stats/shops-overview'),
  getPhotographersOverview: () =>
    httpClient.get<PhotographerOverviewMetrics>('/api/v1/admin-stats/photographers-overview'),
  getLowRatingPhotographers: () =>
    httpClient.get<LowRatingPhotographerReport>('/api/v1/admin/photographers/low-rating'),
  getUserGrowth: (from?: string, to?: string) =>
    httpClient.get<UserGrowthMetrics>(
      `/api/v1/admin-stats/user-growth?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`
    ),
  async exportUserGrowth(from?: string, to?: string): Promise<void> {
    const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    const response = await fetch(`${API_BASE_URL}/api/v1/admin-stats/user-growth/export?${params}`, {
      headers: { Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ''}` },
    });
    if (!response.ok) throw new Error('Không thể xuất báo cáo tăng trưởng người dùng.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-growth.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  },
};
