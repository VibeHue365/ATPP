import { httpClient } from '../../../services/httpClient';
import type {
  AdminCategoryListResponse,
  Category,
  CategoryListResponse,
  CategoryQuery,
  CategoryStatus,
  ServiceCategoryType,
} from '../types';

function queryString(query: CategoryQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const value = params.toString();
  return value ? `?${value}` : '';
}

export const categoryService = {
  async getPublic(query: CategoryQuery = {}): Promise<Category[]> {
    const response = await httpClient.get<CategoryListResponse>(
      `/categories${queryString(query)}`,
    );
    return response.data;
  },

  getAdmin(query: CategoryQuery = {}) {
    return httpClient.get<AdminCategoryListResponse>(
      `/admin/categories${queryString(query)}`,
    );
  },

  create(payload: {
    name: string;
    slug?: string;
    type: ServiceCategoryType;
    parentId?: string;
    description?: string;
    iconUrl?: string;
    coverImageUrl?: string;
    displayOrder?: number;
    metadata?: Record<string, string | undefined>;
  }) {
    return httpClient.post<Category>('/admin/categories', payload);
  },

  update(id: string, payload: Record<string, unknown>) {
    return httpClient.patch<Category>(`/admin/categories/${id}`, payload);
  },

  updateStatus(id: string, status: CategoryStatus, reason?: string) {
    return httpClient.patch<Category>(`/admin/categories/${id}/status`, {
      status,
      reason,
    });
  },

  reorder(
    items: Array<{ id: string; displayOrder: number }>,
    type: ServiceCategoryType,
    reason?: string,
  ) {
    return httpClient.patch<{ data: Category[] }>(
      '/admin/categories/reorder',
      { items, type, reason },
    );
  },

  remove(id: string) {
    return httpClient.delete<{ success: boolean }>(`/admin/categories/${id}`);
  },
};

const categoryErrorMessages: Record<string, string> = {
  CATEGORY_SLUG_ALREADY_EXISTS: 'Slug danh mục đã tồn tại.',
  CATEGORY_HAS_ACTIVE_CHILDREN:
    'Không thể thực hiện vì danh mục còn danh mục con đang hoạt động.',
  CATEGORY_IN_USE_BY_PRODUCTS:
    'Không thể xóa vì danh mục đang được sản phẩm sử dụng.',
  CATEGORY_IN_USE_BY_PACKAGES:
    'Không thể xóa vì danh mục đang được gói chụp ảnh sử dụng.',
  CATEGORY_MAX_DEPTH_EXCEEDED: 'Danh mục chỉ hỗ trợ tối đa hai tầng.',
  CATEGORY_PARENT_TYPE_MISMATCH: 'Danh mục cha phải cùng loại.',
  CATEGORY_PARENT_NOT_ACTIVE: 'Danh mục cha đang không hoạt động.',
  CATEGORY_PARENT_CYCLE: 'Không thể tạo vòng lặp danh mục cha-con.',
};

export function categoryErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  return categoryErrorMessages[message] || message || fallback;
}
