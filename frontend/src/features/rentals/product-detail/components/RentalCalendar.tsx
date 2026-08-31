import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RentalCalendarDay } from "../types/product-detail.types";

interface RentalCalendarProps {
  calendarDate: Date;
  days: RentalCalendarDay[];
  rentalMode: "DAILY" | "HOURLY";
  startDate: string;
  endDate: string;
  singleDate: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
}

export const RentalCalendar: React.FC<RentalCalendarProps> = ({
  calendarDate,
  days,
  rentalMode,
  startDate,
  endDate,
  singleDate,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
}) => (
  <div className="rental-calendar">
    <div className="rental-calendar__header">
      <button type="button" onClick={onPreviousMonth} aria-label="Tháng trước">
        <ChevronLeft size={17} />
      </button>
      <strong>
        Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
      </strong>
      <button type="button" onClick={onNextMonth} aria-label="Tháng sau">
        <ChevronRight size={17} />
      </button>
    </div>

    <div className="rental-calendar__grid">
      {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((weekday) => (
        <span key={weekday} className="rental-calendar__weekday">{weekday}</span>
      ))}
      {days.map((day, index) => {
        if (day.isEmpty) return <span key={`empty-${index}`} aria-hidden="true" />;

        const isSelected = rentalMode === "HOURLY"
          ? singleDate === day.dateStr
          : startDate === day.dateStr || endDate === day.dateStr;
        const isInRange = rentalMode === "DAILY" && Boolean(startDate && endDate)
          && day.dateStr > startDate && day.dateStr < endDate;

        return (
          <button
            key={day.dateStr}
            type="button"
            disabled={!day.isAvailable}
            onClick={() => onSelectDate(day.dateStr)}
            className={`rental-calendar__day${isSelected ? " is-selected" : ""}${isInRange ? " is-in-range" : ""}${day.isWeekend ? " is-weekend" : ""}`}
          >
            {day.day}
          </button>
        );
      })}
    </div>
  </div>
);
