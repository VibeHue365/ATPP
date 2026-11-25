import { resolveOverviewChartRange } from './overview-chart-range';

describe('resolveOverviewChartRange', () => {
  it('uses the selected month for day/week views', () => {
    const range = resolveOverviewChartRange('week', '2026-09');
    expect(range.monthKey).toBe('2026-09');
    expect(range.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('uses the selected year for month view', () => {
    const range = resolveOverviewChartRange('month', '2025-06');
    expect(range.start.toISOString()).toBe('2024-12-31T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2025-12-31T17:00:00.000Z');
  });
});
