export type PhotographyPackageStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type PhotographyPricingUnit = 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';

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
  pricingUnit?: PhotographyPricingUnit;
  includedDurationMinutes?: number | null;
  maxPeople?: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  travelFeeNotes?: string | null;
  overtimeFeePerHour?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
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
  pricingUnit?: PhotographyPricingUnit;
  maxPeople?: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  travelFeeNotes?: string;
  overtimeFeePerHour?: number;
  maxOvertimeMinutes?: number;
  images: string[];
  status?: PhotographyPackageStatus;
}
