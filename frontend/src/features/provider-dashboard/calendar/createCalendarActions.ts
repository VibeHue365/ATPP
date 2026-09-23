import type { useToast } from '../../../components/feedback/Toast';
import { providerApi } from '../api/providerDashboardApi';
import type { useProviderCalendarState } from './useProviderCalendarState';

type Dependencies = Pick<ReturnType<typeof useProviderCalendarState>,
  | 'setSelectedScheduleDays'
  | 'setWorkingHourRanges'
  | 'selectedScheduleDays'
  | 'workingHourRanges'
  | 'scheduleCapability'
  | 'setEditingScheduleDay'
  | 'blockedDate'
  | 'setBlockedDate'
  | 'blockType'
  | 'blockSlotStart'
  | 'blockSlotEnd'
  | 'blockReason'
  | 'setBlockReason'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createCalendarActions({
  setSelectedScheduleDays, setWorkingHourRanges, selectedScheduleDays, toast, workingHourRanges,
  scheduleCapability, setEditingScheduleDay, fetchProviderData, blockedDate, setBlockedDate,
  blockType, blockSlotStart, blockSlotEnd, blockReason, setBlockReason,
}: Dependencies) {
  const toggleScheduleDay = (day: number) => {
    setSelectedScheduleDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day].sort((a, b) => a - b));
  };

  const updateWorkingHourRange = (
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setWorkingHourRanges((current) => current.map((range, rangeIndex) =>
      rangeIndex === index ? { ...range, [field]: value } : range,
    ));
  };

  const handleSaveRecurringSchedules = async () => {
    if (selectedScheduleDays.length === 0) {
      toast.error('Hãy chọn ít nhất một ngày làm việc.');
      return;
    }

    const sortedRanges = [...workingHourRanges].sort((a, b) => a.start.localeCompare(b.start));
    const hasInvalidRange = sortedRanges.some((range) => !range.start || !range.end || range.start >= range.end);
    const hasOverlap = sortedRanges.some((range, index) =>
      index > 0 && range.start < sortedRanges[index - 1].end,
    );
    if (hasInvalidRange) {
      toast.error('Giờ bắt đầu của mỗi ca phải sớm hơn giờ kết thúc.');
      return;
    }
    if (hasOverlap) {
      toast.error('Các ca làm việc không được chồng lên nhau.');
      return;
    }

    try {
      await providerApi.saveRecurringSchedules({
        dayOfWeeks: selectedScheduleDays,
        workingHours: sortedRanges,
        capability: scheduleCapability,
      });
      toast.success(`Đã lưu lịch cho ${selectedScheduleDays.length} ngày làm việc.`);
      setEditingScheduleDay(null);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Lưu lịch làm việc thất bại.');
    }
  };

  const handleEditRecurringSchedule = (schedule: any) => {
    const dayOfWeek = Number(schedule.dayOfWeek);
    setSelectedScheduleDays(Number.isInteger(dayOfWeek) ? [dayOfWeek] : []);
    setWorkingHourRanges(
      Array.isArray(schedule.workingHours) && schedule.workingHours.length > 0
        ? schedule.workingHours.map((range: any) => ({ start: range.start, end: range.end }))
        : [{ start: '08:00', end: '17:00' }],
    );
    setEditingScheduleDay(dayOfWeek);

    // Scroll to section 1 smoothly
    const elem = document.getElementById('section-recurring');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBlockDate = async () => {
    if (!blockedDate) {
      toast.error('Vui lòng chọn ngày cần chặn.');
      return;
    }

    const isFullDay = blockType === 'FULL_DAY';
    const customSlots = isFullDay ? [] : [
      { timeSlot: `${blockSlotStart}-${blockSlotEnd}`, status: 'BLOCKED' }
    ];

    try {
      await providerApi.blockDate({
        date: blockedDate,
        isOffDay: isFullDay,
        customSlots,
        capability: scheduleCapability,
        reason: blockReason,
      });
      toast.success(`Đã cập nhật chặn lịch ngày ${blockedDate}!`);
      setBlockedDate('');
      setBlockReason('');
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể chặn lịch ngày bận');
    }
  };

  const handleUnblockDate = async (dateStr: string) => {
    try {
      await providerApi.blockDate({
        date: dateStr,
        isOffDay: false,
        customSlots: [],
        capability: scheduleCapability,
      });
      toast.success(`Đã mở chặn ngày ${new Date(dateStr).toLocaleDateString('vi-VN')}!`);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể mở chặn ngày này');
    }
  };

  return {
    toggleScheduleDay,
    updateWorkingHourRange,
    handleSaveRecurringSchedules,
    handleBlockDate,
    handleEditRecurringSchedule,
    handleUnblockDate,
  };
}
