import { httpClient } from '../../../services/httpClient';
import type { Banner, BannerPlacement, UpdateBannerPayload } from '../types';

export const bannersApi = {
  /** Lấy banner theo placement (cho khách hàng công khai) */
  async getByPlacement(placement: BannerPlacement): Promise<Banner | null> {
    try {
      const res = await httpClient.get<Banner | null>(`/banners/placement/${placement}`);
      return res;
    } catch {
      return null;
    }
  },

  /** Lấy danh sách banner (cho Admin Dashboard) */
  async getAdminBanners(): Promise<Banner[]> {
    return httpClient.get<Banner[]>('/admin/banners');
  },

  /** Upload ảnh banner lên Cloudinary */
  async uploadBannerImage(file: File): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return httpClient.post<{ url: string; key: string }>('/admin/banners/upload', formData);
  },

  /** Cập nhật banner cho 1 placement */
  async updateAdminBanner(placement: BannerPlacement, payload: UpdateBannerPayload): Promise<Banner> {
    return httpClient.put<Banner>(`/admin/banners/${placement}`, payload);
  },

  /** Xóa banner */
  async deleteAdminBanner(placement: BannerPlacement): Promise<{ success: boolean }> {
    return httpClient.delete<{ success: boolean }>(`/admin/banners/${placement}`);
  },
};
