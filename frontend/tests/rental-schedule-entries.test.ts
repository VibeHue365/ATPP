import { describe, expect, it } from 'vitest';
import { buildProviderScheduleEntries } from '../src/features/provider-dashboard/calendar/rentalScheduleEntries';

describe('buildProviderScheduleEntries', () => {
  it('merges pickup and return handovers into the provider booking calendar', () => {
    const entries = buildProviderScheduleEntries([{
      _id: 'booking-1',
      bookingType: 'AODAI_RENTAL',
      startDate: '2026-11-25T02:00:00.000Z',
      endDate: '2026-11-28T10:00:00.000Z',
    }]);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.order.scheduleEntryType)).toEqual(['AODAI_PICKUP', 'AODAI_RETURN']);
    expect(entries.map((entry) => entry.order.scheduleEntryId)).toEqual(['booking-1-pickup', 'booking-1-return']);
  });

  it('keeps a photography-only booking as one calendar appointment', () => {
    const entries = buildProviderScheduleEntries([{
      _id: 'booking-2',
      bookingType: 'PHOTOGRAPHY',
      startDate: '2026-11-25T02:00:00.000Z',
    }]);
    expect(entries).toHaveLength(1);
    expect(entries[0].order.scheduleEntryType).toBe('BOOKING');
  });
});
