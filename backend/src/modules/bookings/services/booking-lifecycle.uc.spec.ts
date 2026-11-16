import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import { BookingRescheduleService } from './booking-reschedule.service';
import { BookingStatusService } from './booking-status.service';

type Row = Record<string, any>;

const customerId = new Types.ObjectId();
const providerId = new Types.ObjectId();
const providerUserId = new Types.ObjectId().toString();
const DAY = 24 * 60 * 60 * 1000;

function bookingDoc(overrides: Row = {}): Row {
  return {
    _id: new Types.ObjectId(),
    bookingCode: 'BK-2026',
    customerId,
    providerIds: [providerId],
    status: BookingStatus.Confirmed,
    statusTimeline: [],
    createdAt: new Date(Date.now() - 10 * DAY),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createStatusService(
  booking: Row | null,
  options: {
    providers?: Row[];
    items?: Row[];
    refundable?: number;
    conflict?: boolean;
  } = {},
) {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const bookingsRepository = {
    startSession: jest.fn().mockResolvedValue(session),
    findBookingById: jest.fn().mockResolvedValue(booking),
    findBookingItems: jest
      .fn()
      .mockReturnValue({
        session: () => Promise.resolve(options.items ?? []),
        then: (r: any) => Promise.resolve(options.items ?? []).then(r),
      }),
    updateManySchedules: jest.fn().mockResolvedValue(undefined),
    model: {
      findOneAndUpdate: jest.fn(async (filter: Row, update: Row) =>
        options.conflict ? null : { _id: filter._id, ...update.$set },
      ),
    },
  };
  const providerModel = {
    find: jest
      .fn()
      .mockReturnValue({
        session: () => Promise.resolve(options.providers ?? []),
      }),
    findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    db: {
      model: jest
        .fn()
        .mockReturnValue({
          findOne: () => ({ session: () => Promise.resolve(null) }),
        }),
    },
  };
  const inventoryReservationModel = {
    updateMany: jest
      .fn()
      .mockReturnValue({ session: () => Promise.resolve(undefined) }),
  };
  const notificationsService = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };
  const paymentsService = {
    settleBooking: jest.fn().mockResolvedValue(undefined),
    getRefundableAmount: jest.fn().mockResolvedValue(options.refundable ?? 0),
    cancelPendingPaymentsForBooking: jest.fn().mockResolvedValue(undefined),
    createRefundIntents: jest.fn().mockResolvedValue([]),
    cancelSettlementsForBooking: jest.fn().mockResolvedValue(undefined),
    executeRefundIntent: jest.fn().mockResolvedValue(undefined),
  };
  const promotionsService = {
    releaseVoucher: jest.fn().mockResolvedValue(null),
  };
  const settlementCalc = {
    getCustomerPaidServiceAmount: jest.fn((item: Row) => item.totalPrice ?? 0),
  };
  const service = new BookingStatusService(
    bookingsRepository as any,
    inventoryReservationModel as any,
    providerModel as any,
    notificationsService as any,
    paymentsService as any,
    promotionsService as any,
    settlementCalc as any,
  );
  return {
    service,
    session,
    bookingsRepository,
    providerModel,
    inventoryReservationModel,
    notificationsService,
    paymentsService,
    promotionsService,
  };
}

const asProvider = { providers: [{ _id: providerId }] };

describe('UC-44 Update Booking Status (NgocL)', () => {
  it('UT-44 UTCID04 forbids a customer from updating the booking status', async () => {
    const { service } = createStatusService(bookingDoc(), { providers: [] });

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.PickupPending,
        undefined,
        customerId.toString(),
        ['CUSTOMER'],
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Chỉ nhà cung cấp hoặc Admin mới có quyền cập nhật trạng thái đơn hàng này.',
      ),
    );
  });

  it('UT-44 UTCID05 returns not found for a missing booking', async () => {
    const { service } = createStatusService(null);

    await expect(
      service.updateBookingStatus('b1', BookingStatus.PickupPending),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy đơn hàng'));
  });

  it('UT-44 UTCID06 starts the Ao Dai handover window and notifies the customer', async () => {
    const booking = bookingDoc();
    const { service, notificationsService, session } = createStatusService(
      booking,
      asProvider,
    );

    await service.updateBookingStatus(
      'b1',
      BookingStatus.PickupPending,
      undefined,
      providerUserId,
      ['PROVIDER'],
    );

    expect(booking.status).toBe(BookingStatus.PickupPending);
    expect(booking.handoverInitiatedAt).toBeInstanceOf(Date);
    expect(notificationsService.createNotification.mock.calls[0][1]).toBe(
      'Đơn hàng bắt đầu bàn giao',
    );
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  it('UT-44 UTCID07 opens the 48-hour review window after a photoshoot', async () => {
    const booking = bookingDoc({ status: BookingStatus.InProgress });
    const { service } = createStatusService(booking, asProvider);

    await service.updateBookingStatus(
      'b1',
      BookingStatus.AwaitingReview,
      'Đã chụp xong',
      providerUserId,
      ['PROVIDER'],
    );

    expect(booking.awaitingReviewSince).toBeInstanceOf(Date);
    expect(booking.statusTimeline.at(-1)).toMatchObject({
      status: BookingStatus.AwaitingReview,
      note: 'Đã chụp xong',
    });
  });

  it('UT-44 UTCID08 completes inventory reservations when the costume is returned', async () => {
    const booking = bookingDoc({ status: BookingStatus.PickedUp });
    const { service, inventoryReservationModel } = createStatusService(
      booking,
      asProvider,
    );

    await service.updateBookingStatus(
      'b1',
      BookingStatus.Returned,
      undefined,
      providerUserId,
      ['PROVIDER'],
    );

    expect(inventoryReservationModel.updateMany).toHaveBeenCalledWith(
      { bookingId: booking._id },
      { $set: { status: 'COMPLETED' } },
    );
  });

  it('UT-44 UTCID09 rejects a transition that skips the handover flow', async () => {
    const { service, session } = createStatusService(bookingDoc(), asProvider);

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Returned,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Không được phép chuyển trạng thái đơn hàng từ CONFIRMED sang RETURNED',
      ),
    );
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  it('UT-44 UTCID10 does not change a booking that is already in a final status', async () => {
    const { service } = createStatusService(
      bookingDoc({ status: BookingStatus.Refunded }),
      asProvider,
    );

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Confirmed,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toThrow(
      'Không thể thay đổi trạng thái đơn hàng khi đã ở trạng thái cuối: REFUNDED',
    );
  });

  it('UT-44 UTCID11 treats an update to the current status as a no-op', async () => {
    const booking = bookingDoc();
    const { service } = createStatusService(booking, asProvider);

    await service.updateBookingStatus(
      'b1',
      BookingStatus.Confirmed,
      undefined,
      providerUserId,
      ['PROVIDER'],
    );

    expect(booking.save).not.toHaveBeenCalled();
  });

  it('UT-44 UTCID12 completes a returned booking and settles provider payouts', async () => {
    const booking = bookingDoc({ status: BookingStatus.Returned });
    const { service, paymentsService } = createStatusService(
      booking,
      asProvider,
    );

    // Provider cannot complete unilaterally
    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Completed,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toThrow(ForbiddenException);

    // Customer confirms completion
    await service.updateBookingStatus(
      'b1',
      BookingStatus.Completed,
      undefined,
      customerId.toString(),
      ['CUSTOMER'],
    );

    expect(booking.status).toBe(BookingStatus.Completed);
    expect(paymentsService.settleBooking).toHaveBeenCalledWith('b1');
  });

  it('UT-44 UTCID13 rejects completing a booking that has not been delivered', async () => {
    const { service, paymentsService } = createStatusService(
      bookingDoc(),
      asProvider,
    );

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Completed,
        undefined,
        customerId.toString(),
        ['CUSTOMER'],
      ),
    ).rejects.toThrow(
      'Không thể hoàn thành đơn đặt lịch từ trạng thái hiện tại: CONFIRMED.',
    );
    expect(paymentsService.settleBooking).not.toHaveBeenCalled();
  });

  it('UT-44 UTCID14 rolls back the transaction when saving fails', async () => {
    const booking = bookingDoc({
      save: jest.fn().mockRejectedValue(new Error('write conflict')),
    });
    const { service, session } = createStatusService(booking, asProvider);

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.PickupPending,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toThrow('write conflict');
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });
});

describe('UC-45 Respond to Booking Request (NgocL)', () => {
  it('UT-45 UTCID03 confirms a paid deposit booking', async () => {
    const booking = bookingDoc({ status: BookingStatus.DepositPaid });
    const { service } = createStatusService(booking, asProvider);

    await service.updateBookingStatus(
      'b1',
      BookingStatus.Confirmed,
      'Nhận lịch',
      providerUserId,
      ['PROVIDER'],
    );

    expect(booking.status).toBe(BookingStatus.Confirmed);
  });

  it('UT-45 UTCID04 confirms a booking that is still waiting for payment', async () => {
    const booking = bookingDoc({ status: BookingStatus.PendingPayment });
    const { service, notificationsService } = createStatusService(
      booking,
      asProvider,
    );

    await service.updateBookingStatus(
      'b1',
      BookingStatus.Confirmed,
      undefined,
      providerUserId,
      ['PROVIDER'],
    );

    expect(booking.status).toBe(BookingStatus.Confirmed);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      customerId.toString(),
      expect.stringContaining('Đã xác nhận'),
      expect.stringContaining('xác nhận đơn hàng'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('UT-45 UTCID05 declines a request with a full refund and a provider violation', async () => {
    const booking = bookingDoc({ status: BookingStatus.Confirmed });
    const { service, providerModel, paymentsService } = createStatusService(
      booking,
      { ...asProvider, refundable: 400000 },
    );

    await service.updateBookingStatus(
      'b1',
      BookingStatus.Cancelled,
      'Trùng lịch',
      providerUserId,
      ['PROVIDER'],
    );

    expect(providerModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(providerUserId) },
      { $inc: { violationCount: 1 } },
      expect.anything(),
    );
    expect(paymentsService.createRefundIntents).toHaveBeenCalledWith(
      booking._id,
      400000,
      'BOOKING_CANCEL',
      expect.anything(),
    );
  });

  it('UT-45 UTCID06 forbids responding to a booking of another shop', async () => {
    const { service } = createStatusService(
      bookingDoc({ status: BookingStatus.DepositPaid }),
      { providers: [{ _id: new Types.ObjectId() }] },
    );

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Confirmed,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('UT-45 UTCID07 cannot respond to a booking that was already cancelled', async () => {
    const { service } = createStatusService(
      bookingDoc({ status: BookingStatus.Cancelled }),
      asProvider,
    );

    await expect(
      service.updateBookingStatus(
        'b1',
        BookingStatus.Confirmed,
        undefined,
        providerUserId,
        ['PROVIDER'],
      ),
    ).rejects.toThrow(
      'Không thể thay đổi trạng thái đơn hàng khi đã ở trạng thái cuối: CANCELLED',
    );
  });
});

describe('UC-46 Cancel Booking (NgocL)', () => {
  it('UT-46 UTCID05 returns not found for a missing booking', async () => {
    const { service } = createStatusService(null);

    await expect(
      service.cancelBooking('b1', customerId.toString(), [], 'Đổi ý'),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy đơn đặt lịch'));
  });

  it('UT-46 UTCID06 forbids an unrelated user from cancelling', async () => {
    const { service } = createStatusService(bookingDoc(), { providers: [] });

    await expect(
      service.cancelBooking(
        'b1',
        new Types.ObjectId().toString(),
        ['CUSTOMER'],
        'x',
      ),
    ).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền hủy đơn đặt lịch này'),
    );
  });

  it('UT-46 UTCID07 returns an already cancelled booking without side effects', async () => {
    const booking = bookingDoc({ status: BookingStatus.Cancelled });
    const { service, bookingsRepository, paymentsService } =
      createStatusService(booking);

    await expect(
      service.cancelBooking('b1', customerId.toString(), [], 'x'),
    ).resolves.toBe(booking);
    expect(bookingsRepository.model.findOneAndUpdate).not.toHaveBeenCalled();
    expect(paymentsService.getRefundableAmount).not.toHaveBeenCalled();
  });

  it('UT-46 UTCID08 refuses to cancel a booking whose costume was already picked up', async () => {
    const { service } = createStatusService(
      bookingDoc({ status: BookingStatus.PickedUp }),
    );

    await expect(
      service.cancelBooking('b1', customerId.toString(), [], 'x'),
    ).rejects.toThrow(
      new BadRequestException(
        'Không thể hủy đơn đặt lịch đang thực hiện hoặc đã hoàn thành',
      ),
    );
  });

  it('UT-46 UTCID09 charges a 20% penalty for a late customer cancellation without touching the rental deposit', async () => {
    const items = [
      {
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: new Date(Date.now() + 10 * 60 * 60 * 1000),
        totalPrice: 500000,
        depositAmount: 200000,
      },
    ];
    const { service, paymentsService } = createStatusService(bookingDoc(), {
      items,
      refundable: 700000,
    });

    const result = (await service.cancelBooking(
      'b1',
      customerId.toString(),
      [],
      'Bận việc',
    )) as Row;

    expect(result).toMatchObject({ isFreeCancel: false, refundAmount: 600000 });
    expect(result.penaltyReason).toContain('Hủy đơn trễ');
    expect(paymentsService.createRefundIntents).toHaveBeenCalledWith(
      expect.anything(),
      600000,
      'BOOKING_CANCEL',
      expect.anything(),
    );
  });

  it('UT-46 UTCID10 reports a conflict when another process changed the booking first', async () => {
    const { service, session } = createStatusService(
      bookingDoc({ status: BookingStatus.PendingPayment }),
      { conflict: true },
    );

    await expect(
      service.cancelBooking('b1', customerId.toString(), [], 'x'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  it('UT-46 UTCID11 lets an administrator cancel any booking', async () => {
    const { service } = createStatusService(
      bookingDoc({ status: BookingStatus.PendingPayment }),
      { providers: [] },
    );

    const result = (await service.cancelBooking(
      'b1',
      new Types.ObjectId().toString(),
      ['ADMIN'],
      'Vi phạm',
    )) as Row;

    expect(result.success).toBe(true);
    expect(result.booking.status).toBe(BookingStatus.Cancelled);
  });
});

// ------------------------------------------------------------------ Reschedule
function createRescheduleService(booking: Row | null, item: Row | null) {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const bookingsRepository = {
    startSession: jest.fn().mockResolvedValue(session),
    findBookingById: jest.fn().mockResolvedValue(booking),
    findOneBookingItem: jest.fn().mockResolvedValue(item),
    updateBookingItem: jest.fn().mockResolvedValue(undefined),
    updateManySchedules: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BookingRescheduleService(
    bookingsRepository as any,
    {} as any,
    { createNotification: jest.fn() } as any,
  );
  jest
    .spyOn(service as any, 'getBusySchedulesForProvider')
    .mockResolvedValue({ bookedSlots: [] });
  return { service, session, bookingsRepository };
}

const rescheduleBookingId = new Types.ObjectId().toString();
const isoDate = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().split('T')[0];

describe('UC-47 Change Booking (NgocL)', () => {
  const productItem = () => ({
    _id: new Types.ObjectId(),
    itemType: BookingItemType.Product,
    rentalType: 'DAILY',
    rentalFrom: new Date(Date.now() + 5 * DAY),
  });
  const photoItem = () => ({
    _id: new Types.ObjectId(),
    itemType: BookingItemType.PhotographyPackage,
    providerId,
    shootDate: new Date(Date.now() + 5 * DAY),
  });

  afterEach(() => jest.restoreAllMocks());

  it('UT-47 UTCID05 rejects rescheduling a booking of another customer', async () => {
    const { service } = createRescheduleService(bookingDoc(), productItem());

    await expect(
      service.rescheduleBooking(
        rescheduleBookingId,
        new Types.ObjectId().toString(),
        { itemId: new Types.ObjectId().toString() },
      ),
    ).rejects.toThrow(
      new BadRequestException('Bạn không có quyền đổi lịch đơn hàng này'),
    );
  });

  it('UT-47 UTCID06 allows rescheduling only confirmed or deposit-paid bookings', async () => {
    const { service } = createRescheduleService(
      bookingDoc({ status: BookingStatus.PendingPayment }),
      productItem(),
    );

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow(
      /Chỉ có thể đổi lịch khi đơn ở trạng thái Đã xác nhận hoặc Đã cọc/,
    );
  });

  it('UT-47 UTCID07 returns not found for an item outside the booking', async () => {
    const { service } = createRescheduleService(bookingDoc(), null);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy mục đặt lịch'));
  });

  it('UT-47 UTCID08 requires at least 24 hours before the current start', async () => {
    const item = {
      ...productItem(),
      rentalFrom: new Date(Date.now() + 23 * 60 * 60 * 1000),
    };
    const { service } = createRescheduleService(bookingDoc(), item);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
        newRentalFrom: isoDate(7),
        newRentalTo: isoDate(8),
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Chỉ có thể đổi lịch trước giờ bắt đầu ít nhất 24 tiếng',
      ),
    );
  });

  it('UT-47 UTCID09 requires both new rental dates for a daily rental', async () => {
    const item = productItem();
    const { service } = createRescheduleService(bookingDoc(), item);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
        newRentalFrom: isoDate(7),
      }),
    ).rejects.toThrow(
      new BadRequestException('Yêu cầu ngày nhận và ngày trả mới'),
    );
  });

  it('UT-47 UTCID10 rejects a new pickup date in the past', async () => {
    const item = productItem();
    const { service } = createRescheduleService(bookingDoc(), item);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
        newRentalFrom: isoDate(-1),
        newRentalTo: isoDate(2),
      }),
    ).rejects.toThrow(
      new BadRequestException('Ngày nhận mới không thể nằm trong quá khứ'),
    );
  });

  it('UT-47 UTCID11 rejects a return date before the new pickup date', async () => {
    const item = productItem();
    const { service } = createRescheduleService(bookingDoc(), item);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
        newRentalFrom: isoDate(8),
        newRentalTo: isoDate(7),
      }),
    ).rejects.toThrow(
      new BadRequestException('Ngày trả phải sau hoặc bằng ngày nhận'),
    );
  });

  it('UT-47 UTCID12 requires a new shoot date for a photography item', async () => {
    const item = photoItem();
    const { service } = createRescheduleService(bookingDoc(), item);

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
      }),
    ).rejects.toThrow(new BadRequestException('Yêu cầu ngày chụp mới'));
  });

  it('UT-47 UTCID13 rejects a photographer slot that overlaps another booking', async () => {
    const item = photoItem();
    const { service } = createRescheduleService(bookingDoc(), item);
    jest
      .spyOn(service as any, 'getBusySchedulesForProvider')
      .mockResolvedValue({
        bookedSlots: [
          {
            date: isoDate(9),
            timeSlot: '09:00-11:00',
            bookingItemId: 'other-item',
          },
        ],
      });

    await expect(
      service.rescheduleBooking(rescheduleBookingId, customerId.toString(), {
        itemId: item._id.toString(),
        newShootDate: isoDate(9),
        newShootTimeSlot: '10:00-12:00',
      }),
    ).rejects.toThrow(
      `Thợ ảnh đã có lịch vào ngày ${isoDate(9)} khung giờ 10:00-12:00`,
    );
  });
});
