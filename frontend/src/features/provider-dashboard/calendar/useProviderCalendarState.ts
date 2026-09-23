import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderCalendarState() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedScheduleDays, setSelectedScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workingHourRanges, setWorkingHourRanges] = useState<Array<{ start: string; end: string }>>([
    { start: '08:00', end: '12:00' },
    { start: '13:30', end: '17:30' },
  ]);
  const [editingScheduleDay, setEditingScheduleDay] = useState<number | null>(null);
  const [blockedDate, setBlockedDate] = useState('');
  const [scheduleCapability, setScheduleCapability] = useState<'AODAI_RENTAL' | 'PHOTOGRAPHY' | null>(null);

  // Figma 353:1121 interactive state
  const [activeSubNavTab, setActiveSubNavTab] = useState<'overview' | 'recurring' | 'block' | 'list'>('overview');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [blockType, setBlockType] = useState<'FULL_DAY' | 'CUSTOM_HOURS'>('FULL_DAY');
  const [blockSlotStart, setBlockSlotStart] = useState('08:00');
  const [blockSlotEnd, setBlockSlotEnd] = useState('12:00');
  const [blockReason, setBlockReason] = useState('');
  const [listTab, setListTab] = useState<'working' | 'blocked'>('working');

  return {
    schedules, setSchedules,
    selectedScheduleDays, setSelectedScheduleDays,
    workingHourRanges, setWorkingHourRanges,
    editingScheduleDay, setEditingScheduleDay,
    blockedDate, setBlockedDate,
    scheduleCapability, setScheduleCapability,
    activeSubNavTab, setActiveSubNavTab,
    calendarMonth, setCalendarMonth,
    selectedDate, setSelectedDate,
    blockType, setBlockType,
    blockSlotStart, setBlockSlotStart,
    blockSlotEnd, setBlockSlotEnd,
    blockReason, setBlockReason,
    listTab, setListTab,
  };
}
