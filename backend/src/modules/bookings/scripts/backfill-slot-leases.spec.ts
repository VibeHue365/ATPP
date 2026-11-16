import { Types } from 'mongoose';
import { runBackfillSlotLeases } from './backfill-slot-leases';

describe('backfill-slot-leases', () => {
  let mockDb: any;
  let mockProviders: any[];
  let mockBookings: any[];
  let mockBookingItems: any[];
  let mockReservations: any[];
  let mockSlotLeases: any[];
  let mockSchedules: any[];
  let accessedCollections: string[];

  let mockSession: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    abortTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  beforeEach(() => {
    mockProviders = [];
    mockBookings = [];
    mockBookingItems = [];
    mockReservations = [];
    mockSlotLeases = [];
    mockSchedules = [];
    accessedCollections = [];

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mockDb = {
      startSession: jest.fn().mockResolvedValue(mockSession),
      collection: (name: string) => {
        accessedCollections.push(name);
        if (name === 'providers') {
          return {
            find: () => ({
              toArray: async () => mockProviders,
            }),
            updateOne: async (filter: any, update: any) => {
              const p = mockProviders.find((x) => x._id.toString() === filter._id.toString());
              if (p && update.$set) {
                Object.assign(p, update.$set);
              }
              return { modifiedCount: 1 };
            },
          };
        }
        if (name === 'bookings') {
          return {
            find: (filter: any) => ({
              toArray: async () =>
                mockBookings.filter((b) => {
                  if (filter.status?.$in && !filter.status.$in.includes(b.status)) return false;
                  return true;
                }),
            }),
            findOne: async (filter: any) =>
              mockBookings.find((b) => b._id.toString() === filter._id.toString()),
          };
        }
        if (name === 'booking_items') {
          return {
            find: () => ({
              toArray: async () => mockBookingItems,
            }),
            updateMany: async (filter: any, update: any) => {
              let modifiedCount = 0;
              const ids = filter._id?.$in?.map((id: any) => id.toString());
              for (const item of mockBookingItems) {
                if (ids && !ids.includes(item._id.toString())) {
                  continue;
                }

                // Emulate MongoDB filter matching on rentalFulfillment
                if (filter.rentalFulfillment) {
                  if (
                    filter.rentalFulfillment.$type === 'object' &&
                    filter.rentalFulfillment.$ne === null
                  ) {
                    if (
                      item.rentalFulfillment === null ||
                      item.rentalFulfillment === undefined ||
                      typeof item.rentalFulfillment !== 'object'
                    ) {
                      continue; // No match
                    }
                  }
                }

                if (update.$set) {
                  if ('slotLeaseRequired' in update.$set) {
                    item.slotLeaseRequired = update.$set.slotLeaseRequired;
                    modifiedCount++;
                  }
                  if ('rentalFulfillment.slotLeaseRequired' in update.$set) {
                    // Realistic MongoDB behavior: setting field inside null element throws error in Mongo
                    if (item.rentalFulfillment === null) {
                      throw new Error(
                        "Cannot create field 'slotLeaseRequired' in element {rentalFulfillment: null}",
                      );
                    }
                    if (item.rentalFulfillment === undefined) {
                      item.rentalFulfillment = {
                        slotLeaseRequired:
                          update.$set['rentalFulfillment.slotLeaseRequired'],
                      };
                    } else if (typeof item.rentalFulfillment === 'object') {
                      item.rentalFulfillment.slotLeaseRequired =
                        update.$set['rentalFulfillment.slotLeaseRequired'];
                    }
                    modifiedCount++;
                  }
                }
              }
              return { modifiedCount };
            },
          };
        }
        if (name === 'inventory_reservations') {
          return {
            findOne: async (filter: any) =>
              mockReservations.find(
                (r) => r.bookingItemId.toString() === filter.bookingItemId.toString(),
              ),
          };
        }
        if (name === 'provider_schedules') {
          return {
            find: () => ({
              toArray: async () => mockSchedules,
            }),
          };
        }
        if (name === 'inventory_slot_leases') {
          return {
            find: (filter: any) => ({
              toArray: async () =>
                mockSlotLeases.filter((l) => {
                  if (
                    filter.status?.$in &&
                    !filter.status.$in.includes(l.status)
                  ) {
                    return false;
                  }
                  return true;
                }),
            }),
            updateOne: async (filter: any, update: any, options: any) => {
              const existing = mockSlotLeases.find(
                (l) =>
                  l.inventoryItemId.toString() === filter.inventoryItemId.toString() &&
                  l.bookingItemId?.toString() === filter.bookingItemId?.toString() &&
                  l.dateStr === filter.dateStr &&
                  l.slotIndex === filter.slotIndex &&
                  l.purpose === filter.purpose,
              );
              if (!existing && options?.upsert) {
                const inserted = {
                  ...filter,
                  ...(update.$setOnInsert || {}),
                };
                mockSlotLeases.push(inserted);
                return { upsertedCount: 1 };
              }
              return { upsertedCount: 0 };
            },
          };
        }
        // Strict guard: disallow legacy collection names
        if (name === 'bookingitems' || name === 'inventoryreservations') {
          throw new Error(`Legacy collection accessed: ${name}`);
        }
        throw new Error(`Unknown collection: ${name}`);
      },
    };
  });

  it('uses exact real collection names (booking_items, inventory_reservations) and migrates conflict-free provider', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      name: 'Shop Áo Dài Huế',
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    // Booking item missing inventoryItemId directly, will be resolved via inventory_reservations
    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: null,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00', // Slot 2
    });

    mockReservations.push({
      bookingItemId,
      inventoryItemId: itemId,
      status: 'CONFIRMED',
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(accessedCollections).toContain('booking_items');
    expect(accessedCollections).toContain('inventory_reservations');
    expect(accessedCollections).toContain('inventory_slot_leases');
    expect(accessedCollections).not.toContain('bookingitems');
    expect(accessedCollections).not.toContain('inventoryreservations');

    expect(result.providersScanned).toBe(1);
    expect(result.providersMigrated).toBe(1);
    expect(result.leasesInserted).toBe(2); // 1 RENTAL (slot 2) + 1 TURNAROUND (slot 3)
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment).toBeUndefined();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  it('backfills active leases for PICKUP_PENDING and enables useSlotLeases', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'PICKUP_PENDING',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00',
      rentalFulfillment: {
        status: 'READY_FOR_PICKUP',
        turnaroundStatus: 'SCHEDULED',
      },
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(result.leasesInserted).toBe(2);
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment?.slotLeaseRequired).toBe(true);
  });

  it('backfills active leases for RETURN_PENDING before enabling useSlotLeases', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'RETURN_PENDING',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '13:00 - 15:00',
      rentalFulfillment: {
        status: 'PICKED_UP',
        turnaroundStatus: 'SCHEDULED',
      },
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(result.leasesInserted).toBe(2);
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment?.slotLeaseRequired).toBe(true);
  });

  it('backfills leases for COMBO_PHOTOS_APPROVED when rental item is ongoing', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'COMBO_PHOTOS_APPROVED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '11:00 - 13:00',
      rentalFulfillment: {
        status: 'RETURNED',
        turnaroundStatus: 'IN_PROGRESS',
      },
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(result.leasesInserted).toBe(2);
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment?.slotLeaseRequired).toBe(true);
  });

  it('strictly throws in apply mode when MongoDB session or transaction is not supported', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      useSlotLeases: false,
    });

    mockBookings.push({ _id: bookingId, providerIds: [providerId], status: 'CONFIRMED' });
    mockBookingItems.push({
      _id: new Types.ObjectId(),
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00',
    });

    // Mock DB without startSession (e.g. standalone Mongo)
    const mockDbWithoutSession = {
      ...mockDb,
      startSession: undefined,
    };

    await expect(
      runBackfillSlotLeases(mockDbWithoutSession, {
        dryRun: false,
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      }),
    ).rejects.toThrow('MongoDB session and transaction support are strictly required in apply mode');

    expect(mockSlotLeases).toHaveLength(0);
    expect(mockProviders[0].useSlotLeases).toBe(false);
  });

  it('creates multiple RENTAL leases for multi-hour bookings (07:00-11:00 creates 2 RENTAL + 1 TURNAROUND)', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '07:00 - 11:00', // 2 slots: slot 1 (07-09) and slot 2 (09-11)
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(result.leasesInserted).toBe(3); // 2 RENTAL + 1 TURNAROUND
    expect(mockSlotLeases).toHaveLength(3);

    const rental1 = mockSlotLeases.find((l) => l.slotIndex === 1 && l.purpose === 'RENTAL');
    const rental2 = mockSlotLeases.find((l) => l.slotIndex === 2 && l.purpose === 'RENTAL');
    const turnaround = mockSlotLeases.find((l) => l.slotIndex === 3 && l.purpose === 'TURNAROUND');

    expect(rental1).toBeDefined();
    expect(rental2).toBeDefined();
    expect(turnaround).toBeDefined();
  });

  it('does NOT enable useSlotLeases when an active booking item cannot be backfilled (unresolvable inventoryItemId)', async () => {
    const providerId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      name: 'Unresolvable Shop',
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    // Booking item has no inventoryItemId and reservation does NOT exist
    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: null,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00',
    });

    const warnFn = jest.fn();
    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: warnFn, error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(0);
    expect(result.providersSkippedWithConflicts).toBe(1);
    expect(mockProviders[0].useSlotLeases).toBe(false);
    expect(mockSlotLeases).toHaveLength(0);
    expect(warnFn).toHaveBeenCalled();
  });

  it('detects preflight conflict with existing active lease in collection, skips provider and leaves useSlotLeases false', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();
    const otherBookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      name: 'Conflict Shop',
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00', // Slot 2
    });

    // Pre-existing lease in DB for this item and slot belonging to a different bookingItem
    mockSlotLeases.push({
      providerId,
      bookingItemId: otherBookingItemId,
      inventoryItemId: itemId,
      dateStr: '2026-11-20',
      slotIndex: 2,
      purpose: 'RENTAL',
      status: 'CONFIRMED',
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(0);
    expect(result.providersSkippedWithConflicts).toBe(1);
    expect(result.conflicts).toHaveLength(1);
    expect(mockProviders[0].useSlotLeases).toBe(false);
  });

  it('rolls back transaction when insert fails mid-way, leaving useSlotLeases false', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      name: 'Failing Shop',
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00', // Produces 2 leases (rental slot 2 + turnaround slot 3)
    });

    // Cause failure on 2nd updateOne call
    let callCount = 0;
    const originalCollection = mockDb.collection;
    mockDb.collection = (name: string) => {
      const col = originalCollection(name);
      if (name === 'inventory_slot_leases') {
        return {
          ...col,
          updateOne: async (...args: any[]) => {
            callCount++;
            if (callCount >= 2) {
              throw new Error('Database write failure mid-way');
            }
            return col.updateOne(...args);
          },
        };
      }
      return col;
    };

    await expect(
      runBackfillSlotLeases(mockDb, {
        dryRun: false,
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      }),
    ).rejects.toThrow('Database write failure mid-way');

    expect(mockProviders[0].useSlotLeases).toBe(false);
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('respects dryRun option and does not write leases or change provider flag', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const b1 = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      name: 'Shop Nón Bài Thơ',
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({ _id: b1, providerIds: [providerId], status: 'CONFIRMED' });
    mockBookingItems.push({
      _id: new Types.ObjectId(),
      bookingId: b1,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '13:00 - 15:00',
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: true,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersScanned).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(mockSlotLeases).toHaveLength(0);
    expect(mockProviders[0].useSlotLeases).toBe(false);
  });

  it('migrates booking item with rentalFulfillment = null: sets top-level slotLeaseRequired=true and keeps rentalFulfillment=null without throwing', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00',
      rentalFulfillment: null, // Legacy item where rentalFulfillment is null
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment).toBeNull();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  it('migrates booking item with rentalFulfillment missing (undefined): sets top-level slotLeaseRequired=true and does NOT create empty rentalFulfillment', async () => {
    const providerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingItemId = new Types.ObjectId();

    mockProviders.push({
      _id: providerId,
      rentalSettings: { turnaroundSlots: 1 },
      useSlotLeases: false,
    });

    mockBookings.push({
      _id: bookingId,
      providerIds: [providerId],
      status: 'CONFIRMED',
    });

    mockBookingItems.push({
      _id: bookingItemId,
      bookingId,
      providerId,
      inventoryItemId: itemId,
      itemType: 'PRODUCT',
      rentalType: 'HOURLY',
      shootDate: new Date('2026-11-20T00:00:00.000Z'),
      shootTimeSlot: '09:00 - 11:00',
      // rentalFulfillment is undefined/missing
    });

    const result = await runBackfillSlotLeases(mockDb, {
      dryRun: false,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.providersMigrated).toBe(1);
    expect(mockProviders[0].useSlotLeases).toBe(true);
    expect(mockBookingItems[0].slotLeaseRequired).toBe(true);
    expect(mockBookingItems[0].rentalFulfillment).toBeUndefined();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });
});
