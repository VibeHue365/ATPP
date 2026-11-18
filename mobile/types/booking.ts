export type BookingType = 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO';

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'DEPOSIT_PAID'
  | 'CONFIRMED'
  | 'PICKUP_PENDING'
  | 'PICKED_UP'
  | 'RETURN_PENDING'
  | 'RETURNED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'COMBO_PHOTOS_APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface BookingProvider {
  _id: string;
  businessName?: string;
  contact?: { phone?: string; email?: string };
  address?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string;
  };
  rating?: { averageRating?: number; totalReviews?: number };
}

export interface BookingProduct {
  _id: string;
  name?: string;
  images?: string[];
  providerId?: BookingProvider | string;
}

export interface BookingPackage {
  _id: string;
  name?: string;
  images?: string[];
  durationHours?: number;
  editedPhotosCount?: number;
}

export type RentalFulfillmentStatus =
  | 'PENDING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CUSTOMER_RETURN_REQUESTED'
  | 'RETURNED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RentalInventoryStatus =
  | 'RESERVED'
  | 'RENTED_OUT'
  | 'RETURNED_PENDING_INSPECTION'
  | 'CLEANING'
  | 'AVAILABLE'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'LOST';

export type RentalDepositSettlementStatus =
  | 'HELD'
  | 'PENDING_SETTLEMENT'
  | 'FULLY_RELEASED'
  | 'PARTIALLY_DEDUCTED'
  | 'FULLY_DEDUCTED';

export type RentalIssueStatus = 'NONE' | 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED';

export interface RentalEvidenceSnapshot {
  files?: string[];
  note?: string | null;
  uploadedAt?: string | null;
  returnedAt?: string | null;
}

export interface RentalFulfillment {
  status?: RentalFulfillmentStatus | string;
  inventoryStatus?: RentalInventoryStatus | string;
  depositSettlementStatus?: RentalDepositSettlementStatus | string;
  issueStatus?: RentalIssueStatus | string;
  pickupDueAt?: string | null;
  returnDueAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  returnedAt?: string | null;
  completedAt?: string | null;
  pickupConditionNote?: string | null;
  returnConditionNote?: string | null;
  pickupEvidence?: RentalEvidenceSnapshot | null;
  customerReturnEvidence?: RentalEvidenceSnapshot | null;
  returnEvidence?: RentalEvidenceSnapshot | null;
  depositDeductedAmount?: number;
  depositRefundAmount?: number;
}

export interface RescheduleRequest {
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
  requestedAt?: string;
  resolvedAt?: string | null;
  customerReason?: string | null;
  providerNote?: string | null;
  newRentalFrom?: string | null;
  newRentalTo?: string | null;
  newShootDate?: string | null;
  newShootTimeSlot?: string | null;
}

export interface BookingItem {
  _id: string;
  itemType: 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';
  providerId?: BookingProvider | string;
  productId?: BookingProduct | string | null;
  photographyPackageId?: BookingPackage | string | null;
  unitPrice: number;
  depositAmount?: number;
  quantity: number;
  rentalFrom?: string | null;
  rentalTo?: string | null;
  shootDate?: string | null;
  shootTimeSlot?: string | null;
  shootLocation?: string | null;
  shootLocationSnapshot?: {
    address?: string | null;
    geo?: { coordinates?: number[] };
  } | null;
  pickupReturnLocationSnapshot?: {
    address?: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
  } | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  rentalType?: 'DAILY' | 'HOURLY';
  shootConcept?: string | null;
  customRequests?: string | null;
  isReviewed?: boolean;
  isMyItem?: boolean;
  inventoryItemId?: string | null;
  inventoryItem?: {
    _id: string;
    sku?: string | null;
    status?: string | null;
    conditionStatus?: string | null;
    operationalAvailableFrom?: string | null;
  } | null;
  rentalFulfillment?: RentalFulfillment | null;
  packageSnapshot?: {
    name?: string;
    basePrice?: number;
    includedDurationMinutes?: number;
  } | null;
  priceBreakdown?: Array<{ type: string; label: string; amount: number }>;
  rescheduleRequest?: RescheduleRequest | null;
}

export interface BookingSchedule {
  _id: string;
  bookingItemId?: string;
  scheduleType: 'RENTAL_PERIOD' | 'PICKUP' | 'RETURN' | 'PHOTOSHOOT';
  status: string;
  scheduledDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  providerLocalDate?: string | null;
  timeSlot?: string | null;
  locationAddress?: string | null;
  locationSnapshot?: {
    address?: string;
    geo?: { coordinates?: number[] };
  } | null;
  actualTime?: string | null;
  locationChangeRequest?: {
    status?: string;
    note?: string | null;
    requestedAt?: string;
    requestedLocation?: {
      address?: string;
      geo?: { coordinates?: number[] };
    };
  } | null;
}

export interface Booking {
  _id: string;
  bookingCode: string;
  bookingType: BookingType;
  contractFlowVersion?: 2 | null;
  status: BookingStatus;
  providerIds?: Array<BookingProvider | string>;
  items: BookingItem[];
  schedules?: BookingSchedule[];
  pricingSummary?: {
    subTotal: number;
    depositTotal: number;
    discountAmount: number;
    comboDiscountTotal?: number;
    voucherDiscountTotal?: number;
    travelFee: number;
    overtimeFee: number;
    lateFee: number;
    damageFee: number;
    serviceFee?: number;
    grandTotal: number;
  };
  paymentSummary?: {
    totalPaid: number;
    totalRefunded: number;
    paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  };
  statusTimeline?: Array<{
    status: BookingStatus;
    changedAt: string;
    note?: string | null;
  }>;
  holdExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cancellation?: {
    reason?: string | null;
    cancelledAt?: string | null;
    refundAmount?: number | null;
  };
  rentalDepositRefund?: { status: string; amount: number };
  depositSettlementStatus?: string;
  handoverPhotos?: string[];
  pickupDamageReport?: {
    description?: string;
    photos?: string[];
    reportedAt?: string;
  } | null;
  deliveredPhotos?: string[];
  deliveryDriveUrl?: string | null;
  photosApproved?: boolean;
  hasIncident?: boolean;
  incident?: {
    _id: string;
    status: string;
    requestedAmount?: number;
    description?: string;
    actionType?: string;
    evidencePhotos?: string[];
  } | null;
  activeIncident?: {
    _id: string;
    status: string;
    requestedAmount?: number;
    description?: string;
    actionType?: string;
    evidencePhotos?: string[];
  } | null;
}

export interface CancelBookingResponse {
  success: boolean;
  booking: Booking;
  isFreeCancel: boolean;
  refundAmount: number;
  penaltyReason?: string | null;
}

export interface RescheduleResponse {
  status?: 'PENDING' | 'APPROVED';
  directUpdate?: boolean;
  message?: string;
}

export interface ProviderAvailability {
  timeRanges?: Array<{ start: string; end: string }>;
}

export interface ProviderBusyDates {
  bookedSlots?: Array<{
    date: string;
    timeSlot: string;
    bookingItemId?: string;
  }>;
}
