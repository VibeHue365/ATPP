export type HeritageSpotSpaceType = 'OUTDOOR' | 'SEMI_INDOOR' | 'INDOOR_STUDIO';

export interface HeritageSpot {
  _id: string;
  name: string;
  slug: string;
  vietnameseTitle?: string;
  description?: string;
  spaceType: HeritageSpotSpaceType;
  baseTravelFee: number;
  ticketPriceAtCounter?: number;
  openingHours?: string;
  bestShootingTime?: string;
  recommendedOutfits?: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  address: string;
  coverImage?: string;
  galleryImages?: string[];
}

export interface HourlyScoredWeather {
  hourTimestamp: string;
  precipitationMm: number;
  precipitationProbability: number;
  weatherCode: number;
  apparentTemperature: number;
  uvIndex?: number;
  windSpeedKmH?: number;
  past2hPrecipitationMm?: number;
  isGoldenHour: boolean;
  isBlueHour: boolean;
  hourlyScore: number;
  isRedAlert: boolean;
}

export interface SlotAssessmentResult {
  date: string;
  timeSlot: string;
  spaceType: HeritageSpotSpaceType;
  slotScore: number;
  isRedAlert: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  advisoryTitle: string;
  recommendation: string;
  hourlyBreakdown: HourlyScoredWeather[];
  canRescheduleFree: boolean;
}

export interface SpotAssessmentResponse {
  spot: {
    id: string;
    name: string;
    slug: string;
    address: string;
    spaceType: HeritageSpotSpaceType;
    baseTravelFee: number;
    location: {
      coordinates: [number, number];
    };
  };
  assessment: SlotAssessmentResult;
}

export type ProposalChangeType = 'LOCATION_ONLY' | 'DATE_AND_SLOT' | 'SLOT_ONLY';
export type ProposalStatus =
  | 'PENDING'
  | 'APPROVED_PENDING_PAYMENT'
  | 'APPLIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRED_PAYMENT_CAPTURED'
  | 'CANCELLED';

export interface WeatherProposal {
  _id: string;
  bookingId: string;
  customerId: string;
  changeType: ProposalChangeType;
  originalSchedule: {
    spotName: string;
    date: string;
    timeSlot: string;
    travelFee: number;
  };
  proposedSchedule: {
    spotId?: string;
    spotName: string;
    date: string;
    timeSlot: string;
    travelFee: number;
  };
  rawFeeDelta: number;
  additionalFeeDue: number; // AD-01: max(rawFeeDelta, 0)
  status: ProposalStatus;
  proposalExpiresAt: string;
  paymentExpiresAt?: string;
  additionalPayment?: {
    orderCode: number;
    amount: number;
    status: string;
    checkoutUrl: string;
    paymentLinkId?: string;
  };
  createdAt: string;
}

export type CancellationEligibilityBasis =
  | 'BASIS_A_QUOTA_EXHAUSTED'
  | 'BASIS_B_FORCE_MAJEURE';

export type CancellationReviewStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'APPROVED_FULL_REFUND'
  | 'APPROVED_PARTIAL_REFUND'
  | 'REJECTED';

export interface WeatherCancellationRequest {
  _id: string;
  bookingId: string;
  customerId: string;
  eligibilityBasis: CancellationEligibilityBasis;
  weatherRescheduleCountAtSubmission: number;
  weatherSnapshot: {
    spotName?: string;
    precipitationMm: number;
    popPercent: number;
    wmoCode: number;
    isRedAlert: boolean;
    fetchedAt: string;
  };
  reason: string;
  evidencePhotos: string[];
  status: CancellationReviewStatus;
  reviewDecision?: {
    adminId: string;
    reviewedAt: string;
    approvedRefundAmount: number;
    penaltyDeducted: number;
    notes?: string;
  } | null;
  createdAt: string;
}
