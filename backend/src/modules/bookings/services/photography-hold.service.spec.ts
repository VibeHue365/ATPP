import { Types } from 'mongoose';
import {
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { PhotographyHoldService } from './photography-hold.service';

function queryResult<T>(value: T) {
  return {
    session: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('PhotographyHoldService.confirmForBooking', () => {
  function createService(holdExpiresAt: Date) {
    const providerId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const schedule = {
      _id: new Types.ObjectId(),
      bookingId,
      providerId,
      providerLocalDate: '2026-07-20',
      scheduleType: BookingScheduleType.Photoshoot,
      status: BookingScheduleStatus.Held,
      holdExpiresAt,
    };
    const mongoSession = {
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const bookingModel = {
      db: { startSession: jest.fn().mockResolvedValue(mongoSession) },
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const scheduleModel = {
      find: jest.fn().mockReturnValue(queryResult([schedule])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const lockModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      }),
    };
    const inventoryReservationModel = {
      find: jest.fn().mockReturnValue(queryResult([])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    const service = new PhotographyHoldService(
      bookingModel as any,
      {} as any,
      scheduleModel as any,
      lockModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      inventoryReservationModel as any,
      {} as any,
    );
    return {
      service,
      bookingId,
      scheduleModel,
      bookingModel,
      lockModel,
      inventoryReservationModel,
    };
  }

  it('confirms every active photography hold after payment', async () => {
    const fixture = createService(new Date(Date.now() + 60_000));

    const result = await fixture.service.confirmForBooking(fixture.bookingId);

    expect(result).toEqual({
      hasPhotographyHold: true,
      confirmed: true,
      paymentReviewRequired: false,
    });
    expect(fixture.lockModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(fixture.scheduleModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingScheduleStatus.Held }),
      expect.objectContaining({
        $set: { status: BookingScheduleStatus.Confirmed },
      }),
      expect.anything(),
    );
  });

  it('requires payment review when payment arrives after the hold expires', async () => {
    const fixture = createService(new Date(Date.now() - 60_000));

    const result = await fixture.service.confirmForBooking(fixture.bookingId);

    expect(result).toEqual({
      hasPhotographyHold: true,
      confirmed: false,
      paymentReviewRequired: true,
    });
    expect(fixture.scheduleModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingScheduleStatus.Held }),
      { $set: { status: BookingScheduleStatus.Expired } },
      expect.anything(),
    );
    expect(fixture.bookingModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ paymentReviewRequired: true }),
      }),
      expect.anything(),
    );
  });
  it('requires payment review when the matching Ao Dai reservation has expired', async () => {
    const fixture = createService(new Date(Date.now() + 60_000));
    fixture.inventoryReservationModel.find.mockReturnValue(
      queryResult([
        {
          _id: new Types.ObjectId(),
          status: 'TEMP_RESERVED',
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]),
    );

    const result = await fixture.service.confirmForBooking(fixture.bookingId);

    expect(result).toEqual({
      hasPhotographyHold: true,
      confirmed: false,
      paymentReviewRequired: true,
    });
    expect(fixture.inventoryReservationModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TEMP_RESERVED' }),
      expect.objectContaining({ $set: { status: 'EXPIRED' } }),
      expect.anything(),
    );
  });
  it('requires payment review if the guarded held-to-confirmed transition loses a race', async () => {
    const fixture = createService(new Date(Date.now() + 60_000));
    fixture.scheduleModel.updateMany.mockResolvedValue({ modifiedCount: 0 });

    const result = await fixture.service.confirmForBooking(fixture.bookingId);

    expect(result).toEqual({
      hasPhotographyHold: true,
      confirmed: false,
      paymentReviewRequired: true,
    });
    expect(fixture.bookingModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ paymentReviewRequired: true }),
      }),
      expect.anything(),
    );
  });
  it('selects a physical Ao Dai inventory item only when every photo day is within the rental range', async () => {
    const productId = new Types.ObjectId();
    const inventoryId = new Types.ObjectId();
    const product = {
      _id: productId,
      providerId: new Types.ObjectId(),
      status: 'ACTIVE',
      sizes: ['M'],
      colors: ['RED'],
      basePrice: 500000,
      depositAmount: 300000,
    };
    const productModel = {
      findOne: jest.fn().mockReturnValue(queryResult(product)),
    };
    const inventoryModel = {
      find: jest.fn().mockReturnValue(
        queryResult([
          {
            _id: inventoryId,
            productId,
            size: 'M',
            color: 'RED',
            status: 'AVAILABLE',
            conditionStatus: 'GOOD',
          },
        ]),
      ),
      updateOne: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };
    const inventoryReservationModel = {
      find: jest.fn().mockReturnValue(queryResult([])),
      exists: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      }),
      updateMany: jest.fn(),
    };
    const service = new PhotographyHoldService(
      { db: { startSession: jest.fn() } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      productModel as any,
      inventoryModel as any,
      inventoryReservationModel as any,
      {} as any,
    );

    const result = await (service as any).reserveComboAoDaiItem(
      {
        productId: productId.toString(),
        selectedSize: 'm',
        selectedColor: 'red',
        rentalFrom: '2026-07-20',
        rentalTo: '2026-07-21',
      },
      [
        {
          clientId: 'session-1',
          startsAt: new Date('2026-07-20T03:00:00.000Z'),
          endsAt: new Date('2026-07-20T04:00:00.000Z'),
          providerLocalDate: '2026-07-20',
          durationMinutes: 60,
        },
      ],
      new Date(Date.now() + 60_000),
      {} as any,
    );

    expect(result.inventoryItemIds).toEqual([inventoryId]);
    expect(result.unitPrice).toBe(1_000_000);
    expect(inventoryModel.updateOne).toHaveBeenCalledWith(
      { _id: inventoryId },
      expect.anything(),
    );
  });
});