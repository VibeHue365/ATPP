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
      {} as any,
      inventoryReservationModel as any,
      {} as any,
      {} as any,
      {} as any,
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
  const reserveComboAoDai = async (
    activeCampaign: unknown = null,
    rental = { from: '2026-07-20', to: '2026-07-21' },
  ) => {
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
    const providerModel = {
      findById: jest.fn().mockReturnValue(
        queryResult({
          address: {
            addressLine: '1 Nguyen Hue, District 1',
            geo: { type: 'Point', coordinates: [106.7, 10.77] },
          },
          rentalSettings: { useBusinessAddressForPickup: true },
        }),
      ),
    };
    const productModel = {
      findOne: jest.fn().mockReturnValue(queryResult(product)),
    };    const inventoryModel = {
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
      providerModel as any,
      productModel as any,
      inventoryModel as any,
      inventoryReservationModel as any,
      {} as any,
      {} as any,
      {} as any,
      { getActiveCampaign: jest.fn().mockResolvedValue(activeCampaign) } as any,
    );

    const result = await (service as any).reserveComboAoDaiItem(
      {
        productId: productId.toString(),
        selectedSize: 'm',
        selectedColor: 'red',
        rentalFrom: rental.from,
        rentalTo: rental.to,
      },
      [
        {
          clientId: 'session-1',
          startsAt: new Date('2026-07-20T03:00:00.000Z'),
          endsAt: new Date('2026-07-20T04:00:00.000Z'),
          providerLocalDate: rental.from,
          durationMinutes: 60,
        },
      ],
      new Date(Date.now() + 60_000),
      {} as any,
    );
    return { result, inventoryId, inventoryModel };
  };

  it('selects a physical Ao Dai inventory item only when every photo day is within the rental range', async () => {
    const { result, inventoryId, inventoryModel } = await reserveComboAoDai();

    expect(result.inventoryItemIds).toEqual([inventoryId]);
    expect(result.unitPrice).toBe(1_000_000);
    expect(inventoryModel.updateOne).toHaveBeenCalledWith(
      { _id: inventoryId },
      expect.anything(),
    );
  });

  it('applies the shop campaign to the combo Ao Dai price per rental day (VIB-43)', async () => {
    // Phụ thu 20% chỉ ngày 21/07: 500k (20/07) + 600k (21/07).
    const { result } = await reserveComboAoDai({
      type: 'SURCHARGE',
      discountPercent: 20,
      startDate: new Date('2026-07-21T00:00:00.000Z'),
      endDate: new Date('2026-07-25T00:00:00.000Z'),
    });

    expect(result.unitPrice).toBe(1_100_000);
  });

  it('accepts an Ao Dai still being cleaned for a later rental day, like regular rentals', async () => {
    const { inventoryModel } = await reserveComboAoDai(null, {
      from: '2099-07-20',
      to: '2099-07-21',
    });

    expect(inventoryModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $ne: 'MAINTENANCE' } }),
    );
  });

  it('only accepts AVAILABLE Ao Dai when the rental starts today or earlier', async () => {
    const { inventoryModel } = await reserveComboAoDai();

    expect(inventoryModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AVAILABLE' }),
    );
  });
});