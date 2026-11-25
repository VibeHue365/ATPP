import { sortProviderSchedules } from './provider-schedule-sort';

describe('sortProviderSchedules', () => {
  it('sorts by startsAt or scheduledDate instead of putting null startsAt first', () => {
    const result = sortProviderSchedules([
      { id: 'later', startsAt: null, scheduledDate: '2026-11-27T00:00:00Z' },
      { id: 'first', startsAt: '2026-11-25T01:00:00Z' },
      { id: 'second', startsAt: null, scheduledDate: '2026-11-26T00:00:00Z' },
    ]);
    expect(result.map((row) => row.id)).toEqual(['first', 'second', 'later']);
  });
});
