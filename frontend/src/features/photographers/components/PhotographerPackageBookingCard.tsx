import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Star,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import type { LocationSelection, PhotographerDetails, PhotographerPackage, PhotographyQuote } from '../types/photographer.types';
import type { DailyQuotaInfo, SlotCapacityInfo } from '../types/photographer-package-detail.types';
import type { PublicProviderStaffMember } from '../../provider-dashboard/staff/staffApi';
import type { PhotographyCalendarDay, PhotographyTimeSlot } from './PhotographyScheduleSelector';
import type { PhotographySessionDraft } from './PhotographyMultiSessionEditor';
import { PhotographyLocationPicker } from './PhotographyLocationPicker';
import type { ApplicableVoucherItem } from '../../../pages/cart/components/VoucherPickerModal';

interface PhotographerPackageBookingCardProps {
  photographer: PhotographerDetails;
  packages: PhotographerPackage[];
  selectedPackage: PhotographerPackage | null;
  selectedDate: string;
  startTime: string;
  endTime: string;
  selectedTimeSlot: string;
  durationMinutes?: number;
  includedDurationMinutes?: number;
  overtimeIncrementMinutes?: number;
  maxOvertimeMinutes?: number;
  canIncreaseDuration?: boolean;
  isNextDurationQuoteLoading?: boolean;
  increaseUnavailableReason?: string;
  bookingMode?: 'SINGLE' | 'MULTI';
  multiSessions?: PhotographySessionDraft[];
  quote: PhotographyQuote | null;
  quoteError: string | null;
  isQuoteLoading: boolean;
  selectedLocation: LocationSelection | null;
  locationError: string | null;
  agreeTerms: boolean;
  isBusy: boolean;
  isBooking: boolean;
  canAddToCart: boolean;
  calendarDate: Date;
  calendarDays: PhotographyCalendarDay[];
  isCalendarLoading: boolean;
  isSlotsLoading?: boolean;
  slots: PhotographyTimeSlot[];
  isSlotBusy: (slot: PhotographyTimeSlot) => boolean;
  getSlotCapacityInfo?: (slot: PhotographyTimeSlot) => SlotCapacityInfo;
  onSelectPackage: (pkg: PhotographerPackage) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onPreviewDate: (date: string) => void;
  onPreviewDuration?: (durationMinutes: number | null) => void;
  onConfirmSchedule: (date: string, slot: PhotographyTimeSlot, durationMinutes?: number) => void;
  onCancelSchedule: () => void;
  onDecreaseDuration?: () => void;
  onIncreaseDuration?: () => void;
  onOpenMultiSession?: () => void;
  onBackToSingle?: () => void;
  onLocationChange: (location: LocationSelection) => void;
  onAgreeTermsChange: (checked: boolean) => void;
  onBookNow: () => void;
  onAddToCart: () => void;
  selectedVoucher?: ApplicableVoucherItem | null;
  applicableVouchersCount?: number;
  onOpenVoucherPicker?: () => void;
  onRemoveVoucher?: () => void;
  studioStaff?: PublicProviderStaffMember[];
  effectiveCapacity?: number;
  previewDayQuota?: DailyQuotaInfo | null;
  selectedSlotCapacity?: SlotCapacityInfo | null;
  onRefreshAvailability?: () => void;
}

const formatPrice = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')}đ`;

const formatCompactPrice = (amount: number) => {
  const rounded = Math.round(amount);
  if (rounded >= 1_000_000) {
    const millions = rounded / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1).replace(/\.0$/, '')}tr`;
  }
  if (rounded >= 1_000) {
    const thousands = Math.round(rounded / 1_000);
    return `${thousands}k`;
  }
  return `${rounded}đ`;
};

const formatDate = (date: string) => {
  if (!date) return 'Chưa chọn ngày';
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

const formatShortDate = (date: string) => {
  if (!date) return '—';
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return `${hours} giờ${rest ? ` ${rest} phút` : ''}`;
};

const formatShortDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}p`;
  return rest ? `${hours}g ${rest}p` : `${hours} giờ`;
};

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const getPricingUnitMeta = (pricingUnit?: PhotographerPackage['pricingUnit']) => {
  if (pricingUnit === 'PER_DAY') {
    return {
      shortUnit: '/ ngày',
      badge: 'Tính theo ngày',
    };
  }
  if (pricingUnit === 'PER_BOOKING') {
    return {
      shortUnit: '/ trọn gói',
      badge: 'Trọn gói sự kiện',
    };
  }
  return {
    shortUnit: '/ buổi',
    badge: 'Tính theo buổi',
  };
};

export const PhotographerPackageBookingCard: React.FC<PhotographerPackageBookingCardProps> = ({
  photographer,
  packages,
  selectedPackage,
  selectedDate,
  startTime,
  endTime,
  selectedTimeSlot,
  durationMinutes,
  includedDurationMinutes,
  overtimeIncrementMinutes,
  maxOvertimeMinutes,
  canIncreaseDuration = false,
  isNextDurationQuoteLoading = false,
  increaseUnavailableReason,
  bookingMode = 'SINGLE',
  multiSessions = [],
  quote,
  quoteError,
  isQuoteLoading,
  selectedLocation,
  locationError,
  agreeTerms,
  isBusy,
  isBooking,
  canAddToCart,
  calendarDate,
  calendarDays,
  isCalendarLoading,
  isSlotsLoading = false,
  slots,
  isSlotBusy,
  getSlotCapacityInfo,
  onSelectPackage,
  onPreviousMonth,
  onNextMonth,
  onPreviewDate,
  onPreviewDuration,
  onConfirmSchedule,
  onCancelSchedule,
  onDecreaseDuration,
  onIncreaseDuration,
  onOpenMultiSession,
  onBackToSingle,
  onLocationChange,
  onAgreeTermsChange,
  onBookNow,
  onAddToCart,
  selectedVoucher,
  applicableVouchersCount,
  onOpenVoucherPicker,
  onRemoveVoucher,
  studioStaff = [],
  effectiveCapacity = 1,
  previewDayQuota = null,
  selectedSlotCapacity = null,
  onRefreshAvailability,
}) => {
  const effectiveIncluded = Math.max(
    includedDurationMinutes ??
      selectedPackage?.includedDurationMinutes ??
      Math.round((selectedPackage?.durationHours ?? 1) * 60),
    30,
  );
  const effectiveIncrement = Math.max(
    overtimeIncrementMinutes ?? selectedPackage?.overtimeIncrementMinutes ?? 30,
    30,
  );
  const effectiveMaxOvertime = Math.max(
    maxOvertimeMinutes ?? selectedPackage?.maxOvertimeMinutes ?? 240,
    0,
  );
  const currentDuration = Math.max(durationMinutes ?? effectiveIncluded, effectiveIncluded);
  const overtimeMinutes = Math.max(0, currentDuration - effectiveIncluded);

  const [openPanel, setOpenPanel] = useState<'schedule' | 'location' | null>(null);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftDurationMinutes, setDraftDurationMinutes] = useState(currentDuration);
  const [draftSlot, setDraftSlot] = useState<PhotographyTimeSlot | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const packagePrice = selectedPackage?.price ?? 0;
  const pricingUnitMeta = getPricingUnitMeta(selectedPackage?.pricingUnit);
  const overtimeHourlyRate = useMemo(() => {
    const configured = Number(selectedPackage?.overtimeFeePerHour ?? 0);
    if (configured > 0) return Math.round(configured);
    const includedHours = effectiveIncluded / 60;
    return includedHours > 0 ? Math.round(packagePrice / includedHours) : 0;
  }, [selectedPackage?.overtimeFeePerHour, effectiveIncluded, packagePrice]);

  const durationOptions = useMemo(() => {
    const options: Array<{
      minutes: number;
      overtimeMinutes: number;
      extraPrice: number;
    }> = [];
    for (
      let extra = 0;
      extra <= effectiveMaxOvertime && options.length < 12;
      extra += effectiveIncrement
    ) {
      options.push({
        minutes: effectiveIncluded + extra,
        overtimeMinutes: extra,
        extraPrice: Math.round((extra * overtimeHourlyRate) / 60),
      });
    }
    return options;
  }, [effectiveIncluded, effectiveIncrement, effectiveMaxOvertime, overtimeHourlyRate]);

  const quoteTotal = quote?.valid && quote.totals ? quote.totals.totalAmount : packagePrice;
  const voucherDiscount = selectedVoucher ? selectedVoucher.discountAmount : 0;
  const finalTotal = Math.max(0, quoteTotal - voucherDiscount);
  const quoteMessage = quote?.valid === false ? quote.errors?.[0]?.message : quoteError;
  const availableDays = useMemo(
    () => calendarDays.filter((day) => !day.isEmpty),
    [calendarDays],
  );
  const selectedPackageImage = selectedPackage?.images?.find(Boolean);
  const photographerImage =
    selectedPackageImage ||
    photographer.coverImage ||
    photographer.portfolio[0] ||
    photographer.media.images[0];

  const completedMultiSessions = useMemo(
    () => multiSessions.filter((session) => Boolean(session.date && session.startTime)),
    [multiSessions],
  );
  const hasScheduleSelected =
    bookingMode === 'MULTI'
      ? multiSessions.length > 0 && completedMultiSessions.length === multiSessions.length
      : Boolean(selectedDate && startTime);
  const hasBookingDetails = Boolean(hasScheduleSelected && selectedLocation);
  const actionDisabled =
    isBooking || isQuoteLoading || isBusy || !quote?.valid || !quote.totals || !hasBookingDetails;

  const openSchedulePanel = () => {
    onRefreshAvailability?.();
    setDraftDate(selectedDate);
    setDraftDurationMinutes(currentDuration);
    onPreviewDuration?.(currentDuration);
    setDraftSlot(slots.find((slot) => slot.start === startTime && slot.end === endTime) || null);
    setScheduleError(null);
    setOpenPanel('schedule');
  };

  const closePanel = () => {
    if (openPanel === 'schedule') {
      onPreviewDuration?.(null);
      onCancelSchedule();
    }
    setScheduleError(null);
    setOpenPanel(null);
  };

  const handleDatePreview = (date: string) => {
    setDraftDate(date);
    setDraftSlot(null);
    setScheduleError(null);
    onPreviewDate(date);
  };

  const handleDurationPreview = (nextDuration: number) => {
    setDraftDurationMinutes(nextDuration);
    setScheduleError(null);
    onPreviewDuration?.(nextDuration);
  };

  // Keep draftSlot synced when slots recompute after changing draftDurationMinutes
  useEffect(() => {
    if (openPanel !== 'schedule' || !draftSlot) return;
    const matched = slots.find((slot) => slot.start === draftSlot.start);
    const matchedBusy = matched
      ? getSlotCapacityInfo
        ? getSlotCapacityInfo(matched).busy
        : isSlotBusy(matched)
      : true;
    if (matched && !matchedBusy) {
      if (matched.end !== draftSlot.end || matched.label !== draftSlot.label) {
        setDraftSlot(matched);
      }
    } else {
      setDraftSlot(null);
    }
  }, [openPanel, slots, draftSlot, getSlotCapacityInfo, isSlotBusy]);

  const handleDraftSlotSelection = (slot: PhotographyTimeSlot) => {
    setDraftSlot(slot);
    setScheduleError(null);
  };

  const confirmSchedule = () => {
    if (!draftDate || !draftSlot) {
      setScheduleError('Vui lòng chọn ngày và khung giờ trước khi xác nhận.');
      return;
    }
    onPreviewDuration?.(null);
    onConfirmSchedule(draftDate, draftSlot, draftDurationMinutes);
    setScheduleError(null);
    setOpenPanel(null);
  };

  useEffect(() => {
    if (!openPanel) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openPanel === 'schedule') {
        onPreviewDuration?.(null);
        onCancelSchedule();
      }
      setScheduleError(null);
      setOpenPanel(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [openPanel, onCancelSchedule, onPreviewDuration]);

  const hasAvailableSlotInDialog = useMemo(() => {
    if (!slots.length) return false;
    return slots.some((slot) => {
      const info = getSlotCapacityInfo ? getSlotCapacityInfo(slot) : { busy: isSlotBusy(slot) };
      return !info.busy;
    });
  }, [slots, getSlotCapacityInfo, isSlotBusy]);

  const showDetailedBreakdown = Boolean(
    quote?.valid &&
      quote.totals &&
      (quote.totals.overtimeAmount > 0 ||
        quote.totals.surchargeAmount > 0 ||
        bookingMode === 'MULTI' ||
        (selectedVoucher && selectedVoucher.discountAmount > 0)),
  );

  const compactBreakdownRows = useMemo(() => {
    if (!quote?.valid || !Array.isArray(quote.breakdown)) return [];
    const baseItems = quote.breakdown.filter((item) => item.type === 'BASE_PACKAGE');
    const overtimeItems = quote.breakdown.filter((item) => item.type === 'OVERTIME');
    const surchargeItems = quote.breakdown.filter((item) => item.type === 'SURCHARGE');

    const rows: Array<{ key: string; type: 'BASE_PACKAGE' | 'OVERTIME' | 'SURCHARGE'; label: string; amount: number }> = [];

    const baseSum = baseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (baseSum > 0) {
      let baseLabel = `Giá gói cơ bản (${formatShortDuration(effectiveIncluded)})`;
      if (bookingMode === 'MULTI') {
        if (selectedPackage?.pricingUnit === 'PER_DAY') {
          baseLabel = `Giá gói (${baseItems.length} ngày)`;
        } else if (selectedPackage?.pricingUnit === 'PER_BOOKING') {
          baseLabel = 'Giá trọn gói sự kiện';
        } else {
          baseLabel = `Giá gói (${Math.max(baseItems.length, multiSessions.length)} buổi)`;
        }
      }
      rows.push({ key: 'base', type: 'BASE_PACKAGE', label: baseLabel, amount: baseSum });
    }

    const overtimeSum = overtimeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (overtimeSum > 0) {
      const multiOvertimeMins = (quote.sessions || []).reduce(
        (sum, s) => sum + Number(s.overtimeMinutes || 0),
        0,
      );
      const displayOvertimeMins =
        bookingMode === 'SINGLE' ? overtimeMinutes : multiOvertimeMins;
      rows.push({
        key: 'overtime',
        type: 'OVERTIME',
        label:
          displayOvertimeMins > 0
            ? `Phí tăng giờ (+${formatShortDuration(displayOvertimeMins)})`
            : 'Phí tăng giờ',
        amount: overtimeSum,
      });
    }

    surchargeItems.forEach((item, idx) => {
      if (Number(item.amount || 0) > 0) {
        rows.push({
          key: `surcharge-${idx}`,
          type: 'SURCHARGE',
          label: item.label,
          amount: Number(item.amount || 0),
        });
      }
    });

    return rows;
  }, [quote, bookingMode, effectiveIncluded, overtimeMinutes, selectedPackage?.pricingUnit, multiSessions.length]);

  const hasVoucherDiscount = Boolean(selectedVoucher && selectedVoucher.discountAmount > 0);
  const hasSummarySubRows = Boolean((showDetailedBreakdown && compactBreakdownRows.length > 0) || hasVoucherDiscount);

  return (
    <aside className="ppd-booking-card" aria-label="Thông tin đặt lịch chụp ảnh">
      <div className="ppd-booking-provider">
        <div className="ppd-booking-provider__avatar">
          {photographerImage ? <img src={photographerImage} alt="" /> : photographer.businessName.charAt(0)}
        </div>
        <div>
          <strong>{photographer.businessName}</strong>
          <span><ShieldCheck size={13} /> Photographer đã xác minh</span>
        </div>
      </div>

      {packages.length > 1 && (
        <label className="ppd-booking-field">
          <span>GÓI CHỤP</span>
          <select
            value={selectedPackage?._id || ''}
            onChange={(event) => {
              const nextPackage = packages.find((pkg) => pkg._id === event.target.value);
              if (nextPackage) onSelectPackage(nextPackage);
            }}
          >
            {packages.map((pkg) => (
              <option value={pkg._id} key={pkg._id}>
                {pkg.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="ppd-booking-price">
        <div>
          <span>Giá gói</span>
          <div className="ppd-booking-price__amount">
            <strong>{formatPrice(packagePrice)}</strong>
            <em>{pricingUnitMeta.shortUnit}</em>
          </div>
        </div>
        <small>
          {selectedPackage
            ? `${pricingUnitMeta.badge} · Gói ${formatDuration(effectiveIncluded)} · ${selectedPackage.editedPhotosCount || 0} ảnh chỉnh sửa`
            : 'Chọn gói để bắt đầu'}
        </small>
        {selectedPackage && (
          <div className="ppd-booking-overtime-hint">
            <Clock3 size={12} />
            <span>
              {effectiveMaxOvertime > 0
                ? `Có thể đặt thêm tối đa +${formatDuration(effectiveMaxOvertime)} (+${formatPrice(overtimeHourlyRate)}/giờ)`
                : 'Thời lượng cố định theo gói (không tăng giờ)'}
            </span>
          </div>
        )}
        <div className="ppd-booking-rating">
          <Star size={14} fill="currentColor" /> {photographer.rating.averageRating.toFixed(1)}{' '}
          <span>({photographer.rating.totalReviews} đánh giá)</span>
        </div>
      </div>

      {studioStaff.length > 0 && (
        <div
          className="ppd-team-dispatch-pill"
          title="Studio sẽ chủ động điều phối thợ chụp phù hợp khi xác nhận lịch hẹn của bạn."
        >
          <span className="ppd-team-dispatch-card__badge">
            <Users size={13} />
            <span>
              Đội ngũ {studioStaff.length} thợ · Tối đa {Math.max(1, effectiveCapacity)} ca/giờ
            </span>
          </span>
          <div className="ppd-team-avatar-stack" aria-hidden="true">
            {studioStaff.slice(0, 3).map((st) => (
              <span key={st._id} className="ppd-team-avatar-dot" title={st.name}>
                {st.name?.charAt(0)?.toUpperCase() || 'T'}
              </span>
            ))}
            {studioStaff.length > 3 && (
              <span className="ppd-team-avatar-dot ppd-team-avatar-dot--more">
                +{studioStaff.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      <section className="ppd-booking-section ppd-booking-section--compact">
        <div className="ppd-booking-section__heading">
          <span>LỊCH CHỤP</span>
          <CalendarDays size={16} />
        </div>

        {(onOpenMultiSession || onBackToSingle) && (
          <div className="ppd-booking-mode-tabs" role="tablist" aria-label="Chế độ đặt lịch">
            <button
              type="button"
              role="tab"
              aria-selected={bookingMode === 'SINGLE'}
              className={`ppd-booking-mode-tab${bookingMode === 'SINGLE' ? ' is-active' : ''}`}
              onClick={() => {
                if (bookingMode !== 'SINGLE') onBackToSingle?.();
              }}
            >
              Đặt 1 buổi
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={bookingMode === 'MULTI'}
              className={`ppd-booking-mode-tab${bookingMode === 'MULTI' ? ' is-active' : ''}`}
              onClick={() => onOpenMultiSession?.()}
            >
              <Layers size={12} /> Nhiều buổi / Nhiều ngày
            </button>
          </div>
        )}

        {bookingMode === 'MULTI' ? (
          <div className="ppd-multi-card-summary">
            <div className="ppd-multi-card-summary__head">
              <strong>
                {completedMultiSessions.length}/{multiSessions.length} buổi chụp đã lên lịch
              </strong>
              <button type="button" onClick={onOpenMultiSession}>
                Chỉnh sửa
              </button>
            </div>
            <ul className="ppd-multi-card-summary__list">
              {multiSessions.slice(0, 4).map((session, idx) => {
                const sessionEnd = session.startTime
                  ? toTime(toMinutes(session.startTime) + session.durationMinutes)
                  : '';
                return (
                  <li key={session.clientId}>
                    <span>Buổi {idx + 1}</span>
                    <strong>
                      {session.date ? formatShortDate(session.date) : 'Chưa chọn ngày'} ·{' '}
                      {session.startTime ? `${session.startTime} – ${sessionEnd}` : 'Chưa chọn giờ'}
                      <em> ({formatShortDuration(session.durationMinutes)})</em>
                    </strong>
                  </li>
                );
              })}
              {multiSessions.length > 4 && (
                <li className="is-more">+{multiSessions.length - 4} buổi khác…</li>
              )}
            </ul>
            <p className="ppd-inline-note" style={{ marginTop: 6 }}>
              Lịch nhiều buổi sẽ được giữ chỗ đồng thời 10 phút và thanh toán trực tiếp.
            </p>
          </div>
        ) : (
          <>
            <div className="ppd-booking-choice-grid">
              <button
                type="button"
                className={'ppd-booking-choice' + (selectedDate ? ' has-value' : '')}
                onClick={openSchedulePanel}
              >
                <span className="ppd-booking-choice__icon">
                  <CalendarDays size={14} />
                </span>
                <span className="ppd-booking-choice__copy">
                  <small>Ngày chụp</small>
                  <strong>{selectedDate ? formatDate(selectedDate) : 'Chọn ngày'}</strong>
                </span>
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className={'ppd-booking-choice' + (selectedTimeSlot ? ' has-value' : '')}
                onClick={openSchedulePanel}
              >
                <span className="ppd-booking-choice__icon">
                  <Clock3 size={14} />
                </span>
                <span className="ppd-booking-choice__copy">
                  <small>
                    Khung giờ{selectedTimeSlot ? ` (${formatShortDuration(currentDuration)})` : ''}
                  </small>
                  <strong>{selectedTimeSlot || 'Chọn giờ'}</strong>
                </span>
                <ChevronRight size={13} />
              </button>
            </div>

            {selectedDate && startTime && effectiveMaxOvertime > 0 && onDecreaseDuration && onIncreaseDuration && (
              <div className="ppd-inline-duration-bar" aria-live="polite">
                <div className="ppd-inline-duration-bar__top">
                  <div className="ppd-inline-duration-bar__copy">
                    <span>Thời lượng buổi chụp</span>
                    <strong>
                      {formatDuration(currentDuration)}
                      {overtimeMinutes > 0 && (
                        <em> (+{formatShortDuration(overtimeMinutes)} tăng giờ)</em>
                      )}
                    </strong>
                  </div>
                  <div className="ppd-inline-duration-bar__stepper">
                    <button
                      type="button"
                      onClick={onDecreaseDuration}
                      disabled={currentDuration <= effectiveIncluded}
                      aria-label="Giảm thời lượng"
                    >
                      <Minus size={14} />
                    </button>
                    <span>{formatShortDuration(currentDuration)}</span>
                    <button
                      type="button"
                      onClick={onIncreaseDuration}
                      disabled={!canIncreaseDuration || isNextDurationQuoteLoading}
                      aria-label="Tăng thời lượng"
                      title={increaseUnavailableReason || undefined}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {!canIncreaseDuration && increaseUnavailableReason && (
                  <p className="ppd-inline-duration-bar__hint">{increaseUnavailableReason}</p>
                )}
              </div>
            )}

            {!selectedDate ? (
              <p className="ppd-inline-note">
                Chọn ngày, thời lượng mong muốn (1h, 1.5h, 2h…) và khung giờ còn trống trong cùng một bước.
              </p>
            ) : selectedTimeSlot &&
              selectedSlotCapacity &&
              !selectedSlotCapacity.busy &&
              (selectedSlotCapacity.capacity > 1 || effectiveCapacity > 1) ? (
              <div
                className={
                  'ppd-selected-stock-note' +
                  (selectedSlotCapacity.remaining === 1 ? ' is-last' : '')
                }
              >
                <Check size={13} />
                <span>
                  {selectedSlotCapacity.remaining === 1
                    ? `Chỉ còn 1 suất cuối cho khung ${selectedTimeSlot} · Giữ chỗ 10 phút khi thanh toán`
                    : `Khung ${selectedTimeSlot} còn ${selectedSlotCapacity.remaining}/${selectedSlotCapacity.capacity} suất · Giữ chỗ 10 phút khi thanh toán`}
                </span>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="ppd-booking-section">
        <div className="ppd-booking-section__heading">
          <span>ĐỊA ĐIỂM</span>
          <MapPin size={16} />
        </div>
        <button
          type="button"
          className={'ppd-location-summary' + (selectedLocation ? ' has-value' : '')}
          onClick={() => {
            setScheduleError(null);
            setOpenPanel('location');
          }}
        >
          <span>
            <MapPin size={16} />
            <strong>{selectedLocation?.address || 'Chọn địa điểm chụp'}</strong>
          </span>
          <ChevronRight size={16} />
        </button>
        {!selectedLocation && (
          <p className="ppd-inline-note">
            {hasScheduleSelected
              ? 'Vui lòng chọn địa điểm chụp để hệ thống kiểm tra phạm vi phục vụ trước khi đặt.'
              : 'Địa điểm giúp hệ thống kiểm tra phạm vi phục vụ.'}
          </p>
        )}
        {locationError && <p className="ppd-error">{locationError}</p>}
      </section>

      {/* Voucher Picker Entry */}
      <section className="ppd-booking-section ppd-voucher-section">
        <div className="ppd-booking-section__heading">
          <span>MÃ GIẢM GIÁ</span>
          <Ticket size={16} />
        </div>
        {!selectedVoucher ? (
          <button type="button" className="ppd-voucher-trigger" onClick={onOpenVoucherPicker}>
            <span className="ppd-voucher-trigger__left">
              <span className="ppd-voucher-trigger__icon">
                <Ticket size={15} />
              </span>
              <span className="ppd-voucher-trigger__copy">
                <strong>Chọn mã ưu đãi / voucher</strong>
                {typeof applicableVouchersCount === 'number' && applicableVouchersCount > 0 ? (
                  <small>{applicableVouchersCount} mã có sẵn</small>
                ) : (
                  <small>Áp dụng mã giảm giá cho đơn</small>
                )}
              </span>
            </span>
            <ChevronRight size={15} />
          </button>
        ) : (
          <div className="ppd-voucher-applied">
            <div className="ppd-voucher-applied__left">
              <span className="ppd-voucher-applied__icon">
                <Ticket size={15} />
              </span>
              <div className="ppd-voucher-applied__copy">
                <strong>{selectedVoucher.promotion.code}</strong>
                <small>Đã giảm {formatPrice(selectedVoucher.discountAmount)}</small>
              </div>
            </div>
            <div className="ppd-voucher-applied__actions">
              {onOpenVoucherPicker && (
                <button type="button" onClick={onOpenVoucherPicker} className="ppd-voucher-btn-change">
                  Đổi
                </button>
              )}
              {onRemoveVoucher && (
                <button
                  type="button"
                  onClick={onRemoveVoucher}
                  className="ppd-voucher-btn-remove"
                  aria-label="Bỏ chọn mã"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {quoteMessage && <p className="ppd-error">{quoteMessage}</p>}
      {isBusy && <p className="ppd-error">Ca này vừa được giữ chỗ. Vui lòng chọn ca khác.</p>}

      <div className="ppd-booking-total">
        {showDetailedBreakdown ? (
          compactBreakdownRows.map((row) => (
            <div
              key={row.key}
              className={
                'ppd-booking-total__row' +
                (row.type === 'OVERTIME' ? ' ppd-booking-total__row--overtime' : ' ppd-booking-total__row--sub')
              }
            >
              <span>{row.label}</span>
              <strong>
                {row.type === 'OVERTIME' ? '+' : ''}
                {formatPrice(row.amount)}
              </strong>
            </div>
          ))
        ) : hasVoucherDiscount ? (
          <div className="ppd-booking-total__row ppd-booking-total__row--sub">
            <span>Giá gói cơ bản ({formatShortDuration(effectiveIncluded)})</span>
            <strong>{formatPrice(packagePrice)}</strong>
          </div>
        ) : null}
        {hasVoucherDiscount && selectedVoucher && (
          <div className="ppd-booking-total__row ppd-booking-total__row--discount">
            <span>Ưu đãi voucher</span>
            <strong>-{formatPrice(selectedVoucher.discountAmount)}</strong>
          </div>
        )}
        <div
          className={
            'ppd-booking-total__row ppd-booking-total__row--main' +
            (hasSummarySubRows ? ' has-divider' : '')
          }
        >
          <span>
            {hasSummarySubRows
              ? 'Tổng thanh toán'
              : bookingMode === 'MULTI'
                ? `Tổng dự kiến (${multiSessions.length} buổi)`
                : `Tổng cộng (${formatShortDuration(currentDuration)})`}
          </span>
          <strong>{isQuoteLoading ? 'Đang tính…' : formatPrice(finalTotal)}</strong>
        </div>
      </div>

      <label className="ppd-terms">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(event) => onAgreeTermsChange(event.target.checked)}
        />
        <span>Tôi đồng ý chính sách cọc và cam kết chụp đúng giờ.</span>
      </label>
      <button type="button" className="ppd-primary-button" disabled={actionDisabled} onClick={onBookNow}>
        {isBooking ? (
          'Đang xử lý…'
        ) : (
          <>
            Tiếp tục xác nhận <ArrowRight size={16} />
          </>
        )}
      </button>
      <button
        type="button"
        className="ppd-secondary-button"
        disabled={actionDisabled || !canAddToCart}
        onClick={onAddToCart}
      >
        Lưu vào giỏ hàng
      </button>
      <p className="ppd-payment-note">
        Sau khi tiếp tục, hệ thống sẽ giữ lịch 10 phút và chuyển bạn sang bước thanh toán.
      </p>

      {openPanel &&
        createPortal(
          <div
            className="ppd-booking-dialog"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePanel();
            }}
          >
            <div
              className={`ppd-booking-dialog__panel${openPanel === 'location' ? ' ppd-booking-dialog__panel--location' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ppd-booking-dialog-title"
            >
              <div className="ppd-booking-dialog__header">
                <div>
                  <span className="ppd-eyebrow">ĐẶT LỊCH</span>
                  <h2 id="ppd-booking-dialog-title">
                    {openPanel === 'schedule' ? 'Chọn ngày, thời lượng & khung giờ' : 'Chọn địa điểm chụp'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="ppd-booking-dialog__close"
                  onClick={closePanel}
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              {openPanel === 'schedule' ? (
                <div className="ppd-booking-dialog__body">
                  <div className="ppd-dialog-selection-summary ppd-dialog-selection-summary--three">
                    <div>
                      <small>Ngày chụp</small>
                      <strong>{draftDate ? formatDate(draftDate) : 'Chưa chọn'}</strong>
                    </div>
                    <div>
                      <small>Thời lượng</small>
                      <strong>{formatShortDuration(draftDurationMinutes)}</strong>
                    </div>
                    <div>
                      <small>Khung giờ</small>
                      <strong>{draftSlot?.label || 'Chưa chọn'}</strong>
                    </div>
                  </div>

                  <div className="ppd-dialog-step-label">
                    <span>1</span>
                    <strong>Chọn ngày chụp</strong>
                  </div>
                  <div className="ppd-calendar-header">
                    <button type="button" onClick={onPreviousMonth} aria-label="Tháng trước">
                      <ChevronLeft size={16} />
                    </button>
                    <strong>
                      {calendarDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </strong>
                    <button type="button" onClick={onNextMonth} aria-label="Tháng sau">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="ppd-calendar-weekdays">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="ppd-calendar-grid" aria-busy={isCalendarLoading}>
                    {calendarDays.map((day, index) => {
                      if (day.isEmpty) {
                        return <span key={'empty-' + index} className="ppd-calendar-day ppd-calendar-day--empty" />;
                      }
                      const isSelected = draftDate === day.dateStr;
                      return (
                        <button
                          type="button"
                          key={day.dateStr}
                          disabled={!day.isAvailable || isCalendarLoading}
                          className={
                            'ppd-calendar-day' +
                            (isSelected ? ' is-selected' : '') +
                            (day.isAvailable ? ' is-available' : '')
                          }
                          onClick={() => handleDatePreview(day.dateStr)}
                          title={day.availabilityStatus}
                        >
                          {day.day}
                        </button>
                      );
                    })}
                  </div>
                  {!isCalendarLoading && !availableDays.some((day) => day.isAvailable) && (
                    <p className="ppd-inline-note">
                      Tháng này chưa có ngày trống. Bạn có thể chuyển sang tháng kế tiếp.
                    </p>
                  )}

                  {/* Step 2: Duration Selector inside the Schedule Dialog */}
                  <div className="ppd-dialog-duration-section">
                    <div className="ppd-dialog-step-label">
                      <span>2</span>
                      <strong>Chọn thời lượng buổi chụp</strong>
                      <em>Mặc định {formatShortDuration(effectiveIncluded)}</em>
                    </div>
                    {effectiveMaxOvertime > 0 ? (
                      <div className="ppd-duration-chips" role="radiogroup" aria-label="Chọn thời lượng buổi chụp">
                        {durationOptions.map((option) => {
                          const isSelected = draftDurationMinutes === option.minutes;
                          return (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              key={option.minutes}
                              className={`ppd-duration-chip${isSelected ? ' is-selected' : ''}`}
                              onClick={() => handleDurationPreview(option.minutes)}
                            >
                              <strong>{formatShortDuration(option.minutes)}</strong>
                              <small>
                                {option.overtimeMinutes === 0
                                  ? 'Trong gói'
                                  : `+${formatCompactPrice(option.extraPrice)}`}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="ppd-inline-note" style={{ marginTop: 4 }}>
                        Gói này có thời lượng cố định {formatDuration(effectiveIncluded)} (không tăng thêm giờ).
                      </p>
                    )}
                  </div>

                  {scheduleError && <p className="ppd-error">{scheduleError}</p>}

                  {/* Step 3: Available Time Slots filtered by selected duration */}
                  <div className="ppd-dialog-time-section">
                    <div className="ppd-booking-subheading">
                      <span className="ppd-dialog-step-label ppd-dialog-step-label--inline">
                        <span>3</span>
                        <strong>KHUNG GIỜ TRỐNG ({formatShortDuration(draftDurationMinutes)})</strong>
                      </span>
                      {effectiveCapacity > 1 ? (
                        <span className="ppd-capacity-chip">
                          <Users size={12} /> Tối đa {effectiveCapacity} suất/giờ
                        </span>
                      ) : (
                        <Clock3 size={15} />
                      )}
                    </div>
                    {effectiveCapacity > 1 && slots.length > 0 && (
                      <div className="ppd-stock-legend" aria-label="Chú thích trạng thái suất chụp">
                        <span><i className="ppd-legend-dot is-open" />Còn nhiều</span>
                        <span><i className="ppd-legend-dot is-partial" />Sắp kín</span>
                        <span><i className="ppd-legend-dot is-last" />Suất cuối</span>
                        <span><i className="ppd-legend-dot is-full" />Hết suất</span>
                      </div>
                    )}
                    {previewDayQuota && previewDayQuota.remaining === 0 && (
                      <div className="ppd-daily-quota-banner is-exhausted">
                        Ngày {formatDate(previewDayQuota.date)} đã nhận đủ giới hạn {previewDayQuota.limit}/
                        {previewDayQuota.limit} ca chụp trong ngày. Vui lòng chọn ngày khác.
                      </div>
                    )}
                    {previewDayQuota && previewDayQuota.remaining === 1 && (
                      <div className="ppd-daily-quota-banner">
                        Lưu ý: Studio đặt giới hạn {previewDayQuota.limit} ca/ngày — ngày{' '}
                        {formatDate(previewDayQuota.date)} chỉ còn nhận tối đa <strong>1 ca cuối</strong>.
                      </div>
                    )}
                    {!draftDate ? (
                      <p className="ppd-inline-note">Chọn một ngày còn lịch ở Bước 1 để xem các khung giờ.</p>
                    ) : isSlotsLoading ? (
                      <p className="ppd-inline-note">Đang kiểm tra khung giờ trống…</p>
                    ) : slots.length === 0 || !hasAvailableSlotInDialog ? (
                      <div className="ppd-no-slot-helper">
                        <p>
                          {draftDurationMinutes > effectiveIncluded
                            ? `Không còn khung liên tục ${formatDuration(draftDurationMinutes)} trong 1 ca làm việc của ngày ${formatDate(draftDate)} (có thể do hết thợ trống hoặc chạm giờ nghỉ giữa ca).`
                            : `Không còn khung giờ trống trong ngày ${formatDate(draftDate)}. Vui lòng chọn ngày khác.`}
                        </p>
                        {draftDurationMinutes > effectiveIncluded && (
                          <div className="ppd-no-slot-helper__actions">
                            <button
                              type="button"
                              onClick={() => handleDurationPreview(effectiveIncluded)}
                            >
                              Về gói {formatShortDuration(effectiveIncluded)}
                            </button>
                            {onOpenMultiSession && (
                              <button
                                type="button"
                                className="is-primary"
                                onClick={() => {
                                  closePanel();
                                  onOpenMultiSession();
                                }}
                              >
                                Đặt nhiều buổi (Sáng & Chiều)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="ppd-dialog-time-grid">
                        {slots.map((slot) => {
                          const info = getSlotCapacityInfo
                            ? getSlotCapacityInfo(slot)
                            : {
                                busy: isSlotBusy(slot),
                                remaining: isSlotBusy(slot) ? 0 : Math.max(1, effectiveCapacity),
                                capacity: Math.max(1, effectiveCapacity),
                                occupied: isSlotBusy(slot) ? Math.max(1, effectiveCapacity) : 0,
                              };
                          const busy = info.busy;
                          const selected =
                            draftSlot?.start === slot.start && draftSlot?.end === slot.end;
                          const showCapacityCount = info.capacity > 1 || effectiveCapacity > 1;
                          const isLastSlot = !busy && info.remaining === 1 && showCapacityCount;
                          const isPartial =
                            !busy && !isLastSlot && showCapacityCount && info.remaining < info.capacity;

                          let statusText = 'Còn trống';
                          if (busy) {
                            statusText = showCapacityCount
                              ? `Hết suất (0/${info.capacity})`
                              : 'Đã kín lịch';
                          } else if (selected) {
                            statusText = isLastSlot
                              ? 'Đã chọn · Suất cuối'
                              : showCapacityCount
                                ? `Đã chọn · Còn ${info.remaining}/${info.capacity} suất`
                                : 'Đã chọn';
                          } else if (isLastSlot) {
                            statusText = 'Chỉ còn 1 suất cuối';
                          } else if (showCapacityCount) {
                            statusText = `Còn ${info.remaining}/${info.capacity} suất`;
                          }

                          const dotCap = Math.min(info.capacity, 5);
                          const dotRemaining =
                            info.capacity <= 5
                              ? Math.min(info.remaining, dotCap)
                              : Math.round((info.remaining / Math.max(1, info.capacity)) * dotCap);

                          return (
                            <button
                              type="button"
                              key={slot.label}
                              disabled={busy}
                              className={
                                'ppd-time-slot' +
                                (selected ? ' is-selected' : '') +
                                (busy ? ' is-busy' : '') +
                                (isLastSlot && !selected ? ' is-last-slot' : '') +
                                (isPartial && !selected ? ' is-partial' : '')
                              }
                              onClick={() => handleDraftSlotSelection(slot)}
                            >
                              <span className="ppd-time-slot__body">
                                <span className="ppd-time-slot__top">
                                  <strong>
                                    {slot.start} – {slot.end}
                                  </strong>
                                  {showCapacityCount && (
                                    <span
                                      className="ppd-stock-dots"
                                      aria-hidden="true"
                                      title={`Còn ${info.remaining}/${info.capacity} suất`}
                                    >
                                      {Array.from({ length: dotCap }).map((_, idx) => (
                                        <i
                                          key={idx}
                                          className={
                                            'ppd-stock-dot' +
                                            (idx < dotRemaining
                                              ? selected
                                                ? ' is-filled-selected'
                                                : isLastSlot
                                                  ? ' is-filled-last'
                                                  : isPartial
                                                    ? ' is-filled-partial'
                                                    : ' is-filled-open'
                                              : ' is-empty')
                                          }
                                        />
                                      ))}
                                    </span>
                                  )}
                                </span>
                                <small
                                  className={
                                    selected
                                      ? ''
                                      : isLastSlot
                                        ? 'is-last-label'
                                        : isPartial
                                          ? 'is-partial-label'
                                          : !busy && showCapacityCount
                                            ? 'is-open-label'
                                            : ''
                                  }
                                >
                                  {statusText}
                                </small>
                              </span>
                              {selected && <Check size={16} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="ppd-dialog-actions">
                    <button type="button" className="ppd-secondary-button" onClick={closePanel}>
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="ppd-primary-button"
                      disabled={!draftDate || !draftSlot}
                      onClick={confirmSchedule}
                    >
                      Xác nhận lịch
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ppd-booking-dialog__body">
                  <div className="ppd-location-picker ppd-location-picker--dialog">
                    <PhotographyLocationPicker
                      value={selectedLocation}
                      onSelect={(location) => {
                        onLocationChange(location);
                        closePanel();
                      }}
                      compact
                      title="Pin địa điểm"
                      hint="Tìm địa chỉ hoặc chỉnh pin trên bản đồ."
                      radiusKm={null}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
};
