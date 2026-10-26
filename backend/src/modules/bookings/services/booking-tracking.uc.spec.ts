import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { GeocodingController } from '../../geocoding/geocoding.controller';
import { GeocodingService } from '../../geocoding/geocoding.service';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingsService } from './bookings.service';

type Row = Record<string, any>;

const customerId = new Types.ObjectId();
const providerId = new Types.ObjectId();

function chain(result: unknown) {
  const query: Row = {};
  for (const method of ['populate', 'sort', 'lean'])
    query[method] = jest.fn().mockReturnValue(query);
  query.exec = jest.fn().mockResolvedValue(result);
  return query;
}

function bookingDoc(overrides: Row = {}): Row {
  const row = {
    _id: new Types.ObjectId(),
    bookingCode: 'BK-2026',
    customerId: {
      _id: customerId,
      profile: { fullName: 'Lan' },
      auth: { phone: '0901', email: 'lan@example.com' },
    },
    providerIds: [providerId],
    status: BookingStatus.Confirmed,
    ...overrides,
  };
  return { ...row, toObject: () => ({ ...row }) };
}

function createService(
  options: {
    booking?: Row | null;
    bookings?: Row[];
    items?: Row[];
    schedules?: Row[];
    providers?: Row[];
    schedule?: Row | null;
    provider?: Row | null;
    review?: Row | null;
  } = {},
) {
  const findById = jest.fn().mockImplementation(() => {
    const result =
      options.booking === undefined ? bookingDoc() : options.booking;
    return Object.assign(Promise.resolve(result), {
      populate: () => Promise.resolve(result),
      exec: () => Promise.resolve(result),
    });
  });
  const bookingModel = {
    findById,
    find: jest
      .fn()
      .mockReturnValue({
        sort: () => ({ exec: () => Promise.resolve(options.bookings ?? []) }),
      }),
    db: {
      model: jest.fn((name: string) =>
        name === 'CustomerReview'
          ? { findOne: () => chain(options.review ?? null) }
          : { find: () => chain(options.schedules ?? []) },
      ),
    },
  };
  const bookingItemModel = {
    find: jest.fn().mockReturnValue(chain(options.items ?? [])),
  };
  const bookingScheduleModel = {
    find: jest.fn().mockReturnValue(chain(options.schedules ?? [])),
    findOne: jest
      .fn()
      .mockReturnValue({
        exec: () => Promise.resolve(options.schedule ?? null),
      }),
  };
  const providerModel = {
    find: jest.fn().mockResolvedValue(options.providers ?? []),
    findOne: jest
      .fn()
      .mockReturnValue({
        exec: () => Promise.resolve(options.provider ?? null),
      }),
  };
  const coordinator = { coordinate: jest.fn().mockResolvedValue(undefined) };
  const service = Object.create(BookingsService.prototype) as BookingsService;
  Object.assign(service, {
    bookingModel,
    bookingItemModel,
    bookingScheduleModel,
    providerModel,
    rentalDepositRefundCoordinator: coordinator,
  });
  return {
    service,
    bookingModel,
    bookingItemModel,
    bookingScheduleModel,
    coordinator,
  };
}

describe('UC-40 View Booking Details (NgocL)', () => {
  const id = new Types.ObjectId().toString();

  it('UT-40 UTCID02 returns not found for a missing booking', async () => {
    const { service } = createService({ booking: null });

    await expect(
      service.getBookingById(id, customerId.toString(), ['CUSTOMER']),
    ).rejects.toThrow(new NotFoundException('Booking not found'));
  });

  it('UT-40 UTCID03 forbids an unrelated user from viewing the booking', async () => {
    const { service, bookingItemModel } = createService();

    await expect(
      service.getBookingById(id, new Types.ObjectId().toString(), ['CUSTOMER']),
    ).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền xem thông tin đơn hàng này.'),
    );
    expect(bookingItemModel.find).not.toHaveBeenCalled();
  });

  it('UT-40 UTCID04 lets the booking provider view details with resolved item names', async () => {
    const { service } = createService({
      providers: [{ _id: providerId }],
      items: [{ productId: { name: 'Áo dài đỏ' } }],
    });

    const result = await service.getBookingById(
      id,
      new Types.ObjectId().toString(),
      ['PROVIDER'],
    );

    expect(result.items[0].name).toBe('Áo dài đỏ');
    expect(result).toMatchObject({
      customerName: 'Lan',
      customerPhone: '0901',
      customerEmail: 'lan@example.com',
    });
  });

  it('UT-40 UTCID05 lets an administrator view any booking', async () => {
    const { service } = createService();

    await expect(
      service.getBookingById(id, new Types.ObjectId().toString(), ['ADMIN']),
    ).resolves.toMatchObject({
      bookingCode: 'BK-2026',
    });
  });

  it('UT-40 UTCID06 settles the pending rental deposit refund of a returned booking first', async () => {
    const { service, coordinator, bookingModel } = createService({
      booking: bookingDoc({
        status: BookingStatus.Returned,
        rentalDepositRefund: { status: 'PENDING' },
      }),
    });

    await service.getBookingById(id, customerId.toString(), ['CUSTOMER']);

    expect(coordinator.coordinate).toHaveBeenCalledWith(id);
    expect(bookingModel.findById).toHaveBeenCalledTimes(2);
  });

  it('UT-40 UTCID07 includes the provider review of the customer', async () => {
    const review = { rating: 5 };
    const { service } = createService({ review });

    await expect(
      service.getBookingById(id, customerId.toString(), ['CUSTOMER']),
    ).resolves.toMatchObject({
      customerReview: review,
    });
  });
});

describe('UC-37 Track Booking Status (NgocL)', () => {
  it('UT-37 UTCID06 returns no booking for a new customer', async () => {
    const { service, bookingItemModel } = createService({ bookings: [] });

    await expect(
      service.getCustomerBookings(customerId.toString()),
    ).resolves.toEqual([]);
    expect(bookingItemModel.find).not.toHaveBeenCalled();
  });

  it('UT-37 UTCID07 lists customer bookings newest first with their items', async () => {
    const first = bookingDoc();
    const second = bookingDoc();
    const { service, bookingModel } = createService({
      bookings: [first, second],
      items: [{ bookingId: second._id, productId: { name: 'Áo trắng' } }],
    });

    const result = await service.getCustomerBookings(customerId.toString());

    expect(bookingModel.find).toHaveBeenCalledWith({ customerId });
    expect(result.map((booking: Row) => booking.items.length)).toEqual([0, 1]);
  });

  it('UT-37 UTCID08 derives the photoshoot time slot from the schedule times', async () => {
    const booking = bookingDoc();
    const startsAt = new Date(2026, 10, 2, 9, 0);
    const endsAt = new Date(2026, 10, 2, 11, 30);
    const { service } = createService({
      bookings: [booking],
      items: [
        {
          bookingId: booking._id,
          itemType: 'PHOTOGRAPHY_PACKAGE',
          photographyPackageId: { name: 'Hue' },
        },
      ],
      schedules: [
        {
          bookingId: booking._id,
          scheduleType: 'PHOTOSHOOT',
          status: 'CONFIRMED',
          startsAt,
          endsAt,
        },
      ],
    });

    const [result] = await service.getCustomerBookings(customerId.toString());

    expect(result.items[0]).toMatchObject({
      shootTimeSlot: '09:00 - 11:30',
      shootDate: startsAt,
    });
  });
});

describe('UC-38 Edit Booking - photoshoot location change (NgocL)', () => {
  const bookingId = new Types.ObjectId().toString();
  const scheduleId = new Types.ObjectId().toString();
  const location = {
    address: ' Đại Nội Huế ',
    latitude: 16.47,
    longitude: 107.58,
    note: ' Cổng Ngọ Môn ',
  };

  it('UT-38 UTCID03 requires a precise replacement location', async () => {
    const { service } = createService();

    await expect(
      service.requestPhotographyLocationChange(
        bookingId,
        scheduleId,
        customerId.toString(),
        { ...location, latitude: NaN },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'A precise replacement shoot location is required.',
      ),
    );
  });

  it('UT-38 UTCID04 allows only the booking customer to request a change', async () => {
    const { service } = createService({
      booking: bookingDoc({ customerId: new Types.ObjectId() }),
    });

    await expect(
      service.requestPhotographyLocationChange(
        bookingId,
        scheduleId,
        customerId.toString(),
        location,
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Only the booking customer can request a location change.',
      ),
    );
  });

  it('UT-38 UTCID05 requires a provider-confirmed booking', async () => {
    const { service } = createService({
      booking: bookingDoc({ customerId, status: BookingStatus.PendingPayment }),
    });

    await expect(
      service.requestPhotographyLocationChange(
        bookingId,
        scheduleId,
        customerId.toString(),
        location,
      ),
    ).rejects.toThrow(
      'A location change request is available only after provider confirmation.',
    );
  });

  it('UT-38 UTCID06 rejects a second pending request for the same photoshoot', async () => {
    const { service } = createService({
      booking: bookingDoc({ customerId }),
      schedule: {
        locationChangeRequest: { status: 'PENDING' },
        save: jest.fn(),
      },
    });

    await expect(
      service.requestPhotographyLocationChange(
        bookingId,
        scheduleId,
        customerId.toString(),
        location,
      ),
    ).rejects.toThrow(
      'A location change request is already pending for this photoshoot.',
    );
  });

  it('UT-38 UTCID07 stores a trimmed pending request with GeoJSON coordinates', async () => {
    const schedule: Row = { save: jest.fn().mockResolvedValue(undefined) };
    const { service } = createService({
      booking: bookingDoc({ customerId }),
      schedule,
    });

    const request = await service.requestPhotographyLocationChange(
      bookingId,
      scheduleId,
      customerId.toString(),
      location,
    );

    expect(request).toMatchObject({
      status: 'PENDING',
      note: 'Cổng Ngọ Môn',
      requestedLocation: {
        address: 'Đại Nội Huế',
        geo: { type: 'Point', coordinates: [107.58, 16.47] },
      },
    });
  });

  it('UT-38 UTCID08 applies the new address when the provider approves', async () => {
    const requestedLocation = {
      address: 'Đại Nội Huế',
      geo: { type: 'Point', coordinates: [107.58, 16.47] },
    };
    const schedule: Row = {
      locationChangeRequest: { status: 'PENDING', requestedLocation },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = createService({
      provider: { _id: providerId },
      schedule,
    });

    await service.resolvePhotographyLocationChange(
      bookingId,
      scheduleId,
      new Types.ObjectId().toString(),
      true,
      'Đồng ý',
    );

    expect(schedule.locationChangeRequest).toMatchObject({
      status: 'APPROVED',
      note: 'Đồng ý',
      resolvedBy: providerId,
    });
    expect(schedule.locationAddress).toBe('Đại Nội Huế');
  });

  it('UT-38 UTCID09 keeps the original address when the provider rejects', async () => {
    const schedule: Row = {
      locationAddress: 'Phố cổ',
      locationChangeRequest: {
        status: 'PENDING',
        requestedLocation: { address: 'X' },
      },
      save: jest.fn(),
    };
    const { service } = createService({
      provider: { _id: providerId },
      schedule,
    });

    await service.resolvePhotographyLocationChange(
      bookingId,
      scheduleId,
      new Types.ObjectId().toString(),
      false,
    );

    expect(schedule.locationChangeRequest.status).toBe('REJECTED');
    expect(schedule.locationAddress).toBe('Phố cổ');
  });

  it('UT-38 UTCID10 returns not found when no pending request exists', async () => {
    const { service } = createService({
      provider: { _id: providerId },
      schedule: null,
    });

    await expect(
      service.resolvePhotographyLocationChange(
        bookingId,
        scheduleId,
        new Types.ObjectId().toString(),
        true,
      ),
    ).rejects.toThrow(
      new NotFoundException('Pending location change request not found.'),
    );
  });

  it('UT-38 UTCID11 rejects malformed booking or schedule ids', async () => {
    const { service } = createService();

    await expect(
      service.requestPhotographyLocationChange(
        'booking-1',
        scheduleId,
        customerId.toString(),
        location,
      ),
    ).rejects.toThrow(
      new BadRequestException('Booking or photoshoot schedule is invalid.'),
    );
  });
});

describe('UC-41 View Track Journey - destination search (NgocL)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-41 UTCID06 rejects a destination query longer than 200 characters', () => {
    const controller = new GeocodingController({ search: jest.fn() } as any);

    expect(() => controller.search('x'.repeat(201))).toThrow(
      new BadRequestException('Địa chỉ tìm kiếm không hợp lệ.'),
    );
  });

  it('UT-41 UTCID07 trims the query before searching and accepts 2 characters', async () => {
    const geocoding = { search: jest.fn().mockResolvedValue([]) };
    const controller = new GeocodingController(geocoding as any);

    await controller.search('  Hu  ');

    expect(geocoding.search).toHaveBeenCalledWith('Hu');
  });

  it('UT-41 UTCID08 skips Photon results without coordinates or address', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: { name: 'Đại Nội', city: 'Huế' },
              geometry: { coordinates: [107.58, 16.47] },
            },
            { properties: { name: 'Không tọa độ' }, geometry: {} },
            { properties: {}, geometry: { coordinates: [107, 16] } },
          ],
        }),
      } as Response);

    const results = await new GeocodingService().search('Dai Noi');

    expect(results).toEqual([
      {
        place_id: 1,
        display_name: 'Đại Nội, Huế',
        lat: '16.47',
        lon: '107.58',
      },
    ]);
  });

  it('UT-41 UTCID09 reports a gateway error when both providers are unavailable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(new GeocodingService().search('Hue')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
