import { findAdminOverdueRentals } from './overdue-rental-notifications';

describe('findAdminOverdueRentals', () => {
  it('queries actual overdue active rentals and maps them for the admin bell', async () => {
    const exec = jest.fn().mockResolvedValue([{
      _id: { toString: () => 'item-1' },
      bookingId: { toString: () => 'booking-1' },
      bookingCode: 'BK001',
      productName: 'Áo dài Nhật Bình',
      rentalTo: new Date('2026-11-20T00:00:00.000Z'),
      daysOverdue: 5,
    }]);
    const aggregate = jest.fn().mockReturnValue({ exec });
    const now = new Date('2026-11-25T00:00:00.000Z');

    const result = await findAdminOverdueRentals({ aggregate } as any, now);

    expect(aggregate.mock.calls[0][0]).toEqual(expect.arrayContaining([
      { $match: { itemType: 'PRODUCT', rentalTo: { $ne: null, $lt: now } } },
      { $match: { 'booking.status': { $in: ['PICKED_UP', 'RETURN_PENDING'] } } },
    ]));
    expect(result[0]).toMatchObject({ id: 'item-1', bookingCode: 'BK001', daysOverdue: 5 });
  });
});
