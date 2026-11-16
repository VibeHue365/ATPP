import {
  createConnection,
  Connection,
  Model,
  Types,
} from 'mongoose';
import {
  InventorySlotLease,
  InventorySlotLeaseDocument,
  InventorySlotLeaseSchema,
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import {
  Booking,
  BookingSchema,
  BookingStatus,
  BookingType,
} from '../schemas/booking.schema';
import { BookingItem, BookingItemSchema, BookingItemType } from '../schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleSchema } from '../schemas/booking-schedule.schema';
import { Provider, ProviderSchema } from '../../providers/schemas/provider.schema';
import { BookingsService } from './bookings.service';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import { TimeSlotEngineService } from './time-slot-engine.service';
import {
  assertSafeTestMongoUri,
  assertSafeTestConnection,
  sanitizeMongoUriForLogging,
} from './mongo-test-safety-guard';
import { ConflictException } from '@nestjs/common';

/**
 * Requirement 4: Integration test on MongoDB Replica Set
 * - Two concurrent checkouts for same item/slot
 * - Exactly one transaction commits
 * - The other receives E11000 / HTTP 409 Conflict
 * - Zero orphaned leases or reservations
 * - Unique partial index is verified
 */
describe('InventorySlotLease Concurrency & ACID Integration', () => {
  const defaultReplicaUri =
    process.env.MONGODB_SLOT_LEASE_TEST_URI ||
    process.env.CONTRACT_TEST_MONGODB_URI ||
    'mongodb://127.0.0.1:27028/slot_lease_concurrency_test?replicaSet=rsContractTest&directConnection=true';

  let connection: Connection | null = null;
  let leaseModel: Model<InventorySlotLeaseDocument>;
  let reservationModel: Model<any>;
  let isReplicaSetAvailable = false;

  beforeAll(async () => {
    try {
      assertSafeTestMongoUri(defaultReplicaUri);
      console.log(`[Safe Guard] Connecting to replica set: ${sanitizeMongoUriForLogging(defaultReplicaUri)}`);
      connection = await createConnection(defaultReplicaUri, {
        serverSelectionTimeoutMS: 3000,
      }).asPromise();

      const admin = connection.db?.admin();
      const hello = await admin?.command({ hello: 1 });
      if (!hello?.setName || !hello?.isWritablePrimary) {
        throw new Error(
          `MongoDB at ${defaultReplicaUri} is connected but is not a writable primary in a Replica Set (setName: ${hello?.setName}, isWritablePrimary: ${hello?.isWritablePrimary}).`,
        );
      }

      isReplicaSetAvailable = true;
      leaseModel = connection.model(
        InventorySlotLease.name,
        InventorySlotLeaseSchema,
      );
      reservationModel = connection.model(
        InventoryReservation.name,
        InventoryReservationSchema,
      );
      // Build real indexes on replica set
      await leaseModel.createIndexes();
      await reservationModel.createIndexes();
    } catch (err: any) {
      if (connection) {
        try {
          await connection.close();
        } catch {
          // ignore close error
        }
        connection = null;
      }
      isReplicaSetAvailable = false;
      throw new Error(
        `Failed to connect to isolated MongoDB Replica Set on port 27028 (${defaultReplicaUri}): ${err.message}. A running MongoDB replica set is strictly required for this integration test.`,
      );
    }
  });

  afterAll(async () => {
    if (connection) {
      try {
        assertSafeTestConnection(connection);
        await connection.dropDatabase();
      } finally {
        await connection.close();
      }
    }
  });

  describe('Unique Partial Index Definition', () => {
    it('verifies unique partial index exists on inventoryItemId, dateStr, slotIndex for TEMP/CONFIRMED', async () => {
      // 1. Verify schema definition in code
      const indexes = InventorySlotLeaseSchema.indexes();
      const targetIndex = indexes.find((idx: any) => {
        const fields = idx[0];
        return (
          fields.inventoryItemId === 1 &&
          fields.dateStr === 1 &&
          fields.slotIndex === 1
        );
      });

      expect(targetIndex).toBeDefined();
      const options = targetIndex![1] as any;
      expect(options.unique).toBe(true);
      expect(options.partialFilterExpression).toEqual({
        status: { $in: ['TEMP', 'CONFIRMED'] },
      });

      // 2. If replica set is running, verify on live MongoDB instance
      if (isReplicaSetAvailable && leaseModel) {
        const dbIndexes = await leaseModel.collection.indexes();
        const found = dbIndexes.find(
          (idx) =>
            idx.key.inventoryItemId === 1 &&
            idx.key.dateStr === 1 &&
            idx.key.slotIndex === 1,
        );
        expect(found).toBeDefined();
        expect(found?.unique).toBe(true);
        expect(found?.partialFilterExpression).toEqual({
          status: { $in: ['TEMP', 'CONFIRMED'] },
        });
      }
    });
  });

  describe('Real Concurrent Checkout Race (Port 27028 Replica Set)', () => {
    it('executes two concurrent checkouts: exactly 1 commits, 1 receives E11000/409, zero orphans', async () => {
      expect(connection).toBeDefined();
      expect(isReplicaSetAvailable).toBe(true);

      const itemId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const bookingA = new Types.ObjectId();
      const bookingB = new Types.ObjectId();
      const itemA = new Types.ObjectId();
      const itemB = new Types.ObjectId();

      const dateStr = '2026-12-05';
      const slotIndex = 3; // 11:00 - 13:00

      const runCheckoutTransaction = async (
        bookingId: Types.ObjectId,
        bookingItemId: Types.ObjectId,
      ): Promise<{ bookingId: Types.ObjectId; status: string }> => {
        const session = await connection!.startSession();
        try {
          let outcome = 'committed';
          await session.withTransaction(async () => {
            // Step 1: Create inventory reservation
            await reservationModel.create(
              [
                {
                  bookingId,
                  bookingItemId,
                  inventoryItemId: itemId,
                  reservedFrom: new Date('2026-12-05T04:00:00.000Z'),
                  reservedTo: new Date('2026-12-05T06:00:00.000Z'),
                  status: ReservationStatus.TempReserved,
                },
              ],
              { session },
            );

            // Step 2: Create slot lease (will trigger E11000 if slot already leased)
            await leaseModel.create(
              [
                {
                  providerId,
                  bookingId,
                  bookingItemId,
                  inventoryItemId: itemId,
                  dateStr,
                  slotIndex,
                  purpose: SlotLeasePurpose.Rental,
                  status: SlotLeaseStatus.Temp,
                  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
              ],
              { session },
            );
          });
          return { bookingId, status: outcome };
        } catch (err: any) {
          if (err.code === 11000 || err.message?.includes('E11000')) {
            throw new ConflictException(
              'Một hoặc nhiều khung giờ đã được giữ chỗ bởi khách hàng khác.',
            );
          }
          throw err;
        } finally {
          await session.endSession();
        }
      };

      // Run both checkouts concurrently
      const results = await Promise.allSettled([
        runCheckoutTransaction(bookingA, itemA),
        runCheckoutTransaction(bookingB, itemB),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Invariant 1: Exactly one transaction succeeds
      expect(fulfilled).toHaveLength(1);

      // Invariant 2: Exactly one transaction fails with HTTP 409 ConflictException (E11000)
      expect(rejected).toHaveLength(1);
      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedError).toBeInstanceOf(ConflictException);

      // Invariant 3: Verify zero orphaned leases (only the winning bookingId has a lease)
      const survivingLeases = await leaseModel
        .find({
          inventoryItemId: itemId,
          dateStr,
          slotIndex,
          status: { $in: [SlotLeaseStatus.Temp, SlotLeaseStatus.Confirmed] },
        })
        .lean();
      expect(survivingLeases).toHaveLength(1);

      const winnerBookingId = (fulfilled[0] as any).value.bookingId.toString();
      expect(survivingLeases[0].bookingId.toString()).toBe(winnerBookingId);

      // Invariant 4: Verify zero orphaned reservations (losing transaction's reservation was rolled back)
      const survivingReservations = await reservationModel
        .find({
          inventoryItemId: itemId,
        })
        .lean();
      expect(survivingReservations).toHaveLength(1);
      expect(survivingReservations[0].bookingId.toString()).toBe(winnerBookingId);
    });
  });

  describe('Real MongoDB Replica Set Reschedule ACID Rollback (Port 27028)', () => {
    let bookingModel: Model<any>;
    let bookingItemModel: Model<any>;
    let scheduleModel: Model<any>;
    let providerModel: Model<any>;
    let bookingsService: BookingsService;
    let cacheService: ProductBusyCacheService;

    beforeAll(async () => {
      if (connection) {
        bookingModel = connection.model(Booking.name, BookingSchema);
        bookingItemModel = connection.model(
          BookingItem.name,
          BookingItemSchema,
        );
        scheduleModel = connection.model(
          BookingSchedule.name,
          BookingScheduleSchema,
        );
        providerModel = connection.model(Provider.name, ProviderSchema);

        await Promise.all([
          bookingModel.createIndexes(),
          bookingItemModel.createIndexes(),
          scheduleModel.createIndexes(),
          providerModel.createIndexes(),
        ]);

        cacheService = new ProductBusyCacheService();
        const timeEngine = new TimeSlotEngineService();
        const slotLeaseService = new InventorySlotLeaseService(
          leaseModel,
          {} as any,
        );

        bookingsService = new BookingsService(
          bookingModel,
          bookingItemModel,
          {} as any,
          {} as any,
          {} as any,
          scheduleModel,
          {} as any,
          reservationModel,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          { createNotification: jest.fn().mockResolvedValue(undefined) } as any,
          providerModel,
          {} as any,
          {} as any,
          {} as any,
          undefined,
          undefined,
          cacheService,
          slotLeaseService,
          timeEngine,
        );
      }
    });

    it('Requirement C: Production BookingsService.rescheduleBooking conflict -> transaction abort; old lease remains CONFIRMED in real Mongo replica', async () => {
      expect(connection).toBeDefined();
      expect(isReplicaSetAvailable).toBe(true);

      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      await providerModel.create({
        _id: providerId,
        userId: new Types.ObjectId(),
        businessName: 'Tiệm Áo Dài Test C',
        contact: {
          email: 'test-c@provider.com',
          phone: '0901234567',
        },
        address: {
          addressLine: '123 Le Loi',
          city: 'Hue',
        },
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      });

      const [booking] = await bookingModel.create([
        {
          customerId,
          bookingCode: 'BKG-RESCHED-001',
          status: BookingStatus.DepositPaid,
          bookingType: BookingType.AoDaiRental,
          providerIds: [providerId],
          totalAmount: 200000,
          pricingSummary: {
            subTotal: 200000,
            depositTotal: 100000,
            discountAmount: 0,
            travelFee: 0,
            overtimeFee: 0,
            lateFee: 0,
            grandTotal: 200000,
          },
        },
      ]);

      const [bookingItem] = await bookingItemModel.create([
        {
          bookingId: booking._id,
          productId,
          providerId,
          inventoryItemId,
          itemType: BookingItemType.Product,
          rentalType: 'HOURLY',
          slotLeaseRequired: true,
          unitPrice: 100000,
          priceVersionId: new Types.ObjectId(),
          shootDate: '2026-12-10',
          shootTimeSlot: '07:00-09:00',
          rentalFrom: new Date('2026-12-10T00:00:00.000Z'),
          rentalTo: new Date('2026-12-10T02:00:00.000Z'),
        },
      ]);

      const [oldRental] = await leaseModel.create([
        {
          providerId,
          bookingId: booking._id,
          bookingItemId: bookingItem._id,
          inventoryItemId,
          dateStr: '2026-12-10',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          providerId,
          bookingId: booking._id,
          bookingItemId: bookingItem._id,
          inventoryItemId,
          dateStr: '2026-12-10',
          slotIndex: 2,
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      ]);

      // Seed conflicting 3rd party lease on target slot 3 (11:00-13:00)
      const otherBookingId = new Types.ObjectId();
      const otherBookingItemId = new Types.ObjectId();
      await leaseModel.create([
        {
          providerId,
          bookingId: otherBookingId,
          bookingItemId: otherBookingItemId,
          inventoryItemId,
          dateStr: '2026-12-10',
          slotIndex: 3,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
      ]);

      // Execute public production workflow rescheduleBooking
      await expect(
        bookingsService.rescheduleBooking(
          booking._id.toString(),
          customerId.toString(),
          {
            itemId: bookingItem._id.toString(),
            newShootDate: '2026-12-10',
            newShootTimeSlot: '11:00-13:00',
          },
        ),
      ).rejects.toThrow(ConflictException);

      // Verify in real MongoDB replica set:
      // Old leases MUST still be CONFIRMED!
      const fetchedOldRental = await leaseModel.findById(oldRental._id).lean();
      expect(fetchedOldRental?.status).toBe(SlotLeaseStatus.Confirmed);
      expect(fetchedOldRental?.releaseReason).toBeFalsy();

      // Zero new leases for this bookingItem on slot 3
      const newLeases = await leaseModel
        .find({
          bookingItemId: bookingItem._id,
          slotIndex: 3,
        })
        .lean();
      expect(newLeases).toHaveLength(0);

      // Booking item schedule was not modified
      const fetchedItem = await bookingItemModel.findById(bookingItem._id).lean();
      expect(fetchedItem?.shootTimeSlot).toBe('07:00-09:00');
    });

    it('Requirement D: Production workflow aborts and rolls back when downstream schedule update fails in real Mongo replica', async () => {
      expect(connection).toBeDefined();
      expect(isReplicaSetAvailable).toBe(true);

      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      await providerModel.create({
        _id: providerId,
        userId: new Types.ObjectId(),
        businessName: 'Tiệm Áo Dài Test D',
        contact: {
          email: 'test-d@provider.com',
          phone: '0901234567',
        },
        address: {
          addressLine: '123 Le Loi',
          city: 'Hue',
        },
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      });

      const [booking] = await bookingModel.create([
        {
          customerId,
          bookingCode: 'BKG-RESCHED-002',
          status: BookingStatus.DepositPaid,
          bookingType: BookingType.AoDaiRental,
          providerIds: [providerId],
          totalAmount: 200000,
          pricingSummary: {
            subTotal: 200000,
            depositTotal: 100000,
            discountAmount: 0,
            travelFee: 0,
            overtimeFee: 0,
            lateFee: 0,
            grandTotal: 200000,
          },
        },
      ]);

      const [bookingItem] = await bookingItemModel.create([
        {
          bookingId: booking._id,
          productId,
          providerId,
          inventoryItemId,
          itemType: BookingItemType.Product,
          rentalType: 'HOURLY',
          slotLeaseRequired: true,
          unitPrice: 100000,
          priceVersionId: new Types.ObjectId(),
          shootDate: '2026-12-11',
          shootTimeSlot: '07:00-09:00',
          rentalFrom: new Date('2026-12-11T00:00:00.000Z'),
          rentalTo: new Date('2026-12-11T02:00:00.000Z'),
        },
      ]);

      const [oldRental] = await leaseModel.create([
        {
          providerId,
          bookingId: booking._id,
          bookingItemId: bookingItem._id,
          inventoryItemId,
          dateStr: '2026-12-11',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
      ]);

      // Mock scheduleModel.updateMany to throw an error inside the transaction
      jest.spyOn(scheduleModel, 'updateMany').mockImplementationOnce(() => {
        throw new Error('Simulated booking schedule failure inside transaction');
      });

      await expect(
        bookingsService.rescheduleBooking(
          booking._id.toString(),
          customerId.toString(),
          {
            itemId: bookingItem._id.toString(),
            newShootDate: '2026-12-11',
            newShootTimeSlot: '15:00-17:00',
          },
        ),
      ).rejects.toThrow('Simulated booking schedule failure inside transaction');

      // Verify in real MongoDB replica set:
      // Old lease MUST still be CONFIRMED!
      const fetchedOldRental = await leaseModel.findById(oldRental._id).lean();
      expect(fetchedOldRental?.status).toBe(SlotLeaseStatus.Confirmed);
      expect(fetchedOldRental?.releaseReason).toBeFalsy();

      // Zero new leases exist on slot 5 (15:00-17:00)
      const slot5Leases = await leaseModel
        .find({
          bookingItemId: bookingItem._id,
          slotIndex: 5,
        })
        .lean();
      expect(slot5Leases).toHaveLength(0);
    });

    it('Requirement E: Production BookingsService.rescheduleBooking happy path commits transaction on real Mongo replica', async () => {
      expect(connection).toBeDefined();
      expect(isReplicaSetAvailable).toBe(true);

      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      await providerModel.create({
        _id: providerId,
        userId: new Types.ObjectId(),
        businessName: 'Tiệm Áo Dài Test E',
        contact: {
          email: 'test-e@provider.com',
          phone: '0901234567',
        },
        address: {
          addressLine: '123 Le Loi',
          city: 'Hue',
        },
        useSlotLeases: true,
        rentalSettings: { turnaroundSlots: 1 },
      });

      const [booking] = await bookingModel.create([
        {
          customerId,
          bookingCode: 'BKG-RESCHED-003',
          status: BookingStatus.DepositPaid,
          bookingType: BookingType.AoDaiRental,
          providerIds: [providerId],
          totalAmount: 200000,
          pricingSummary: {
            subTotal: 200000,
            depositTotal: 100000,
            discountAmount: 0,
            travelFee: 0,
            overtimeFee: 0,
            lateFee: 0,
            grandTotal: 200000,
          },
        },
      ]);

      const [bookingItem] = await bookingItemModel.create([
        {
          bookingId: booking._id,
          productId,
          providerId,
          inventoryItemId,
          itemType: BookingItemType.Product,
          rentalType: 'HOURLY',
          slotLeaseRequired: true,
          unitPrice: 100000,
          priceVersionId: new Types.ObjectId(),
          shootDate: '2026-12-12',
          shootTimeSlot: '07:00-09:00',
          rentalFrom: new Date('2026-12-12T00:00:00.000Z'),
          rentalTo: new Date('2026-12-12T02:00:00.000Z'),
        },
      ]);

      const [oldRental] = await leaseModel.create([
        {
          providerId,
          bookingId: booking._id,
          bookingItemId: bookingItem._id,
          inventoryItemId,
          dateStr: '2026-12-12',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
      ]);

      // Call public production workflow to reschedule to 15:00-17:00 (slot 5)
      const res = await bookingsService.rescheduleBooking(
        booking._id.toString(),
        customerId.toString(),
        {
          itemId: bookingItem._id.toString(),
          newShootDate: '2026-12-12',
          newShootTimeSlot: '15:00-17:00',
        },
      );

      expect(res.status).toBe('APPROVED');

      // Verify in real MongoDB replica set:
      // Old lease is now RELEASED with RESCHEDULED
      const fetchedOldRental = await leaseModel.findById(oldRental._id).lean();
      expect(fetchedOldRental?.status).toBe(SlotLeaseStatus.Released);
      expect(fetchedOldRental?.releaseReason).toBe('RESCHEDULED');

      // New leases exist with status CONFIRMED: slot 5 (RENTAL) and slot 6 (TURNAROUND)
      const newLeases = await leaseModel
        .find({
          bookingItemId: bookingItem._id,
          status: SlotLeaseStatus.Confirmed,
        })
        .lean();
      expect(newLeases).toHaveLength(2);
      expect(
        newLeases.some(
          (l) => l.slotIndex === 5 && l.purpose === SlotLeasePurpose.Rental,
        ),
      ).toBe(true);
      expect(
        newLeases.some(
          (l) => l.slotIndex === 6 && l.purpose === SlotLeasePurpose.Turnaround,
        ),
      ).toBe(true);

      // BookingItem in MongoDB is updated to 15:00-17:00
      const updatedItem = await bookingItemModel
        .findById(bookingItem._id)
        .lean();
      expect(updatedItem?.shootTimeSlot).toBe('15:00-17:00');
    });
  });
});
