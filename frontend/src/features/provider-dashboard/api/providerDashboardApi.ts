
import { httpClient } from '../../../services/httpClient';

type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

// Endpoint spelling (including legacy /api prefixes), request options and generic
// response types intentionally match the original dashboard. Use the shared client
// for authentication, deduplication, timeouts and FormData handling.

export const providerApi = {
  getAnalyticsPeriod<T = unknown>(period: string, ...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/analytics?period=${period}`, ...args);
  },
  saveRecurringSchedules<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/providers/me/schedules/recurring/bulk`, ...args);
  },
  blockDate<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/providers/me/schedules/specific-date`, ...args);
  },
  getProfile<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me`, ...args);
  },
  listPhotographyPackages<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/photography-packages`, ...args);
  },
  listSchedules<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/schedules`, ...args);
  },
  getAnalytics<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/analytics`, ...args);
  },
  updateProfile<T = unknown>(...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/providers/me`, ...args);
  },
};

export const promotionsApi = {
  getCampaign<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/campaigns/mine`, ...args);
  },
  createCampaign<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/campaigns`, ...args);
  },
  deactivateCampaign<T = unknown>(...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/campaigns/active`, ...args);
  },
  listCombos<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/combo-promotions/my`, ...args);
  },
  listVouchers<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/promotions/provider`, ...args);
  },
  createVoucher<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/promotions`, ...args);
  },
  deleteVoucher<T = unknown>(voucherId: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/promotions/${voucherId}`, ...args);
  },
  updateVoucher<T = unknown>(voucherId: string, ...args: Tail<Parameters<typeof httpClient.put<T>>>) {
    return httpClient.put<T>(`/promotions/${voucherId}`, ...args);
  },
  updateCombo<T = unknown>(comboId: string, ...args: Tail<Parameters<typeof httpClient.put<T>>>) {
    return httpClient.put<T>(`/combo-promotions/${comboId}`, ...args);
  },
  createCombo<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/combo-promotions`, ...args);
  },
  deleteCombo<T = unknown>(comboId: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/combo-promotions/${comboId}`, ...args);
  },
};

export const productsApi = {
  listFiltered<T = unknown>(encodedSearch: string, sortBy: string, page: number, limit: number, sizes: string, colors: string, ...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/products/my-listings?search=${encodedSearch}&sortBy=${sortBy}&page=${page}&limit=${limit}&sizes=${sizes}&colors=${colors}`, ...args);
  },
  listCategories<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/products/categories`, ...args);
  },
  remove<T = unknown>(productId: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/products/${productId}`, ...args);
  },
  uploadImages<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/products/upload`, ...args);
  },
  uploadVideos<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/products/upload-videos`, ...args);
  },
  update<T = unknown>(productId: string, ...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/products/${productId}`, ...args);
  },
  create<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/products`, ...args);
  },
  listForCombos<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/products/my-listings?limit=200`, ...args);
  },
  listForInventory<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/products/my-listings?limit=999`, ...args);
  },
};

export const inventoryApi = {
  getSummary<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/inventory/summary`, ...args);
  },
  listFiltered<T = unknown>(encodedSearch: string, status: string, conditionStatus: string, sortBy: string, page: number, limit: number, ...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/inventory?search=${encodedSearch}&status=${status}&conditionStatus=${conditionStatus}&sortBy=${sortBy}&page=${page}&limit=${limit}`, ...args);
  },
  createItem<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/inventory`, ...args);
  },
  updateItem<T = unknown>(itemId: string, ...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/inventory/${itemId}`, ...args);
  },
  deleteItem<T = unknown>(itemId: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/inventory/${itemId}`, ...args);
  },
  adjustVariantQuantity<T = unknown>(...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/inventory/variants/quantity`, ...args);
  },
  removeVariant<T = unknown>(...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/inventory/variants/remove`, ...args);
  },
};

export const portfolioApi = {
  listItems<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/portfolio-items`, ...args);
  },
  addLegacyImage<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/providers/me/portfolio`, ...args);
  },
  deleteLegacyImage<T = unknown>(encodedImageUrl: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/providers/me/portfolio?imageUrl=${encodedImageUrl}`, ...args);
  },
  updateItem<T = unknown>(itemId: string, ...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/providers/me/portfolio-items/${itemId}`, ...args);
  },
  createItem<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/providers/me/portfolio-items`, ...args);
  },
  deleteItem<T = unknown>(itemId: string, ...args: Tail<Parameters<typeof httpClient.delete<T>>>) {
    return httpClient.delete<T>(`/providers/me/portfolio-items/${itemId}`, ...args);
  },
};

export const reviewsApi = {
  getStats<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/reviews/stats`, ...args);
  },
  reply<T = unknown>(reviewId: string, ...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/reviews/${reviewId}/reply`, ...args);
  },
  report<T = unknown>(reviewId: string, ...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/reviews/${reviewId}/report`, ...args);
  },
  getUserTrust<T = unknown>(customerId: string, ...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/users/${customerId}/trust-score`, ...args);
  },
  rateCustomer<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/reviews/customer`, ...args);
  },
  getCustomerReviewTrust<T = unknown>(customerId: string, ...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/reviews/customer/${customerId}/trust`, ...args);
  },
};

export const bookingsApi = {
  list<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/bookings/provider`, ...args);
  },
  uploadReference<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/api/bookings/upload-reference`, ...args);
  },
  updateStatus<T = unknown>(bookingId: string, ...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/bookings/${bookingId}/status`, ...args);
  },
  cancel<T = unknown>(bookingId: string, ...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/bookings/${bookingId}/cancel`, ...args);
  },
  uploadEvidence<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/upload`, ...args);
  },
  resolveReschedule<T = unknown>(bookingId: string, itemId: string, ...args: Tail<Parameters<typeof httpClient.patch<T>>>) {
    return httpClient.patch<T>(`/bookings/${bookingId}/items/${itemId}/reschedule-requests/resolve`, ...args);
  },
  uploadIncidentEvidence<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/api/disputes/incidents/upload-evidence`, ...args);
  },
  reportIncident<T = unknown>(...args: Tail<Parameters<typeof httpClient.post<T>>>) {
    return httpClient.post<T>(`/api/disputes/incidents`, ...args);
  },
};

export const notificationsApi = {
  list<T = unknown>(...args: Tail<Parameters<typeof httpClient.request<T>>>) {
    return httpClient.request<T>(`/notifications`, ...args);
  },
  markRead<T = unknown>(notificationId: string, ...args: Tail<Parameters<typeof httpClient.request<T>>>) {
    return httpClient.request<T>(`/notifications/${notificationId}/read`, ...args);
  },
  markAllRead<T = unknown>(...args: Tail<Parameters<typeof httpClient.request<T>>>) {
    return httpClient.request<T>(`/notifications/read-all`, ...args);
  },
};

export const payoutsApi = {
  getWallet<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/providers/me/wallet`, ...args);
  },
  listSettlements<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/provider/settlements`, ...args);
  },
  listLegacyTransfers<T = unknown>(...args: Tail<Parameters<typeof httpClient.get<T>>>) {
    return httpClient.get<T>(`/payments/settlement-transfers/provider`, ...args);
  },
};
