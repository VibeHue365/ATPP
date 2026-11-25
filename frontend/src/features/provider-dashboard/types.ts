export interface Order {
  _id: string;
  id?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAvatar?: string;
  customerInitials: string;
  customerType?: string;
  productName: string;
  serviceName?: string;
  orderDate: string;
  updatedDate?: string;
  total: string;
  status: string;
  totalAmount?: number;
  createdAt?: string;
  rawOrderDate?: string;
  photosApproved?: boolean;
  customerId?: any;
  items?: any[];
  schedules?: Array<{ status?: string;[key: string]: any }>;
  depositTotal?: number;
  startDate?: string;
  endDate?: string;
  rawStatus?: string;
  bookingType?: 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO' | string;
  pickupLocation?: string;
  customerNotes?: string;
  pricingSummary?: any;
  paymentSummary?: any;
  bookingCode?: string;
  deliveredPhotos?: string[];
  handoverPhotos?: string[];
  customerIdentityCard?: {
    hasIdentityCard?: boolean;
    frontImage?: string | null;
    backImage?: string | null;
    idNumber?: string | null;
    fullName?: string | null;
    capturedAt?: string | Date | null;
    capturedBy?: string | null;
    notes?: string | null;
  } | null;
  deliveryDriveUrl?: string;
  overdueTracking?: {
    isOverdue?: boolean;
    overdueSince?: string | Date | null;
    minutesOverdue?: number;
    calculatedLateFee?: number;
    maxLateFeeCap?: number;
    notificationsSent?: {
      fifteenMin?: boolean;
      oneHour?: boolean;
      sixHour?: boolean;
      twentyFourHour?: boolean;
    };
    accountRestrictedAt?: string | Date | null;
    lostItemProposedAt?: string | Date | null;
    lostItemConfirmedAt?: string | Date | null;
    lostItemConfirmedBy?: string | null;
    contactAttemptsCount?: number;
    notes?: string | null;
  } | null;
  dominoRecovery?: {
    hasConflict?: boolean;
    sourceOverdueBookingId?: string | null;
    sourceOverdueBookingCode?: string | null;
    actionType?: 'AUTO_SWAP' | 'ALTERNATIVE_SELECTION' | 'FULL_REFUND' | null;
    swappedInventoryItemId?: string | null;
    alternativeProductIds?: string[];
    status?: 'DETECTED' | 'SWAPPED' | 'OFFERED' | 'ACCEPTED_ALTERNATIVE' | 'REFUNDED' | 'DISMISSED';
    offeredAt?: string | Date | null;
    expiresAt?: string | Date | null;
    selectedAlternativeId?: string | null;
    resolvedAt?: string | Date | null;
  } | null;
  pickupDamageReport?: {
    reportedAt: string;
    description: string;
    evidencePhotos: string[];
  } | null;
  incident?: any;
  dispute?: any;
  cancellation?: {
    cancelledBy?: any;
    reason?: string;
    cancelledAt?: string | Date;
    refundAmount?: number;
  } | null;
  cancellationReason?: string;
  cancelReason?: string;
  statusTimeline?: Array<{
    status: string;
    changedAt: string | Date;
    note?: string;
    changedBy?: any;
  }>;
}

export interface Product {
  sizeChartPolicyVersion?: number;
  _id: string;
  name: string;
  providerId?: string | { _id?: string; [key: string]: any };
  categoryId: {
    _id: string;
    name: string;
  } | string;
  description?: string;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  videos?: string[];
  basePrice: number;
  depositAmount: number;
  replacementValue?: number | null;
  sizes: string[];
  colors: string[];
  materials: string[];
  style?: string;
  occasions?: string[];
  styleCategoryIds?: Array<string | { _id?: string; id?: string }>;
  eventCategoryIds?: Array<string | { _id?: string; id?: string }>;
  customTags?: Array<{
    label: string;
    normalizedLabel: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    mappedTagCode?: string | null;
  }>;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  moderationStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'HIDDEN';
  moderationReason?: string | null;
  taggingDecisionVersion?: number;
  rentalPriceSuggestion?: {
    rentalCount: number;
    condition: 'NEW' | 'GOOD' | 'MINOR_DAMAGE' | 'LOCKED' | 'RETIRED' | null;
    eligible: boolean;
    discountPercent: number;
    suggestedPrice: number | null;
    reason: string | null;
    reminderNumber: 1 | 2 | 3 | null;
  };
}

export interface PortfolioItem {
  _id: string;
  title: string;
  description?: string | null;
  images: string[];
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  moderationReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type CancellationRefundRule = {
  noticeDays: number;
  refundPercent: number;
};

export type VariantRow = { size: string; color: string; material: string; quantity: number; condition: string };
