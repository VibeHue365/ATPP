import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import { TimeSlotEngineService } from './time-slot-engine.service';
import {
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';

describe('BookingsService - getBusySchedulesForProduct with variantBookedSlots', () => {
  let service: BookingsService;
  let cacheService: ProductBusyCacheService;
  let mockInventoryItemModel: any;
  let mockInventoryReservationModel: any;
  let mockProductModel: any;
  let mockBookingModel: any;
  let mockBookingItemModel: any;
  let mockBookingScheduleModel: any;
  let mockNotificationsService: any;
  let mockSlotLeases: any[];
  let leaseCollectionMock: any;

  const productId = new Types.ObjectId();
  const item1Id = new Types.ObjectId();
  const item2Id = new Types.ObjectId();

  beforeEach(() => {
    mockSlotLeases = [];
    cacheService = new ProductBusyCacheService();

    mockInventoryItemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: item1Id, size: 'XL', color: 'RED', status: 'AVAILABLE' },
              { _id: item2Id, size: 'S', color: 'RED', status: 'AVAILABLE' },
            ]),
          }),
        }),
      }),
    };

    mockInventoryReservationModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockProductModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      }),
    };

    leaseCollectionMock = {
      find: jest.fn().mockImplementation((query: any) => ({
        project: jest.fn().mockReturnValue({
          toArray: jest.fn().mockImplementation(() => {
            const now = new Date();
            const filtered = mockSlotLeases.filter((l) => {
              if (query?.inventoryItemId?.$in) {
                const ids = query.inventoryItemId.$in.map((id: any) =>
                  id.toString(),
                );
                if (!ids.includes(l.inventoryItemId.toString())) return false;
              }
              if (l.status === 'CONFIRMED') return true;
              if (l.status === 'TEMP' && l.expiresAt && l.expiresAt > now)
                return true;
              return false;
            });
            return Promise.resolve(filtered);
          }),
        }),
      })),
    };

    mockBookingItemModel = {
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockBookingScheduleModel = {
      create: jest.fn().mockResolvedValue([]), // schedules recreated by the approved reschedule (code of 24/11/2026)
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue(null),
    };

    mockBookingModel = {
      findById: jest.fn().mockResolvedValue(null),
      db: {
        model: jest.fn(),
        collection: jest.fn().mockImplementation((name: string) => {
          if (name === 'inventory_slot_leases') return leaseCollectionMock;
          return null;
        }),
      },
    };

    service = new BookingsService(
      mockBookingModel,
      mockBookingItemModel,
      mockProductModel,
      {} as any,
      {} as any,
      mockBookingScheduleModel,
      mockInventoryItemModel,
      mockInventoryReservationModel,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockNotificationsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      undefined,
      cacheService,
    );
  });

  // --- BLOCKER 1: Fail closed on lease query DB error ---
  describe('Blocker 1 - Fail Closed on Lease Query Error', () => {
    it('propagates database error when querying inventory_slot_leases and does NOT return empty schedule', async () => {
      leaseCollectionMock.find = jest.fn().mockReturnValue({
        project: jest.fn().mockReturnValue({
          toArray: jest
            .fn()
            .mockRejectedValue(
              new Error('MongoNetworkTimeoutException: connection lost'),
            ),
        }),
      });

      await expect(
        service.getBusySchedulesForProduct(productId.toString()),
      ).rejects.toThrow('MongoNetworkTimeoutException: connection lost');
    });
  });

  // --- BLOCKER 2: Active reservations and TTL lag ---
  describe('Blocker 2 - Reservation query status and TTL lag', () => {
    it('CONFIRMED reservation locks the slot', async () => {
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                reservedFrom: new Date('2026-11-15T00:00:00.000Z'), // 07:00 VN
                reservedTo: new Date('2026-11-15T02:00:00.000Z'), // 09:00 VN
                status: ReservationStatus.Confirmed,
              },
            ]),
          }),
        }),
      });

      const result = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(result.variantBookedSlots!['XL_RED']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: '2026-11-15',
            timeSlot: '07:00-09:00',
            purpose: 'RENTAL',
          }),
        ]),
      );
    });

    it('unexpired TEMP_RESERVED reservation locks the slot', async () => {
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                reservedFrom: new Date('2026-11-15T00:00:00.000Z'), // 07:00 VN
                reservedTo: new Date('2026-11-15T02:00:00.000Z'), // 09:00 VN
                status: ReservationStatus.TempReserved,
                expiresAt: new Date(Date.now() + 600_000), // in 10 minutes
              },
            ]),
          }),
        }),
      });

      const result = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(result.variantBookedSlots!['XL_RED']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: '2026-11-15',
            timeSlot: '07:00-09:00',
            purpose: 'RENTAL',
          }),
        ]),
      );
    });

    it('expired TEMP_RESERVED reservation due to TTL lag does NOT lock the slot', async () => {
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                reservedFrom: new Date('2026-11-15T00:00:00.000Z'), // 07:00 VN
                reservedTo: new Date('2026-11-15T02:00:00.000Z'), // 09:00 VN
                status: ReservationStatus.TempReserved,
                expiresAt: new Date(Date.now() - 30_000), // expired 30s ago (TTL index has not deleted it yet)
              },
            ]),
          }),
        }),
      });

      const result = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(result.variantBookedSlots!['XL_RED']).toEqual([]);
    });
  });

  // --- BLOCKER 3: Provider schedule fallback with rollover ---
  describe('Blocker 3 - Provider schedule fallback with turnaround rollover', () => {
    it('rolls turnaround over weekly off days when reservation ends before shop weekend', async () => {
      const providerId = new Types.ObjectId();
      mockProductModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ providerId }),
      });

      // Provider works Monday (1) to Saturday (6); Sunday (0) is off
      const recurringSchedules = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        providerId,
        scheduleType: 'RECURRING',
        dayOfWeek,
      }));

      mockBookingModel.db.collection = jest
        .fn()
        .mockImplementation((name: string) => {
          if (name === 'inventory_slot_leases') return leaseCollectionMock;
          if (name === 'providers') {
            return {
              findOne: jest.fn().mockResolvedValue({
                rentalSettings: { turnaroundSlots: 1 },
              }),
            };
          }
          if (name === 'provider_schedules') {
            return {
              find: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(recurringSchedules),
              }),
            };
          }
          return null;
        });

      // Saturday 2026-11-21: slot 7 is 19:00-21:00 VN (12:00-14:00 UTC)
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                reservedFrom: new Date('2026-11-21T12:00:00.000Z'),
                reservedTo: new Date('2026-11-21T14:00:00.000Z'),
                status: ReservationStatus.Confirmed,
              },
            ]),
          }),
        }),
      });

      const result = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      // RENTAL on Saturday 19:00-21:00
      expect(result.variantBookedSlots!['XL_RED']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: '2026-11-21',
            timeSlot: '19:00-21:00',
            purpose: 'RENTAL',
          }),
          // Rollover Sunday (closed) -> Monday 2026-11-23 at 07:00-09:00
          expect.objectContaining({
            date: '2026-11-23',
            timeSlot: '07:00-09:00',
            purpose: 'TURNAROUND',
          }),
        ]),
      );
    });

    it('rolls turnaround over SPECIFIC_DATE off day', async () => {
      const providerId = new Types.ObjectId();
      mockProductModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ providerId }),
      });

      // Provider works all days, but 2026-11-16 (Monday) is a specific holiday
      const schedules = [
        ...[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          providerId,
          scheduleType: 'RECURRING',
          dayOfWeek,
        })),
        {
          providerId,
          scheduleType: 'SPECIFIC_DATE',
          offDays: ['2026-11-16'],
        },
      ];

      mockBookingModel.db.collection = jest
        .fn()
        .mockImplementation((name: string) => {
          if (name === 'inventory_slot_leases') return leaseCollectionMock;
          if (name === 'providers') {
            return {
              findOne: jest.fn().mockResolvedValue({
                rentalSettings: { turnaroundSlots: 1 },
              }),
            };
          }
          if (name === 'provider_schedules') {
            return {
              find: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(schedules),
              }),
            };
          }
          return null;
        });

      // Sunday 2026-11-15: slot 7 (19:00-21:00 VN)
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                reservedFrom: new Date('2026-11-15T12:00:00.000Z'),
                reservedTo: new Date('2026-11-15T14:00:00.000Z'),
                status: ReservationStatus.Confirmed,
              },
            ]),
          }),
        }),
      });

      const result = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      // RENTAL on Sunday 19:00-21:00
      // Rollover Monday 2026-11-16 (holiday) -> Tuesday 2026-11-17 at 07:00-09:00
      expect(result.variantBookedSlots!['XL_RED']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: '2026-11-15',
            timeSlot: '19:00-21:00',
            purpose: 'RENTAL',
          }),
          expect.objectContaining({
            date: '2026-11-17',
            timeSlot: '07:00-09:00',
            purpose: 'TURNAROUND',
          }),
        ]),
      );
    });
  });

  // --- BLOCKER 4: Cache invalidation through real lifecycle methods ---
  describe('Blocker 4 - Cache invalidation through real lifecycle methods', () => {
    it('invalidates cache when InventorySlotLeaseService.releaseBookingLeases is called', async () => {
      // 1. Warm cache
      mockSlotLeases = [
        {
          inventoryItemId: item1Id,
          dateStr: '2026-11-15',
          slotIndex: 1,
          purpose: 'RENTAL',
          status: 'CONFIRMED',
        },
      ];
      const initial = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(initial.variantBookedSlots!['XL_RED']).toHaveLength(1);
      expect(cacheService.has(productId.toString())).toBe(true);

      // 2. Set up InventorySlotLeaseService with cacheService
      const mockLeaseModel = {
        updateMany: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
      };
      const slotLeaseService = new InventorySlotLeaseService(
        mockLeaseModel as any,
        new TimeSlotEngineService(),
        cacheService,
      );

      // 3. Release leases for a booking
      await slotLeaseService.releaseBookingLeases(
        new Types.ObjectId(),
        'CANCELLED',
      );

      // 4. Assert cache was invalidated
      expect(cacheService.has(productId.toString())).toBe(false);

      // 5. Next read queries DB again
      mockSlotLeases = []; // lease is gone
      const fresh = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(fresh.variantBookedSlots!['XL_RED']).toHaveLength(0);
    });

    it('invalidates cache when InventorySlotLeaseService.reconcileTurnaroundLeases releases leases', async () => {
      // Warm cache
      mockSlotLeases = [
        {
          inventoryItemId: item1Id,
          dateStr: '2026-11-15',
          slotIndex: 2,
          purpose: 'TURNAROUND',
          status: 'CONFIRMED',
        },
      ];
      await service.getBusySchedulesForProduct(productId.toString());
      expect(cacheService.has(productId.toString())).toBe(true);

      const leaseId = new Types.ObjectId();
      const mockLeaseModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([
                { _id: leaseId, dateStr: '2026-11-15', slotIndex: 2 },
              ]),
          }),
        }),
        updateMany: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        }),
      };
      const slotLeaseService = new InventorySlotLeaseService(
        mockLeaseModel as any,
        new TimeSlotEngineService(),
        cacheService,
      );

      // Early ready at 08:30 (before 09:00 leaseStart)
      await slotLeaseService.reconcileTurnaroundLeases(
        new Types.ObjectId(),
        new Date('2026-11-15T01:30:00.000Z'),
      );

      expect(cacheService.has(productId.toString())).toBe(false);
    });

    it('invalidates cache when InventorySlotLeaseService.expireHoldLeases cleans up expired leases', async () => {
      mockSlotLeases = [];
      await service.getBusySchedulesForProduct(productId.toString());
      expect(cacheService.has(productId.toString())).toBe(true);

      const mockLeaseModel = {
        updateMany: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
        }),
      };
      const slotLeaseService = new InventorySlotLeaseService(
        mockLeaseModel as any,
        new TimeSlotEngineService(),
        cacheService,
      );

      await slotLeaseService.expireHoldLeases();

      expect(cacheService.has(productId.toString())).toBe(false);
    });

    it('invalidates cache when reschedule workflow triggers applyApprovedReschedule', async () => {
      // 1. Warm cache
      await service.getBusySchedulesForProduct(productId.toString());
      expect(cacheService.has(productId.toString())).toBe(true);

      const bookingId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();

      const bookingMock = {
        _id: bookingId,
        customerId,
        bookingCode: 'BKG-TEST-001',
        status: BookingStatus.DepositPaid,
        providerIds: [providerId],
      };

      const bookingItemMock = {
        _id: itemId,
        bookingId,
        productId,
        providerId,
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: new Date(Date.now() + 5 * 24 * 3600 * 1000), // > 24h in future
        rentalTo: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      };

      mockBookingModel.findById = jest.fn().mockResolvedValue(bookingMock);
      mockBookingItemModel.findOne = jest
        .fn()
        .mockResolvedValue(bookingItemMock);
      mockBookingItemModel.updateOne = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      mockBookingScheduleModel.updateMany = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      mockInventoryReservationModel.findOne = jest.fn().mockResolvedValue(null);
      mockInventoryReservationModel.updateOne = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const newFrom = new Date(Date.now() + 10 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const newTo = new Date(Date.now() + 12 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      // 2. Call public reschedule workflow which executes applyApprovedReschedule
      // Since the code of 24/11/2026 the customer only sends a reschedule request (rescheduleBooking); the leases
      // move when the provider approves it, so the approval step (applyApprovedReschedule) is called here.
      const result = await (service as any).applyApprovedReschedule(
        bookingId.toString(),
        customerId.toString(),
        {
          itemId: itemId.toString(),
          newRentalFrom: newFrom,
          newRentalTo: newTo,
        },
      );

      expect(result).toBeDefined();
      expect(result.message).toBe('Đổi lịch thành công');

      // 3. Prove cache was invalidated by applyApprovedReschedule
      expect(cacheService.has(productId.toString())).toBe(false);

      // 4. Prove next read re-queries DB and re-populates cache
      const freshSchedule = await service.getBusySchedulesForProduct(
        productId.toString(),
      );
      expect(freshSchedule).toBeDefined();
      expect(cacheService.has(productId.toString())).toBe(true);
    });
  });

  // --- CORE FUNCTIONALITY TESTS ---
  it('correctly maps RENTAL and TURNAROUND slot leases to variantBookedSlots', async () => {
    mockSlotLeases = [
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1, // 07:00-09:00
        purpose: 'RENTAL',
        status: 'CONFIRMED',
      },
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 2, // 09:00-11:00
        purpose: 'TURNAROUND',
        status: 'CONFIRMED',
      },
    ];

    const result = await service.getBusySchedulesForProduct(
      productId.toString(),
    );

    expect(result.variantBookedSlots).toBeDefined();
    expect(result.variantBookedSlots!['XL_RED']).toEqual([
      { date: '2026-11-15', timeSlot: '07:00-09:00', purpose: 'RENTAL' },
      { date: '2026-11-15', timeSlot: '09:00-11:00', purpose: 'TURNAROUND' },
    ]);
    expect(result.variantBookedSlots!['S_RED']).toEqual([]);
  });

  it('correctly parses hourly reservations using Vietnam time (UTC+7) and projects turnaround slots into variantBookedSlots', async () => {
    mockInventoryReservationModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              inventoryItemId: item1Id,
              reservedFrom: new Date('2026-11-15T00:00:00.000Z'),
              reservedTo: new Date('2026-11-15T02:00:00.000Z'),
              status: ReservationStatus.Confirmed,
            },
          ]),
        }),
      }),
    });

    const result = await service.getBusySchedulesForProduct(
      productId.toString(),
    );

    expect(result.variantBookedSlots).toBeDefined();
    expect(result.variantBookedSlots!['XL_RED']).toEqual([
      { date: '2026-11-15', timeSlot: '07:00-09:00', purpose: 'RENTAL' },
      { date: '2026-11-15', timeSlot: '09:00-11:00', purpose: 'TURNAROUND' },
    ]);
  });

  it('does not mark slot 11:00-13:00 busy when no lease exists for it', async () => {
    mockSlotLeases = [
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: 'RENTAL',
        status: 'CONFIRMED',
      },
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 2,
        purpose: 'TURNAROUND',
        status: 'CONFIRMED',
      },
    ];

    const result = await service.getBusySchedulesForProduct(
      productId.toString(),
    );
    const slots = result.variantBookedSlots!['XL_RED'];
    const slot3 = slots.find((s) => s.timeSlot === '11:00-13:00');
    expect(slot3).toBeUndefined();
  });

  it('unexpired TEMP lease blocks slot, while expired TEMP lease does not', async () => {
    const unexpired = new Date(Date.now() + 600_000);
    const expired = new Date(Date.now() - 600_000);

    mockSlotLeases = [
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: 'RENTAL',
        status: 'TEMP',
        expiresAt: unexpired,
      },
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 2,
        purpose: 'TURNAROUND',
        status: 'TEMP',
        expiresAt: expired,
      },
    ];

    const result = await service.getBusySchedulesForProduct(
      productId.toString(),
    );
    expect(result.variantBookedSlots!['XL_RED']).toEqual([
      { date: '2026-11-15', timeSlot: '07:00-09:00', purpose: 'RENTAL' },
    ]);
  });

  it('two leases for the same inventoryItemId in the same slot are not double counted', async () => {
    mockSlotLeases = [
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: 'TURNAROUND',
        status: 'CONFIRMED',
      },
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: 'RENTAL',
        status: 'CONFIRMED',
      },
    ];

    const result = await service.getBusySchedulesForProduct(
      productId.toString(),
    );
    expect(result.variantBookedSlots!['XL_RED']).toHaveLength(1);
    expect(result.variantBookedSlots!['XL_RED'][0]).toEqual({
      date: '2026-11-15',
      timeSlot: '07:00-09:00',
      purpose: 'RENTAL',
    });
  });

  it('variant with stock=2 remains available when only 1 item is leased, and becomes busy when both are leased', async () => {
    const item3Id = new Types.ObjectId();
    mockInventoryItemModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { _id: item1Id, size: 'XL', color: 'RED', status: 'AVAILABLE' },
            { _id: item3Id, size: 'XL', color: 'RED', status: 'AVAILABLE' },
          ]),
        }),
      }),
    });

    mockSlotLeases = [
      {
        inventoryItemId: item1Id,
        dateStr: '2026-11-15',
        slotIndex: 1,
        purpose: 'RENTAL',
        status: 'CONFIRMED',
      },
    ];

    let result = await service.getBusySchedulesForProduct(productId.toString());
    expect(result.variantBookedSlots!['XL_RED']).toEqual([]);

    cacheService.invalidate(productId.toString());

    mockSlotLeases.push({
      inventoryItemId: item3Id,
      dateStr: '2026-11-15',
      slotIndex: 1,
      purpose: 'RENTAL',
      status: 'CONFIRMED',
    });

    result = await service.getBusySchedulesForProduct(productId.toString());
    expect(result.variantBookedSlots!['XL_RED']).toEqual([
      { date: '2026-11-15', timeSlot: '07:00-09:00', purpose: 'RENTAL' },
    ]);
  });

  describe('Defensive ID validation for getBusySchedulesForProduct', () => {
    it('throws BadRequestException when productId is an invalid string, not BSON/Cast error', async () => {
      await expect(
        service.getBusySchedulesForProduct('invalid'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getBusySchedulesForProduct('invalid'),
      ).rejects.toThrow('ID sản phẩm không hợp lệ');
    });

    it('throws BadRequestException when productId is empty or malformed', async () => {
      await expect(service.getBusySchedulesForProduct('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.getBusySchedulesForProduct('123456789012'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getBusySchedulesForProduct(null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully processes valid ObjectId without throwing', async () => {
      const validId = new Types.ObjectId().toString();
      const result = await service.getBusySchedulesForProduct(validId);
      expect(result).toHaveProperty('bookedDates');
      expect(result).toHaveProperty('bookedSlots');
    });
  });
});
