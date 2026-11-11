import { Types } from 'mongoose';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingStatusService } from './booking-status.service';
import { BookingsService } from './bookings.service';
import { PhotographyHoldService } from './photography-hold.service';
import { pendingBookingExpiryFilter } from './booking-expiry-filter';
import { BookingScheduleStatus } from '../schemas/booking-schedule.schema';

describe('booking expiry race guards', () => {
  it('uses the saved deadline when present and the existing cutoff for legacy bookings', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');
    const cutoff = new Date('2026-10-28T09:45:00.000Z');
    const filter = pendingBookingExpiryFilter(now, cutoff);
    expect(filter).toEqual({
      status: BookingStatus.PendingPayment,
      $or: [
        { holdExpiresAt: { $lte: now } },
        { holdExpiresAt: null, createdAt: { $lt: cutoff } },
      ],
    });
  });

  it('does not release resources when payment wins before the scheduled booking transition', async () => {
    const bookingId = new Types.ObjectId();
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    const repo = {
      startSession: jest.fn().mockResolvedValue(session),
      findBookings: jest.fn().mockResolvedValue([{ _id: bookingId }]),
      // Simulate the payment path moving PENDING_PAYMENT to CONFIRMED first.
      updateManyBookings: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      updateManySchedules: jest.fn(),
      hasSuccessfulPayment: jest.fn().mockResolvedValue(false),
    };
    const inventory = { updateMany: jest.fn() };
    const promotions = { releaseVoucher: jest.fn() };
    const service = new BookingStatusService(
      repo as never,
      inventory as never,
      {} as never,
      {} as never,
      {} as never,
      promotions as never,
      {} as never,
    );

    await service.cleanupExpiredPendingBookings();

    expect(repo.updateManyBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: bookingId,
        status: BookingStatus.PendingPayment,
      }),
      expect.anything(),
      session,
    );
    expect(repo.updateManySchedules).not.toHaveBeenCalled();
    expect(inventory.updateMany).not.toHaveBeenCalled();
    expect(promotions.releaseVoucher).not.toHaveBeenCalled();
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not fail pending payments or release holds if the second cleanup loses to payment', async () => {
    const bookingId = new Types.ObjectId();
    const payments = {
      updateMany: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
    };
    const bookingModel = {
      find: jest.fn().mockResolvedValue([{ _id: bookingId }]),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      db: { model: jest.fn().mockReturnValue(payments) },
    };
    const schedules = { updateMany: jest.fn() };
    const inventory = { updateMany: jest.fn() };
    await BookingsService.prototype.cleanupExpiredPendingBookings.call({
      policyResolverService: {
        getBookingHoldPolicy: jest.fn().mockResolvedValue({
          autoExpireEnabled: true,
          holdMinutes: 15,
        }),
      },
      bookingModel,
      bookingScheduleModel: schedules,
      inventoryReservationModel: inventory,
    } as never);

    expect(bookingModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: bookingId,
        status: BookingStatus.PendingPayment,
      }),
      expect.anything(),
    );
    expect(schedules.updateMany).not.toHaveBeenCalled();
    expect(inventory.updateMany).not.toHaveBeenCalled();
    expect(payments.updateMany).not.toHaveBeenCalled();
  });

  it('photography expiry does not cancel a paid booking or release its voucher', async () => {
    const bookingId = new Types.ObjectId();
    const scheduleId = new Types.ObjectId();
    const schedules = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: scheduleId, bookingId }]),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: scheduleId }),
    };
    const bookingModel = {
      exists: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      db: {
        model: jest
          .fn()
          .mockReturnValue({ exists: jest.fn().mockResolvedValue(null) }),
      },
    };
    const inventory = { updateMany: jest.fn() };
    const promotions = { releaseVoucher: jest.fn() };
    const count =
      await PhotographyHoldService.prototype.expireExpiredHolds.call({
        bookingScheduleModel: schedules,
        bookingModel,
        inventoryReservationModel: inventory,
        promotionsService: promotions,
      } as never);

    expect(count).toBe(1);
    expect(bookingModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: bookingId,
        status: BookingStatus.PendingPayment,
      }),
      expect.anything(),
    );
    expect(promotions.releaseVoucher).not.toHaveBeenCalled();
  });

  it('photography expiry does nothing when payment confirms the schedule first', async () => {
    const bookingId = new Types.ObjectId();
    const schedules = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: new Types.ObjectId(), bookingId }]),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };
    const bookingModel = {
      exists: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn(),
      db: {
        model: jest
          .fn()
          .mockReturnValue({ exists: jest.fn().mockResolvedValue(null) }),
      },
    };
    const inventory = { updateMany: jest.fn() };
    const count =
      await PhotographyHoldService.prototype.expireExpiredHolds.call({
        bookingScheduleModel: schedules,
        bookingModel,
        inventoryReservationModel: inventory,
      } as never);

    expect(count).toBe(0);
    expect(bookingModel.updateOne).not.toHaveBeenCalled();
    expect(inventory.updateMany).not.toHaveBeenCalled();
    expect(schedules.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingScheduleStatus.Held }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('leaves a photography schedule held when payment succeeded before cleanup', async () => {
    const bookingId = new Types.ObjectId();
    const schedules = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: new Types.ObjectId(), bookingId }]),
      }),
      findOneAndUpdate: jest.fn(),
    };
    const bookingModel = {
      exists: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn(),
      db: {
        model: jest.fn().mockReturnValue({
          exists: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
        }),
      },
    };
    const inventory = { updateMany: jest.fn() };

    const count =
      await PhotographyHoldService.prototype.expireExpiredHolds.call({
        bookingScheduleModel: schedules,
        bookingModel,
        inventoryReservationModel: inventory,
      } as never);

    expect(count).toBe(0);
    expect(schedules.findOneAndUpdate).not.toHaveBeenCalled();
    expect(bookingModel.updateOne).not.toHaveBeenCalled();
    expect(inventory.updateMany).not.toHaveBeenCalled();
  });

  it('skips an expired pending booking when a successful payment already exists', async () => {
    const bookingId = new Types.ObjectId();
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    const repo = {
      startSession: jest.fn().mockResolvedValue(session),
      findBookings: jest.fn().mockResolvedValue([{ _id: bookingId }]),
      hasSuccessfulPayment: jest.fn().mockResolvedValue(true),
      updateManyBookings: jest.fn(),
      updateManySchedules: jest.fn(),
    };
    const service = new BookingStatusService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.cleanupExpiredPendingBookings();
    expect(repo.updateManyBookings).not.toHaveBeenCalled();
    expect(repo.updateManySchedules).not.toHaveBeenCalled();
  });
});
