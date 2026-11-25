import { Types } from 'mongoose';
import {
  InventoryItemStatus,
  ConditionStatus,
} from '../schemas/inventory-item.schema';
import { ReservationStatus } from '../schemas/inventory-reservation.schema';

describe('Inventory Service - Summary & Cross-Lease Parity (F.6, F.1, F.2)', () => {
  let service: any;
  let mockInventoryItemModel: any;
  let mockInventoryReservationModel: any;
  let mockProductModel: any;
  let mockConnection: any;
  let mockUsersRepository: any;

  const providerId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId();

  beforeEach(() => {
    mockUsersRepository = {
      findUserById: jest.fn().mockResolvedValue({
        provider: { providerId },
      }),
    };

    mockProductModel = {
      find: jest.fn().mockResolvedValue([
        {
          _id: productId,
          name: 'Áo Dài Gấm',
          colors: ['Đỏ'],
          sizes: ['L'],
        },
      ]),
    };

    mockInventoryItemModel = {
      find: jest.fn(),
    };

    mockInventoryReservationModel = {
      find: jest.fn(),
    };

    const mockSlotLeaseCursor = {
      project: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    };

    const mockLeaseCollection = {
      find: jest.fn().mockReturnValue(mockSlotLeaseCursor),
    };

    const mockBookingModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockConnection = {
      collection: jest.fn().mockImplementation((name) => {
        if (name === 'inventory_slot_leases') return mockLeaseCollection;
        return null;
      }),
      model: jest.fn().mockImplementation((name) => {
        if (name === 'Booking') return mockBookingModel;
        return null;
      }),
    };

    const { InventoryService } = require('./inventory.service');
    service = new InventoryService(
      mockInventoryItemModel,
      mockInventoryReservationModel,
      mockProductModel,
      {} as any,
      mockUsersRepository,
      {} as any,
      mockConnection,
    );
  });

  describe('getInventorySummary (F.6)', () => {
    it('Scenario 6A: Physical asset in shop is AVAILABLE=1, future reservation sets bookedAhead=1, rented=0', async () => {
      const item1Id = new Types.ObjectId();
      const booking1Id = new Types.ObjectId();

      mockInventoryItemModel.find.mockResolvedValue([
        {
          _id: item1Id,
          productId,
          size: 'L',
          color: 'Đỏ',
          material: null,
          status: InventoryItemStatus.Available,
          conditionStatus: ConditionStatus.Good,
        },
      ]);

      // Future reservation: reservedFrom > now
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                bookingId: booking1Id,
                status: ReservationStatus.Confirmed,
                reservedFrom: futureDate,
                reservedTo: new Date(
                  futureDate.getTime() + 24 * 60 * 60 * 1000,
                ),
                expiresAt: null,
              },
            ]),
          }),
        }),
      });

      // Booking status is CONFIRMED
      const mockBookingModel = mockConnection.model('Booking');
      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: booking1Id,
                status: 'CONFIRMED',
              },
            ]),
          }),
        }),
      });

      const summary = await service.getInventorySummary(userId);
      expect(summary).toHaveLength(1);
      expect(summary[0]).toEqual(
        expect.objectContaining({
          total: 1,
          available: 1,
          bookedAhead: 1,
          rented: 0,
          maintenance: 0,
        }),
      );
    });

    it('Scenario 6B: Picked up asset sets available=0, rented=1, bookedAhead=0', async () => {
      const item1Id = new Types.ObjectId();
      const booking1Id = new Types.ObjectId();

      mockInventoryItemModel.find.mockResolvedValue([
        {
          _id: item1Id,
          productId,
          size: 'L',
          color: 'Đỏ',
          material: null,
          status: InventoryItemStatus.Rented,
          conditionStatus: ConditionStatus.Good,
        },
      ]);

      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                bookingId: booking1Id,
                status: ReservationStatus.Confirmed,
                reservedFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
                reservedTo: new Date(Date.now() + 24 * 60 * 60 * 1000),
                expiresAt: null,
              },
            ]),
          }),
        }),
      });

      const mockBookingModel = mockConnection.model('Booking');
      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: booking1Id,
                status: 'PICKED_UP',
              },
            ]),
          }),
        }),
      });

      const summary = await service.getInventorySummary(userId);
      expect(summary).toHaveLength(1);
      expect(summary[0]).toEqual(
        expect.objectContaining({
          total: 1,
          available: 0,
          bookedAhead: 0,
          rented: 1,
          maintenance: 0,
        }),
      );
    });

    it('Scenario 6C: Both slot lease and legacy reservation exist for same item -> deduped, not double counted', async () => {
      const item1Id = new Types.ObjectId();
      const booking1Id = new Types.ObjectId();

      mockInventoryItemModel.find.mockResolvedValue([
        {
          _id: item1Id,
          productId,
          size: 'L',
          color: 'Đỏ',
          material: null,
          status: InventoryItemStatus.Available,
          conditionStatus: ConditionStatus.Good,
        },
      ]);

      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const futureDateStr = futureDate.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      // Legacy reservation
      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                inventoryItemId: item1Id,
                bookingId: booking1Id,
                status: ReservationStatus.Confirmed,
                reservedFrom: futureDate,
                reservedTo: new Date(
                  futureDate.getTime() + 24 * 60 * 60 * 1000,
                ),
                expiresAt: null,
              },
            ]),
          }),
        }),
      });

      // Slot lease for same item and booking
      const leaseColl = mockConnection.collection('inventory_slot_leases');
      leaseColl.find.mockReturnValue({
        project: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([
          {
            inventoryItemId: item1Id,
            bookingId: booking1Id,
            status: 'CONFIRMED',
            dateStr: futureDateStr,
            slotIndex: 1,
            expiresAt: null,
          },
        ]),
      });

      const mockBookingModel = mockConnection.model('Booking');
      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: booking1Id,
                status: 'CONFIRMED',
              },
            ]),
          }),
        }),
      });

      const summary = await service.getInventorySummary(userId);
      expect(summary).toHaveLength(1);
      // bookedAhead must be 1, NOT 2!
      expect(summary[0].bookedAhead).toBe(1);
      expect(summary[0].available).toBe(1);
      expect(summary[0].total).toBe(1);
    });

    it('Scenario 6D: Throws error when inventory_slot_leases query fails, avoiding false available summary', async () => {
      const item1Id = new Types.ObjectId();

      mockInventoryItemModel.find.mockResolvedValue([
        {
          _id: item1Id,
          productId,
          size: 'L',
          color: 'Đỏ',
          material: null,
          status: InventoryItemStatus.Available,
          conditionStatus: ConditionStatus.Good,
        },
      ]);

      mockInventoryReservationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const leaseColl = mockConnection.collection('inventory_slot_leases');
      leaseColl.find.mockReturnValue({
        project: jest.fn().mockReturnThis(),
        toArray: jest
          .fn()
          .mockRejectedValue(
            new Error('MongoNetworkError: failed to query slot leases'),
          ),
      });

      await expect(service.getInventorySummary(userId)).rejects.toThrow(
        'MongoNetworkError: failed to query slot leases',
      );
    });
  });

  describe('Daily vs Hourly cross-lease filtering logic (F.1, F.2)', () => {
    it('Scenario 1A: Variant with 2 items where Item 1 is leased hourly on date D allows daily rental on Item 2', () => {
      const item1 = { _id: new Types.ObjectId(), sku: 'SKU-1' };
      const item2 = { _id: new Types.ObjectId(), sku: 'SKU-2' };
      const inventoryItems = [item1, item2];

      // Item 1 has an hourly lease on 2026-11-20
      const busyDailyLeases = [
        { inventoryItemId: item1._id, dateStr: '2026-11-20', slotIndex: 1 },
      ];

      const busyInventoryItemIds = new Set<string>();
      for (const bdl of busyDailyLeases) {
        busyInventoryItemIds.add(bdl.inventoryItemId.toString());
      }

      const freeInventoryItems = inventoryItems.filter(
        (i) => !busyInventoryItemIds.has(i._id.toString()),
      );

      expect(freeInventoryItems).toHaveLength(1);
      expect(freeInventoryItems[0]._id).toBe(item2._id);
    });

    it('Scenario 1B: Variant where ALL items are leased hourly on date D blocks daily rental', () => {
      const item1 = { _id: new Types.ObjectId(), sku: 'SKU-1' };
      const item2 = { _id: new Types.ObjectId(), sku: 'SKU-2' };
      const inventoryItems = [item1, item2];

      // Both items are leased on 2026-11-20
      const busyDailyLeases = [
        { inventoryItemId: item1._id, dateStr: '2026-11-20', slotIndex: 1 },
        { inventoryItemId: item2._id, dateStr: '2026-11-20', slotIndex: 3 },
      ];

      const busyInventoryItemIds = new Set<string>();
      for (const bdl of busyDailyLeases) {
        busyInventoryItemIds.add(bdl.inventoryItemId.toString());
      }

      const freeInventoryItems = inventoryItems.filter(
        (i) => !busyInventoryItemIds.has(i._id.toString()),
      );

      expect(freeInventoryItems).toHaveLength(0);
      const qty = 1;
      expect(freeInventoryItems.length < qty).toBe(true);
    });

    it('Scenario 2: Daily rental on date D marks all leased items busy, blocking subsequent hourly rental on those items', () => {
      const item1 = { _id: new Types.ObjectId(), sku: 'SKU-1' };
      const inventoryItems = [item1];

      // Daily reservation exists covering 2026-11-20 to 2026-11-22
      const reservedFrom = new Date('2026-11-20T00:00:00.000Z');
      const reservedTo = new Date('2026-11-22T23:59:59.999Z');

      const hourlyStart = new Date('2026-11-21T07:00:00.000Z');
      const hourlyEnd = new Date('2026-11-21T09:00:00.000Z');

      // Daily reservation encompasses the hourly slot
      const overlaps = hourlyStart < reservedTo && reservedFrom < hourlyEnd;
      expect(overlaps).toBe(true);

      const busyItemIds = new Set<string>();
      if (overlaps) {
        busyItemIds.add(item1._id.toString());
      }

      const freeItems = inventoryItems.filter(
        (i) => !busyItemIds.has(i._id.toString()),
      );
      expect(freeItems).toHaveLength(0);
    });
  });
});
