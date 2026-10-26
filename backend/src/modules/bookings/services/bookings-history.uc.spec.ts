import { Types } from 'mongoose';
import { BookingsService } from './bookings.service';

type Row = Record<string, any>;

function chain(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['populate', 'sort', 'lean']) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.exec = jest.fn().mockResolvedValue(result);
  return query;
}

function bookingDoc(row: Row) {
  return { ...row, toObject: () => ({ ...row }) };
}

describe('UC-12 View Activity History (DaiBLL)', () => {
  const customerId = new Types.ObjectId().toString();

  function createService(
    options: {
      bookings?: Row[];
      items?: Row[];
      schedules?: Row[];
      incidents?: Row[] | Error;
    } = {},
  ) {
    const bookingSort = jest
      .fn()
      .mockResolvedValue((options.bookings ?? []).map(bookingDoc));
    const incidentModel = {
      find: jest
        .fn()
        .mockReturnValue(
          options.incidents instanceof Error
            ? {
                lean: () => ({ exec: () => Promise.reject(options.incidents) }),
              }
            : chain(options.incidents ?? []),
        ),
    };
    const bookingModel = {
      find: jest.fn().mockReturnValue({ sort: bookingSort }),
      db: { models: { IncidentReport: incidentModel }, model: jest.fn() },
    };
    const itemQuery = chain(options.items ?? []);
    const bookingItemModel = { find: jest.fn().mockReturnValue(itemQuery) };
    const bookingScheduleModel = {
      find: jest.fn().mockReturnValue(chain(options.schedules ?? [])),
    };

    const service = Object.create(BookingsService.prototype) as BookingsService;
    Object.assign(service, {
      bookingModel,
      bookingItemModel,
      bookingScheduleModel,
    });
    return {
      service,
      bookingModel,
      bookingSort,
      bookingItemModel,
      itemQuery,
      incidentModel,
    };
  }

  it('UT-12 UTCID01 returns an empty history without loading items for a new customer', async () => {
    const { service, bookingItemModel } = createService();

    await expect(service.getMyBookings(customerId)).resolves.toEqual([]);
    expect(bookingItemModel.find).not.toHaveBeenCalled();
  });

  it('UT-12 UTCID02 loads only the customer bookings sorted from newest to oldest', async () => {
    const newer = new Types.ObjectId();
    const older = new Types.ObjectId();
    const { service, bookingModel, bookingSort } = createService({
      bookings: [
        { _id: newer, status: 'CONFIRMED' },
        { _id: older, status: 'COMPLETED' },
      ],
    });

    const result = await service.getMyBookings(customerId);

    expect(bookingModel.find.mock.calls[0][0].customerId.toString()).toBe(
      customerId,
    );
    expect(bookingSort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(result.map((booking) => booking._id)).toEqual([newer, older]);
  });

  it('UT-12 UTCID03 groups items and schedules under their own booking', async () => {
    const first = new Types.ObjectId();
    const second = new Types.ObjectId();
    const { service, itemQuery } = createService({
      bookings: [{ _id: first }, { _id: second }],
      items: [
        {
          bookingId: first,
          itemType: 'AO_DAI_RENTAL',
          productId: { name: 'Ao dai do' },
        },
        {
          bookingId: second,
          itemType: 'AO_DAI_RENTAL',
          productId: { name: 'Ao dai xanh' },
        },
        {
          bookingId: first,
          itemType: 'AO_DAI_RENTAL',
          productId: { name: 'Ao dai trang' },
        },
      ],
      schedules: [{ bookingId: second, scheduleType: 'RENTAL_PICKUP' }],
    });

    const [firstResult, secondResult] = await service.getMyBookings(customerId);

    expect(firstResult.items.map((item: Row) => item.name)).toEqual([
      'Ao dai do',
      'Ao dai trang',
    ]);
    expect(secondResult.items.map((item: Row) => item.name)).toEqual([
      'Ao dai xanh',
    ]);
    expect(firstResult.schedules).toEqual([]);
    expect(secondResult.schedules).toHaveLength(1);
    expect(itemQuery.sort).toHaveBeenCalledWith({ _id: 1 });
  });

  it('UT-12 UTCID04 resolves item names from product, package, snapshot and stored name', async () => {
    const bookingId = new Types.ObjectId();
    const { service } = createService({
      bookings: [{ _id: bookingId }],
      items: [
        { bookingId, productId: { name: 'Product name' } },
        { bookingId, photographyPackageId: { name: 'Package name' } },
        { bookingId, packageSnapshot: { name: 'Snapshot name' } },
        { bookingId, name: 'Stored name' },
        { bookingId },
      ],
    });

    const [result] = await service.getMyBookings(customerId);

    expect(result.items.map((item: Row) => item.name)).toEqual([
      'Product name',
      'Package name',
      'Snapshot name',
      'Stored name',
      null,
    ]);
  });

  it('UT-12 UTCID05 fills photography details from the active photoshoot schedule only', async () => {
    const bookingId = new Types.ObjectId();
    const startsAt = new Date('2026-11-01T02:00:00.000Z');
    const { service } = createService({
      bookings: [{ _id: bookingId }],
      items: [
        {
          bookingId,
          itemType: 'PHOTOGRAPHY_PACKAGE',
          photographyPackageId: { name: 'Hue concept' },
        },
      ],
      schedules: [
        {
          bookingId,
          scheduleType: 'PHOTOSHOOT',
          status: 'CANCELLED',
          startsAt: new Date('2026-10-01'),
          timeSlot: '07:00',
        },
        {
          bookingId,
          scheduleType: 'PHOTOSHOOT',
          status: 'CONFIRMED',
          startsAt,
          timeSlot: '09:00',
          locationAddress: 'Dai Noi Hue',
        },
      ],
    });

    const [result] = await service.getMyBookings(customerId);

    expect(result.items[0]).toMatchObject({
      shootDate: startsAt,
      shootTimeSlot: '09:00',
      shootLocation: 'Dai Noi Hue',
    });
  });

  it('UT-12 UTCID06 marks bookings that have an open incident report', async () => {
    const withIncident = new Types.ObjectId();
    const withoutIncident = new Types.ObjectId();
    const incident = { bookingId: withIncident, status: 'PENDING_CUSTOMER' };
    const { service, incidentModel } = createService({
      bookings: [{ _id: withIncident }, { _id: withoutIncident }],
      incidents: [incident],
    });

    const [first, second] = await service.getMyBookings(customerId);

    expect(incidentModel.find.mock.calls[0][0].status).toEqual({
      $in: ['PENDING_CUSTOMER', 'DISPUTED'],
    });
    expect(first).toMatchObject({
      hasIncident: true,
      activeIncident: incident,
    });
    expect(second).toMatchObject({ hasIncident: false, activeIncident: null });
  });

  it('UT-12 UTCID07 still returns the history when incident lookup fails', async () => {
    const bookingId = new Types.ObjectId();
    const { service } = createService({
      bookings: [{ _id: bookingId }],
      incidents: new Error('IncidentReport model is unavailable'),
    });

    const [result] = await service.getMyBookings(customerId);

    expect(result).toMatchObject({ hasIncident: false, activeIncident: null });
  });

  it('UT-12 UTCID08 rejects a malformed customer id before querying bookings', async () => {
    const { service, bookingModel } = createService();

    await expect(service.getMyBookings('customer-1')).rejects.toThrow();
    expect(bookingModel.find).not.toHaveBeenCalled();
  });
});
