import { API_BASE_URL } from "../../../config/env";
import { httpClient } from "../../../services/httpClient";
import { tokenStorage } from "../../../services/tokenStorage";
import type {
  AdminStats,
  BookingConversionMetrics,
  PhotographerOverviewMetrics,
  ShopsOverviewMetrics,
  UserGrowthMetrics,
} from "../types";

export const adminStatsApi = {
  get: (period = "month") =>
    httpClient.get<AdminStats>(`/admin/stats?period=${period}`),
  getBookingConversion: () =>
    httpClient.get<BookingConversionMetrics>(
      "/api/v1/admin-stats/booking-conversion",
    ),
  getShopsOverview: () =>
    httpClient.get<ShopsOverviewMetrics>("/api/v1/admin-stats/shops-overview"),
  getPhotographersOverview: () =>
    httpClient.get<PhotographerOverviewMetrics>(
      "/api/v1/admin-stats/photographers-overview",
    ),
  getUserGrowth: (from?: string, to?: string) =>
    httpClient.get<UserGrowthMetrics>(
      `/api/v1/admin-stats/user-growth?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`,
    ),
  async exportUserGrowth(from?: string, to?: string): Promise<void> {
    const params = new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin-stats/user-growth/export?${params}`,
      {
        headers: {
          Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ""}`,
        },
      },
    );
    if (!response.ok)
      throw new Error("Không thể xuất báo cáo tăng trưởng người dùng.");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "user-growth.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  },
};
