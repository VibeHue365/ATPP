import type { ProductSlot } from '../types';

export const timeSlots = [
  '07:00',
  '07:30',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
];

export const productSlots: ProductSlot[] = [
  { start: '07:00', end: '09:00', label: '07:00 - 09:00' },
  { start: '09:00', end: '11:00', label: '09:00 - 11:00' },
  { start: '11:00', end: '13:00', label: '11:00 - 13:00' },
  { start: '13:00', end: '15:00', label: '13:00 - 15:00' },
  { start: '15:00', end: '17:00', label: '15:00 - 17:00' },
  { start: '17:00', end: '19:00', label: '17:00 - 19:00' },
  { start: '19:00', end: '21:00', label: '19:00 - 21:00' },
];

export const isTimeSlotOverlap = (slot1: string, slot2: string): boolean => {
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const [start1Str, end1Str] = slot1.split('-').map((s) => s.trim());
  const [start2Str, end2Str] = slot2.split('-').map((s) => s.trim());
  if (!start1Str || !end1Str || !start2Str || !end2Str) return false;
  const s1 = parseTime(start1Str);
  const e1 = parseTime(end1Str);
  const s2 = parseTime(start2Str);
  const e2 = parseTime(end2Str);
  return s1 < e2 && s2 < e1;
};

export const formatSingleDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (dateStr.includes('/')) return dateStr;
  return dateStr;
};

export const getDayDuration = (startDate?: string, endDate?: string): number => {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

export const getHourDuration = (startTime: string, endTime: string): number => {
  const startIndex = timeSlots.indexOf(startTime);
  const endIndex = timeSlots.indexOf(endTime);
  if (startIndex === -1 || endIndex === -1) return 2;
  return (endIndex - startIndex) * 0.5;
};
