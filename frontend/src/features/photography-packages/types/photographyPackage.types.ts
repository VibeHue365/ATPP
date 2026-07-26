export type PhotographyPackageStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface PhotographyPackage {
  _id: string;
  categoryId?: string | null;
  conceptCategoryIds?: string[];
  styleCategoryIds?: string[];
  eventCategoryIds?: string[];
  name: string;
  description?: string | null;
  price: number;
  durationHours: number;
  maxPeople?: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  travelFeeNotes?: string | null;
  overtimeFeePerHour?: number;
  images: string[];
  status: PhotographyPackageStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface PhotographyPackagePayload {
  categoryId?: string | null;
  conceptCategoryIds?: string[];
  styleCategoryIds?: string[];
  eventCategoryIds?: string[];
  name: string;
  description?: string;
  price: number;
  durationHours: number;
  maxPeople?: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  travelFeeNotes?: string;
  overtimeFeePerHour?: number;
  images: string[];
  status?: PhotographyPackageStatus;
}
