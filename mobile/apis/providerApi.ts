import httpClient from '@/apis/httpClient';
import type {
  ProviderProfile,
  ProviderOverviewResponse,
  ProviderWalletResponse,
  InventorySummaryItem,
} from '@/types/provider';

export interface LocationChangeResolvePayload {
  approved: boolean;
  note?: string;
}

export interface BookingStatusExtraPayload {
  note?: string;
  handoverPhotos?: string[];
  deliveredPhotos?: string[];
  deliveryDriveUrl?: string;
}

export interface IncidentReportPayload {
  bookingId: string;
  bookingItemId: string;
  description: string;
  evidencePhotos: string[];
  requestedAmount: number;
  actionType: 'CLEANING' | 'MAINTENANCE';
}

export const providerApi = {
  /** Thông tin hồ sơ đối tác / cửa hàng */
  getMe: () => httpClient.get<never, ProviderProfile>('/providers/me'),

  /** Tổng quan KPI, lịch trình, tác vụ, hiệu suất đối tác */
  getOverview: (params?: { period?: string; service?: string; month?: string }) =>
    httpClient.get<never, ProviderOverviewResponse>('/providers/me/overview', { params }),

  /** Số dư ví, cọc escrow, tiền chờ đối soát, lịch sử settlements */
  getWallet: () => httpClient.get<never, ProviderWalletResponse>('/providers/me/wallet'),

  /** Thống kê phân tích doanh thu theo kỳ */
  getAnalytics: (period = 'month') =>
    httpClient.get<never, any>(`/providers/me/analytics?period=${period}`),

  /** Tồn kho áo dài theo biến thể và trạng thái */
  getInventorySummary: () =>
    httpClient.get<never, InventorySummaryItem[]>('/inventory/summary'),

  /** Danh sách hiện vật (chip RFID / SKU) chi tiết trong kho */
  getInventoryItems: (params?: {
    productId?: string;
    search?: string;
    status?: string;
    conditionStatus?: string;
    page?: number;
    limit?: number;
  }) =>
    httpClient.get<never, { items: any[]; total: number }>('/inventory', {
      params: { limit: 100, ...params },
    }),

  /** Cập nhật trạng thái của 1 chip hiện vật (AVAILABLE, MAINTENANCE, CLEANING...) */
  updateInventoryItem: (
    itemId: string,
    data: { status?: string; conditionStatus?: string },
  ) => httpClient.patch<never, any>(`/inventory/${itemId}`, data),

  /** Điều chỉnh số lượng biến thể (size + màu) trong kho */
  adjustVariantQuantity: (data: {
    productId: string;
    size: string;
    color: string;
    material?: string | null;
    quantity: number;
  }) => httpClient.patch<never, any>('/inventory/variants/quantity', data),

  /** Danh sách sản phẩm áo dài của đối tác */
  getMyProducts: (params?: {
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    sizes?: string;
    colors?: string;
  }) =>
    httpClient.get<never, { items: any[]; total: number }>('/products/my-listings', {
      params: { limit: 50, ...params },
    }),

  /** Cập nhật thông tin hoặc trạng thái bật/tắt cho thuê của sản phẩm */
  updateProduct: (productId: string, data: Record<string, any>) =>
    httpClient.patch<never, any>(`/products/${productId}`, data),

  /** Xóa sản phẩm */
  deleteProduct: (productId: string) =>
    httpClient.delete<never, any>(`/products/${productId}`),

  /** Thêm mẫu áo dài mới */
  createProduct: (data: Record<string, any>) =>
    httpClient.post<never, any>('/products', data),

  /** Tải lên hình ảnh sản phẩm / gói chụp / album / cửa hàng */
  uploadImages: (formData: FormData) =>
    httpClient.post<never, { urls: string[] }>('/products/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Lấy danh sách danh mục sản phẩm */
  getCategories: () => httpClient.get<never, any[]>('/products/categories'),

  /** Danh sách booking của đối tác (kèm thông tin khách hàng, lịch, địa điểm) */
  getBookings: () => httpClient.get<never, any[]>('/bookings/provider'),

  /** Cập nhật trạng thái đơn hàng (chuẩn Web: hỗ trợ handoverPhotos, deliveredPhotos, deliveryDriveUrl) */
  updateBookingStatus: (
    bookingId: string,
    status: string,
    noteOrExtra?: string | BookingStatusExtraPayload,
  ) => {
    const extra: BookingStatusExtraPayload =
      typeof noteOrExtra === 'string'
        ? { note: noteOrExtra }
        : noteOrExtra || {};
    return httpClient.patch<never, any>(`/bookings/${bookingId}/status`, {
      status,
      ...extra,
    });
  },

  /** Hủy / Từ chối đơn hàng kèm lý do (hoặc báo No-Show kèm reportPhotos) */
  cancelBooking: (
    bookingId: string,
    payload: { reason: string; reportPhotos?: string[] },
  ) => httpClient.post<never, any>(`/bookings/${bookingId}/cancel`, payload),

  /** Tải ảnh bằng chứng bàn giao áo hoặc ảnh kết quả buổi chụp */
  uploadReference: async (formData: FormData): Promise<{ url?: string }> => {
    try {
      return await httpClient.post<never, { url?: string }>(
        '/api/bookings/upload-reference',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    } catch {
      return await httpClient.post<never, { url?: string }>(
        '/bookings/upload-reference',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    }
  },

  /** Duyệt hoặc từ chối yêu cầu dời lịch thuê của khách hàng */
  resolveReschedule: (
    bookingId: string,
    itemIdOrApproved: string | boolean,
    payload?: { approved: boolean; note?: string },
  ) => {
    if (typeof itemIdOrApproved === 'boolean') {
      return httpClient.patch<never, any>(
        `/bookings/${bookingId}/reschedule/resolve`,
        { approved: itemIdOrApproved },
      );
    }
    return httpClient.patch<never, any>(
      `/bookings/${bookingId}/items/${itemIdOrApproved}/reschedule-requests/resolve`,
      payload ?? { approved: true },
    );
  },

  /** Tải ảnh bằng chứng sự cố / hư hỏng trang phục */
  uploadIncidentEvidence: (formData: FormData) =>
    httpClient.post<never, { urls?: string[] }>(
      '/api/disputes/incidents/upload-evidence',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  /** Gửi báo cáo sự cố / yêu cầu khấu trừ tiền cọc Escrow */
  reportIncident: (payload: IncidentReportPayload) =>
    httpClient.post<never, any>('/api/disputes/incidents', payload),

  /** Bật/tắt trạng thái nhận đơn trực tiếp hoặc cập nhật hồ sơ tiệm */
  updateProfile: (data: Partial<ProviderProfile> & Record<string, any>) =>
    httpClient.patch<never, ProviderProfile>('/providers/me', data),

  /** Lấy danh sách cấu hình lịch làm việc & ngày khóa của đối tác */
  listSchedules: () => httpClient.get<never, any>('/providers/me/schedules'),

  /** Khóa hoặc mở khóa một ngày cụ thể trên lịch */
  blockDate: (payload: Record<string, any>) =>
    httpClient.post<never, any>('/providers/me/schedules/specific-date', payload),

  /** Lưu lịch làm việc cố định hàng tuần */
  saveRecurringSchedules: (payload: {
    dayOfWeeks: number[];
    workingHours: Array<{ start: string; end: string }>;
    capability?: string;
  }) =>
    httpClient.post<never, any>('/providers/me/schedules/recurring/bulk', payload),

  /** Danh sách Voucher khuyến mãi của tiệm */
  listVouchers: () => httpClient.get<never, any[]>('/promotions/provider'),

  /** Tạo Voucher khuyến mãi mới */
  createVoucher: (payload: Record<string, any>) =>
    httpClient.post<never, any>('/promotions', payload),

  /** Cập nhật trạng thái hoặc thông tin Voucher */
  updateVoucher: (id: string, payload: Record<string, any>) =>
    httpClient.put<never, any>(`/promotions/${id}`, payload),

  /** Xóa Voucher khuyến mãi */
  deleteVoucher: (id: string) =>
    httpClient.delete<never, any>(`/promotions/${id}`),

  /** Lấy Chiến dịch Flash Sale đang kích hoạt của tiệm */
  getActiveCampaign: () => httpClient.get<never, any>('/campaigns/mine'),

  /** Tạo Chiến dịch giảm giá toàn cửa hàng */
  createCampaign: (payload: {
    occasion: string;
    discountPercent: number;
    startDate: string;
    endDate: string;
  }) => httpClient.post<never, any>('/campaigns', payload),

  /** Tắt Chiến dịch giảm giá đang kích hoạt */
  deactivateCampaign: () => httpClient.delete<never, any>('/campaigns/active'),

  /** Danh sách Gói Combo (Áo dài + Chụp ảnh) của tiệm */
  listCombos: () => httpClient.get<never, any[]>('/combo-promotions/my'),

  /** Tạo Gói Combo mới */
  createCombo: (payload: Record<string, any>) =>
    httpClient.post<never, any>('/combo-promotions', payload),

  /** Cập nhật Gói Combo */
  updateCombo: (id: string, payload: Record<string, any>) =>
    httpClient.put<never, any>(`/combo-promotions/${id}`, payload),

  /** Xóa Gói Combo */
  deleteCombo: (id: string) =>
    httpClient.delete<never, any>(`/combo-promotions/${id}`),

  /** Lấy lịch sử thay đổi giá của mẫu sản phẩm */
  getProductPriceHistory: (productId: string, page = 1, limit = 10) =>
    httpClient.get<never, any>(
      `/products/my-listings/${productId}/price-history?page=${page}&limit=${limit}`,
    ),

  /** Thống kê & danh sách đánh giá của khách dành cho tiệm */
  getReviewStats: () => httpClient.get<never, any>('/reviews/stats'),

  /** Phản hồi (Reply) đánh giá của khách hàng */
  replyReview: (reviewId: string, reply: string) =>
    httpClient.post<never, any>(`/reviews/${reviewId}/reply`, { reply }),

  /** Báo cáo đánh giá vi phạm */
  reportReview: (reviewId: string, reason = 'Spam, ngôn từ không phù hợp') =>
    httpClient.post<never, any>(`/reviews/${reviewId}/report`, { reason }),

  /** Xem điểm tín nhiệm (Trust Score) của khách hàng */
  getCustomerTrust: (customerId: string) =>
    httpClient.get<never, any>(`/reviews/customer/${customerId}/trust`),

  /** Chấm điểm tín nhiệm khách hàng sau khi hoàn tất đơn */
  rateCustomer: (payload: {
    bookingId: string;
    rating: number;
    comment: string;
  }) => httpClient.post<never, any>('/reviews/customer', payload),

  /** Danh sách gói chụp ảnh của đối tác/thợ ảnh */
  listPhotographyPackages: () =>
    httpClient.get<never, any[]>('/providers/me/photography-packages'),

  /** Tạo gói chụp ảnh mới */
  createPhotographyPackage: (payload: Record<string, any>) =>
    httpClient.post<never, any>('/providers/me/photography-packages', payload),

  /** Cập nhật gói chụp ảnh */
  updatePhotographyPackage: (id: string, payload: Record<string, any>) =>
    httpClient.patch<never, any>(`/providers/me/photography-packages/${id}`, payload),

  /** Bật nhận khách (Publish) gói chụp ảnh */
  publishPhotographyPackage: (id: string) =>
    httpClient.post<never, any>(`/providers/me/photography-packages/${id}/publish`, {}),

  /** Tạm ngưng nhận khách (Unpublish) gói chụp ảnh */
  unpublishPhotographyPackage: (id: string) =>
    httpClient.post<never, any>(`/providers/me/photography-packages/${id}/unpublish`, {}),

  /** Xóa gói chụp ảnh */
  deletePhotographyPackage: (id: string) =>
    httpClient.delete<never, any>(`/providers/me/photography-packages/${id}`),

  /** Danh sách album Portfolio của đối tác/thợ ảnh */
  listPortfolioItems: () =>
    httpClient.get<never, any[]>('/providers/me/portfolio-items'),

  /** Tạo album Portfolio mới */
  createPortfolioItem: (payload: Record<string, any>) =>
    httpClient.post<never, any>('/providers/me/portfolio-items', payload),

  /** Duyệt hoặc từ chối đề xuất đổi địa điểm chụp do thời tiết mưa */
  resolveLocationChange: (
    bookingId: string,
    scheduleId: string,
    payload: LocationChangeResolvePayload,
  ) =>
    httpClient.patch<never, any>(
      `/bookings/${bookingId}/photoshoot-schedules/${scheduleId}/location-change-requests/resolve`,
      payload,
    ),

  /** Bắt đầu ca chụp ảnh (chuyển trạng thái booking sang IN_PROGRESS) */
  startSession: (bookingId: string) =>
    httpClient.patch<never, any>(`/bookings/${bookingId}/status`, {
      status: 'IN_PROGRESS',
    }),

  /** Xác nhận giao đồ trực tiếp cho khách */
  markPickedUp: (bookingId: string, itemId: string, evidence?: any) =>
    httpClient.post<never, any>(
      `/bookings/${bookingId}/items/${itemId}/rental/picked-up`,
      evidence ?? {},
    ),

  /** Xác nhận khách đã trả đồ */
  markReturned: (bookingId: string, itemId: string, evidence?: any) =>
    httpClient.post<never, any>(
      `/bookings/${bookingId}/items/${itemId}/rental/returned`,
      evidence ?? {},
    ),

  /** Hoàn trả hoặc đối soát tiền cọc */
  settleDeposit: (bookingId: string, itemId: string, data?: any) =>
    httpClient.post<never, any>(
      `/bookings/${bookingId}/items/${itemId}/rental/deposit/settle`,
      data ?? {},
    ),

  /** Lấy hồ sơ KYC Đối tác hiện tại */
  getCurrentVerification: () =>
    httpClient.get<never, any>('/provider-verifications/me/current'),

  /** Khởi tạo hồ sơ đăng ký Đối tác (KYC) */
  createVerification: (payload: { requestedCapabilities: string[] }) =>
    httpClient.post<never, any>('/provider-verifications', payload),

  /** Cập nhật thông tin hồ sơ đăng ký Đối tác (KYC) */
  updateVerification: (id: string, payload: Record<string, any>) =>
    httpClient.patch<never, any>(`/provider-verifications/${id}`, payload),

  /** Đồng ý điều khoản Đối tác TàGo */
  acceptVerificationConsent: (id: string, version = '1.0') =>
    httpClient.post<never, any>(`/provider-verifications/${id}/consent`, { version }),

  /** Tải lên giấy tờ định danh KYC (CCCD_FRONT, CCCD_BACK, SELFIE, BUSINESS_LICENSE) */
  uploadVerificationDocument: (id: string, formData: FormData) =>
    httpClient.post<never, any>(`/provider-verifications/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Gửi duyệt hồ sơ KYC Đối tác */
  submitVerification: (id: string) =>
    httpClient.post<never, any>(`/provider-verifications/${id}/submit`, {}),
};
