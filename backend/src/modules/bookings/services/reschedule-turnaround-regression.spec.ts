import { Types } from 'mongoose';
import { BookingsService } from './bookings.service';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { ProductBusyCacheService } from './product-busy-cache.service';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import {
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import { ReservationStatus } from '../../products/schemas/inventory-reservation.schema';

describe('Reschedule Turnaround & Reservation Boundaries Regression', () => {
  let cacheService: ProductBusyCacheService;
  let timeEngine: TimeSlotEngineService;
  let inMemoryLeases: any[];
  let inMemoryReservations: any[];

  beforeEach(() => {
    inMemoryLeases = [];
    inMemoryReservations = [];
    cacheService = new ProductBusyCacheService();
    timeEngine = new TimeSlotEngineService();
  });

  it('reschedule to 11:00-13:00: sets reservation end to 13:00, slot 3 RENTAL, slot 4 TURNAROUND, keeps 15:00-17:00 open without ghost turnaround', async () => {
    const bookingId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const inventoryItemId = new Types.ObjectId();
    const dateStr = '2026-12-20';

    // 1. Initial leases at slot 1 (07:00-09:00 RENTAL) and slot 2 (09:00-11:00 TURNAROUND)
    inMemoryLeases.push(
      {
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemId,
        inventoryItemId,
        providerId,
        dateStr,
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
        dateStr,
        slotIndex: 2,
        purpose: SlotLeasePurpose.Turnaround,
        status: SlotLeaseStatus.Confirmed,
      },
    );

    // Initial reservation
    inMemoryReservations.push({
      _id: new Types.ObjectId(),
      bookingId,
      bookingItemId: itemId,
      inventoryItemId,
      status: ReservationStatus.Confirmed,
      reservedFrom: new Date(`${dateStr}T07:00:00+07:00`),
      reservedTo: new Date(`${dateStr}T09:00:00+07:00`),
    });

    const bookingMock = {
      _id: bookingId,
      customerId,
      bookingCode: 'BKG-REGRESS-001',
      status: BookingStatus.DepositPaid,
      providerIds: [providerId],
    };

    const bookingItemMock: any = {
      _id: itemId,
      bookingId,
      productId,
      providerId,
      inventoryItemId,
      itemType: BookingItemType.Product,
      rentalType: 'HOURLY',
      slotLeaseRequired: true,
      shootDate: dateStr,
      shootTimeSlot: '07:00-09:00',
      rentalFrom: new Date(`${dateStr}T07:00:00+07:00`),
      rentalTo: new Date(`${dateStr}T09:00:00+07:00`),
      rentalFulfillment: {
        status: 'PENDING',
        availableFrom: new Date(`${dateStr}T11:00:00+07:00`),
        turnaroundSlotsSnapshot: 1,
      },
    };

    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(null),
      abortTransaction: jest.fn().mockResolvedValue(null),
      endSession: jest.fn().mockResolvedValue(null),
    };

    const leaseColl = {
      findOne: jest.fn().mockImplementation((query: any) => {
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
          if (query.slotIndex !== undefined && l.slotIndex !== query.slotIndex)
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
          return true;
        });
        return Promise.resolve(match || null);
      }),
      find: jest.fn().mockImplementation((query: any) => ({
        project: jest.fn().mockReturnValue({
          toArray: jest.fn().mockImplementation(() => {
            const now = new Date();
            const res = inMemoryLeases.filter((l) => {
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
            return Promise.resolve(res);
          }),
        }),
      })),
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        let count = 0;
        for (const l of inMemoryLeases) {
          let match = true;
          if (
            filter.bookingItemId &&
            l.bookingItemId.toString() !== filter.bookingItemId.toString()
          )
            match = false;
          if (filter.status?.$in && !filter.status.$in.includes(l.status))
            match = false;
          if (match) {
            Object.assign(l, update.$set);
            count++;
          }
        }
        return Promise.resolve({ modifiedCount: count });
      }),
      insertMany: jest.fn().mockImplementation((docs: any[]) => {
        for (const d of docs) {
          inMemoryLeases.push({ ...d, _id: new Types.ObjectId() });
        }
        return Promise.resolve(docs);
      }),
    };

    const mockBookingModel = {
      findById: jest.fn().mockResolvedValue(bookingMock),
      db: {
        startSession: jest.fn().mockResolvedValue(mockSession),
        collection: jest.fn().mockImplementation((name) => {
          if (name === 'inventory_slot_leases') return leaseColl;
          if (name === 'providers') {
            return {
              findOne: jest.fn().mockResolvedValue({
                _id: providerId,
                useSlotLeases: true,
                rentalSettings: { turnaroundSlots: 1 },
              }),
            };
          }
          if (name === 'providerschedules') {
            return {
              find: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue([]),
              }),
            };
          }
          return null;
        }),
      },
    };

    const mockBookingItemModel = {
      findOne: jest.fn().mockResolvedValue(bookingItemMock),
      updateOne: jest.fn().mockImplementation((filter, update) => {
        for (const [k, v] of Object.entries(update.$set || {})) {
          if (k.includes('.')) {
            const [parent, child] = k.split('.');
            if (!bookingItemMock[parent]) bookingItemMock[parent] = {};
            bookingItemMock[parent][child] = v;
          } else {
            bookingItemMock[k] = v;
          }
        }
        return Promise.resolve({ modifiedCount: 1 });
      }),
    };

    const mockReservationModel = {
      updateMany: jest.fn().mockImplementation((filter, update) => {
        for (const r of inMemoryReservations) {
          if (r.bookingItemId.toString() === filter.bookingItemId.toString()) {
            Object.assign(r, update.$set);
          }
        }
        return Promise.resolve({ modifiedCount: inMemoryReservations.length });
      }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockImplementation(() => {
              return Promise.resolve(
                inMemoryReservations.map((r) => ({
                  inventoryItemId: r.inventoryItemId,
                  reservedFrom: r.reservedFrom,
                  reservedTo: r.reservedTo,
                  status: r.status,
                })),
              );
            }),
          }),
        }),
      }),
    };

    const mockInventoryItemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: inventoryItemId,
                size: 'XL',
                color: 'RED',
                status: 'AVAILABLE',
                conditionStatus: 'GOOD',
              },
            ]),
          }),
        }),
      }),
    };

    const mockProductModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ providerId }),
      }),
    };

    const mockScheduleModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
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
      mockProductModel as any,
      {} as any,
      {} as any,
      mockScheduleModel as any,
      mockInventoryItemModel as any,
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
      undefined,
      timeEngine,
    );

    // 2. Perform reschedule to 11:00-13:00 (slot 3)
    const result = await bookingsService.rescheduleBooking(
      bookingId.toString(),
      customerId.toString(),
      {
        itemId: itemId.toString(),
        newShootDate: dateStr,
        newShootTimeSlot: '11:00-13:00',
        reason: 'Change to lunch slot',
      },
    );

    expect(result.status).toBe('APPROVED');

    // 3. Verification:
    // a. Reservation must end at 13:00 (contractual rental end), NOT 15:00
    const updatedReservation = inMemoryReservations.find(
      (r) => r.bookingItemId.toString() === itemId.toString(),
    );
    expect(updatedReservation).toBeDefined();
    const reservedToVn = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(updatedReservation.reservedTo);
    expect(reservedToVn).toBe('13:00');

    // b. rentalFulfillment.availableFrom must still be 15:00 (turnaround availableFrom)
    const availableFromVn = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(bookingItemMock.rentalFulfillment.availableFrom);
    expect(availableFromVn).toBe('15:00');

    // c. Leases: slot 3 is RENTAL CONFIRMED, slot 4 is TURNAROUND CONFIRMED
    const slot3Lease = inMemoryLeases.find(
      (l) => l.slotIndex === 3 && l.status === SlotLeaseStatus.Confirmed,
    );
    const slot4Lease = inMemoryLeases.find(
      (l) => l.slotIndex === 4 && l.status === SlotLeaseStatus.Confirmed,
    );
    expect(slot3Lease).toBeDefined();
    expect(slot3Lease.purpose).toBe(SlotLeasePurpose.Rental);
    expect(slot4Lease).toBeDefined();
    expect(slot4Lease.purpose).toBe(SlotLeasePurpose.Turnaround);

    // Old leases must be released with RESCHEDULED
    const oldLeases = inMemoryLeases.filter((l) =>
      [1, 2].includes(l.slotIndex),
    );
    expect(
      oldLeases.every(
        (l) =>
          l.status === SlotLeaseStatus.Released &&
          l.releaseReason === 'RESCHEDULED',
      ),
    ).toBe(true);

    // d. Busy schedule query:
    // Slot 3 (11:00-13:00) is RENTAL
    // Slot 4 (13:00-15:00) is TURNAROUND
    // Slot 5 (15:00-17:00) MUST NOT be busy / NO ghost turnaround
    cacheService.invalidate(productId.toString());
    const busy = await bookingsService.getBusySchedulesForProduct(
      productId.toString(),
    );
    const xlRedSlots = busy.variantBookedSlots?.['XL_RED'] || [];

    const slot11_13 = xlRedSlots.find((s) => s.timeSlot === '11:00-13:00');
    const slot13_15 = xlRedSlots.find((s) => s.timeSlot === '13:00-15:00');
    const slot15_17 = xlRedSlots.find((s) => s.timeSlot === '15:00-17:00');

    expect(slot11_13).toBeDefined();
    expect(slot11_13?.purpose).toBe('RENTAL');

    expect(slot13_15).toBeDefined();
    expect(slot13_15?.purpose).toBe('TURNAROUND');

    // Crucial check: 15:00-17:00 must NOT exist in busy schedules
    expect(slot15_17).toBeUndefined();

    // e. Another customer booking at 15:00-17:00 does not conflict with reservation boundary
    // In booking-creation, conflict checks: reservedFrom <= candidateReservedTo && candidateReservedFrom <= reservedTo
    const candidateReservedFrom = new Date(`${dateStr}T15:00:00+07:00`);
    const candidateReservedTo = new Date(`${dateStr}T17:00:00+07:00`);

    // Does updatedReservation conflict with candidate?
    // reservedFrom (11:00) <= candidateReservedTo (17:00) -> true
    // reservedTo (13:00) >= candidateReservedFrom (15:00) -> FALSE! (13:00 < 15:00)
    const isConflicting =
      updatedReservation.reservedFrom <= candidateReservedTo &&
      updatedReservation.reservedTo >= candidateReservedFrom;
    expect(isConflicting).toBe(false);
  });
});
