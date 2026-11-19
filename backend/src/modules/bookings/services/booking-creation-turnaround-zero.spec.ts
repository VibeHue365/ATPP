import { Types } from 'mongoose';
import {
  BookingCreationService,
  createBookingCreationServiceForTest,
} from './booking-creation.service';
import { buildReservationOverlapFilter } from './reservation-overlap-filter';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { BookingType } from '../schemas/booking.schema';
import {
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import { ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { VoucherPricingService } from '../../products/services/voucher-pricing.service';
import { BadRequestException } from '@nestjs/common';

describe('BookingCreation & Overlap Filter: turnaroundSlots = 0 vs 1 & Boundary Conditions', () => {
  describe('buildReservationOverlapFilter helper unit tests', () => {
    const t07_00 = new Date('2026-12-25T07:00:00+07:00');
    const t08_00 = new Date('2026-12-25T08:00:00+07:00');
    const t09_00 = new Date('2026-12-25T09:00:00+07:00');
    const t10_00 = new Date('2026-12-25T10:00:00+07:00');
    const t11_00 = new Date('2026-12-25T11:00:00+07:00');
    const t13_00 = new Date('2026-12-25T13:00:00+07:00');

    it('hourly interval: touching boundaries (07-09 and 09-11) do NOT overlap', () => {
      // Existing booking is 07:00-09:00
      const existing = { reservedFrom: t07_00, reservedTo: t09_00 };
      // Query for candidate 09:00-11:00
      const filter = buildReservationOverlapFilter(t09_00, t11_00, true);

      // Check if existing satisfies { reservedFrom: { $lt: requestedEnd }, reservedTo: { $gt: requestedStart } }
      const matchesTime =
        existing.reservedFrom < (filter.reservedFrom as any).$lt &&
        existing.reservedTo > (filter.reservedTo as any).$gt;
      expect(matchesTime).toBe(false); // 09:00 > 09:00 is false -> NO overlap!
    });

    it('hourly interval: overlapping slots (07-09 and 08-10) conflict', () => {
      const existing = { reservedFrom: t07_00, reservedTo: t09_00 };
      const filter = buildReservationOverlapFilter(t08_00, t10_00, true);

      const matchesTime =
        existing.reservedFrom < (filter.reservedFrom as any).$lt &&
        existing.reservedTo > (filter.reservedTo as any).$gt;
      expect(matchesTime).toBe(true); // 07:00 < 10:00 and 09:00 > 08:00 -> CONFLICT!
    });

    it('hourly interval: identical slot (07-09 and 07-09) conflict', () => {
      const existing = { reservedFrom: t07_00, reservedTo: t09_00 };
      const filter = buildReservationOverlapFilter(t07_00, t09_00, true);

      const matchesTime =
        existing.reservedFrom < (filter.reservedFrom as any).$lt &&
        existing.reservedTo > (filter.reservedTo as any).$gt;
      expect(matchesTime).toBe(true);
    });

    it('daily interval: inclusive boundaries ($lte and $gte)', () => {
      const d1Start = new Date('2026-12-25T00:00:00+07:00');
      const d1End = new Date('2026-12-25T23:59:59+07:00');
      const filter = buildReservationOverlapFilter(d1Start, d1End, false);

      expect(filter.reservedFrom).toHaveProperty('$lte');
      expect(filter.reservedTo).toHaveProperty('$gte');
    });

    it('status filter: expired TEMP does not block, unexpired TEMP and CONFIRMED block', () => {
      const now = new Date('2026-12-25T12:00:00Z');
      const filter = buildReservationOverlapFilter(t07_00, t09_00, true, now);

      // Confirmed always satisfies $or
      const confirmedStatus = { status: ReservationStatus.Confirmed };
      const tempActiveStatus = {
        status: ReservationStatus.TempReserved,
        expiresAt: new Date('2026-12-25T12:15:00Z'),
      };
      const tempExpiredStatus = {
        status: ReservationStatus.TempReserved,
        expiresAt: new Date('2026-12-25T11:45:00Z'),
      };

      const satisfiesStatus = (doc: any) => {
        return filter.$or.some((branch: any) => {
          if (branch.status !== doc.status) return false;
          if (!branch.$or) return true;
          return branch.$or.some((sub: any) => {
            if (sub.expiresAt?.$gt && doc.expiresAt > sub.expiresAt.$gt)
              return true;
            if (sub.expiresAt?.$exists === false && doc.expiresAt === undefined)
              return true;
            if (sub.expiresAt === null && doc.expiresAt === null) return true;
            return false;
          });
        });
      };

      expect(satisfiesStatus(confirmedStatus)).toBe(true);
      expect(satisfiesStatus(tempActiveStatus)).toBe(true);
      expect(satisfiesStatus(tempExpiredStatus)).toBe(false);
    });
  });

  describe('BookingCreationService workflow: turnaroundSlots = 0 vs 1', () => {
    let service: BookingCreationService;
    let timeEngine: TimeSlotEngineService;
    let cacheService: ProductBusyCacheService;
    let slotLeaseService: InventorySlotLeaseService;
    let inMemoryReservations: any[];
    let inMemoryLeases: any[];

    const providerId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const inventoryItemId = new Types.ObjectId();
    const customer1 = new Types.ObjectId();
    const customer2 = new Types.ObjectId();
    const dateStr = '2026-12-25';

    let currentTurnaroundSlots = 0;

    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(null),
      abortTransaction: jest.fn().mockResolvedValue(null),
      endSession: jest.fn().mockResolvedValue(null),
    };

    beforeEach(() => {
      inMemoryReservations = [];
      inMemoryLeases = [];
      currentTurnaroundSlots = 0;
      timeEngine = new TimeSlotEngineService();
      cacheService = new ProductBusyCacheService();

      const mockBookingModel: any = function (data: any) {
        Object.assign(this, data, { _id: new Types.ObjectId() });
        this.save = jest.fn().mockResolvedValue(this);
      };
      mockBookingModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockBookingModel.db = {
        startSession: jest.fn().mockResolvedValue(mockSession),
        collection: jest.fn().mockImplementation(() => ({
          find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([]),
          }),
        })),
      };

      const mockBookingItemModel: any = function (data: any) {
        Object.assign(this, data, { _id: new Types.ObjectId() });
        this.save = jest.fn().mockResolvedValue(this);
      };

      const mockReservationModel: any = function (data: any) {
        Object.assign(this, data, { _id: new Types.ObjectId() });
        this.save = jest.fn().mockImplementation(() => {
          inMemoryReservations.push(this);
          return Promise.resolve(this);
        });
      };
      mockReservationModel.find = jest.fn().mockImplementation((query: any) => {
        const now = new Date();
        const filtered = inMemoryReservations.filter((r) => {
          if (query.inventoryItemId?.$in) {
            const ids = query.inventoryItemId.$in.map((id: any) =>
              id.toString(),
            );
            if (!ids.includes(r.inventoryItemId.toString())) return false;
          } else if (
            query.inventoryItemId &&
            r.inventoryItemId.toString() !== query.inventoryItemId.toString()
          ) {
            return false;
          }

          // Status & Expiry check
          if (query.$or) {
            const matchesStatus = query.$or.some((branch: any) => {
              if (branch.status !== r.status) return false;
              if (branch.status === ReservationStatus.Confirmed) return true;
              if (branch.$or) {
                return branch.$or.some((sub: any) => {
                  if (
                    sub.expiresAt?.$gt &&
                    r.expiresAt &&
                    r.expiresAt > sub.expiresAt.$gt
                  )
                    return true;
                  if (
                    sub.expiresAt?.$exists === false &&
                    r.expiresAt === undefined
                  )
                    return true;
                  if (sub.expiresAt === null && r.expiresAt === null)
                    return true;
                  return false;
                });
              }
              return true;
            });
            if (!matchesStatus) return false;
          }

          // Time filter: half-open interval check
          if (
            query.reservedFrom?.$lt &&
            !(r.reservedFrom < query.reservedFrom.$lt)
          )
            return false;
          if (query.reservedTo?.$gt && !(r.reservedTo > query.reservedTo.$gt))
            return false;

          // Time filter: inclusive check
          if (
            query.reservedFrom?.$lte &&
            !(r.reservedFrom <= query.reservedFrom.$lte)
          )
            return false;
          if (
            query.reservedTo?.$gte &&
            !(r.reservedTo >= query.reservedTo.$gte)
          )
            return false;

          return true;
        });

        return {
          session: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnValue(Promise.resolve(filtered)),
          then: (res: any, rej: any) =>
            Promise.resolve(filtered).then(res, rej),
        };
      });
      mockReservationModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const mockLeaseModel: any = {
        find: jest.fn().mockImplementation((query: any) => ({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockImplementation(() => {
            const now = new Date();
            const filtered = inMemoryLeases.filter((l) => {
              if (query.inventoryItemId?.$in) {
                const ids = query.inventoryItemId.$in.map((id: any) =>
                  id.toString(),
                );
                if (!ids.includes(l.inventoryItemId.toString())) return false;
              }
              if (query.$or) {
                const matchesSlot = query.$or.some(
                  (cond: any) =>
                    cond.dateStr === l.dateStr &&
                    cond.slotIndex === l.slotIndex,
                );
                if (!matchesSlot) return false;
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
            return Promise.resolve(filtered);
          }),
        })),
        insertMany: jest.fn().mockImplementation((docs: any[]) => {
          for (const d of docs) {
            inMemoryLeases.push({ ...d, _id: new Types.ObjectId() });
          }
          return Promise.resolve(docs);
        }),
        updateMany: jest.fn().mockImplementation((query: any, update: any) => ({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          then: (res: any, rej: any) =>
            Promise.resolve({ modifiedCount: 1 }).then(res, rej),
        })),
      };

      slotLeaseService = new InventorySlotLeaseService(
        mockLeaseModel,
        timeEngine,
        cacheService,
      );

      const mockProductModel: any = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue({
            _id: productId,
            providerId,
            name: 'Áo Dài Boundary Test',
            status: 'ACTIVE',
            moderationStatus: 'APPROVED',
            hasHourlyRental: true,
            basePrice: 150000,
            hourlyPrice: 150000,
            depositAmount: 50000,
            sizes: ['M'],
            colors: ['RED'],
            variants: [
              { size: 'M', color: 'RED', quantity: 1, availableQuantity: 1 },
            ],
          }),
        }),
      };

      const mockInventoryItemModel: any = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([
            {
              _id: inventoryItemId,
              productId,
              providerId,
              size: 'M',
              color: 'RED',
              status: 'AVAILABLE',
              conditionStatus: 'GOOD',
            },
          ]),
        }),
      };

      const mockProviderModel: any = {
        findById: jest.fn().mockImplementation(() => ({
          session: jest.fn().mockImplementation(() =>
            Promise.resolve({
              _id: providerId,
              status: 'ACTIVE',
              useSlotLeases: true,
              rentalSettings: { turnaroundSlots: currentTurnaroundSlots },
            }),
          ),
        })),
      };

      const mockScheduleModel: any = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockPriceVersionModel: any = {
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(),
            price: 150000,
            depositAmount: 50000,
          }),
        }),
      };

      const mockBookingsRepo: any = {
        startSession: jest.fn().mockResolvedValue(mockSession),
        createBooking: jest.fn().mockImplementation((doc) => ({
          _id: new Types.ObjectId(),
          ...doc,
        })),
        createBookingItem: jest.fn().mockImplementation((doc) => ({
          _id: new Types.ObjectId(),
          ...doc,
          save: jest.fn().mockResolvedValue(true),
        })),
        createSchedule: jest.fn().mockResolvedValue({}),
        findBookings: jest.fn().mockResolvedValue([]),
        findBookingItems: jest.fn().mockResolvedValue([]),
      };

      service = createBookingCreationServiceForTest({
        bookingsRepository: mockBookingsRepo,
        bookingModel: mockBookingModel,
        productModel: mockProductModel,
        priceVersionModel: mockPriceVersionModel,
        inventoryItemModel: mockInventoryItemModel,
        inventoryReservationModel: mockReservationModel,
        notificationsService: {
          createNotification: jest.fn().mockResolvedValue(true),
        } as any,
        providerModel: mockProviderModel,
        voucherPricingService: new VoucherPricingService(),
        leaseModel: mockLeaseModel,
        slotLeaseService,
        timeEngineService: timeEngine,
        providerScheduleModel: mockScheduleModel,
        productBusyCacheService: cacheService,
      });
    });

    it('turnaroundSlots = 0: 07:00-09:00 and 09:00-11:00 on the same InventoryItem are BOTH ALLOWED', async () => {
      currentTurnaroundSlots = 0;

      // 1. Customer 1 books 07:00-09:00
      const b1 = await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '07:00-09:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });
      expect(b1).toBeDefined();

      // 2. Customer 2 books adjacent 09:00-11:00 -> MUST SUCCEED (no overlap error)
      const b2 = await service.createBooking(customer2.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '09:00-11:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });
      expect(b2).toBeDefined();
    });

    it('turnaroundSlots = 0: 07:00-09:00 and 08:00-10:00 (true overlap) is BLOCKED with BadRequestException', async () => {
      currentTurnaroundSlots = 0;

      await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '07:00-09:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });

      await expect(
        service.createBooking(customer2.toString(), {
          bookingType: BookingType.AoDaiRental,
          items: [
            {
              productId: productId.toString(),
              rentalType: 'HOURLY',
              shootDate: dateStr,
              shootTimeSlot: '08:00-10:00',
              selectedSize: 'M',
              selectedColor: 'RED',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('turnaroundSlots = 0: duplicate slot 07:00-09:00 is BLOCKED with BadRequestException', async () => {
      currentTurnaroundSlots = 0;

      await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '07:00-09:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });

      await expect(
        service.createBooking(customer2.toString(), {
          bookingType: BookingType.AoDaiRental,
          items: [
            {
              productId: productId.toString(),
              rentalType: 'HOURLY',
              shootDate: dateStr,
              shootTimeSlot: '07:00-09:00',
              selectedSize: 'M',
              selectedColor: 'RED',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('turnaroundSlots = 1: 07:00-09:00 locks lease 09:00-11:00; booking 09:00-11:00 is BLOCKED by TURNAROUND; 11:00-13:00 is ALLOWED', async () => {
      currentTurnaroundSlots = 1;

      // 1. Customer 1 books 07:00-09:00
      await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '07:00-09:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });

      // Leases created: slot 1 (RENTAL) and slot 2 (TURNAROUND 09:00-11:00)
      const turnaroundLease = inMemoryLeases.find(
        (l) => l.slotIndex === 2 && l.purpose === SlotLeasePurpose.Turnaround,
      );
      expect(turnaroundLease).toBeDefined();

      // 2. Customer 2 tries to book 09:00-11:00 -> BLOCKED by turnaround lease
      await expect(
        service.createBooking(customer2.toString(), {
          bookingType: BookingType.AoDaiRental,
          items: [
            {
              productId: productId.toString(),
              rentalType: 'HOURLY',
              shootDate: dateStr,
              shootTimeSlot: '09:00-11:00',
              selectedSize: 'M',
              selectedColor: 'RED',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Customer 2 books 11:00-13:00 -> ALLOWED!
      const b3 = await service.createBooking(customer2.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '11:00-13:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });
      expect(b3).toBeDefined();
    });

    it('DAILY rental: overlapping dates are still blocked inclusively', async () => {
      // 1. Customer 1 books DAILY 2026-12-25 to 2026-12-26
      await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'DAILY',
            rentalFrom: '2026-12-25',
            rentalTo: '2026-12-26',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });

      // 2. Customer 2 tries to book DAILY overlapping 2026-12-26 to 2026-12-27 -> BLOCKED
      await expect(
        service.createBooking(customer2.toString(), {
          bookingType: BookingType.AoDaiRental,
          items: [
            {
              productId: productId.toString(),
              rentalType: 'DAILY',
              rentalFrom: '2026-12-26',
              rentalTo: '2026-12-27',
              selectedSize: 'M',
              selectedColor: 'RED',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEMP reservation: expired temp reservation does NOT block, active temp reservation DOES block', async () => {
      currentTurnaroundSlots = 0;

      // Seed an expired TEMP reservation for the item
      inMemoryReservations.push({
        _id: new Types.ObjectId(),
        inventoryItemId,
        status: ReservationStatus.TempReserved,
        reservedFrom: new Date(`${dateStr}T07:00:00+07:00`),
        reservedTo: new Date(`${dateStr}T09:00:00+07:00`),
        expiresAt: new Date(Date.now() - 60_000), // EXPIRED 1 min ago
      });

      // Customer 1 books 07:00-09:00 -> Expired TEMP must NOT block -> SUCCEEDS!
      const b1 = await service.createBooking(customer1.toString(), {
        bookingType: BookingType.AoDaiRental,
        items: [
          {
            productId: productId.toString(),
            rentalType: 'HOURLY',
            shootDate: dateStr,
            shootTimeSlot: '07:00-09:00',
            selectedSize: 'M',
            selectedColor: 'RED',
            quantity: 1,
          },
        ],
      });
      expect(b1).toBeDefined();

      // Now there is an ACTIVE unexpired TEMP reservation created by b1.
      // Customer 2 attempts to book 07:00-09:00 -> Active TEMP MUST BLOCK -> Fails!
      await expect(
        service.createBooking(customer2.toString(), {
          bookingType: BookingType.AoDaiRental,
          items: [
            {
              productId: productId.toString(),
              rentalType: 'HOURLY',
              shootDate: dateStr,
              shootTimeSlot: '07:00-09:00',
              selectedSize: 'M',
              selectedColor: 'RED',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
