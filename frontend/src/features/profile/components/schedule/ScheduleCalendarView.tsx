import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface ScheduleCalendarViewProps {
  bookings: any[];
  onSelectBooking: (booking: any) => void;
}

export const ScheduleCalendarView: React.FC<ScheduleCalendarViewProps> = ({
  bookings,
  onSelectBooking
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Index bookings by 'YYYY-MM-DD'
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    bookings.forEach((b) => {
      (b.items || []).forEach((item: any) => {
        const rawDate = item.shootDate || item.startDate || item.rentalFrom || b.startDate;
        if (rawDate) {
          const dateKey = new Date(rawDate).toISOString().split('T')[0];
          const list = map.get(dateKey) || [];
          list.push({ booking: b, item });
          map.set(dateKey, list);
        }
      });
    });
    return map;
  }, [bookings]);

  const daysCells = useMemo(() => {
    const cells = [];
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateKey: ''
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        day,
        isCurrentMonth: true,
        dateKey,
        events: bookingsByDate.get(dateKey) || []
      });
    }

    // Next month padding
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateKey: ''
      });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayIndex, bookingsByDate]);

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  return (
    <div className="lume-schedule-calendar-card">
      {/* Month Navigation */}
      <div className="lume-calendar-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={18} color="#8B1E2D" />
          <h3 className="lume-calendar-month-title">
            {monthNames[month]} năm {year}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #DED7CB',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #DED7CB',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grid Day Names */}
      <div className="lume-calendar-grid-header">
        <div>Thứ 2</div>
        <div>Thứ 3</div>
        <div>Thứ 4</div>
        <div>Thứ 5</div>
        <div>Thứ 6</div>
        <div>Thứ 7</div>
        <div style={{ color: '#8B1E2D' }}>Chủ Nhật</div>
      </div>

      {/* Grid Days */}
      <div className="lume-calendar-days-grid">
        {daysCells.map((cell, idx) => {
          const events = cell.events || [];
          return (
            <div
              key={idx}
              className={`lume-calendar-day-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${events.length > 0 ? 'selected' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="lume-calendar-day-number">{cell.day}</span>
                {events.length > 0 && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#8B1E2D'
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                {events.slice(0, 2).map((ev: any, evIdx: number) => {
                  const isPhoto = ev.item.itemType === 'PHOTOGRAPHY_PACKAGE';
                  return (
                    <button
                      key={evIdx}
                      type="button"
                      onClick={() => onSelectBooking(ev.booking)}
                      className={`lume-calendar-day-pill ${isPhoto ? 'photo' : 'rental'}`}
                      style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }}
                      title={ev.item.name || (isPhoto ? 'Lịch chụp ảnh' : 'Thuê áo dài')}
                    >
                      {isPhoto ? '📷 ' : '👘 '}
                      {ev.item.name || (isPhoto ? 'Chụp ảnh' : 'Thuê áo')}
                    </button>
                  );
                })}
                {events.length > 2 && (
                  <span style={{ fontSize: '9px', color: '#8C827A', fontWeight: 700 }}>
                    +{events.length - 2} lịch khác
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
