export type PhotographyPackageStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type PhotographyPricingUnit = 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';

export interface PhotographyPackage {
  _id: string;
  serviceGroupId?: string | null;
  serviceName?: string | null;
  planName?: string | null;
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
  includedSessionCount?: number | null;
  includedDayCount?: number | null;
  additionalSessionFee?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
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
  serviceGroupId?: string;
  serviceName?: string;
  planName?: string;
  categoryId?: string | null;
  conceptCategoryIds?: string[];
  styleCategoryIds?: string[];
  eventCategoryIds?: string[];
  name: string;
  description?: string;
  price: number;
  durationHours: number;
  pricingUnit: PhotographyPricingUnit;
  includedDurationMinutes: number;
  includedSessionCount?: number;
  includedDayCount?: number;
  additionalSessionFee?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
  maxPeople?: number;
  editedPhotosCount: number;
  rawPhotosCount?: number;
  deliveryDays: number;
  travelFeeNotes?: string;
  overtimeFeePerHour?: number;
  images: string[];
  status?: PhotographyPackageStatus;
}
