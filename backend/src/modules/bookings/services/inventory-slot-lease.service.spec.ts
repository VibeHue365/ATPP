import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InventorySlotLeaseService } from './inventory-slot-lease.service';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { SlotLeasePurpose, SlotLeaseStatus } from '../schemas/inventory-slot-lease.schema';

describe('InventorySlotLeaseService', () => {
  let service: InventorySlotLeaseService;
  let timeEngine: TimeSlotEngineService;
  let mockLeaseModel: any;

  beforeEach(() => {
    timeEngine = new TimeSlotEngineService();
    mockLeaseModel = {
      insertMany: jest.fn(),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    service = new InventorySlotLeaseService(mockLeaseModel as any, timeEngine);
  });

  describe('isSlotConflictError', () => {
    it('returns true for E11000 on slot lease unique key', () => {
      const err = {
        code: 11000,
        keyPattern: { inventoryItemId: 1, dateStr: 1, slotIndex: 1 },
        message: 'E11000 duplicate key error collection: inventory_slot_leases index: inventory_slot_leases_item_date_slot_unique',
      };
      expect(service.isSlotConflictError(err)).toBe(true);
    });

    it('returns false for duplicate key on different collection or field', () => {
      const err = {
        code: 11000,
        keyPattern: { sku: 1 },
        message: 'E11000 duplicate key error on sku',
      };
      expect(service.isSlotConflictError(err)).toBe(false);
    });

    it('returns false for non-11000 error', () => {
      expect(service.isSlotConflictError(new Error('Generic database error'))).toBe(false);
    });
  });

  describe('acquireUpfrontBlockLease', () => {
    const input = {
      inventoryItemId: new Types.ObjectId(),
      providerId: new Types.ObjectId(),
      bookingId: new Types.ObjectId(),
      bookingItemId: new Types.ObjectId(),
      rentalSlots: [{ dateStr: '2026-11-16', slotIndex: 1 }],
      turnaroundSlots: [{ dateStr: '2026-11-16', slotIndex: 2 }],
      status: SlotLeaseStatus.Temp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    it('inserts RENTAL and TURNAROUND leases atomically', async () => {
      mockLeaseModel.insertMany.mockResolvedValue([
        { _id: new Types.ObjectId(), purpose: SlotLeasePurpose.Rental },
        { _id: new Types.ObjectId(), purpose: SlotLeasePurpose.Turnaround },
      ]);

      const result = await service.acquireUpfrontBlockLease(input);
      expect(result).toHaveLength(2);
      expect(mockLeaseModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ slotIndex: 1, purpose: SlotLeasePurpose.Rental }),
          expect.objectContaining({ slotIndex: 2, purpose: SlotLeasePurpose.Turnaround }),
        ]),
        { session: undefined },
      );
    });

    it('translates E11000 slot conflict into HTTP 409 ConflictException', async () => {
      const duplicateErr = {
        code: 11000,
        keyPattern: { inventoryItemId: 1, dateStr: 1, slotIndex: 1 },
        message: 'E11000 duplicate key error on inventory_slot_leases',
      };
      mockLeaseModel.insertMany.mockRejectedValue(duplicateErr);

      await expect(service.acquireUpfrontBlockLease(input)).rejects.toThrow(ConflictException);
    });
  });

  describe('reconcileTurnaroundLeases', () => {
    it('releases TURNAROUND lease when leaseStart >= availableFrom', async () => {
      const bookingItemId = new Types.ObjectId();
      // Suppose slot 2 is 09:00-11:00, slot 3 is 11:00-13:00 on 2026-11-16.
      // availableFrom is 11:00.
      // Slot 3 has start = 11:00, which is >= availableFrom (11:00) -> should be released!
      const availableFrom = timeEngine.makeVnDate(2026, 11, 16, 11, 0);

      const lease3Id = new Types.ObjectId();
      mockLeaseModel.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { _id: lease3Id, dateStr: '2026-11-16', slotIndex: 3, purpose: SlotLeasePurpose.Turnaround },
          ]),
        }),
      });

      const releasedCount = await service.reconcileTurnaroundLeases(bookingItemId, availableFrom);
      expect(releasedCount).toBe(1);
      expect(mockLeaseModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [lease3Id] } },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: SlotLeaseStatus.Released,
            releaseReason: 'RETURN_RESTRUCTURED',
          }),
        }),
        { session: undefined },
      );
    });
  });
});
