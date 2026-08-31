import React, { useEffect, useState } from "react";
import { CalendarDays, Check, CheckCircle2, Clock3, X } from "lucide-react";
import type {
  ProductAvailabilityView,
  RentalCalendarDay,
  RentalTimeSlot,
} from "../types/product-detail.types";
import { RentalCalendar } from "./RentalCalendar";

type RentalMode = "DAILY" | "HOURLY";
type DailyStep = "start" | "end" | "ready";
type HourlyStep = "date" | "time";

export interface RentalDateTimeModalProps {
  isOpen: boolean;
  rentalMode: RentalMode;
  calendarDate: Date;
  calendarDays: RentalCalendarDay[];
  startDate: string;
  endDate: string;
  singleDate: string;
  startTime: string;
  endTime: string;
  timeSlots: RentalTimeSlot[];
  startSlotIndex: number;
  endSlotIndex: number;
  bookedSlotsOnSelectedDate: string[];
  availability: ProductAvailabilityView;
  isCurrentTimeSlotBusy: boolean;
  onClose: () => void;
  onSelectRentalMode: (mode: RentalMode) => void;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectSlot: (index: number) => void;
  formatDate: (date?: string | null) => string;
  isTimeSlotOverlap: (slot1: string, slot2: string) => boolean;
}

export const RentalDateTimeModal: React.FC<RentalDateTimeModalProps> = ({
  isOpen,
  rentalMode,
  calendarDate,
  calendarDays,
  startDate,
  endDate,
  singleDate,
  startTime,
  endTime,
  timeSlots,
  startSlotIndex,
  endSlotIndex,
  bookedSlotsOnSelectedDate,
  availability,
  isCurrentTimeSlotBusy,
  onClose,
  onSelectRentalMode,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  onSelectSlot,
  formatDate,
  isTimeSlotOverlap,
}) => {
  const [dailyStep, setDailyStep] = useState<DailyStep>("start");
  const [hourlyStep, setHourlyStep] = useState<HourlyStep>("date");

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);


  if (!isOpen) return null;

  const isDailyReady = Boolean(startDate && endDate);
  const isHourlyReady = Boolean(singleDate && startTime && endTime);
  const isReady = rentalMode === "DAILY" ? isDailyReady : isHourlyReady;
  const isUnavailable = isCurrentTimeSlotBusy || availability.state === "unavailable";
  const hasTimeSlots = rentalMode === "HOURLY" && Boolean(singleDate) && timeSlots.length > 0;

  const handleModeChange = (mode: RentalMode) => {
    onSelectRentalMode(mode);
    if (mode === "DAILY") setDailyStep(startDate && !endDate ? "end" : "start");
    else setHourlyStep(singleDate ? "time" : "date");
  };

  const handleDateSelect = (date: string) => {
    if (rentalMode === "HOURLY") {
      onSelectDate(date);
      setHourlyStep("time");
      return;
    }

    const selectingEnd = dailyStep === "end" && Boolean(startDate) && !endDate;
    onSelectDate(date);
    if (selectingEnd && date >= startDate) setDailyStep("ready");
    else setDailyStep("end");
  };

  return (
    <div
      className="rental-date-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="rental-date-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="rental-date-modal-title">
        <div className="rental-date-modal__header">
          <div>
            <span className="figma-product-booking__eyebrow">LỊCH THUÊ</span>
            <h2 id="rental-date-modal-title">Chọn thời gian thuê</h2>
            <p>Chọn ngày và khung giờ phù hợp với lịch của bạn.</p>
          </div>
          <button type="button" className="rental-date-modal__close" onClick={onClose} aria-label="Đóng chọn thời gian">
            <X size={19} />
          </button>
        </div>

        <div className="rental-date-modal__mode-tabs" role="tablist" aria-label="Hình thức thuê">
          <button type="button" role="tab" aria-selected={rentalMode === "DAILY"} className={rentalMode === "DAILY" ? "is-active" : ""} onClick={() => handleModeChange("DAILY")}>Theo ngày</button>
          <button type="button" role="tab" aria-selected={rentalMode === "HOURLY"} className={rentalMode === "HOURLY" ? "is-active" : ""} onClick={() => handleModeChange("HOURLY")}>Theo giờ</button>
        </div>

        {rentalMode === "DAILY" ? (
          <div className="rental-date-modal__steps">
            <button type="button" className={`rental-date-modal__step${dailyStep === "start" ? " is-active" : ""}`} onClick={() => setDailyStep("start")}>
              <span>01</span><div><small>Ngày nhận</small><strong>{startDate ? formatDate(startDate) : "Chưa chọn"}</strong></div>
            </button>
            <span className="rental-date-modal__step-arrow">→</span>
            <button type="button" className={`rental-date-modal__step${dailyStep === "end" ? " is-active" : ""}`} onClick={() => setDailyStep("end")}>
              <span>02</span><div><small>Ngày trả</small><strong>{endDate ? formatDate(endDate) : "Chưa chọn"}</strong></div>
            </button>
          </div>
        ) : (
          <div className="rental-date-modal__steps">
            <button type="button" className={`rental-date-modal__step${hourlyStep === "date" ? " is-active" : ""}`} onClick={() => setHourlyStep("date")}>
              <span>01</span><div><small>Ngày thuê</small><strong>{singleDate ? formatDate(singleDate) : "Chưa chọn"}</strong></div>
            </button>
            <span className="rental-date-modal__step-arrow">→</span>
            <button type="button" className={`rental-date-modal__step${hourlyStep === "time" ? " is-active" : ""}`} onClick={() => setHourlyStep("time")}>
              <span>02</span><div><small>Khung giờ</small><strong>{startTime && endTime ? `${startTime} – ${endTime}` : "Chưa chọn"}</strong></div>
            </button>
          </div>
        )}

        <div className="rental-date-modal__content">
          <div className="rental-date-modal__calendar-panel">
            <div className="rental-date-modal__panel-heading">
              <div><CalendarDays size={17} /><strong>{rentalMode === "DAILY" ? (dailyStep === "end" ? "Chọn ngày trả" : "Chọn ngày nhận") : "Chọn ngày thuê"}</strong></div>
              <span>{rentalMode === "DAILY" ? "Có thể chọn khoảng ngày" : "Chọn một ngày"}</span>
            </div>
            <RentalCalendar
              calendarDate={calendarDate}
              days={calendarDays}
              rentalMode={rentalMode}
              startDate={startDate}
              endDate={endDate}
              singleDate={singleDate}
              onPreviousMonth={onPreviousMonth}
              onNextMonth={onNextMonth}
              onSelectDate={handleDateSelect}
            />
          </div>

          {rentalMode === "HOURLY" && (
            <div className={`rental-date-modal__time-panel${hasTimeSlots ? "" : " is-muted"}`}>
              <div className="rental-date-modal__panel-heading">
                <div><Clock3 size={17} /><strong>Chọn khung giờ</strong></div>
                <span>Tối thiểu 2 giờ</span>
              </div>
              {hasTimeSlots ? (
                <div className="rental-date-modal__time-grid">
                  {timeSlots.map((slot, index) => {
                    const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) => isTimeSlotOverlap(slot.label, bookedSlot));
                    const isSelected = index >= startSlotIndex && index <= endSlotIndex;
                    return (
                      <button key={slot.label} type="button" disabled={isBusy} className={isSelected ? "is-selected" : ""} onClick={() => onSelectSlot(index)}>
                        <span>{slot.start}</span><small>{slot.end}</small>
                        {isBusy && <em>Đã bận</em>}
                      </button>
                    );
                  })}
                </div>
              ) : <p className="rental-date-modal__empty-time">Chọn ngày trước để xem các khung giờ còn trống.</p>}
            </div>
          )}
        </div>

        <div className="rental-date-modal__footer">
          <div className="rental-date-modal__summary">
            {isReady ? <><CheckCircle2 size={17} /><div><strong>{rentalMode === "DAILY" ? `${formatDate(startDate)} → ${formatDate(endDate)}` : `${formatDate(singleDate)} · ${startTime} – ${endTime}`}</strong><span>{rentalMode === "DAILY" ? "Khoảng ngày đã chọn" : "Khung giờ đã chọn"}</span></div></> : <><Clock3 size={17} /><div><strong>{rentalMode === "DAILY" ? "Chọn đủ ngày nhận và ngày trả" : "Chọn ngày rồi chọn khung giờ"}</strong><span>Bạn có thể thay đổi lựa chọn bất cứ lúc nào.</span></div></>}
          </div>
          {availability.state === "available" && availability.result && <span className="rental-date-modal__availability"><Check size={14} /> Còn lịch trống</span>}
          <button type="button" className="rental-date-modal__confirm" disabled={!isReady || isUnavailable} onClick={onClose}>Xác nhận thời gian</button>
        </div>
      </div>
    </div>
  );
};
