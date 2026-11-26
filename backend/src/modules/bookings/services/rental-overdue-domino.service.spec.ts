import { Types } from 'mongoose';
import { RentalOverdueDominoService } from './rental-overdue-domino.service';

const query = (value: unknown) => ({
  select: () => query(value),
  lean: () => ({ exec: async () => value }),
  exec: async () => value,
});

describe('RentalOverdueDominoService return settlement', () => {
  it('settles only after every rental item has been received', async () => {
    const bookingId = new Types.ObjectId();
    const bookingModel = {
      findById: jest.fn(() =>
        query({
          _id: bookingId,
          status: 'RETURN_PENDING',
          overdueTracking: { isOverdue: true },
        }),
      ),
    };
    const bookingItemModel = {
      find: jest.fn(() =>
        query([
          { rentalFulfillment: { status: 'RETURNED' } },
          { rentalFulfillment: { status: 'RETURNED' } },
        ]),
      ),
    };
    const service = new RentalOverdueDominoService(
      bookingModel as any,
      bookingItemModel as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      undefined,
    );
    const reverse = jest
      .spyOn(service, 'reverseOverdueOnReturn')
      .mockResolvedValue({ success: true });

    await expect(
      service.settleIfFullyReturned(bookingId.toString()),
    ).resolves.toBe(true);
    expect(reverse).toHaveBeenCalledWith(bookingId.toString());

    bookingItemModel.find.mockReturnValue(
      query([
        { rentalFulfillment: { status: 'RETURNED' } },
        { rentalFulfillment: { status: 'CUSTOMER_RETURN_REQUESTED' } },
      ]),
    );
    reverse.mockClear();

    await expect(
      service.settleIfFullyReturned(bookingId.toString()),
    ).resolves.toBe(false);
    expect(reverse).not.toHaveBeenCalled();
  });
});
