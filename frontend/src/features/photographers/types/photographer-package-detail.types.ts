import type {
  LocationSelection,
  PhotographerDetails,
  PhotographerPackage,
  PhotographyQuote,
} from './photographer.types';
import type {
  PhotographyCalendarDay,
  PhotographyTimeSlot,
} from '../components/PhotographyScheduleSelector';
import type { PhotographerReview } from '../components/PhotographerReviews';
import type { PhotographySessionDraft } from '../components/PhotographyMultiSessionEditor';

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
  slots: PhotographyTimeSlot[];
  isSlotBusy: (slot: PhotographyTimeSlot) => boolean;
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
  onConfirmSchedule: (date: string, slot: PhotographyTimeSlot) => void;
  onCancelSchedule: () => void;
  onDecreaseDuration: () => void;
  onIncreaseDuration: () => void;
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
}
