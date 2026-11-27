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

  describe('simulateOverdueForDemo production gate', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowSim = process.env.ALLOW_OVERDUE_SIMULATION;

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalAllowSim === undefined) {
        delete process.env.ALLOW_OVERDUE_SIMULATION;
      } else {
        process.env.ALLOW_OVERDUE_SIMULATION = originalAllowSim;
      }
    });

    it('blocks simulation in production by default', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_OVERDUE_SIMULATION;

      const bookingModel = { findById: jest.fn() };
      const service = new RentalOverdueDominoService(
        bookingModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
      );

      await expect(
        service.simulateOverdueForDemo(new Types.ObjectId().toString(), {
          sub: new Types.ObjectId().toString(),
          roles: ['ADMIN'],
        } as any),
      ).rejects.toThrow('Chức năng giả lập');
      expect(bookingModel.findById).not.toHaveBeenCalled();
    });

    it('allows passing the production gate when ALLOW_OVERDUE_SIMULATION=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_OVERDUE_SIMULATION = 'true';

      const bookingModel = { findById: jest.fn(() => query(null)) };
      const service = new RentalOverdueDominoService(
        bookingModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
      );

      await expect(
        service.simulateOverdueForDemo(new Types.ObjectId().toString(), {
          sub: new Types.ObjectId().toString(),
          roles: ['ADMIN'],
        } as any),
      ).rejects.toThrow('Không tìm thấy đơn hàng.');
      expect(bookingModel.findById).toHaveBeenCalledTimes(1);
    });
  });
});
