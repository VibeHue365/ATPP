import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Camera,
  Layers,
  RotateCcw,
} from 'lucide-react';
import './ServiceDatePicker.css';

export interface ServiceDateValue {
  rentalType: 'DAILY' | 'HOURLY';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  singleDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  timeSlot?: string; // e.g. "08:00 - 11:00"
}

export interface ServiceDatePickerProps {
  serviceType: 'aodai' | 'photographer' | 'combo';
  value: ServiceDateValue;
  onChange: (val: ServiceDateValue) => void;
  id?: string;
  className?: string;
}

const VIETNAMESE_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const VIETNAMESE_WEEKDAYS_FULL = [
  'Chủ Nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

const QUICK_TIME_CHIPS = [
  { label: '08:00 - 10:00', start: '08:00', end: '10:00', tag: '2h • Sáng' },
  { label: '09:00 - 12:00', start: '09:00', end: '12:00', tag: '3h • Sáng' },
  { label: '14:00 - 16:30', start: '14:00', end: '16:30', tag: '2.5h • Chiều' },
  { label: '15:00 - 18:00', start: '15:00', end: '18:00', tag: '3h • Chiều' },
  { label: '17:00 - 19:30', start: '17:00', end: '19:30', tag: '2.5h • Hoàng hôn' },
];

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateFull = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = VIETNAMESE_WEEKDAYS_FULL[date.getDay()];
  return `${dayName}, ${d} thg ${m} ${y}`;
};

const formatDateShort = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = VIETNAMESE_WEEKDAYS_FULL[date.getDay()];
  return `${dayName}, ${d} thg ${m}`;
};

export const ServiceDatePicker: React.FC<ServiceDatePickerProps> = ({
  serviceType,
  value,
  onChange,
  id,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local editing states (committed to parent on Apply or click)
  const isHourlyDefault = serviceType === 'photographer' || serviceType === 'combo';
  const effectiveMode = isHourlyDefault ? 'HOURLY' : value.rentalType;

  const [mode, setMode] = useState<'DAILY' | 'HOURLY'>(effectiveMode);
  const [startDate, setStartDate] = useState(value.startDate || '');
  const [endDate, setEndDate] = useState(value.endDate || '');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const [singleDate, setSingleDate] = useState(value.singleDate || value.startDate || toDateString(new Date()));
  const [startTime, setStartTime] = useState(value.startTime || '08:00');
  const [endTime, setEndTime] = useState(value.endTime || '11:00');

  // Month navigation base date
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value.startDate) {
      const [y, m] = value.startDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Sync mode when serviceType changes
  useEffect(() => {
    if (serviceType === 'photographer' || serviceType === 'combo') {
      setMode('HOURLY');
    } else {
      setMode(value.rentalType || 'DAILY');
    }
  }, [serviceType, value.rentalType]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Today reference
  const todayStr = useMemo(() => toDateString(new Date()), []);

  // Compute Month 1 and Month 2
  const month1Year = viewDate.getFullYear();
  const month1Month = viewDate.getMonth();

  const month2Date = useMemo(() => {
    return new Date(month1Year, month1Month + 1, 1);
  }, [month1Year, month1Month]);

  const month2Year = month2Date.getFullYear();
  const month2Month = month2Date.getMonth();

  // Helper to build day cells
  const buildMonthDays = (year: number, month: number) => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
    const startOffset = (firstDay + 6) % 7; // Mon = 0, Sun = 6

    const cells: Array<{ day: number; dateStr: string; isPast: boolean; isSunday: boolean } | null> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      cells.push({
        day: d,
        dateStr,
        isPast: dateStr < todayStr,
        isSunday: dayOfWeek === 0,
      });
    }
    return cells;
  };

  const month1Days = useMemo(() => buildMonthDays(month1Year, month1Month), [month1Year, month1Month, todayStr]);
  const month2Days = useMemo(() => buildMonthDays(month2Year, month2Month), [month2Year, month2Month, todayStr]);

  // Daily duration
  const dailyDiffDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    const diff = Math.round((e - s) / (1000 * 3600 * 24));
    return diff <= 0 ? 1 : diff;
  }, [startDate, endDate]);

  // Hourly duration
  const hourlyDuration = useMemo(() => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    const h = mins / 60;
    return h > 0 ? h : 0;
  }, [startTime, endTime]);

  // Handle Day Click in Daily mode
  const handleDailyDayClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate('');
    } else {
      // startDate exists, no endDate
      if (dateStr < startDate) {
        setStartDate(dateStr);
        setEndDate('');
      } else {
        setEndDate(dateStr);
      }
    }
  };

  // Commit changes to parent
  const handleApply = () => {
    if (mode === 'DAILY') {
      const validEnd = endDate || startDate;
      onChange({
        rentalType: 'DAILY',
        startDate,
        endDate: validEnd,
        singleDate: startDate,
        startTime,
        endTime,
        timeSlot: `${startTime} - ${endTime}`,
      });
    } else {
      onChange({
        rentalType: 'HOURLY',
        startDate: singleDate,
        endDate: singleDate,
        singleDate,
        startTime,
        endTime,
        timeSlot: `${startTime} - ${endTime}`,
      });
    }
    setIsOpen(false);
  };

  // Quick presets
  const handlePreset = (type: 'today' | 'tomorrow' | 'weekend') => {
    const now = new Date();
    if (type === 'today') {
      const d = toDateString(now);
      if (mode === 'DAILY') {
        setStartDate(d);
        setEndDate(d);
      } else {
        setSingleDate(d);
      }
    } else if (type === 'tomorrow') {
      const tom = new Date(now);
      tom.setDate(now.getDate() + 1);
      const d = toDateString(tom);
      if (mode === 'DAILY') {
        setStartDate(d);
        setEndDate(d);
      } else {
        setSingleDate(d);
      }
    } else if (type === 'weekend') {
      const sat = new Date(now);
      const day = now.getDay();
      const diffToSat = (6 - day + 7) % 7;
      sat.setDate(now.getDate() + diffToSat);
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);

      if (mode === 'DAILY') {
        setStartDate(toDateString(sat));
        setEndDate(toDateString(sun));
      } else {
        setSingleDate(toDateString(sat));
      }
    }
  };

  // Check if date is in range
  const isDateInRange = (dateStr: string) => {
    if (startDate && endDate) {
      return dateStr > startDate && dateStr < endDate;
    }
    if (startDate && !endDate && hoverDate) {
      if (hoverDate > startDate) {
        return dateStr > startDate && dateStr <= hoverDate;
      }
    }
    return false;
  };

  // Month navigation
  const prevMonthDisabled = useMemo(() => {
    const now = new Date();
    return viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() <= now.getMonth();
  }, [viewDate]);

  const handlePrevMonth = () => {
    if (prevMonthDisabled) return;
    setViewDate(new Date(month1Year, month1Month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(month1Year, month1Month + 1, 1));
  };

  // Render Label on trigger button
  const renderTriggerContent = () => {
    if (serviceType === 'photographer') {
      if (value.singleDate || value.startDate) {
        const d = value.singleDate || value.startDate;
        const slot = value.timeSlot || `${value.startTime || '08:00'} - ${value.endTime || '10:30'}`;
        return (
          <div className="sdp-trigger-content">
            <span className="sdp-trigger-main">{formatDateShort(d)}</span>
            <span className="sdp-trigger-sub">Ca chụp: {slot}</span>
          </div>
        );
      }
      return <span className="sdp-trigger-placeholder">Chọn ngày & ca chụp ảnh</span>;
    }

    if (serviceType === 'combo') {
      if (value.singleDate || value.startDate) {
        const d = value.singleDate || value.startDate;
        const slot = value.timeSlot || `${value.startTime || '08:00'} - ${value.endTime || '11:00'}`;
        return (
          <div className="sdp-trigger-content">
            <span className="sdp-trigger-main">{formatDateShort(d)}</span>
            <span className="sdp-trigger-sub">Lịch combo: {slot}</span>
          </div>
        );
      }
      return <span className="sdp-trigger-placeholder">Chọn ngày & giờ combo</span>;
    }

    // Ao Dai
    if (value.rentalType === 'HOURLY') {
      if (value.singleDate || value.startDate) {
        const d = value.singleDate || value.startDate;
        return (
          <div className="sdp-trigger-content">
            <span className="sdp-trigger-main">{formatDateShort(d)}</span>
            <span className="sdp-trigger-sub">{value.startTime || '08:00'} - {value.endTime || '11:00'} (Theo giờ)</span>
          </div>
        );
      }
      return <span className="sdp-trigger-placeholder">Chọn ngày & giờ thuê áo</span>;
    }

    // Ao Dai DAILY
    if (value.startDate) {
      if (value.endDate && value.endDate !== value.startDate) {
        return (
          <div className="sdp-trigger-content">
            <span className="sdp-trigger-main">
              {formatDateShort(value.startDate)} - {formatDateShort(value.endDate)}
            </span>
            <span className="sdp-trigger-sub">Thuê theo ngày</span>
          </div>
        );
      }
      return (
        <div className="sdp-trigger-content">
          <span className="sdp-trigger-main">{formatDateShort(value.startDate)}</span>
          <span className="sdp-trigger-sub">Nhận trong ngày</span>
        </div>
      );
    }

    return <span className="sdp-trigger-placeholder">Chọn ngày nhận - trả</span>;
  };

  return (
    <div className={`sdp-container ${className}`} ref={containerRef}>
      {/* Trigger Button inside Search Bar */}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        className="sdp-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {renderTriggerContent()}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="sdp-popover" role="dialog" aria-label="Bộ chọn ngày và giờ">
          {/* Service Switch (Only for Ao Dai) */}
          {serviceType === 'aodai' && (
            <div className="sdp-mode-switch">
              <button
                type="button"
                className={`sdp-mode-btn ${mode === 'DAILY' ? 'is-active' : ''}`}
                onClick={() => setMode('DAILY')}
              >
                <CalendarIcon size={14} />
                <span>Thuê theo ngày</span>
              </button>
              <button
                type="button"
                className={`sdp-mode-btn ${mode === 'HOURLY' ? 'is-active' : ''}`}
                onClick={() => setMode('HOURLY')}
              >
                <Clock size={14} />
                <span>Thuê theo giờ</span>
              </button>
            </div>
          )}

          {/* Mode Context Banner for Photo/Combo */}
          {serviceType === 'photographer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, color: '#8B263E', fontSize: 13, fontWeight: 700 }}>
              <Camera size={16} />
              <span>Đặt lịch chụp ảnh theo ca (Chọn ngày & khung giờ)</span>
            </div>
          )}

          {serviceType === 'combo' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, color: '#8B263E', fontSize: 13, fontWeight: 700 }}>
              <Layers size={16} />
              <span>Lịch trọn gói Combo (Áo dài & Thợ chụp ảnh đồng bộ)</span>
            </div>
          )}

          {/* MODE: DAILY (Traveloka Dual Month View) */}
          {mode === 'DAILY' ? (
            <>
              {/* Summary Ribbon */}
              <div className="sdp-summary-ribbon">
                <div className="sdp-summary-box">
                  <span className="sdp-summary-label">Nhận đồ</span>
                  <span className="sdp-summary-date">
                    {startDate ? formatDateFull(startDate) : 'Chọn ngày nhận'}
                  </span>
                </div>

                {dailyDiffDays !== null ? (
                  <span className="sdp-summary-duration">{dailyDiffDays} ngày</span>
                ) : (
                  <span style={{ color: '#b5a8a0', fontSize: 13 }}>→</span>
                )}

                <div className="sdp-summary-box" style={{ textAlign: 'right' }}>
                  <span className="sdp-summary-label">Trả đồ</span>
                  <span className="sdp-summary-date">
                    {endDate ? formatDateFull(endDate) : 'Chọn ngày trả'}
                  </span>
                </div>
              </div>

              {/* Dual Month Calendar */}
              <div className="sdp-dual-months">
                {/* Month 1 */}
                <div className="sdp-month-block">
                  <div className="sdp-month-header">
                    <button
                      type="button"
                      className="sdp-nav-btn"
                      disabled={prevMonthDisabled}
                      onClick={handlePrevMonth}
                      title="Tháng trước"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="sdp-month-title">
                      tháng {month1Month + 1} năm {month1Year}
                    </span>
                    <div style={{ width: 32 }} /> {/* spacer */}
                  </div>

                  <div className="sdp-weekdays">
                    {VIETNAMESE_WEEKDAYS.map((w, idx) => (
                      <span key={w} className={`sdp-weekday ${idx === 6 ? 'is-sunday' : ''}`}>
                        {w}
                      </span>
                    ))}
                  </div>

                  <div className="sdp-days-grid">
                    {month1Days.map((cell, idx) => {
                      if (!cell) return <div key={`empty-1-${idx}`} className="sdp-day-cell" />;
                      const isStart = cell.dateStr === startDate;
                      const isEnd = cell.dateStr === endDate;
                      const inRange = isDateInRange(cell.dateStr);

                      return (
                        <div
                          key={cell.dateStr}
                          className={`sdp-day-cell ${inRange ? 'is-in-range' : ''} ${isStart ? 'is-range-start' : ''} ${isEnd ? 'is-range-end' : ''}`}
                        >
                          <button
                            type="button"
                            disabled={cell.isPast}
                            onClick={() => handleDailyDayClick(cell.dateStr)}
                            onMouseEnter={() => setHoverDate(cell.dateStr)}
                            onMouseLeave={() => setHoverDate(null)}
                            className={`sdp-day-btn ${cell.isSunday ? 'is-sunday' : ''} ${isStart ? 'is-start-date' : ''} ${isEnd ? 'is-end-date' : ''} ${cell.dateStr === todayStr ? 'is-today' : ''}`}
                          >
                            {cell.day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Month 2 */}
                <div className="sdp-month-block">
                  <div className="sdp-month-header">
                    <div style={{ width: 32 }} /> {/* spacer */}
                    <span className="sdp-month-title">
                      tháng {month2Month + 1} năm {month2Year}
                    </span>
                    <button
                      type="button"
                      className="sdp-nav-btn"
                      onClick={handleNextMonth}
                      title="Tháng sau"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="sdp-weekdays">
                    {VIETNAMESE_WEEKDAYS.map((w, idx) => (
                      <span key={w} className={`sdp-weekday ${idx === 6 ? 'is-sunday' : ''}`}>
                        {w}
                      </span>
                    ))}
                  </div>

                  <div className="sdp-days-grid">
                    {month2Days.map((cell, idx) => {
                      if (!cell) return <div key={`empty-2-${idx}`} className="sdp-day-cell" />;
                      const isStart = cell.dateStr === startDate;
                      const isEnd = cell.dateStr === endDate;
                      const inRange = isDateInRange(cell.dateStr);

                      return (
                        <div
                          key={cell.dateStr}
                          className={`sdp-day-cell ${inRange ? 'is-in-range' : ''} ${isStart ? 'is-range-start' : ''} ${isEnd ? 'is-range-end' : ''}`}
                        >
                          <button
                            type="button"
                            disabled={cell.isPast}
                            onClick={() => handleDailyDayClick(cell.dateStr)}
                            onMouseEnter={() => setHoverDate(cell.dateStr)}
                            onMouseLeave={() => setHoverDate(null)}
                            className={`sdp-day-btn ${cell.isSunday ? 'is-sunday' : ''} ${isStart ? 'is-start-date' : ''} ${isEnd ? 'is-end-date' : ''} ${cell.dateStr === todayStr ? 'is-today' : ''}`}
                          >
                            {cell.day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* MODE: HOURLY / PHOTOGRAPHER / COMBO (Single Month + Time Column) */
            <div className="sdp-hourly-layout">
              {/* Single Month Calendar */}
              <div className="sdp-month-block" style={{ width: 290 }}>
                <div className="sdp-month-header">
                  <button
                    type="button"
                    className="sdp-nav-btn"
                    disabled={prevMonthDisabled}
                    onClick={handlePrevMonth}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="sdp-month-title">
                    tháng {month1Month + 1} năm {month1Year}
                  </span>
                  <button
                    type="button"
                    className="sdp-nav-btn"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="sdp-weekdays">
                  {VIETNAMESE_WEEKDAYS.map((w, idx) => (
                    <span key={w} className={`sdp-weekday ${idx === 6 ? 'is-sunday' : ''}`}>
                      {w}
                    </span>
                  ))}
                </div>

                <div className="sdp-days-grid">
                  {month1Days.map((cell, idx) => {
                    if (!cell) return <div key={`empty-hourly-${idx}`} className="sdp-day-cell" />;
                    const isSelected = cell.dateStr === singleDate;

                    return (
                      <div key={cell.dateStr} className="sdp-day-cell">
                        <button
                          type="button"
                          disabled={cell.isPast}
                          onClick={() => setSingleDate(cell.dateStr)}
                          className={`sdp-day-btn ${cell.isSunday ? 'is-sunday' : ''} ${isSelected ? 'is-start-date' : ''} ${cell.dateStr === todayStr ? 'is-today' : ''}`}
                        >
                          {cell.day}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#2b2320' }}>
                  Ngày đã chọn: <span style={{ color: '#8B263E' }}>{formatDateFull(singleDate)}</span>
                </div>
              </div>

              {/* Time Column */}
              <div className="sdp-time-column">
                <span className="sdp-time-heading">
                  {serviceType === 'photographer'
                    ? 'Khung giờ chụp dự kiến'
                    : 'Khung giờ thuê trang phục'}
                </span>
                <span className="sdp-time-note">Tối thiểu thuê từ 2 giờ trở lên</span>

                {/* Quick Chips */}
                <div className="sdp-time-chips">
                  {QUICK_TIME_CHIPS.map((chip) => {
                    const isActive = startTime === chip.start && endTime === chip.end;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          setStartTime(chip.start);
                          setEndTime(chip.end);
                        }}
                        className={`sdp-time-chip ${isActive ? 'is-active' : ''}`}
                      >
                        <span>{chip.label}</span>
                        <span className="sdp-chip-tag">{chip.tag}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time Dropdowns */}
                <div className="sdp-custom-time-row">
                  <div className="sdp-custom-time-field">
                    <label>Giờ bắt đầu</label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`start-${t}`} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sdp-custom-time-field">
                    <label>Giờ kết thúc</label>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`end-${t}`} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration banner */}
                <div className="sdp-duration-banner">
                  <Clock size={14} />
                  <span>
                    Thời lượng thuê: <strong>{hourlyDuration} tiếng</strong>{' '}
                    {hourlyDuration < 2 ? '(Chưa đủ 2h)' : '✓ Hợp lệ'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Popover Footer */}
          <div className="sdp-footer">
            <div className="sdp-presets">
              <button
                type="button"
                className="sdp-preset-btn"
                onClick={() => handlePreset('today')}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className="sdp-preset-btn"
                onClick={() => handlePreset('tomorrow')}
              >
                Ngày mai
              </button>
              <button
                type="button"
                className="sdp-preset-btn"
                onClick={() => handlePreset('weekend')}
              >
                Cuối tuần này
              </button>
            </div>

            <div className="sdp-actions">
              <button
                type="button"
                className="sdp-reset-btn"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                <RotateCcw size={13} style={{ display: 'inline', marginRight: 4 }} />
                Đặt lại
              </button>
              <button
                type="button"
                className="sdp-apply-btn"
                onClick={handleApply}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
