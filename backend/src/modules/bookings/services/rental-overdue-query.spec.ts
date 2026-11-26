import { Types } from 'mongoose';
import { buildRentalOverduePipeline, countOverdueRentals, listOverdueRentalBookingIds } from './rental-overdue-query';

describe('rental overdue query', () => {
  it('uses the same overdue truth for global admin and provider-scoped counts', () => {
    const now = new Date('2026-11-25T03:00:00.000Z');
    const providerId = new Types.ObjectId();
    const globalMatch = buildRentalOverduePipeline({ now })[0].$match as any;
    const providerMatch = buildRentalOverduePipeline({ now, providerId })[0].$match as any;
    expect(globalMatch.rentalTo).toEqual({ $ne: null, $lt: now });
    expect(providerMatch).toMatchObject({ ...globalMatch, providerId });
    expect(buildRentalOverduePipeline({ now })).toContainEqual({
      $match: {
        'booking.status': {
          $in: ['PICKED_UP', 'RETURN_PENDING', 'OVERDUE'],
        },
      },
    });
  });

  it('returns the aggregation count', async () => {
    const exec = jest.fn().mockResolvedValue([{ total: 3 }]);
    const aggregate = jest.fn().mockReturnValue({ exec });
    await expect(countOverdueRentals({ aggregate } as any)).resolves.toBe(3);
  });

  it.each([
    ['MOST_OVERDUE', 1],
    ['NEAREST_OVERDUE', -1],
  ] as const)('sorts overdue booking ids for %s', async (sort, direction) => {
    const exec = jest.fn().mockResolvedValue([]);
    const aggregate = jest.fn().mockReturnValue({ exec });
    await listOverdueRentalBookingIds({ aggregate } as any, sort);
    expect(aggregate.mock.calls[0][0]).toContainEqual({ $sort: { returnDueAt: direction, _id: 1 } });
  });
});
