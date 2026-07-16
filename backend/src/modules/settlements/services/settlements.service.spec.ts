import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus, PaymentStatus as BookingPaymentStatus } from '../../bookings/schemas/booking.schema';
import { SettlementStatus } from '../constants/settlement-status.enum';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  const settlementModel = {
    find: jest.fn(),
    findById: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const bookingModel = {
    findById: jest.fn(),
    updateOne: jest.fn(),
  };
  const bookingItemModel = { find: jest.fn() };
  const paymentModel = { findOne: jest.fn() };
  const adjustmentModel = { find: jest.fn(), updateOne: jest.fn() };
  const calculationService = { calculateSettlementsForBooking: jest.fn() };
  const codeService = { generateSettlementCode: jest.fn() };
  const securityLogService = { recordAdminAudit: jest.fn() };

  let service: SettlementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    bookingModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    settlementModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
    securityLogService.recordAdminAudit.mockResolvedValue(undefined);
    service = new SettlementsService(
      settlementModel as never,
      bookingModel as never,
      bookingItemModel as never,
      paymentModel as never,
      adjustmentModel as never,
      calculationService as never,
      codeService as never,
      securityLogService as never,
    );
  });

  function booking(status: BookingStatus, paymentStatus: BookingPaymentStatus) {
    return {
      _id: new Types.ObjectId(),
      bookingCode: 'BK-TEST',
      status,
      paymentSummary: { paymentStatus, totalPaid: 100000 },
    };
  }

  function mockItems(items: Array<{ providerId: Types.ObjectId }>) {
    const secondPopulate = jest.fn().mockResolvedValue(items);
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    bookingItemModel.find.mockReturnValue({ populate: firstPopulate });
  }

  function mockExisting(items: unknown[]) {
    settlementModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(items),
    });
  }

  it('does not create settlements before the booking is completed', async () => {
    bookingModel.findById.mockResolvedValue(
      booking(BookingStatus.Confirmed, BookingPaymentStatus.Paid),
    );

    await expect(
      service.createSettlementsForBooking(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calculationService.calculateSettlementsForBooking).not.toHaveBeenCalled();
  });

  it('does not create settlements before the booking is paid', async () => {
    bookingModel.findById.mockResolvedValue(
      booking(BookingStatus.Completed, BookingPaymentStatus.Pending),
    );

    await expect(
      service.createSettlementsForBooking(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calculationService.calculateSettlementsForBooking).not.toHaveBeenCalled();
  });

  it('creates one settlement per provider and remains idempotent', async () => {
    const currentBooking = booking(
      BookingStatus.Completed,
      BookingPaymentStatus.Paid,
    );
    const providerA = new Types.ObjectId();
    const providerB = new Types.ObjectId();
    const sourceItems = [{ providerId: providerA }, { providerId: providerB }];
    const payloads = [
      { bookingId: currentBooking._id, providerId: providerA },
      { bookingId: currentBooking._id, providerId: providerB },
    ];
    const created = payloads.map((payload, index) => ({
      ...payload,
      settlementCode: `STL-${index + 1}`,
      status: SettlementStatus.ReadyToSettle,
    }));

    bookingModel.findById.mockResolvedValue(currentBooking);
    mockItems(sourceItems);
    mockExisting([]);
    paymentModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
    calculationService.calculateSettlementsForBooking.mockResolvedValue(payloads);
    codeService.generateSettlementCode
      .mockResolvedValueOnce('STL-1')
      .mockResolvedValueOnce('STL-2');
    settlementModel.insertMany.mockResolvedValue(created);

    await expect(
      service.createSettlementsForBooking(currentBooking._id.toString()),
    ).resolves.toEqual(created);
    expect(settlementModel.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ settlementCode: 'STL-1', providerId: providerA }),
        expect.objectContaining({ settlementCode: 'STL-2', providerId: providerB }),
      ]),
      { ordered: true },
    );

    mockExisting(created);
    await expect(
      service.createSettlementsForBooking(currentBooking._id.toString()),
    ).resolves.toEqual(created);
    expect(settlementModel.insertMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a partial settlement state instead of creating duplicates', async () => {
    const currentBooking = booking(
      BookingStatus.Completed,
      BookingPaymentStatus.Paid,
    );
    const providerA = new Types.ObjectId();
    const providerB = new Types.ObjectId();
    bookingModel.findById.mockResolvedValue(currentBooking);
    mockItems([{ providerId: providerA }, { providerId: providerB }]);
    mockExisting([{ providerId: providerA }]);

    await expect(
      service.createSettlementsForBooking(currentBooking._id.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(settlementModel.insertMany).not.toHaveBeenCalled();
  });

  it('holds and releases only from the expected lifecycle status', async () => {
    const settlementId = new Types.ObjectId();
    const actorId = new Types.ObjectId().toString();
    const ready = {
      _id: settlementId,
      status: SettlementStatus.ReadyToSettle,
      providerId: new Types.ObjectId(),
    };
    const held = { ...ready, status: SettlementStatus.OnHold, holdReason: 'DISPUTE' };
    const released = { ...ready, holdReason: null };
    settlementModel.findById
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(held);
    settlementModel.findOneAndUpdate
      .mockResolvedValueOnce(held)
      .mockResolvedValueOnce(released);

    await service.holdSettlement(actorId, settlementId.toString(), { reason: 'DISPUTE' });
    expect(settlementModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: settlementId, status: SettlementStatus.ReadyToSettle },
      expect.any(Object),
      { new: true },
    );

    await service.releaseSettlement(actorId, settlementId.toString(), { reason: 'RESOLVED' });
    expect(settlementModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: settlementId, status: SettlementStatus.OnHold },
      expect.any(Object),
      { new: true },
    );
  });

  it('marks a ready settlement as settled with a payout reference', async () => {
    const settlementId = new Types.ObjectId();
    const actorId = new Types.ObjectId().toString();
    const ready = {
      _id: settlementId,
      status: SettlementStatus.ReadyToSettle,
      providerId: new Types.ObjectId(),
      payableAmount: 90000,
    };
    const settled = {
      ...ready,
      status: SettlementStatus.Settled,
      payoutReference: 'BANK-REF-001',
    };
    settlementModel.findById.mockResolvedValue(ready);
    adjustmentModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    settlementModel.findOneAndUpdate.mockResolvedValue(settled);

    await expect(
      service.markSettled(actorId, settlementId.toString(), {
        payoutReference: 'BANK-REF-001',
      }),
    ).resolves.toEqual(settled);
    expect(settlementModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: settlementId,
        status: SettlementStatus.ReadyToSettle,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: SettlementStatus.Settled,
          payoutReference: 'BANK-REF-001',
        }),
      }),
      { new: true },
    );
  });
});
