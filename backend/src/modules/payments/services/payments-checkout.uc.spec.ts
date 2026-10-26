import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../../bookings/schemas/booking.schema';
import { PaymentPurpose, PaymentStatus } from '../schemas/payment.schema';
import { PaymentsService } from './payments.service';

type Row = Record<string, any>;

const customerId = new Types.ObjectId();

function createService(
  options: {
    booking?: Row | null;
    pending?: Row | null;
    bookings?: Row[];
    provider?: Row | null;
  } = {},
) {
  const paymentsRepository = {
    findPendingPaymentByBooking: jest
      .fn()
      .mockResolvedValue(options.pending ?? null),
    createPayment: jest.fn(async (data: Row) => ({
      _id: new Types.ObjectId(),
      ...data,
    })),
    findPaymentWithBooking: jest.fn(),
    findPendingPaymentsByBookingIds: jest.fn().mockResolvedValue([]),
    findByBookingIds: jest.fn(async (ids: Types.ObjectId[]) =>
      ids.map((bookingId) => ({ bookingId })),
    ),
  };
  const providerModel = {
    findOne: jest
      .fn()
      .mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(options.provider ?? null) }),
      }),
  };
  const refundPaymentModel = {
    findOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
  };
  const bookingModel = {
    findById: jest.fn().mockResolvedValue(
      options.booking === undefined
        ? {
            _id: new Types.ObjectId(),
            bookingCode: 'BK-2026',
            customerId,
            status: BookingStatus.PendingPayment,
            pricingSummary: { amountDueNow: 350000, grandTotal: 900000 },
            paymentSummary: { totalPaid: 350000 },
          }
        : options.booking,
    ),
    find: jest.fn().mockImplementation(() => {
      const result = options.bookings ?? [];
      return Object.assign(Promise.resolve(result), {
        select: () => ({
          lean: () => ({ exec: () => Promise.resolve(result) }),
        }),
      });
    }),
    db: {
      model: jest.fn((name: string) =>
        name === 'Provider' ? providerModel : refundPaymentModel,
      ),
    },
  };
  const service = Object.create(PaymentsService.prototype) as PaymentsService;
  Object.assign(service, {
    paymentsRepository,
    bookingModel,
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
  });
  const finalize = jest
    .spyOn(service, 'finalizeAfterPayment')
    .mockResolvedValue(undefined);
  const refundDeposit = jest
    .spyOn(service, 'refundDeposit')
    .mockResolvedValue({} as any);
  return { service, paymentsRepository, bookingModel, finalize, refundDeposit };
}

afterEach(() => jest.restoreAllMocks());

describe('UC-49 Online Payment (HoangLVM)', () => {
  const bookingId = new Types.ObjectId().toString();

  it('UT-49 UTCID09 returns not found for a missing booking', async () => {
    const { service } = createService({ booking: null });

    await expect(
      service.createPaymentLink(
        bookingId,
        PaymentPurpose.DepositPayment,
        customerId.toString(),
      ),
    ).rejects.toThrow(new NotFoundException('Booking not found'));
  });

  it('UT-49 UTCID10 forbids paying a booking of another customer', async () => {
    const { service, paymentsRepository } = createService();

    await expect(
      service.createPaymentLink(
        bookingId,
        PaymentPurpose.DepositPayment,
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền thanh toán đơn này.'),
    );
    expect(paymentsRepository.createPayment).not.toHaveBeenCalled();
  });

  it('UT-49 UTCID11 rejects a deposit payment for a booking that is no longer pending', async () => {
    const { service } = createService({
      booking: {
        customerId,
        status: BookingStatus.Confirmed,
        pricingSummary: {},
        paymentSummary: {},
      },
    });

    await expect(
      service.createPaymentLink(
        bookingId,
        PaymentPurpose.DepositPayment,
        customerId.toString(),
      ),
    ).rejects.toThrow(
      new BadRequestException('Đơn không còn ở trạng thái chờ thanh toán.'),
    );
  });

  it('UT-49 UTCID12 reuses an existing pending payment instead of creating a duplicate', async () => {
    const pending = { paymentCode: 'PAY-EXISTING' };
    const { service, paymentsRepository } = createService({ pending });

    await expect(
      service.createPaymentLink(
        bookingId,
        PaymentPurpose.DepositPayment,
        customerId.toString(),
      ),
    ).resolves.toBe(pending);
    expect(paymentsRepository.createPayment).not.toHaveBeenCalled();
  });

  it('UT-49 UTCID13 creates a pending payment for the amount due now with a checkout link', async () => {
    const { service, paymentsRepository } = createService();

    const payment = await service.createPaymentLink(
      bookingId,
      PaymentPurpose.DepositPayment,
      customerId.toString(),
    );

    expect(paymentsRepository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 350000,
        status: PaymentStatus.Pending,
        purpose: PaymentPurpose.DepositPayment,
      }),
    );
    expect(payment.paymentCode).toMatch(/^PAY\d{10}$/);
    expect(payment.payos.checkoutUrl).toContain(
      `/checkout/result?paymentCode=${payment.paymentCode}`,
    );
  });

  it('UT-49 UTCID14 confirms a zero-amount booking immediately without a payment gateway', async () => {
    const { service, paymentsRepository, finalize } = createService({
      booking: {
        _id: new Types.ObjectId(),
        customerId,
        status: BookingStatus.PendingPayment,
        pricingSummary: { amountDueNow: 0 },
        paymentSummary: {},
      },
    });

    const payment = await service.createPaymentLink(
      bookingId,
      PaymentPurpose.DepositPayment,
      customerId.toString(),
    );

    expect(paymentsRepository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0, status: PaymentStatus.Success }),
    );
    expect(payment.paymentCode).toMatch(/^PAY0D_/);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('UT-49 UTCID15 charges the remaining balance even after the booking is confirmed', async () => {
    const { service, paymentsRepository } = createService({
      booking: {
        _id: new Types.ObjectId(),
        customerId,
        status: BookingStatus.Confirmed,
        pricingSummary: { grandTotal: 900000 },
        paymentSummary: { totalPaid: 350000 },
      },
    });

    await service.createPaymentLink(
      bookingId,
      PaymentPurpose.RemainingPayment,
      customerId.toString(),
    );

    expect(paymentsRepository.createPayment.mock.calls[0][0].amount).toBe(
      550000,
    );
  });

  it('UT-49 UTCID16 forbids reading the payment status of another customer', async () => {
    const { service, paymentsRepository } = createService();
    paymentsRepository.findPaymentWithBooking.mockResolvedValue({
      status: PaymentStatus.Success,
      bookingId: {
        _id: new Types.ObjectId(),
        customerId: new Types.ObjectId(),
        paymentSummary: {},
      },
    });

    await expect(
      service.getPaymentStatus('PAY123', customerId.toString()),
    ).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền xem giao dịch này.'),
    );
  });

  it('UT-49 UTCID17 returns not found for an unknown payment code', async () => {
    const { service, paymentsRepository } = createService();
    paymentsRepository.findPaymentWithBooking.mockResolvedValue(null);

    await expect(
      service.getPaymentStatus('PAY404', customerId.toString()),
    ).rejects.toThrow(new NotFoundException('Payment not found'));
  });
});

describe('UC-48 View Transaction (HoangLVM)', () => {
  it('UT-48 UTCID02 lists the payments of the customer bookings', async () => {
    const bookings = [
      {
        _id: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
        pricingSummary: {},
      },
    ];
    const { service, paymentsRepository, bookingModel } = createService({
      bookings,
    });

    const result = await service.getTransactions(customerId.toString(), [
      'CUSTOMER',
    ]);

    expect(bookingModel.find).toHaveBeenCalledWith({ customerId });
    expect(paymentsRepository.findByBookingIds).toHaveBeenCalledWith([
      bookings[0]._id,
    ]);
    expect(result).toHaveLength(1);
  });

  it('UT-48 UTCID03 lists the payments of bookings that belong to the provider', async () => {
    const provider = { _id: new Types.ObjectId() };
    const bookings = [
      { _id: new Types.ObjectId() },
      { _id: new Types.ObjectId() },
    ];
    const { service, bookingModel } = createService({ provider, bookings });

    const result = await service.getTransactions(
      new Types.ObjectId().toString(),
      ['PROVIDER'],
    );

    expect(bookingModel.find).toHaveBeenCalledWith({
      providerIds: provider._id,
    });
    expect(result).toHaveLength(2);
  });

  it('UT-48 UTCID04 returns an empty list for a provider role without a provider profile', async () => {
    const { service, paymentsRepository } = createService({ provider: null });

    await expect(
      service.getTransactions(new Types.ObjectId().toString(), ['PROVIDER']),
    ).resolves.toEqual([]);
    expect(paymentsRepository.findByBookingIds).not.toHaveBeenCalled();
  });

  it('UT-48 UTCID05 lists only pending checkouts that still have a checkout link', async () => {
    const booking = { _id: new Types.ObjectId(), bookingCode: 'BK-1' };
    const { service, paymentsRepository } = createService({
      bookings: [booking],
    });
    paymentsRepository.findPendingPaymentsByBookingIds.mockResolvedValue([
      {
        paymentCode: 'PAY1',
        bookingId: booking._id,
        payos: { checkoutUrl: 'https://pay.test/1' },
      },
      { paymentCode: 'PAY2', bookingId: booking._id, payos: {} },
    ]);

    await expect(
      service.getPendingCheckouts(customerId.toString()),
    ).resolves.toEqual([
      {
        paymentCode: 'PAY1',
        bookingId: booking._id.toString(),
        checkoutUrl: 'https://pay.test/1',
      },
    ]);
  });

  it('UT-48 UTCID06 returns no pending checkout when the customer has no unpaid booking', async () => {
    const { service, paymentsRepository } = createService({ bookings: [] });

    await expect(
      service.getPendingCheckouts(customerId.toString()),
    ).resolves.toEqual([]);
    expect(
      paymentsRepository.findPendingPaymentsByBookingIds,
    ).not.toHaveBeenCalled();
  });

  it('UT-48 UTCID07 creates the missing deposit refund of a returned booking while listing transactions', async () => {
    const booking = {
      _id: new Types.ObjectId(),
      bookingCode: 'BK-RET',
      status: 'RETURNED',
      bookingType: 'PRODUCT',
      pricingSummary: {
        depositTotal: 200000,
        subTotal: 500000,
        grandTotal: 700000,
      },
    };
    const { service, refundDeposit } = createService({ bookings: [booking] });

    await service.getTransactions(customerId.toString(), ['CUSTOMER']);

    expect(refundDeposit).toHaveBeenCalledWith(booking._id.toString(), 200000);
  });

  it('UT-48 UTCID08 rejects a malformed user id', async () => {
    const { service, bookingModel } = createService();

    await expect(
      service.getTransactions('user-1', ['CUSTOMER']),
    ).rejects.toThrow();
    expect(bookingModel.find).not.toHaveBeenCalled();
  });
});
