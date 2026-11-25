import { Types } from 'mongoose';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingStatusService } from './booking-status.service';
import { BookingsSchedulerService } from './bookings-scheduler.service';
import { RentalFulfillmentWorkflowService } from './rental-fulfillment-workflow.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { BookingStatus, BookingType } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import {
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import { RentalFulfillmentStatus } from '../schemas/rental-fulfillment.types';

describe('Production Slot Lease Workflows Integration', () => {
  // The scenarios use fixed dates in November 2026: freeze the clock (Date only) before them so the
  // "reschedule at least 24 hours before" rule does not depend on the day the suite runs.
  beforeAll(() => {
    jest.useFakeTimers({
      now: new Date('2026-11-10T01:00:00.000Z'),
      doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval',
        'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
    });
  });
  afterAll(() => jest.useRealTimers());

  let cacheService: ProductBusyCacheService;
  let timeEngine: TimeSlotEngineService;
  let slotLeaseService: InventorySlotLeaseService;

  // In-memory lease storage for realistic behavior
  let inMemoryLeases: any[] = [];
  let mockLeaseModel: any;

  beforeEach(() => {
    inMemoryLeases = [];
    cacheService = new ProductBusyCacheService();
    timeEngine = new TimeSlotEngineService();

    mockLeaseModel = {
      find: jest.fn().mockImplementation((query: any) => {
        const exec = () => {
          let filtered = [...inMemoryLeases];
          if (query.bookingId) {
            filtered = filtered.filter(
              (l) => l.bookingId.toString() === query.bookingId.toString(),
            );
          }
          if (query.bookingItemId) {
            filtered = filtered.filter(
              (l) =>
                l.bookingItemId.toString() === query.bookingItemId.toString(),
            );
          }
          if (query.purpose) {
            filtered = filtered.filter((l) => l.purpose === query.purpose);
          }
          if (query.status) {
            if (typeof query.status === 'object' && query.status.$in) {
              filtered = filtered.filter((l) =>
                query.status.$in.includes(l.status),
              );
            } else {
              filtered = filtered.filter((l) => l.status === query.status);
            }
          }
          return Promise.resolve(filtered);
        };
        return {
          session: jest.fn().mockReturnThis(),
          exec: jest.fn().mockImplementation(exec),
          then: (res: any, rej: any) => exec().then(res, rej),
        };
      }),
      findOne: jest.fn().mockImplementation((query: any) => {
        const exec = () => {
          const now = new Date();
          const match = inMemoryLeases.find((l) => {
            if (
              query.inventoryItemId &&
              l.inventoryItemId.toString() !== query.inventoryItemId.toString()
            )
              return false;
            if (
              query.bookingItemId?.$ne &&
              l.bookingItemId &&
              l.bookingItemId.toString() === query.bookingItemId.$ne.toString()
            )
              return false;
            if (query.dateStr && l.dateStr !== query.dateStr) return false;
            if (
              query.slotIndex !== undefined &&
              l.slotIndex !== query.slotIndex
            )
              return false;
            if (query.$or && Array.isArray(query.$or)) {
              const matchesOr = query.$or.some(
                (cond: any) =>
                  (!cond.dateStr || cond.dateStr === l.dateStr) &&
                  (cond.slotIndex === undefined ||
                    cond.slotIndex === l.slotIndex),
              );
              if (!matchesOr) return false;
            }
            if (l.status === SlotLeaseStatus.Released) return false;
            if (
              l.status === SlotLeaseStatus.Temp &&
              l.expiresAt &&
              l.expiresAt <= now
            )
              return false;
            return true;
          });
          return Promise.resolve(match || null);
        };
        return {
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          session: jest.fn().mockReturnThis(),
          exec: jest.fn().mockImplementation(exec),
          then: (res: any, rej: any) => exec().then(res, rej),
        };
      }),
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        const exec = () => {
          let count = 0;
          for (const lease of inMemoryLeases) {
            let match = true;
            if (
              filter.bookingId &&
              lease.bookingId.toString() !== filter.bookingId.toString()
            )
              match = false;
            if (
              filter.bookingItemId &&
              lease.bookingItemId.toString() !== filter.bookingItemId.toString()
            )
              match = false;
            if (filter._id?.$in) {
              const ids = filter._id.$in.map((id: any) => id.toString());
              if (!ids.includes(lease._id.toString())) match = false;
            }
            if (filter.status) {
              if (filter.status.$in) {
                if (!filter.status.$in.includes(lease.status)) match = false;
              } else if (lease.status !== filter.status) {
                match = false;
              }
            }
            if (filter.expiresAt?.$lte) {
              if (!lease.expiresAt || lease.expiresAt > filter.expiresAt.$lte)
                match = false;
            }

            if (match) {
              if (update.$set) {
                Object.assign(lease, update.$set);
              }
              count++;
            }
          }
          if (count > 0) {
            cacheService.invalidate();
          }
          return Promise.resolve({ modifiedCount: count });
        };
        return {
          session: jest.fn().mockReturnThis(),
          exec: jest.fn().mockImplementation(exec),
          then: (res: any, rej: any) => exec().then(res, rej),
        };
      }),
      insertMany: jest.fn().mockImplementation((docs: any[]) => {
        // Enforce unique constraint simulation: item + dateStr + slotIndex for active leases
        for (const doc of docs) {
          const collision = inMemoryLeases.find(
            (l) =>
              l.inventoryItemId.toString() === doc.inventoryItemId.toString() &&
              l.dateStr === doc.dateStr &&
              l.slotIndex === doc.slotIndex &&
              [SlotLeaseStatus.Temp, SlotLeaseStatus.Confirmed].includes(
                l.status,
              ),
          );
          if (collision) {
            const err: any = new Error(
              'E11000 duplicate key error collection: inventory_slot_leases index: inventory_slot_leases_item_date_slot_unique',
            );
            err.code = 11000;
            err.keyPattern = { inventoryItemId: 1, dateStr: 1, slotIndex: 1 };
            throw err;
          }
        }
        const created = docs.map((d) => ({
          _id: new Types.ObjectId(),
          ...d,
        }));
        inMemoryLeases.push(...created);
        cacheService.invalidate();
        return Promise.resolve(created);
      }),
    };

    slotLeaseService = new InventorySlotLeaseService(
      mockLeaseModel,
      timeEngine,
      cacheService,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CANCEL BOOKING RELEASES LEASES
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 1: cancelBooking releases leases and invalidates cache', () => {
    it('releases all CONFIRMED and TEMP leases with reason CANCELLED when booking is cancelled', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push(
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 2,
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      );

      // Warm cache
      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const mockBooking = {
        _id: bookingId,
        bookingCode: 'BKG-CANCEL-001',
        status: BookingStatus.DepositPaid,
        providerIds: [new Types.ObjectId()],
        save: jest.fn().mockResolvedValue(true),
        statusTimeline: [],
      };

      const mockBookingModel = {
        findById: jest.fn().mockResolvedValue(mockBooking),
        db: {
          collection: jest.fn().mockReturnValue({
            updateMany: mockLeaseModel.updateMany,
          }),
        },
      };

      const mockBookingItemModel = {
        find: jest
          .fn()
          .mockResolvedValue([{ _id: itemId, productId, bookingId }]),
      };

      const mockInventoryReservationModel = {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const mockBookingScheduleModel = {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const mockNotificationsService = {
        createNotification: jest.fn().mockResolvedValue(null),
      };

      const bookingsService = new BookingsService(
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
        {} as any,
        mockBookingScheduleModel as any,
        {} as any,
        mockInventoryReservationModel as any,
        {} as any,
        {
          cancelSettlementsForBooking: jest.fn().mockResolvedValue(null),
        } as any,
        {} as any,
        {} as any,
        {} as any,
        mockNotificationsService as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        {} as any,
        {
          getCancellationPolicy: jest
            .fn()
            .mockResolvedValue({ productLateCancelPenaltyRate: 0.2 }),
        } as any,
        {} as any,
        undefined,
        undefined,
        cacheService,
        slotLeaseService,
      );

      await bookingsService.cancelBooking(bookingId.toString(), 'KH_HUY');

      // Verify all leases transitioned to RELEASED with reason CANCELLED
      expect(inMemoryLeases).toHaveLength(2);
      expect(inMemoryLeases[0].status).toBe(SlotLeaseStatus.Released);
      expect(inMemoryLeases[0].releaseReason).toBe('CANCELLED');
      expect(inMemoryLeases[1].status).toBe(SlotLeaseStatus.Released);
      expect(inMemoryLeases[1].releaseReason).toBe('CANCELLED');

      // Verify product cache was invalidated
      expect(cacheService.has(productId.toString())).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PAYMENT TIMEOUT RELEASES LEASES
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 2: Payment timeout releases leases via cleanupExpiredPendingBookings', () => {
    it('releases TEMP leases with reason EXPIRED and invalidates cache when pending booking expires', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push({
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemId,
        inventoryItemId,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: SlotLeasePurpose.Rental,
        status: SlotLeaseStatus.Temp,
        expiresAt: new Date(Date.now() - 5000), // Expired
      });

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const mockBookingsRepo = {
        startSession: jest.fn().mockResolvedValue({
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          abortTransaction: jest.fn(),
          endSession: jest.fn(),
        }),
        findBookings: jest.fn().mockResolvedValue([
          {
            _id: bookingId,
            contractFlowVersion: 2,
            status: BookingStatus.PendingPayment,
          },
        ]),
        hasSuccessfulPayment: jest.fn().mockResolvedValue(false),
        updateManyBookings: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        updateManySchedules: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const mockReservationModel = {
        updateMany: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
      };

      const mockPromotionsService = {
        releaseVoucher: jest.fn().mockResolvedValue(true),
      };

      const bookingStatusService = new BookingStatusService(
        mockBookingsRepo as any,
        mockReservationModel as any,
        {} as any,
        {} as any,
        {} as any,
        mockPromotionsService as any,
        {} as any,
        mockLeaseModel,
        slotLeaseService,
      );

      await bookingStatusService.cleanupExpiredPendingBookings();

      expect(inMemoryLeases[0].status).toBe(SlotLeaseStatus.Released);
      expect(inMemoryLeases[0].releaseReason).toBe('EXPIRED');
      expect(cacheService.has(productId.toString())).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. EARLY READY / RETURN RELEASES TURNAROUND LEASES
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 3 & Requirements E/F: Turnaround lease lifecycle across ready and cleaning completion', () => {
    it('Requirement E: markReady before pickup does NOT release TURNAROUND lease', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push(
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 1, // 07:00-09:00
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 2, // 09:00-11:00
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      );

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const mockBookingModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: bookingId,
              bookingType: BookingType.AoDaiRental,
              status: BookingStatus.Confirmed,
              providerIds: [new Types.ObjectId()],
            }),
          }),
        }),
      };

      const mockBookingItemModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: itemId,
              bookingId,
              productId,
              slotLeaseRequired: true,
              rentalTo: new Date('2026-11-15T02:00:00.000Z'),
              rentalFulfillment: { turnaroundSlotsSnapshot: 1 },
            }),
          }),
        }),
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockRentalFulfillment = {
        markReady: jest.fn().mockResolvedValue({ _id: itemId }),
      };

      const mockCoordinator = {
        coordinate: jest.fn().mockResolvedValue(true),
      };

      const workflow = new RentalFulfillmentWorkflowService(
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
        mockRentalFulfillment as any,
        mockCoordinator as any,
        {} as any,
        slotLeaseService,
        timeEngine,
      );

      const mockUser: any = { _id: 'admin_1', roles: ['ADMIN'] };
      (workflow as any).requireProviderOrAdmin = jest.fn().mockResolvedValue({
        bookingId,
        itemId,
        actor: { role: 'PROVIDER', id: 'admin_1' },
        fulfillmentStatus: RentalFulfillmentStatus.Pending,
        bookingStatus: BookingStatus.Confirmed,
      });

      await workflow.markReady(
        bookingId.toString(),
        itemId.toString(),
        mockUser,
      );

      // Verify that markReady before pickup does NOT release turnaround lease
      const turnaroundLease = inMemoryLeases.find(
        (l) => l.purpose === SlotLeasePurpose.Turnaround,
      );
      expect(turnaroundLease.status).toBe(SlotLeaseStatus.Confirmed);

      const rentalLease = inMemoryLeases.find(
        (l) => l.purpose === SlotLeasePurpose.Rental,
      );
      expect(rentalLease.status).toBe(SlotLeaseStatus.Confirmed);

      // Cache is NOT invalidated
      expect(cacheService.has(productId.toString())).toBe(true);
    });

    it('Requirement F: markCleaningCompleted after return releases remaining turnaround leases', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push(
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          dateStr: '2026-11-15',
          slotIndex: 2,
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      );

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const mockInventoryModel = {
        updateOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
        updateMany: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: inventoryItemId,
                status: 'CLEANING',
                conditionStatus: 'GOOD',
              },
            ]),
          }),
        }),
      };
      const mockReservationModel = {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([{ inventoryItemId }]),
            }),
          }),
        }),
      };

      const mockBookingModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: bookingId,
              bookingType: BookingType.AoDaiRental,
              status: BookingStatus.Returned,
            }),
          }),
        }),
      };

      const mockBookingItemModel = {
        // markCleaningCompleted (code of 24/11/2026) reads the item: no open incident here
        findById: jest.fn().mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve({ rentalFulfillment: {} }) }),
        }),
        db: {
          model: jest.fn().mockImplementation((name) => {
            if (name === 'InventoryItem') return mockInventoryModel;
            if (name === 'InventoryReservation') return mockReservationModel;
            return null;
          }),
        },
        updateOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const workflow = new RentalFulfillmentWorkflowService(
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        slotLeaseService,
        timeEngine,
      );

      const mockUser: any = { _id: 'provider_1', roles: ['PROVIDER'] };
      (workflow as any).requireProviderOrAdmin = jest.fn().mockResolvedValue({
        bookingId,
        itemId,
        actor: { role: 'PROVIDER', id: 'provider_1' },
        fulfillmentStatus: RentalFulfillmentStatus.Returned,
        bookingStatus: BookingStatus.Returned,
      });

      await workflow.markCleaningCompleted(
        bookingId.toString(),
        itemId.toString(),
        mockUser,
      );

      // Verify turnaround lease is released with RETURN_RESTRUCTURED
      const turnaroundLease = inMemoryLeases.find(
        (l) => l.purpose === SlotLeasePurpose.Turnaround,
      );
      expect(turnaroundLease.status).toBe(SlotLeaseStatus.Released);
      expect(turnaroundLease.releaseReason).toBe('RETURN_RESTRUCTURED');

      // Cache is invalidated
      expect(cacheService.has(productId.toString())).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. SCHEDULER EXPIRES ORPHANED TEMP LEASES
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 4: BookingsSchedulerService expires orphaned TEMP leases', () => {
    it('expires expired TEMP leases and invalidates cache', async () => {
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push({
        _id: new Types.ObjectId(),
        bookingId: new Types.ObjectId(),
        bookingItemId: new Types.ObjectId(),
        inventoryItemId,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: SlotLeasePurpose.Rental,
        status: SlotLeaseStatus.Temp,
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
      });

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const scheduler = new BookingsSchedulerService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        slotLeaseService,
      );

      await scheduler.expireHoldLeases();

      expect(inMemoryLeases[0].status).toBe(SlotLeaseStatus.Released);
      expect(inMemoryLeases[0].releaseReason).toBe('EXPIRED');
      expect(cacheService.has(productId.toString())).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. HOURLY RESCHEDULE ACQUIRES NEW LEASES & RELEASES OLD LEASES
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 5: Hourly reschedule drops old leases and locks new leases', () => {
    it('transactionally moves RENTAL and TURNAROUND leases from old slot to new slot and updates cache', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      // Old leases: slot 1 (07:00-09:00) RENTAL, slot 2 (09:00-11:00) TURNAROUND
      inMemoryLeases.push(
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          providerId,
          dateStr: '2026-11-20',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId: itemId,
          inventoryItemId,
          providerId,
          dateStr: '2026-11-20',
          slotIndex: 2,
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      );

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      const bookingMock = {
        _id: bookingId,
        customerId,
        bookingCode: 'BKG-HOURLY-001',
        status: BookingStatus.DepositPaid,
        providerIds: [providerId],
      };

      const bookingItemMock = {
        _id: itemId,
        bookingId,
        productId,
        providerId,
        inventoryItemId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        slotLeaseRequired: true,
        shootDate: '2026-11-20',
        shootTimeSlot: '07:00-09:00',
        rentalFrom: new Date('2026-11-20T00:00:00.000Z'),
        rentalTo: new Date('2026-11-20T02:00:00.000Z'),
      };

      const leaseColl = {
        findOne: mockLeaseModel.findOne,
        updateMany: mockLeaseModel.updateMany,
        insertMany: mockLeaseModel.insertMany,
      };

      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(null),
        abortTransaction: jest.fn().mockResolvedValue(null),
        endSession: jest.fn().mockResolvedValue(null),
      };

      const mockBookingModel = {
        findById: jest.fn().mockResolvedValue(bookingMock),
        db: {
          startSession: jest.fn().mockResolvedValue(mockSession),
          collection: jest.fn().mockImplementation((name) => {
            if (name === 'inventory_slot_leases') return leaseColl;
            return null;
          }),
        },
      };

      const mockBookingItemModel = {
        findOne: jest.fn().mockResolvedValue(bookingItemMock),
        updateOne: jest.fn().mockImplementation((filter, update) => {
          Object.assign(bookingItemMock, update.$set);
          return Promise.resolve({ modifiedCount: 1 });
        }),
      };

      const mockProviderModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: providerId,
            useSlotLeases: true,
            rentalSettings: { turnaroundSlots: 1 },
          }),
        }),
      };

      const mockScheduleModel = {
        create: jest.fn().mockResolvedValue([]), // schedules recreated by the approved reschedule (code of 24/11/2026)
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const mockReservationModel = {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const bookingsService = new BookingsService(
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
        {} as any,
        mockScheduleModel as any,
        {} as any,
        mockReservationModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { createNotification: jest.fn() } as any,
        mockProviderModel as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        cacheService,
        slotLeaseService,
        timeEngine,
      );

      // Reschedule from 07:00-09:00 (slot 1) to 11:00-13:00 (slot 3)
      // Since the code of 24/11/2026 the customer only sends a reschedule request (rescheduleBooking); the leases
      // move when the provider approves it, so the approval step (applyApprovedReschedule) is called here.
      const res = await (bookingsService as any).applyApprovedReschedule(
        bookingId.toString(),
        customerId.toString(),
        {
          itemId: itemId.toString(),
          newShootDate: '2026-11-20',
          newShootTimeSlot: '11:00-13:00',
        },
      );

      expect(res.message).toBe('Đổi lịch thành công');

      // Verify old leases were released with RESCHEDULED
      const oldRental = inMemoryLeases.find(
        (l) => l.dateStr === '2026-11-20' && l.slotIndex === 1,
      );
      const oldTurnaround = inMemoryLeases.find(
        (l) => l.dateStr === '2026-11-20' && l.slotIndex === 2,
      );
      expect(oldRental.status).toBe(SlotLeaseStatus.Released);
      expect(oldRental.releaseReason).toBe('RESCHEDULED');
      expect(oldTurnaround.status).toBe(SlotLeaseStatus.Released);
      expect(oldTurnaround.releaseReason).toBe('RESCHEDULED');

      // Verify new leases were created with CONFIRMED: slot 3 (RENTAL) and slot 4 (TURNAROUND)
      const newRental = inMemoryLeases.find(
        (l) =>
          l.dateStr === '2026-11-20' &&
          l.slotIndex === 3 &&
          l.status === SlotLeaseStatus.Confirmed,
      );
      const newTurnaround = inMemoryLeases.find(
        (l) =>
          l.dateStr === '2026-11-20' &&
          l.slotIndex === 4 &&
          l.status === SlotLeaseStatus.Confirmed,
      );
      expect(newRental).toBeDefined();
      expect(newRental.purpose).toBe(SlotLeasePurpose.Rental);
      expect(newTurnaround).toBeDefined();
      expect(newTurnaround.purpose).toBe(SlotLeasePurpose.Turnaround);

      // Verify booking item was updated
      expect(bookingItemMock.shootTimeSlot).toBe('11:00-13:00');

      // Verify cache was invalidated
      expect(cacheService.has(productId.toString())).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ROLLBACK ON RESCHEDULE SLOT CONFLICT
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 6: Rollback on reschedule conflict leaves old leases untouched', () => {
    it('rejects reschedule when target slot has a conflicting active lease and keeps old leases intact', async () => {
      const bookingAId = new Types.ObjectId();
      const bookingBId = new Types.ObjectId();
      const itemAId = new Types.ObjectId();
      const itemBId = new Types.ObjectId();
      const customerAId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      // Booking A holds slot 1 (07:00-09:00) + turnaround slot 2 (09:00-11:00)
      inMemoryLeases.push(
        {
          _id: new Types.ObjectId(),
          bookingId: bookingAId,
          bookingItemId: itemAId,
          inventoryItemId,
          providerId,
          dateStr: '2026-11-20',
          slotIndex: 1,
          purpose: SlotLeasePurpose.Rental,
          status: SlotLeaseStatus.Confirmed,
        },
        {
          _id: new Types.ObjectId(),
          bookingId: bookingAId,
          bookingItemId: itemAId,
          inventoryItemId,
          providerId,
          dateStr: '2026-11-20',
          slotIndex: 2,
          purpose: SlotLeasePurpose.Turnaround,
          status: SlotLeaseStatus.Confirmed,
        },
      );

      // Booking B already holds slot 3 (11:00-13:00) on that same item!
      inMemoryLeases.push({
        _id: new Types.ObjectId(),
        bookingId: bookingBId,
        bookingItemId: itemBId,
        inventoryItemId,
        providerId,
        dateStr: '2026-11-20',
        slotIndex: 3,
        purpose: SlotLeasePurpose.Rental,
        status: SlotLeaseStatus.Confirmed,
      });

      const bookingAMock = {
        _id: bookingAId,
        customerId: customerAId,
        bookingCode: 'BKG-A-001',
        status: BookingStatus.DepositPaid,
        providerIds: [providerId],
      };

      const bookingItemAMock = {
        _id: itemAId,
        bookingId: bookingAId,
        productId,
        providerId,
        inventoryItemId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        slotLeaseRequired: true,
        shootDate: '2026-11-20',
        shootTimeSlot: '07:00-09:00',
        rentalFrom: new Date('2026-11-20T00:00:00.000Z'),
        rentalTo: new Date('2026-11-20T02:00:00.000Z'),
      };

      const leaseColl = {
        findOne: mockLeaseModel.findOne,
        updateMany: mockLeaseModel.updateMany,
        insertMany: mockLeaseModel.insertMany,
      };

      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(null),
        abortTransaction: jest.fn().mockResolvedValue(null),
        endSession: jest.fn().mockResolvedValue(null),
      };

      const mockBookingModel = {
        findById: jest.fn().mockResolvedValue(bookingAMock),
        db: {
          startSession: jest.fn().mockResolvedValue(mockSession),
          collection: jest.fn().mockImplementation((name) => {
            if (name === 'inventory_slot_leases') return leaseColl;
            return null;
          }),
        },
      };

      const mockBookingItemModel = {
        findOne: jest.fn().mockResolvedValue(bookingItemAMock),
        updateOne: jest.fn(),
      };

      const mockProviderModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: providerId,
            useSlotLeases: true,
            rentalSettings: { turnaroundSlots: 1 },
          }),
        }),
      };

      const bookingsService = new BookingsService(
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { createNotification: jest.fn() } as any,
        mockProviderModel as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        cacheService,
        slotLeaseService,
        timeEngine,
      );

      cacheService.set(productId.toString(), {} as any);
      expect(cacheService.has(productId.toString())).toBe(true);

      // Attempt to reschedule Booking A to 11:00-13:00 (which conflicts with Booking B)
      // Since the code of 24/11/2026 the customer only sends a reschedule request (rescheduleBooking); the leases
      // move when the provider approves it, so the approval step (applyApprovedReschedule) is called here.
      await expect(
        (bookingsService as any).applyApprovedReschedule(
          bookingAId.toString(),
          customerAId.toString(),
          {
            itemId: itemAId.toString(),
            newShootDate: '2026-11-20',
            newShootTimeSlot: '11:00-13:00',
          },
        ),
      ).rejects.toThrow(ConflictException);

      // Verify Booking A's old leases remain CONFIRMED
      const lease1 = inMemoryLeases.find(
        (l) => l.bookingId === bookingAId && l.slotIndex === 1,
      );
      const lease2 = inMemoryLeases.find(
        (l) => l.bookingId === bookingAId && l.slotIndex === 2,
      );
      expect(lease1.status).toBe(SlotLeaseStatus.Confirmed);
      expect(lease2.status).toBe(SlotLeaseStatus.Confirmed);

      // Verify no new leases created for Booking A on slot 3 or 4
      const newLeaseA = inMemoryLeases.find(
        (l) => l.bookingId === bookingAId && l.slotIndex === 3,
      );
      expect(newLeaseA).toBeUndefined();

      // Verify bookingItem was NOT modified
      expect(bookingItemAMock.shootTimeSlot).toBe('07:00-09:00');

      // Requirement I: Abort does NOT invalidate cache
      expect(cacheService.has(productId.toString())).toBe(true);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. REQUIREMENT A: startSession reject -> reschedule fail and zero writes
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 7: Requirement A: startSession reject -> reschedule fail and zero writes', () => {
    it('throws ServiceUnavailableException and performs zero writes when startSession fails', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push({
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemId,
        inventoryItemId,
        providerId,
        dateStr: '2026-11-20',
        slotIndex: 1,
        purpose: SlotLeasePurpose.Rental,
        status: SlotLeaseStatus.Confirmed,
      });

      const bookingMock = {
        _id: bookingId,
        customerId,
        bookingCode: 'BKG-FAIL-001',
        status: BookingStatus.DepositPaid,
        providerIds: [providerId],
      };

      const bookingItemMock = {
        _id: itemId,
        bookingId,
        productId,
        providerId,
        inventoryItemId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        slotLeaseRequired: true,
        shootDate: '2026-11-20',
        shootTimeSlot: '07:00-09:00',
        rentalFrom: new Date('2026-11-20T00:00:00.000Z'),
        rentalTo: new Date('2026-11-20T02:00:00.000Z'),
      };

      const mockBookingItemUpdate = jest.fn();
      const mockScheduleUpdate = jest.fn();

      const mockBookingModel = {
        findById: jest.fn().mockResolvedValue(bookingMock),
        db: {
          startSession: jest
            .fn()
            .mockRejectedValue(new Error('MongoNetworkTimeout')),
          collection: jest.fn().mockReturnValue({}),
        },
      };

      const mockProviderModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: providerId,
            useSlotLeases: true,
            rentalSettings: { turnaroundSlots: 1 },
          }),
        }),
      };

      const bookingsService = new BookingsService(
        mockBookingModel as any,
        {
          findOne: jest.fn().mockResolvedValue(bookingItemMock),
          updateOne: mockBookingItemUpdate,
        } as any,
        {} as any,
        {} as any,
        {} as any,
        { updateMany: mockScheduleUpdate } as any,
        {} as any,
        { updateMany: jest.fn() } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { createNotification: jest.fn() } as any,
        mockProviderModel as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        cacheService,
        slotLeaseService,
        timeEngine,
      );

      // Since the code of 24/11/2026 the customer only sends a reschedule request (rescheduleBooking); the leases
      // move when the provider approves it, so the approval step (applyApprovedReschedule) is called here.
      await expect(
        (bookingsService as any).applyApprovedReschedule(
          bookingId.toString(),
          customerId.toString(),
          {
            itemId: itemId.toString(),
            newShootDate: '2026-11-20',
            newShootTimeSlot: '11:00-13:00',
          },
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      // Verify zero writes
      expect(mockBookingItemUpdate).not.toHaveBeenCalled();
      expect(mockScheduleUpdate).not.toHaveBeenCalled();
      expect(inMemoryLeases[0].status).toBe(SlotLeaseStatus.Confirmed);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. REQUIREMENT B: startTransaction reject -> fail and zero writes
  // ──────────────────────────────────────────────────────────────────────────
  describe('Workflow 8: Requirement B: startTransaction reject -> fail and zero writes', () => {
    it('throws ServiceUnavailableException and cleans up session with zero writes when startTransaction fails', async () => {
      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const inventoryItemId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      inMemoryLeases.push({
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemId,
        inventoryItemId,
        providerId,
        dateStr: '2026-11-20',
        slotIndex: 1,
        purpose: SlotLeasePurpose.Rental,
        status: SlotLeaseStatus.Confirmed,
      });

      const bookingMock = {
        _id: bookingId,
        customerId,
        bookingCode: 'BKG-FAIL-002',
        status: BookingStatus.DepositPaid,
        providerIds: [providerId],
      };

      const bookingItemMock = {
        _id: itemId,
        bookingId,
        productId,
        providerId,
        inventoryItemId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        slotLeaseRequired: true,
        shootDate: '2026-11-20',
        shootTimeSlot: '07:00-09:00',
        rentalFrom: new Date('2026-11-20T00:00:00.000Z'),
        rentalTo: new Date('2026-11-20T02:00:00.000Z'),
      };

      const mockSession = {
        startTransaction: jest.fn().mockImplementation(() => {
          throw new Error('Transaction already in progress on this session');
        }),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn().mockResolvedValue(null),
      };

      const mockBookingItemUpdate = jest.fn();
      const mockBookingModel = {
        findById: jest.fn().mockResolvedValue(bookingMock),
        db: {
          startSession: jest.fn().mockResolvedValue(mockSession),
          collection: jest.fn().mockReturnValue({}),
        },
      };

      const mockProviderModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: providerId,
            useSlotLeases: true,
            rentalSettings: { turnaroundSlots: 1 },
          }),
        }),
      };

      const bookingsService = new BookingsService(
        mockBookingModel as any,
        {
          findOne: jest.fn().mockResolvedValue(bookingItemMock),
          updateOne: mockBookingItemUpdate,
        } as any,
        {} as any,
        {} as any,
        {} as any,
        { updateMany: jest.fn() } as any,
        {} as any,
        { updateMany: jest.fn() } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { createNotification: jest.fn() } as any,
        mockProviderModel as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        cacheService,
        slotLeaseService,
        timeEngine,
      );

      // Since the code of 24/11/2026 the customer only sends a reschedule request (rescheduleBooking); the leases
      // move when the provider approves it, so the approval step (applyApprovedReschedule) is called here.
      await expect(
        (bookingsService as any).applyApprovedReschedule(
          bookingId.toString(),
          customerId.toString(),
          {
            itemId: itemId.toString(),
            newShootDate: '2026-11-20',
            newShootTimeSlot: '11:00-13:00',
          },
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      // Verify session endSession called and zero writes
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(mockBookingItemUpdate).not.toHaveBeenCalled();
      expect(inMemoryLeases[0].status).toBe(SlotLeaseStatus.Confirmed);
    });
  });
});
