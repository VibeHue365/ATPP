export type OverviewChartPeriod = 'day' | 'week' | 'month';

export function resolveOverviewChartRange(
  period: string,
  selectedMonth?: string,
  now = new Date(),
) {
  const normalizedPeriod: OverviewChartPeriod = ['day', 'week', 'month'].includes(period)
    ? period as OverviewChartPeriod
    : 'month';
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth || '') ? selectedMonth! : fallback;
  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = new Date(`${monthKey}-01T00:00:00+07:00`);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEnd = new Date(new Date(`${nextMonth}-01T00:00:00+07:00`).getTime() - 1);
  const start = normalizedPeriod === 'month' ? new Date(`${year}-01-01T00:00:00+07:00`) : monthStart;
  const end = normalizedPeriod === 'month' ? new Date(`${year + 1}-01-01T00:00:00+07:00`) : new Date(monthEnd.getTime() + 1);
  return { period: normalizedPeriod, monthKey, year, month, monthStart, monthEnd, start, end };
}
