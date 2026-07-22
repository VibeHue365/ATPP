export type ServiceCategoryType =
  | 'AODAI_CATEGORY'
  | 'PHOTOGRAPHY_CATEGORY'
  | 'CONCEPT'
  | 'STYLE'
  | 'EVENT';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface CategoryMetadata {
  color?: string;
  occasion?: string;
  season?: string;
  /** IDs of photography service categories this tag should be suggested for. */
  photographyCategoryIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: ServiceCategoryType;
  description?: string | null;
  iconUrl?: string | null;
  coverImageUrl?: string | null;
  parentId?: string | null;
  status: CategoryStatus;
  displayOrder: number;
  metadata?: CategoryMetadata;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryListResponse {
  data: Category[];
}

export interface AdminCategoryListResponse extends CategoryListResponse {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryQuery {
  type?: ServiceCategoryType;
  status?: CategoryStatus;
  keyword?: string;
  includeDeleted?: boolean;
  includeTree?: boolean;
  page?: number;
  limit?: number;
}
