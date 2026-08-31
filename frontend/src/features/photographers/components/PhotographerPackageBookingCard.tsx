import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,

  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import type { LocationSelection, PhotographerDetails, PhotographerPackage, PhotographyQuote } from '../types/photographer.types';
import type { PhotographyCalendarDay, PhotographyTimeSlot } from './PhotographyScheduleSelector';
import { PhotographyLocationPicker } from './PhotographyLocationPicker';

interface PhotographerPackageBookingCardProps {
  photographer: PhotographerDetails;
  packages: PhotographerPackage[];
  selectedPackage: PhotographerPackage | null;
  selectedDate: string;
  startTime: string;
  endTime: string;
  selectedTimeSlot: string;
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
  slots: PhotographyTimeSlot[];
  isSlotBusy: (slot: PhotographyTimeSlot) => boolean;
  onSelectPackage: (pkg: PhotographerPackage) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onPreviewDate: (date: string) => void;
  onConfirmSchedule: (date: string, slot: PhotographyTimeSlot) => void;
  onCancelSchedule: () => void;
  onLocationChange: (location: LocationSelection) => void;
  onAgreeTermsChange: (checked: boolean) => void;
  onBookNow: () => void;
  onAddToCart: () => void;
}

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

const formatDate = (date: string) => {
  if (!date) return 'Chưa chọn ngày';
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return `${hours} giờ${rest ? ` ${rest} phút` : ''}`;
};

export const PhotographerPackageBookingCard: React.FC<PhotographerPackageBookingCardProps> = ({
  photographer,
  packages,
  selectedPackage,
  selectedDate,
  startTime,
  endTime,
  selectedTimeSlot,
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
  slots,
  isSlotBusy,
  onSelectPackage,
  onPreviousMonth,
  onNextMonth,
  onPreviewDate,
  onConfirmSchedule,
  onCancelSchedule,
  onLocationChange,
  onAgreeTermsChange,
  onBookNow,
  onAddToCart,
}) => {
  const [openPanel, setOpenPanel] = useState<'schedule' | 'location' | null>(null);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftSlot, setDraftSlot] = useState<PhotographyTimeSlot | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const packagePrice = selectedPackage?.price ?? 0;
  const total = quote?.valid && quote.totals ? quote.totals.totalAmount : packagePrice;
  const quoteMessage = quote?.valid === false ? quote.errors[0]?.message : quoteError;
  const availableDays = useMemo(
    () => calendarDays.filter((day) => !day.isEmpty),
    [calendarDays],
  );
  const selectedPackageImage = selectedPackage?.images?.find(Boolean);
  const photographerImage = selectedPackageImage || photographer.coverImage || photographer.portfolio[0] || photographer.media.images[0];
  const hasBookingDetails = Boolean(selectedDate && startTime && selectedLocation);
  const actionDisabled = isBooking || isQuoteLoading || isBusy || !quote?.valid || !quote.totals || !hasBookingDetails;
  const openSchedulePanel = () => {
    setDraftDate(selectedDate);
    setDraftSlot(slots.find((slot) => slot.start === startTime && slot.end === endTime) || null);
    setScheduleError(null);
    setOpenPanel('schedule');
  };

  const closePanel = () => {
    if (openPanel === 'schedule') onCancelSchedule();
    setScheduleError(null);
    setOpenPanel(null);
  };

  const handleDatePreview = (date: string) => {
    setDraftDate(date);
    setDraftSlot(null);
    setScheduleError(null);
    onPreviewDate(date);
  };

  const handleDraftSlotSelection = (slot: PhotographyTimeSlot) => {
    setDraftSlot(slot);
    setScheduleError(null);
  };

  const confirmSchedule = () => {
    if (!draftDate || !draftSlot) {
      setScheduleError('Vui lòng chọn ngày và khung giờ trước khi xác nhận.');
      return;
    }
    onConfirmSchedule(draftDate, draftSlot);
    setScheduleError(null);
    setOpenPanel(null);
  };

  useEffect(() => {
    if (!openPanel) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openPanel === 'schedule') onCancelSchedule();
      setScheduleError(null);
      setOpenPanel(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [openPanel, onCancelSchedule]);

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
          <select value={selectedPackage?._id || ''} onChange={(event) => {
            const nextPackage = packages.find((pkg) => pkg._id === event.target.value);
            if (nextPackage) onSelectPackage(nextPackage);
          }}>
            {packages.map((pkg) => <option value={pkg._id} key={pkg._id}>{pkg.name}</option>)}
          </select>
        </label>
      )}

      <div className="ppd-booking-price">
        <div>
          <span>Giá gói</span>
          <strong>{formatPrice(packagePrice)}</strong>
        </div>
        <small>{selectedPackage ? `${formatDuration(selectedPackage.includedDurationMinutes ?? Math.round(selectedPackage.durationHours * 60))} · ${selectedPackage.editedPhotosCount || 0} ảnh chỉnh sửa` : 'Chọn gói để bắt đầu'}</small>
        <div className="ppd-booking-rating"><Star size={14} fill="currentColor" /> {photographer.rating.averageRating.toFixed(1)} <span>({photographer.rating.totalReviews} đánh giá)</span></div>
      </div>

      <section className="ppd-booking-section ppd-booking-section--compact">
        <div className="ppd-booking-section__heading"><span>LỊCH CHỤP</span><CalendarDays size={16} /></div>
        <div className="ppd-booking-choice-grid">
          <button type="button" className={'ppd-booking-choice' + (selectedDate ? ' has-value' : '')} onClick={openSchedulePanel}>
            <span className="ppd-booking-choice__icon"><CalendarDays size={16} /></span>
            <span className="ppd-booking-choice__copy"><small>Ngày chụp</small><strong>{selectedDate ? formatDate(selectedDate) : 'Chọn ngày'}</strong></span>
            <ChevronRight size={15} />
          </button>
          <button type="button" className={'ppd-booking-choice' + (selectedTimeSlot ? ' has-value' : '')} onClick={openSchedulePanel} disabled={!selectedDate}>
            <span className="ppd-booking-choice__icon"><Clock3 size={16} /></span>
            <span className="ppd-booking-choice__copy"><small>Khung giờ</small><strong>{selectedTimeSlot || 'Chọn giờ'}</strong></span>
            <ChevronRight size={15} />
          </button>
        </div>
        {!selectedDate && <p className="ppd-inline-note">Chọn ngày trước để xem các khung giờ còn trống.</p>}
      </section>

      <section className="ppd-booking-section">
        <div className="ppd-booking-section__heading"><span>ĐỊA ĐIỂM</span><MapPin size={16} /></div>
        <button type="button" className={'ppd-location-summary' + (selectedLocation ? ' has-value' : '')} onClick={() => { setScheduleError(null); setOpenPanel('location'); }}>
          <span><MapPin size={16} /><strong>{selectedLocation?.address || 'Chọn địa điểm chụp'}</strong></span>
          <ChevronRight size={16} />
        </button>
        {!selectedLocation && <p className="ppd-inline-note">Địa điểm giúp hệ thống kiểm tra phạm vi phục vụ.</p>}
        {locationError && <p className="ppd-error">{locationError}</p>}
      </section>
      {quote?.valid && quote.breakdown.some((item) => item.type !== 'BASE_PACKAGE') && (
        <section className="ppd-booking-section ppd-breakdown-section">
          <div className="ppd-booking-section__heading"><span>CHI PHÍ PHÁT SINH</span></div>
          {quote.breakdown.filter((item) => item.type !== 'BASE_PACKAGE').map((item, index) => (
            <div className="ppd-breakdown-row" key={`${item.type}-${index}`}><span>{item.label}</span><strong>{formatPrice(item.amount)}</strong></div>
          ))}
        </section>
      )}

      {quoteMessage && <p className="ppd-error">{quoteMessage}</p>}
      {isBusy && <p className="ppd-error">Ca này vừa được giữ chỗ. Vui lòng chọn ca khác.</p>}

      <div className="ppd-booking-total">
        <span>Tạm tính</span>
        <strong>{isQuoteLoading ? 'Đang tính…' : formatPrice(total)}</strong>
      </div>
      <label className="ppd-terms"><input type="checkbox" checked={agreeTerms} onChange={(event) => onAgreeTermsChange(event.target.checked)} /><span>Tôi đồng ý chính sách cọc và cam kết chụp đúng giờ.</span></label>
      <button type="button" className="ppd-primary-button" disabled={actionDisabled} onClick={onBookNow}>
        {isBooking ? 'Đang xử lý…' : <>Tiếp tục xác nhận <ArrowRight size={16} /></>}
      </button>
      <button type="button" className="ppd-secondary-button" disabled={actionDisabled || !canAddToCart} onClick={onAddToCart}>Lưu vào giỏ hàng</button>
      <p className="ppd-payment-note">Sau khi tiếp tục, hệ thống sẽ giữ lịch và chuyển bạn sang bước thanh toán.</p>
      {openPanel && createPortal((
        <div className="ppd-booking-dialog" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <div className={`ppd-booking-dialog__panel${openPanel === 'location' ? ' ppd-booking-dialog__panel--location' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ppd-booking-dialog-title">
            <div className="ppd-booking-dialog__header">
              <div>
                <span className="ppd-eyebrow">ĐẶT LỊCH</span>
                <h2 id="ppd-booking-dialog-title">{openPanel === 'schedule' ? 'Chọn ngày và khung giờ' : 'Chọn địa điểm chụp'}</h2>
              </div>
              <button type="button" className="ppd-booking-dialog__close" onClick={closePanel} aria-label="Đóng"><X size={18} /></button>
            </div>

            {openPanel === 'schedule' ? (
              <div className="ppd-booking-dialog__body">
                <div className="ppd-dialog-selection-summary">
                  <div><small>Ngày chụp</small><strong>{draftDate ? formatDate(draftDate) : 'Chưa chọn'}</strong></div>
                  <div><small>Khung giờ</small><strong>{draftSlot?.label || 'Chưa chọn'}</strong></div>
                </div>
                <div className="ppd-calendar-header">
                  <button type="button" onClick={onPreviousMonth} aria-label="Tháng trước"><ChevronLeft size={16} /></button>
                  <strong>{calendarDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</strong>
                  <button type="button" onClick={onNextMonth} aria-label="Tháng sau"><ChevronRight size={16} /></button>
                </div>
                <div className="ppd-calendar-weekdays">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="ppd-calendar-grid" aria-busy={isCalendarLoading}>
                  {calendarDays.map((day, index) => {
                    if (day.isEmpty) return <span key={'empty-' + index} className="ppd-calendar-day ppd-calendar-day--empty" />;
                    const isSelected = draftDate === day.dateStr;
                    return <button type="button" key={day.dateStr} disabled={!day.isAvailable || isCalendarLoading} className={'ppd-calendar-day' + (isSelected ? ' is-selected' : '') + (day.isAvailable ? ' is-available' : '')} onClick={() => handleDatePreview(day.dateStr)} title={day.availabilityStatus}>{day.day}</button>;
                  })}
                </div>
                {!isCalendarLoading && !availableDays.some((day) => day.isAvailable) && <p className="ppd-inline-note">Tháng này chưa có ngày trống. Bạn có thể chuyển sang tháng kế tiếp.</p>}
                {scheduleError && <p className="ppd-error">{scheduleError}</p>}
                <div className="ppd-dialog-time-section">
                  <div className="ppd-booking-subheading"><span>KHUNG GIỜ CÒN TRỐNG</span><Clock3 size={15} /></div>
                  {slots.length === 0 ? <p className="ppd-inline-note">Chọn một ngày còn lịch để xem ca chụp.</p> : <div className="ppd-dialog-time-grid">{slots.map((slot) => {
                    const busy = isSlotBusy(slot);
                    const selected = draftSlot?.start === slot.start && draftSlot?.end === slot.end;
                    return <button type="button" key={slot.label} disabled={busy} className={'ppd-time-slot' + (selected ? ' is-selected' : '') + (busy ? ' is-busy' : '')} onClick={() => handleDraftSlotSelection(slot)}><span><strong>{slot.start} – {slot.end}</strong><small>{busy ? 'Đã có booking' : selected ? 'Đã chọn' : 'Còn trống'}</small></span>{selected && <Check size={16} />}</button>;
                  })}</div>}
                </div>
                <div className="ppd-dialog-actions">
                  <button type="button" className="ppd-secondary-button" onClick={closePanel}>Hủy</button>
                  <button type="button" className="ppd-primary-button" disabled={!draftDate || !draftSlot} onClick={confirmSchedule}>Xác nhận lịch</button>
                </div>              </div>
            ) : (
              <div className="ppd-booking-dialog__body">
                <div className="ppd-location-picker ppd-location-picker--dialog">
                  <PhotographyLocationPicker value={selectedLocation} onSelect={(location) => { onLocationChange(location); closePanel(); }} compact title="Pin địa điểm" hint="Tìm địa chỉ hoặc chỉnh pin trên bản đồ." radiusKm={null} />
                </div>
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </aside>
  );
};
