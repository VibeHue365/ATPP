import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const calendarStatusLabel = {
  AVAILABLE: 'Còn lịch',
  FULL: 'Đã kín lịch',
  NO_SCHEDULE: 'Chưa mở lịch',
  OFF_DAY: 'Ngày nghỉ',
  PAST: 'Ngày đã qua',
};

export interface PhotographyCalendarDay {
  day: number;
  dateStr: string;
  isWeekend: boolean;
  isAvailable: boolean;
  isEmpty: boolean;
  availabilityStatus?: 'AVAILABLE' | 'FULL' | 'NO_SCHEDULE' | 'OFF_DAY' | 'PAST';
}

export interface PhotographyTimeSlot {
  start: string;
  end: string;
  label: string;
}

interface PhotographyScheduleSelectorProps {
  calendarDate: Date;
  calendarDays: PhotographyCalendarDay[];
  isCalendarLoading?: boolean;
  selectedDate: string;
  slots: PhotographyTimeSlot[];
  selectedStartTime: string;
  selectedEndTime: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: PhotographyTimeSlot) => void;
  isSlotBusy: (slot: PhotographyTimeSlot) => boolean;
}

export const PhotographyScheduleSelector: React.FC<PhotographyScheduleSelectorProps> = ({
  calendarDate,
  calendarDays,
  isCalendarLoading = false,
  selectedDate,
  slots,
  selectedStartTime,
  selectedEndTime,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  onSelectSlot,
  isSlotBusy,
}) => {
  const futureDays = calendarDays.filter((day) => !day.isEmpty && day.availabilityStatus !== 'PAST');
  const hasAvailableDay = futureDays.some((day) => day.isAvailable);
  const hasNoWorkingSchedule = futureDays.length > 0 && futureDays.every((day) => day.availabilityStatus === 'NO_SCHEDULE' || day.availabilityStatus === 'OFF_DAY');

  return (
  <section className="pd-schedule-section">
    <h2 className="pd-section-title">
      <span className="pd-section-title-num">2</span>
      <span>Lịch & khung giờ</span>
    </h2>
    <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', marginBottom: '24px', marginLeft: '36px', textAlign: 'left' }}>
      Chọn thời gian phù hợp để ghi lại những khoảnh khắc đẹp nhất.
    </p>
    
    <div className="pd-schedule-layout">
      {/* Cột trái: Lịch tháng */}
      <div>
        <div className="pd-calendar-header">
          <button type="button" onClick={onPreviousMonth} aria-label="Tháng trước" className="pd-calendar-month-btn">
            <ChevronLeft size={18} />
          </button>
          <span className="pd-calendar-title">
            Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
          </span>
          <button type="button" onClick={onNextMonth} aria-label="Tháng sau" className="pd-calendar-month-btn">
            <ChevronRight size={18} />
          </button>
        </div>
        
        {isCalendarLoading && <p className="pd-calendar-loading">Đang kiểm tra lịch làm việc…</p>}
        {!isCalendarLoading && !hasAvailableDay && hasNoWorkingSchedule && <p className="pd-calendar-empty-note">Nhiếp ảnh gia chưa mở lịch làm việc trong tháng này.</p>}
        {!isCalendarLoading && !hasAvailableDay && !hasNoWorkingSchedule && <p className="pd-calendar-empty-note">Các khung giờ còn lại trong tháng này đã kín hoặc là ngày nghỉ.</p>}
        <div className="pd-calendar-grid" aria-busy={isCalendarLoading}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
            <span key={day} className="pd-calendar-weekday">{day}</span>
          ))}
          {calendarDays.map((day, index) => {
            if (day.isEmpty) return <div key={`empty-${index}`} />;
            const isSelected = selectedDate === day.dateStr;
            const status = day.availabilityStatus || 'NO_SCHEDULE';
            return (
              <button
                key={day.dateStr}
                type="button"
                disabled={!day.isAvailable || isCalendarLoading}
                onClick={() => onSelectDate(day.dateStr)}
                title={calendarStatusLabel[status]}
                className={`pd-calendar-day-btn ${isSelected ? 'selected' : ''} ${day.isWeekend ? 'weekend' : ''} pd-calendar-day-btn--${status.toLowerCase()}`}
              >
                {day.day}
              </button>
            );
          })}
        </div>
        <div className="pd-calendar-legend" aria-label="Chú thích lịch">
          <span><i className="pd-calendar-legend__available" />Còn lịch</span>
          <span><i className="pd-calendar-legend__disabled" />Chưa mở lịch / ngày nghỉ</span><span><i className="pd-calendar-legend__full" />Đã kín</span>
        </div>
      </div>
      
      {/* Cột phải: Khung giờ */}
      <div className="pd-time-slots-wrapper">
        <h3 className="pd-time-slots-title">Chọn giờ chụp</h3>
        <div className="pd-time-slots-grid">
          {slots.map((slot) => {
            const isBusy = isSlotBusy(slot);
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const [hour, minute] = slot.start.split(':').map(Number);
            const isPast = selectedDate === today && (hour < now.getHours() || (hour === now.getHours() && minute <= now.getMinutes()));
            const isSelected = selectedStartTime === slot.start && selectedEndTime === slot.end;
            const disabled = isBusy || isPast;
            return (
              <button
                key={slot.label}
                type="button"
                disabled={disabled}
                onClick={() => onSelectSlot(slot)}
                className={`pd-time-slot-btn ${isSelected ? 'selected' : ''}`}
              >
                <span>{slot.label}</span>
                <span className="pd-time-slot-status">
                  {isBusy ? 'Đã bận' : isPast ? 'Đã qua' : isSelected ? 'Đã chọn' : 'Trống'}
                </span>
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--color-text-secondary)', display: 'block', marginTop: '14px' }}>
          * Chọn một khung giờ phù hợp với thời lượng gói dịch vụ.
        </span>
      </div>
    </div>
  </section>
  );
};