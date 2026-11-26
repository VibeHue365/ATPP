import type {
  LocationSelection,
  PhotographerDetails,
  PhotographerPackage,
  PhotographyQuote,
} from './photographer.types';
import type { PublicProviderStaffMember } from '../../provider-dashboard/staff/staffApi';
import type {
  PhotographyCalendarDay,
  PhotographyTimeSlot,
} from '../components/PhotographyScheduleSelector';
import type { PhotographerReview } from '../components/PhotographerReviews';
import type { PhotographySessionDraft } from '../components/PhotographyMultiSessionEditor';
import type {
  ApplicableVoucherItem,
  IneligibleVoucherItem,
} from '../../../pages/cart/components/VoucherPickerModal';

export interface SlotCapacityInfo {
  busy: boolean;
  remaining: number;
  capacity: number;
  occupied: number;
}

export interface DailyQuotaInfo {
  date: string;
  used: number;
  limit: number;
  remaining: number;
}

export interface PhotographerPackageDetailLayoutProps {
  photographer: PhotographerDetails;
  packages: PhotographerPackage[];
  selectedPackage: PhotographerPackage | null;
  selectedDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  selectedTimeSlot: string;
  quote: PhotographyQuote | null;
  quoteError: string | null;
  isQuoteLoading: boolean;
  selectedLocation: LocationSelection | null;
  locationError: string | null;
  selectedConcept: string;
  customRequest: string;
  referenceFile: File | null;
  bookingMode: 'SINGLE' | 'MULTI';
  multiSessions: PhotographySessionDraft[];
  agreeTerms: boolean;
  isFavorite: boolean;
  isBusy: boolean;
  isBooking: boolean;
  canAddToCart: boolean;
  reviews: PhotographerReview[];
  reviewsLoading: boolean;
  calendarDate: Date;
  calendarDays: PhotographyCalendarDay[];
  isCalendarLoading: boolean;
  isSlotsLoading?: boolean;
  slots: PhotographyTimeSlot[];
  isSlotBusy: (slot: PhotographyTimeSlot) => boolean;
  getSlotCapacityInfo?: (slot: PhotographyTimeSlot) => SlotCapacityInfo;
  includedDurationMinutes: number;
  overtimeIncrementMinutes: number;
  maxOvertimeMinutes: number;
  canIncreaseDuration: boolean;
  isNextDurationQuoteLoading: boolean;
  increaseUnavailableReason: string;
  onToggleFavorite: (event: React.MouseEvent) => void;
  onSelectPackage: (pkg: PhotographerPackage) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onPreviewDate: (date: string) => void;
  onPreviewDuration?: (durationMinutes: number | null) => void;
  onConfirmSchedule: (date: string, slot: PhotographyTimeSlot, durationMinutes?: number) => void;
  onCancelSchedule: () => void;
  onDecreaseDuration: () => void;
  onIncreaseDuration: () => void;
  onSetDuration?: (durationMinutes: number) => void;
  onLocationChange: (location: LocationSelection) => void;
  onConceptChange: (value: string) => void;
  onRequestChange: (value: string) => void;
  onReferenceFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAgreeTermsChange: (checked: boolean) => void;
  onBookNow: () => void;
  onAddToCart: () => void;
  onImageClick: (imageSrc: string) => void;
  lightbox: React.ReactNode;
  onStartMultiSession: () => void;
  onBackToSingle: () => void;
  onAddSession: () => void;
  onGenerateRange: (from: string, to: string) => void;
  onUpdateSession: (clientId: string, patch: Partial<Omit<PhotographySessionDraft, 'clientId'>>) => void;
  onRemoveSession: (clientId: string) => void;
  selectedVoucher?: ApplicableVoucherItem | null;
  applicableVouchers?: ApplicableVoucherItem[];
  ineligibleVouchers?: IneligibleVoucherItem[];
  onOpenVoucherPicker?: () => void;
  onRemoveVoucher?: () => void;
  studioStaff?: PublicProviderStaffMember[];
  effectiveCapacity?: number;
  previewDayQuota?: DailyQuotaInfo | null;
  selectedSlotCapacity?: SlotCapacityInfo | null;
  onRefreshAvailability?: () => void;
}

