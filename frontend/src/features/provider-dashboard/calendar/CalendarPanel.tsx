import {
  CalendarDays,
  CalendarClock,
  CalendarOff,
  CalendarCheck,
  CalendarX,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Camera,
  ShoppingBag,
  PackageCheck,
  Lightbulb,
  CheckCircle2,
  LockOpen,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Users,
  Check,
  CheckCheck,
  RotateCcw,
  Layers,
  Clock,
} from 'lucide-react';
import { daysOfWeekVn } from '../constants';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import { toLocalDateKey } from '../shared/dateHelpers';
import type { useProviderCalendarState } from './useProviderCalendarState';
import './calendarFigma.css';

type CalendarPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<ReturnType<typeof useProviderCalendarState>,
    | 'editingScheduleDay'
    | 'setScheduleCapability'
    | 'scheduleCapability'
    | 'setSelectedScheduleDays'
    | 'selectedScheduleDays'
    | 'setWorkingHourRanges'
    | 'workingHourRanges'
    | 'setEditingScheduleDay'
    | 'blockedDate'
    | 'setBlockedDate'
    | 'schedules'
    | 'activeSubNavTab'
    | 'setActiveSubNavTab'
    | 'calendarMonth'
    | 'setCalendarMonth'
    | 'selectedDate'
    | 'setSelectedDate'
    | 'blockType'
    | 'setBlockType'
    | 'blockSlotStart'
    | 'setBlockSlotStart'
    | 'blockSlotEnd'
    | 'setBlockSlotEnd'
    | 'blockReason'
    | 'setBlockReason'
    | 'listTab'
    | 'setListTab'
  > &
{
  hasAodaiCapability?: boolean;
  hasPhotographyCapability?: boolean;
  toggleScheduleDay: (day: number) => void;
  updateWorkingHourRange: (index: number, field: "end" | "start", value: string) => void;
  handleSaveRecurringSchedules: () => Promise<void>;
  handleBlockDate: () => Promise<void>;
  handleEditRecurringSchedule: (schedule: any) => void;
  handleUnblockDate?: (dateStr: string) => Promise<void>;
  orders?: any[];
};

export function CalendarPanel({
  isLoadingProvider,
  editingScheduleDay,
  hasAodaiCapability,
  hasPhotographyCapability,
  setScheduleCapability,
  scheduleCapability,
  setSelectedScheduleDays,
  selectedScheduleDays,
  toggleScheduleDay,
  setWorkingHourRanges,
  workingHourRanges,
  updateWorkingHourRange,
  setEditingScheduleDay,
  handleSaveRecurringSchedules,
  blockedDate,
  setBlockedDate,
  handleBlockDate,
  schedules,
  handleEditRecurringSchedule,
  handleUnblockDate,
  activeSubNavTab,
  setActiveSubNavTab,
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
  blockType,
  setBlockType,
  blockSlotStart,
  setBlockSlotStart,
  blockSlotEnd,
  setBlockSlotEnd,
  blockReason,
  setBlockReason,
  listTab,
  setListTab,
  orders = [],
}: CalendarPanelProps) {
  // Month navigation helpers
  const currentYear = calendarMonth.getFullYear();
  const currentMonthIdx = calendarMonth.getMonth(); // 0-indexed

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(currentYear, currentMonthIdx - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(currentYear, currentMonthIdx + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(toLocalDateKey(today));
  };

  // Calculate calendar days
  const firstDayOfMonth = new Date(currentYear, currentMonthIdx, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonthIdx + 1, 0);
  const daysInCurrentMonth = lastDayOfMonth.getDate();

  // Convert JS Day (0=Sun, 1=Mon, ..., 6=Sat) to Vietnamese Week index (0=T2, ..., 6=CN)
  const firstDayVnIndex = (firstDayOfMonth.getDay() + 6) % 7;

  // Previous month trailing days
  const prevMonthLastDay = new Date(currentYear, currentMonthIdx, 0).getDate();
  const prevMonthDays: Array<{ dateKey: string; dayNum: number; isOtherMonth: boolean }> = [];
  for (let i = firstDayVnIndex - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(currentYear, currentMonthIdx - 1, d);
    prevMonthDays.push({
      dateKey: toLocalDateKey(prevDate),
      dayNum: d,
      isOtherMonth: true,
    });
  }

  // Current month days
  const currentMonthDays: Array<{ dateKey: string; dayNum: number; isOtherMonth: boolean }> = [];
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const currDate = new Date(currentYear, currentMonthIdx, d);
    currentMonthDays.push({
      dateKey: toLocalDateKey(currDate),
      dayNum: d,
      isOtherMonth: false,
    });
  }

  // Next month leading days to complete grid (multiples of 7)
  const totalCellsSoFar = prevMonthDays.length + currentMonthDays.length;
  const remainingCells = totalCellsSoFar % 7 === 0 ? 0 : 7 - (totalCellsSoFar % 7);
  const nextMonthDays: Array<{ dateKey: string; dayNum: number; isOtherMonth: boolean }> = [];
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(currentYear, currentMonthIdx + 1, d);
    nextMonthDays.push({
      dateKey: toLocalDateKey(nextDate),
      dayNum: d,
      isOtherMonth: true,
    });
  }

  const allCalendarCells = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Helper maps for schedules
  const recurringSchedules = schedules.filter((s) => s.scheduleType === 'RECURRING');
  const recurringDaysSet = new Set(recurringSchedules.map((s) => Number(s.dayOfWeek)));

  const blockedDatesMap = new Map<string, any>();
  schedules
    .filter((s) => s.scheduleType !== 'RECURRING')
    .forEach((s) => {
      if (s.specificDate) {
        const key = toLocalDateKey(new Date(s.specificDate));
        blockedDatesMap.set(key, s);
      }
      if (Array.isArray(s.offDays)) {
        s.offDays.forEach((off: any) => {
          const key = toLocalDateKey(new Date(off));
          blockedDatesMap.set(key, s);
        });
      }
    });

  // Helper map for customer orders by date
  const ordersByDateMap = new Map<string, any[]>();
  orders.forEach((ord) => {
    const rawDate = ord.startDate || ord.rawOrderDate || ord.orderDate || ord.createdAt;
    if (rawDate) {
      try {
        const dateKey = toLocalDateKey(new Date(rawDate));
        if (!ordersByDateMap.has(dateKey)) {
          ordersByDateMap.set(dateKey, []);
        }
        ordersByDateMap.get(dateKey)!.push(ord);
      } catch {
        // ignore invalid dates
      }
    }
  });

  // Calculate monthly stats for the displayed month
  let workingDaysCount = 0;
  let blockedDaysCount = 0;
  let orderDaysCount = 0;

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dayDate = new Date(currentYear, currentMonthIdx, d);
    const dateKey = toLocalDateKey(dayDate);
    const jsDay = dayDate.getDay();
    const isBlocked = blockedDatesMap.has(dateKey);
    const hasOrder = (ordersByDateMap.get(dateKey)?.length || 0) > 0;
    const isRecurringWork = recurringDaysSet.has(jsDay);

    if (isBlocked) {
      blockedDaysCount++;
    } else if (isRecurringWork) {
      workingDaysCount++;
    }

    if (hasOrder) {
      orderDaysCount++;
    }
  }

  const workingPct = Math.round((workingDaysCount / daysInCurrentMonth) * 100);
  const blockedPct = Math.round((blockedDaysCount / daysInCurrentMonth) * 100);
  const ordersPct = Math.round((orderDaysCount / daysInCurrentMonth) * 100);

  // Selected date breakdown
  const selectedDateObj = new Date(selectedDate);
  const selectedDateDayVn = daysOfWeekVn[selectedDateObj.getDay()] || '';
  const selectedDateFormatted = selectedDateObj.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const isSelectedDateToday = selectedDate === toLocalDateKey();
  const selectedDateOrders = ordersByDateMap.get(selectedDate) || [];
  const isSelectedDateBlocked = blockedDatesMap.has(selectedDate);
  const selectedDateSchedule = recurringSchedules.find(
    (s) => Number(s.dayOfWeek) === selectedDateObj.getDay()
  );

  // Quick block action from Overview -> switch to Block Tab with date prefilled
  const handleQuickBlockSelectedDate = () => {
    setBlockedDate(selectedDate);
    setActiveSubNavTab('block');
  };

  // Edit recurring action -> switch to Recurring Tab
  const onEditRecurring = (sched: any) => {
    handleEditRecurringSchedule(sched);
    setActiveSubNavTab('recurring');
  };

  return (
    <main className="cal-container">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <h1>Lịch làm việc &amp; Chặn</h1>
          <p>
            Thiết lập khung giờ hoạt động để khách hàng có thể đặt lịch. Quản lý ngày nghỉ, ngày bận và xem lịch tổng quan.
          </p>
        </div>
        <div className="cal-header-quote">
          <Sparkles size={15} style={{ color: '#832738' }} />
          <span>Chủ động lịch trình — Đón trọn cơ hội</span>
        </div>
      </div>

      {/* Subnav Tabs (Clean Modern Vector Icons) */}
      <div className="cal-subnav">
        <button
          type="button"
          onClick={() => setActiveSubNavTab('overview')}
          className={`cal-subnav-btn ${activeSubNavTab === 'overview' ? 'active' : ''}`}
        >
          <CalendarDays size={16} />
          <span>Lịch tổng quan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubNavTab('recurring')}
          className={`cal-subnav-btn ${activeSubNavTab === 'recurring' ? 'active' : ''}`}
        >
          <CalendarClock size={16} />
          <span>Thiết lập lịch làm việc</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubNavTab('block')}
          className={`cal-subnav-btn ${activeSubNavTab === 'block' ? 'active' : ''}`}
        >
          <CalendarOff size={16} />
          <span>Chặn ngày / khung giờ</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubNavTab('list')}
          className={`cal-subnav-btn ${activeSubNavTab === 'list' ? 'active' : ''}`}
        >
          <SlidersHorizontal size={16} />
          <span>Danh sách đã thiết lập</span>
        </button>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#6B7280', fontWeight: 600 }}>
          Đang tải thông tin lịch trình...
        </div>
      ) : (
        <>
          {/* TAB 1: LỊCH TỔNG QUAN (OVERVIEW 3 COLUMNS) */}
          {activeSubNavTab === 'overview' && (
            <div className="cal-tab-pane cal-overview-grid">
              {/* Card 1: Interactive Month Calendar */}
              <div className="cal-card">
                <div className="cal-month-nav">
                  <div className="cal-month-selector">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="cal-month-nav-btn"
                      title="Tháng trước"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="cal-month-label">
                      Tháng {currentMonthIdx + 1}, {currentYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="cal-month-nav-btn"
                      title="Tháng sau"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoToday}
                    className="cal-btn-today"
                  >
                    Hôm nay
                  </button>
                </div>

                {/* Modern Vector Legend */}
                <div className="cal-legend">
                  <div className="cal-legend-item">
                    <CheckCircle2 size={13} className="cal-legend-icon-work" />
                    <span>Có lịch làm việc</span>
                  </div>
                  <div className="cal-legend-item">
                    <CalendarOff size={13} className="cal-legend-icon-block" />
                    <span>Ngày bị chặn</span>
                  </div>
                  <div className="cal-legend-item">
                    <Users size={13} className="cal-legend-icon-order" />
                    <span>Có đơn đặt lịch</span>
                  </div>
                </div>

                {/* Grid Header (T2 - CN) */}
                <div className="cal-grid">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dow, idx) => (
                    <div key={dow} className={`cal-dow ${idx === 6 ? 'sunday' : ''}`}>
                      {dow}
                    </div>
                  ))}

                  {/* Day Cells */}
                  {allCalendarCells.map((cell, idx) => {
                    const cellDateObj = new Date(cell.dateKey);
                    const jsDay = cellDateObj.getDay();
                    const isBlocked = blockedDatesMap.has(cell.dateKey);
                    const isWorking = recurringDaysSet.has(jsDay) && !isBlocked;
                    const ordersForCell = ordersByDateMap.get(cell.dateKey) || [];
                    const hasOrders = ordersForCell.length > 0;
                    const isSelected = selectedDate === cell.dateKey;
                    const isToday = cell.dateKey === toLocalDateKey();
                    const shiftsCount = recurringSchedules.find((s) => Number(s.dayOfWeek) === jsDay)?.workingHours?.length || 1;

                    return (
                      <button
                        key={`${cell.dateKey}-${idx}`}
                        type="button"
                        onClick={() => setSelectedDate(cell.dateKey)}
                        className={`cal-day-cell ${cell.isOtherMonth ? 'other-month' : ''} ${
                          isSelected ? 'selected' : ''
                        } ${isToday ? 'is-today' : ''}`}
                      >
                        <span>{cell.dayNum}</span>
                        <div className="cal-day-indicators">
                          {isBlocked ? (
                            <span className="cal-day-badge cal-day-badge-block" title="Ngày bị chặn">
                              <CalendarOff size={10} />
                            </span>
                          ) : (
                            <>
                              {isWorking && (
                                <span className="cal-day-badge cal-day-badge-work" title={`${shiftsCount} ca làm việc`}>
                                  • {shiftsCount}
                                </span>
                              )}
                              {hasOrders && (
                                <span className="cal-day-badge cal-day-badge-order" title={`${ordersForCell.length} đơn đặt`}>
                                  <Users size={9} />
                                  <span>{ordersForCell.length}</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Selected Day Details */}
              <div className="cal-card">
                <div className="cal-detail-header">
                  <div className="cal-detail-title-row">
                    <h3 className="cal-card-title">
                      Chi tiết ngày {selectedDateFormatted}
                    </h3>
                    {isSelectedDateToday && (
                      <span className="cal-detail-date-badge">
                        <Sparkles size={11} />
                        <span>Hôm nay</span>
                      </span>
                    )}
                  </div>
                  <div className="cal-detail-orders-count">
                    {selectedDateDayVn} • {selectedDateOrders.length} đơn đặt lịch
                  </div>
                </div>

                {/* Bookings List */}
                <div className="cal-detail-orders-list">
                  {selectedDateOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF' }}>
                      <CalendarDays size={32} style={{ opacity: 0.35, marginBottom: '6px' }} />
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>
                        Chưa có đơn đặt lịch nào trong ngày này.
                      </p>
                    </div>
                  ) : (
                    selectedDateOrders.map((ord: any) => {
                      const isPhoto = ord.bookingType === 'PHOTOGRAPHY' || ord.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY');
                      const isAoDai = ord.bookingType === 'AODAI_RENTAL' || ord.items?.some((i: any) => i.itemType === 'AODAI_RENTAL');
                      const isCombo = ord.bookingType === 'COMBO' || (isPhoto && isAoDai);

                      let iconEl = <Camera size={17} />;
                      let iconClass = 'cal-order-icon-photo';
                      let label = 'Chụp ảnh';

                      if (isCombo) {
                        iconEl = <PackageCheck size={17} />;
                        iconClass = 'cal-order-icon-combo';
                        label = 'Combo trải nghiệm';
                      } else if (isAoDai) {
                        iconEl = <ShoppingBag size={17} />;
                        iconClass = 'cal-order-icon-aodai';
                        label = 'Thuê áo dài';
                      }

                      const timeSlot = ord.schedules?.[0]?.timeSlot || (ord.startDate ? new Date(ord.startDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '08:00 - 12:00');

                      return (
                        <div key={ord._id} className="cal-order-card">
                          <div className="cal-order-left">
                            <div className={`cal-order-icon ${iconClass}`}>
                              {iconEl}
                            </div>
                            <div className="cal-order-info">
                              <h4>{ord.customerName || 'Khách hàng LUMÉ'}</h4>
                              <p>{label} • {ord.status || 'CONFIRMED'}</p>
                            </div>
                          </div>
                          <div className="cal-order-time">
                            <Clock size={12} />
                            <span>{timeSlot}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Open Slots Section */}
                <div className="cal-open-slots-section">
                  <div className="cal-open-slots-title">Khung giờ hoạt động</div>
                  <div className="cal-open-slots-list">
                    {isSelectedDateBlocked ? (
                      <span className="cal-slot-chip blocked">
                        <CalendarOff size={13} />
                        <span>Ngày này đã bị chặn lịch nghỉ</span>
                      </span>
                    ) : selectedDateSchedule && Array.isArray(selectedDateSchedule.workingHours) && selectedDateSchedule.workingHours.length > 0 ? (
                      selectedDateSchedule.workingHours.map((slot: any, idx: number) => (
                        <span key={idx} className="cal-slot-chip">
                          <Clock size={11} style={{ marginRight: 3, verticalAlign: '-1px' }} />
                          {slot.start} - {slot.end}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
                        Không có ca làm việc cố định
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickBlockSelectedDate}
                    className="cal-btn-quick-block"
                  >
                    <CalendarOff size={15} />
                    <span>+ Chặn ngày này</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Monthly Statistics */}
              <div className="cal-card">
                <h3 className="cal-card-title">
                  <CalendarDays size={18} style={{ color: '#4A0E17' }} />
                  <span>Thống kê lịch tháng {currentMonthIdx + 1}</span>
                </h3>

                <div className="cal-stats-list">
                  <div className="cal-stat-item">
                    <div className="cal-stat-info">
                      <div className="cal-stat-icon-wrap" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                        <CalendarCheck size={17} />
                      </div>
                      <div>
                        <div className="cal-stat-title">Ngày làm việc</div>
                        <div className="cal-stat-val">{workingDaysCount} ngày</div>
                      </div>
                    </div>
                    <span className="cal-stat-badge cal-stat-badge-green">{workingPct}%</span>
                  </div>

                  <div className="cal-stat-item">
                    <div className="cal-stat-info">
                      <div className="cal-stat-icon-wrap" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                        <CalendarX size={17} />
                      </div>
                      <div>
                        <div className="cal-stat-title">Ngày bị chặn</div>
                        <div className="cal-stat-val">{blockedDaysCount} ngày</div>
                      </div>
                    </div>
                    <span className="cal-stat-badge cal-stat-badge-red">{blockedPct}%</span>
                  </div>

                  <div className="cal-stat-item">
                    <div className="cal-stat-info">
                      <div className="cal-stat-icon-wrap" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                        <Users size={17} />
                      </div>
                      <div>
                        <div className="cal-stat-title">Có đơn đặt lịch</div>
                        <div className="cal-stat-val">{orderDaysCount} ngày</div>
                      </div>
                    </div>
                    <span className="cal-stat-badge cal-stat-badge-blue">{ordersPct}%</span>
                  </div>
                </div>

                {/* Tip Callout */}
                <div className="cal-tip-box">
                  <div className="cal-tip-title">
                    <Lightbulb size={15} />
                    <span>Mẹo nhỏ</span>
                  </div>
                  <p className="cal-tip-desc">
                    Bạn có thể bấm trực tiếp vào bất kỳ ngày nào trên lịch để xem đơn đặt hoặc ấn <strong>+ Chặn ngày này</strong> để thiết lập nghỉ đột xuất nhanh.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THIẾT LẬP LỊCH LÀM VIỆC (2 COLUMNS: FORM + RECURRING LIST) */}
          {activeSubNavTab === 'recurring' && (
            <div className="cal-tab-pane cal-tab-two-col">
              {/* Left Column: Form */}
              <div className="cal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 className="cal-card-title">
                    <CalendarClock size={20} style={{ color: '#4A0E17' }} />
                    <span>Khung giờ làm việc hằng tuần</span>
                  </h3>
                  {editingScheduleDay !== null && (
                    <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', backgroundColor: '#FFF7ED', color: '#9A3412' }}>
                      Đang sửa {daysOfWeekVn[editingScheduleDay]}
                    </span>
                  )}
                </div>

                {/* Service Capability Selector */}
                {hasAodaiCapability && hasPhotographyCapability && (
                  <div className="cal-cap-pills">
                    {[
                      { key: null, label: 'Cả hai dịch vụ', icon: <Layers size={13} /> },
                      { key: 'AODAI_RENTAL', label: 'Chỉ Áo dài', icon: <ShoppingBag size={13} /> },
                      { key: 'PHOTOGRAPHY', label: 'Chỉ Chụp ảnh', icon: <Camera size={13} /> },
                    ].map(({ key, label, icon }) => (
                      <button
                        key={String(key)}
                        type="button"
                        onClick={() => setScheduleCapability(key as any)}
                        className={`cal-cap-btn ${scheduleCapability === key ? 'active' : ''}`}
                      >
                        {icon}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Day Selection */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
                    Chọn các ngày trong tuần
                  </span>
                  <div className="cal-quick-actions">
                    <button type="button" onClick={() => setSelectedScheduleDays([1, 2, 3, 4, 5])} className="cal-quick-btn">
                      <CheckCheck size={13} />
                      <span>Thứ 2 - Thứ 6</span>
                    </button>
                    <button type="button" onClick={() => setSelectedScheduleDays([0, 1, 2, 3, 4, 5, 6])} className="cal-quick-btn">
                      <CheckCheck size={13} />
                      <span>Cả tuần</span>
                    </button>
                    <button type="button" onClick={() => setSelectedScheduleDays([])} className="cal-quick-btn">
                      <RotateCcw size={13} />
                      <span>Bỏ chọn</span>
                    </button>
                  </div>
                </div>

                <div className="cal-days-pills-row">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                    const isSelected = selectedScheduleDays.includes(dayIdx);
                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        onClick={() => toggleScheduleDay(dayIdx)}
                        className={`cal-day-select-btn ${isSelected ? 'selected' : ''}`}
                      >
                        {dayIdx === 0 ? 'Chủ nhật' : `Thứ ${dayIdx + 1}`}
                      </button>
                    );
                  })}
                </div>

                {/* Working Shifts */}
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>
                  Các ca làm việc trong ngày
                </span>

                <div className="cal-shifts-container">
                  {workingHourRanges.map((range, idx) => (
                    <div key={idx} className="cal-shift-row">
                      <span className="cal-shift-label">Ca {idx + 1}</span>
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => updateWorkingHourRange(idx, 'start', e.target.value)}
                        className="cal-time-input"
                      />
                      <ArrowRight size={14} style={{ color: '#9CA3AF' }} />
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => updateWorkingHourRange(idx, 'end', e.target.value)}
                        className="cal-time-input"
                      />
                      <button
                        type="button"
                        disabled={workingHourRanges.length === 1}
                        onClick={() => setWorkingHourRanges((curr) => curr.filter((_, i) => i !== idx))}
                        className="cal-btn-del-shift"
                        title="Xóa ca này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setWorkingHourRanges((curr) => [...curr, { start: '13:30', end: '17:30' }])}
                  className="cal-btn-add-shift"
                >
                  <Plus size={15} />
                  <span>+ Thêm ca làm việc mới</span>
                </button>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                  {editingScheduleDay !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScheduleDay(null);
                        setSelectedScheduleDays([1, 2, 3, 4, 5]);
                        setWorkingHourRanges([
                          { start: '08:00', end: '12:00' },
                          { start: '13:30', end: '17:30' },
                        ]);
                      }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid #D1D5DB',
                        background: 'white',
                        fontWeight: 650,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Hủy sửa</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveRecurringSchedules}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#4A0E17',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Check size={16} />
                    <span>{editingScheduleDay !== null ? 'Cập nhật khung giờ' : 'Lưu lịch đã chọn'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Configured Weekly Schedule */}
              <div className="cal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="cal-card-title">
                    <CalendarDays size={19} style={{ color: '#4A0E17' }} />
                    <span>Lịch làm việc đã cấu hình ({recurringSchedules.length} ngày)</span>
                  </h3>
                </div>

                <div className="cal-configured-items-list">
                  {recurringSchedules.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '13.5px' }}>
                      Chưa thiết lập khung giờ làm việc hằng tuần nào.
                    </div>
                  ) : (
                    [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                      const daySchedule = recurringSchedules.find((s) => Number(s.dayOfWeek) === dayIdx);
                      const dayName = dayIdx === 0 ? 'Chủ nhật' : `Thứ ${dayIdx + 1}`;

                      if (!daySchedule) {
                        return (
                          <div key={dayIdx} className="cal-configured-item" style={{ opacity: 0.6 }}>
                            <div>
                              <div className="cal-item-day-title">{dayName}</div>
                              <div className="cal-item-hours">Nghỉ (Không làm việc)</div>
                            </div>
                            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Đóng</span>
                          </div>
                        );
                      }

                      return (
                        <div key={daySchedule._id || dayIdx} className="cal-configured-item">
                          <div>
                            <div className="cal-item-day-title">
                              <span>{dayName}</span>
                              {daySchedule.capability === 'AODAI_RENTAL' && (
                                <span className="cal-item-badge" style={{ background: '#FCE7F3', color: '#BE185D', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ShoppingBag size={11} /> Áo dài
                                </span>
                              )}
                              {daySchedule.capability === 'PHOTOGRAPHY' && (
                                <span className="cal-item-badge" style={{ background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Camera size={11} /> Chụp ảnh
                                </span>
                              )}
                            </div>
                            <div className="cal-item-hours">
                              {daySchedule.workingHours?.map((w: any) => `${w.start} - ${w.end}`).join(', ') || 'Chưa có ca'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEditRecurring(daySchedule)}
                            className="cal-btn-edit-item"
                          >
                            <Pencil size={13} />
                            <span>Sửa</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CHẶN NGÀY / KHUNG GIỜ (2 COLUMNS: BLOCK FORM + BLOCKED LIST) */}
          {activeSubNavTab === 'block' && (
            <div className="cal-tab-pane cal-tab-two-col">
              {/* Left Column: Block Form */}
              <div className="cal-card">
                <h3 className="cal-card-title" style={{ marginBottom: '18px' }}>
                  <CalendarOff size={20} style={{ color: '#DC2626' }} />
                  <span>Chặn lịch nghỉ / Lịch bận đột xuất</span>
                </h3>

                {/* Block Type Radio */}
                <div className="cal-radio-group">
                  <label className="cal-radio-label">
                    <input
                      type="radio"
                      name="blockType"
                      checked={blockType === 'FULL_DAY'}
                      onChange={() => setBlockType('FULL_DAY')}
                    />
                    <span>Chặn cả ngày</span>
                  </label>
                  <label className="cal-radio-label">
                    <input
                      type="radio"
                      name="blockType"
                      checked={blockType === 'CUSTOM_HOURS'}
                      onChange={() => setBlockType('CUSTOM_HOURS')}
                    />
                    <span>Chặn khung giờ cụ thể</span>
                  </label>
                </div>

                {/* Custom Hours inputs if CUSTOM_HOURS */}
                {blockType === 'CUSTOM_HOURS' && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', padding: '12px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FEE2E2' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Từ</label>
                    <input
                      type="time"
                      value={blockSlotStart}
                      onChange={(e) => setBlockSlotStart(e.target.value)}
                      className="cal-time-input"
                    />
                    <ArrowRight size={14} style={{ color: '#9CA3AF' }} />
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Đến</label>
                    <input
                      type="time"
                      value={blockSlotEnd}
                      onChange={(e) => setBlockSlotEnd(e.target.value)}
                      className="cal-time-input"
                    />
                  </div>
                )}

                {/* Date Input */}
                <div className="cal-form-group">
                  <label>Chọn ngày bận</label>
                  <input
                    type="date"
                    value={blockedDate}
                    min={toLocalDateKey()}
                    onChange={(e) => setBlockedDate(e.target.value)}
                    className="cal-input-date"
                  />
                </div>

                {/* Reason Input */}
                <div className="cal-form-group">
                  <label>Lý do nghỉ (Tùy chọn)</label>
                  <textarea
                    value={blockReason}
                    maxLength={200}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Ví dụ: Đi công tác, nghỉ lễ gia đình, bận việc đột xuất..."
                    className="cal-textarea-reason"
                  />
                  <div className="cal-char-count">{blockReason.length}/200</div>
                </div>

                {/* Confirm Block Button */}
                <button
                  type="button"
                  onClick={handleBlockDate}
                  className="cal-btn-confirm-block"
                >
                  <ShieldAlert size={16} />
                  <span>Xác nhận chặn lịch nghỉ</span>
                </button>
              </div>

              {/* Right Column: List of Blocked Dates */}
              <div className="cal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="cal-card-title">
                    <CalendarX size={19} style={{ color: '#DC2626' }} />
                    <span>Danh sách ngày đang bị chặn ({blockedDatesMap.size})</span>
                  </h3>
                </div>

                <div className="cal-configured-items-list">
                  {blockedDatesMap.size === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '13.5px' }}>
                      Chưa có ngày nào bị chặn lịch nghỉ.
                    </div>
                  ) : (
                    Array.from(blockedDatesMap.entries()).map(([dateKey, sched]: [string, any]) => {
                      const displayDate = new Date(dateKey).toLocaleDateString('vi-VN', {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });

                      return (
                        <div key={dateKey} className="cal-configured-item">
                          <div>
                            <div className="cal-item-day-title" style={{ color: '#B91C1C' }}>
                              <span>{displayDate}</span>
                              {sched.capability === 'AODAI_RENTAL' && (
                                <span className="cal-item-badge" style={{ background: '#FEF2F2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ShoppingBag size={11} /> Áo dài
                                </span>
                              )}
                              {sched.capability === 'PHOTOGRAPHY' && (
                                <span className="cal-item-badge" style={{ background: '#FEF2F2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Camera size={11} /> Chụp ảnh
                                </span>
                              )}
                            </div>
                            <div className="cal-item-hours">
                              {sched.customSlots && sched.customSlots.length > 0
                                ? `Chặn ca: ${sched.customSlots.map((c: any) => c.timeSlot).join(', ')}`
                                : 'Chặn toàn bộ cả ngày'}
                            </div>
                          </div>
                          {handleUnblockDate && (
                            <button
                              type="button"
                              onClick={() => handleUnblockDate(dateKey)}
                              className="cal-btn-unblock-item"
                              title="Mở chặn ngày này"
                            >
                              <LockOpen size={13} />
                              <span>Mở chặn</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DANH SÁCH ĐÃ THIẾT LẬP (FULL AUDIT VIEW) */}
          {activeSubNavTab === 'list' && (
            <div className="cal-tab-pane cal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="cal-card-title">
                  <SlidersHorizontal size={20} style={{ color: '#4A0E17' }} />
                  <span>Tổng hợp toàn bộ lịch trình đã thiết lập</span>
                </h3>
              </div>

              {/* Subtabs */}
              <div className="cal-list-tabs">
                <button
                  type="button"
                  onClick={() => setListTab('working')}
                  className={`cal-list-tab-btn ${listTab === 'working' ? 'active' : ''}`}
                >
                  <CalendarClock size={14} />
                  <span>Lịch làm việc hằng tuần ({recurringSchedules.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('blocked')}
                  className={`cal-list-tab-btn ${listTab === 'blocked' ? 'active' : ''}`}
                >
                  <CalendarOff size={14} />
                  <span>Ngày nghỉ / Bị chặn ({blockedDatesMap.size})</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="cal-configured-items-list" style={{ maxHeight: '600px' }}>
                {listTab === 'working' ? (
                  [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                    const daySchedule = recurringSchedules.find((s) => Number(s.dayOfWeek) === dayIdx);
                    const dayName = dayIdx === 0 ? 'Chủ nhật' : `Thứ ${dayIdx + 1}`;

                    if (!daySchedule) {
                      return (
                        <div key={dayIdx} className="cal-configured-item" style={{ opacity: 0.6 }}>
                          <div>
                            <div className="cal-item-day-title">{dayName}</div>
                            <div className="cal-item-hours">Nghỉ (Đóng cửa)</div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Chưa thiết lập</span>
                        </div>
                      );
                    }

                    return (
                      <div key={daySchedule._id || dayIdx} className="cal-configured-item">
                        <div>
                          <div className="cal-item-day-title">
                            <span>{dayName}</span>
                            {daySchedule.capability === 'AODAI_RENTAL' && (
                              <span className="cal-item-badge" style={{ background: '#FCE7F3', color: '#BE185D', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <ShoppingBag size={11} /> Áo dài
                              </span>
                            )}
                            {daySchedule.capability === 'PHOTOGRAPHY' && (
                              <span className="cal-item-badge" style={{ background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Camera size={11} /> Chụp ảnh
                              </span>
                            )}
                          </div>
                          <div className="cal-item-hours">
                            {daySchedule.workingHours?.map((w: any) => `${w.start} - ${w.end}`).join(', ') || 'Chưa có ca'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditRecurring(daySchedule)}
                          className="cal-btn-edit-item"
                        >
                          <Pencil size={13} />
                          <span>Chỉnh sửa ca</span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  blockedDatesMap.size === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px 0', color: '#9CA3AF', fontSize: '13.5px' }}>
                      Chưa có ngày nào bị chặn lịch nghỉ.
                    </div>
                  ) : (
                    Array.from(blockedDatesMap.entries()).map(([dateKey, sched]: [string, any]) => {
                      const displayDate = new Date(dateKey).toLocaleDateString('vi-VN', {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });

                      return (
                        <div key={dateKey} className="cal-configured-item">
                          <div>
                            <div className="cal-item-day-title" style={{ color: '#B91C1C' }}>
                              <span>{displayDate}</span>
                              {sched.capability === 'AODAI_RENTAL' && (
                                <span className="cal-item-badge" style={{ background: '#FEF2F2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ShoppingBag size={11} /> Áo dài
                                </span>
                              )}
                              {sched.capability === 'PHOTOGRAPHY' && (
                                <span className="cal-item-badge" style={{ background: '#FEF2F2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Camera size={11} /> Chụp ảnh
                                </span>
                              )}
                            </div>
                            <div className="cal-item-hours">
                              {sched.customSlots && sched.customSlots.length > 0
                                ? `Chặn ca: ${sched.customSlots.map((c: any) => c.timeSlot).join(', ')}`
                                : 'Chặn toàn bộ cả ngày'}
                            </div>
                          </div>
                          {handleUnblockDate && (
                            <button
                              type="button"
                              onClick={() => handleUnblockDate(dateKey)}
                              className="cal-btn-unblock-item"
                            >
                              <LockOpen size={13} />
                              <span>Mở chặn</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
