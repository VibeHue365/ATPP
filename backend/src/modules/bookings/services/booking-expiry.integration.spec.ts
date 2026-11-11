import { createConnection, Connection, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { contractTestTarget } from '../../contracts/contract-test-target';
import {
  Booking,
  BookingSchema,
  BookingStatus,
} from '../schemas/booking.schema';
import {
  BookingSchedule,
  BookingScheduleSchema,
  BookingScheduleStatus,
} from '../schemas/booking-schedule.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { Payment, PaymentSchema } from '../../payments/schemas/payment.schema';
import { BookingsService } from './bookings.service';

const target = contractTestTarget();

(target ? describe : describe.skip)(
  'Booking expiry and payment transition on isolated MongoDB',
  () => {
    let connection: Connection;
    let scratchName: string;

    beforeAll(async () => {
      scratchName = `contract_expiry_${new Types.ObjectId().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;
      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary)
        throw new Error('Expiry integration requires the isolated replica set');
      connection.model(Booking.name, BookingSchema);
      connection.model(BookingSchedule.name, BookingScheduleSchema);
      connection.model(InventoryReservation.name, InventoryReservationSchema);
      connection.model(Payment.name, PaymentSchema);
    }, 30000);

    afterAll(async () => {
      if (!connection) return;
      if (
        scratchName.startsWith('contract_expiry_') &&
        scratchName.endsWith('_test')
      )
        await connection.dropDatabase();
      await connection.close();
    }, 30000);

    it('lets only payment or expiry win, with no losing expiry side effects', async () => {
      const bookings = connection.model(Booking.name);
      const schedules = connection.model(BookingSchedule.name);
      const reservations = connection.model(InventoryReservation.name);
      const payments = connection.model(Payment.name);
      for (let index = 0; index < 8; index++) {
        const bookingId = new Types.ObjectId();
        const scheduleId = new Types.ObjectId();
        const reservationId = new Types.ObjectId();
        await connection.db!.collection('bookings').insertOne({
          _id: bookingId,
          bookingCode: `EXP-${randomUUID()}`,
          customerId: new Types.ObjectId(),
          bookingType: 'AODAI_RENTAL',
          status: BookingStatus.PendingPayment,
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          holdExpiresAt: new Date(Date.now() - 1000),
        });
        await connection.db!.collection('booking_schedules').insertOne({
          _id: scheduleId,
          bookingId,
          status: BookingScheduleStatus.Held,
        });
        await connection.db!.collection('inventory_reservations').insertOne({
          _id: reservationId,
          bookingId,
          status: ReservationStatus.TempReserved,
        });
        await connection.db!.collection('payments').insertOne({
          bookingId,
          paymentCode: `EXP-PAY-${randomUUID()}`,
          status: 'PENDING',
        });

        const expiry =
          BookingsService.prototype.cleanupExpiredPendingBookings.call({
            policyResolverService: {
              getBookingHoldPolicy: () =>
                Promise.resolve({ autoExpireEnabled: true, holdMinutes: 15 }),
            },
            bookingModel: bookings,
            bookingScheduleModel: schedules,
            inventoryReservationModel: reservations,
          } as never);
        const payment = bookings.updateOne(
          { _id: bookingId, status: BookingStatus.PendingPayment },
          { $set: { status: BookingStatus.Confirmed } },
        );
        const [, paymentResult] = await Promise.all([expiry, payment]);
        const saved = await bookings.findById(bookingId).lean();
        const reservation = await reservations.findById(reservationId).lean();
        const schedule = await schedules.findById(scheduleId).lean();
        if (paymentResult.modifiedCount === 1) {
          expect(saved?.status).toBe(BookingStatus.Confirmed);
          expect(reservation?.status).toBe(ReservationStatus.TempReserved);
          expect(schedule?.status).toBe(BookingScheduleStatus.Held);
        } else {
          expect(saved?.status).toBe(BookingStatus.Cancelled);
          expect(reservation?.status).toBe(ReservationStatus.Cancelled);
          expect(schedule?.status).toBe(BookingScheduleStatus.Cancelled);
        }
        expect(
          await payments.countDocuments({ bookingId, status: 'SUCCESS' }),
        ).toBe(0);
      }
    });

    it('expires V2 hold atomically but preserves a booking with acknowledged payment', async () => {
      const bookings = connection.model(Booking.name);
      const schedules = connection.model(BookingSchedule.name);
      const reservations = connection.model(InventoryReservation.name);
      const payments = connection.model(Payment.name);
      const expiredAt = new Date(Date.now() - 1000);
      const unpaidId = new Types.ObjectId();
      const paidId = new Types.ObjectId();
      for (const bookingId of [unpaidId, paidId]) {
        await connection.db!.collection('bookings').insertOne({
          _id: bookingId,
          bookingCode: `EXP-V2-${randomUUID()}`,
          customerId: new Types.ObjectId(),
          bookingType: 'AODAI_RENTAL',
          contractFlowVersion: 2,
          status: BookingStatus.PendingPayment,
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          holdExpiresAt: expiredAt,
        });
        await connection.db!.collection('booking_schedules').insertOne({
          bookingId,
          status: BookingScheduleStatus.Held,
        });
        await connection.db!.collection('inventory_reservations').insertOne({
          bookingId,
          status: ReservationStatus.TempReserved,
        });
      }
      await connection.db!.collection('payments').insertMany([
        {
          bookingId: unpaidId,
          paymentCode: `EXP-V2-${randomUUID()}`,
          status: 'PENDING',
        },
        {
          bookingId: paidId,
          paymentCode: `EXP-V2-${randomUUID()}`,
          status: 'SUCCESS',
        },
      ]);
      const service = Object.assign(Object.create(BookingsService.prototype), {
        policyResolverService: {
          getBookingHoldPolicy: () =>
            Promise.resolve({ autoExpireEnabled: true, holdMinutes: 15 }),
        },
        bookingModel: bookings,
        bookingScheduleModel: schedules,
        inventoryReservationModel: reservations,
        promotionsService: {
          releaseVoucher: jest.fn().mockResolvedValue(undefined),
        },
      }) as BookingsService;
      await service.cleanupExpiredPendingBookings();
      expect((await bookings.findById(unpaidId).lean())?.status).toBe(
        BookingStatus.Cancelled,
      );
      const unpaidClaim = (await bookings.findById(unpaidId).lean())
        ?.paymentExpiryClaim as { phase?: string } | undefined;
      expect(unpaidClaim?.phase).toBe('EXPIRY');
      expect(
        (await payments.findOne({ bookingId: unpaidId }).lean())?.status,
      ).toBe('FAILED');
      expect(
        (await schedules.findOne({ bookingId: unpaidId }).lean())?.status,
      ).toBe(BookingScheduleStatus.Cancelled);
      expect(
        (await reservations.findOne({ bookingId: unpaidId }).lean())?.status,
      ).toBe(ReservationStatus.Cancelled);
      expect((await bookings.findById(paidId).lean())?.status).toBe(
        BookingStatus.PendingPayment,
      );
      expect(
        (await schedules.findOne({ bookingId: paidId }).lean())?.status,
      ).toBe(BookingScheduleStatus.Held);
      expect(
        (await reservations.findOne({ bookingId: paidId }).lean())?.status,
      ).toBe(ReservationStatus.TempReserved);
    });
  },
);
