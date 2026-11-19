import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RentalFulfillmentWorkflowService } from './rental-fulfillment-workflow.service';
import { RentalInventoryStatus } from '../schemas/rental-fulfillment.types';
import { ProductAvailabilityService } from '../../products/services/product-availability.service';
import { TimeSlotEngineService } from './time-slot-engine.service';

const query = (value: unknown) => ({
  select: () => query(value),
  lean: () => ({ exec: async () => value }),
  exec: async () => value,
});

describe('RentalFulfillmentWorkflowService', () => {
  const bookingId = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const providerUserId = new Types.ObjectId();
  const otherProviderUserId = new Types.ObjectId();
  const booking = { _id: bookingId, customerId, status: 'CONFIRMED' };
  const item = {
    _id: itemId,
    bookingId,
    providerId,
    itemType: 'PRODUCT',
    rentalFulfillment: { status: 'PENDING' },
  };
  const providerUser = {
    sub: providerUserId.toString(),
    roles: ['PROVIDER'],
  } as any;

  function setup(providerMatch = true) {
    const inventoryItemModel = {
      updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
      updateMany: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
      find: jest.fn(() =>
        query([
          {
            _id: new Types.ObjectId(),
            status: 'CLEANING',
            conditionStatus: 'GOOD',
          },
        ]),
      ),
    };
    const reservationModel = {
      find: jest.fn(() => query([{ inventoryItemId: new Types.ObjectId() }])),
      updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
    };
    const bookingModel = {
      findById: jest.fn(() => query(booking)),
    };
    const itemModel = {
      findOne: jest.fn(() => query(item)),
      findById: jest.fn(() => query(item)),
      updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
      find: jest.fn(() => query([item])),
      db: {
        model: jest.fn((name: string) => {
          if (name === 'InventoryItem') return inventoryItemModel;
          if (name === 'InventoryReservation') return reservationModel;
          return {};
        }),
      },
    };
    const providerModel = {
      findOne: jest.fn(() => query(providerMatch ? { _id: providerId } : null)),
    };
    const evidenceModel = {
      find: jest.fn(() => query([])),
      findOne: jest.fn(() => query(null)),
      create: jest.fn(),
      updateMany: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
    };
    const fulfillment = {
      markReady: jest.fn(async (input) => ({
        ...input,
        status: 'READY_FOR_PICKUP',
      })),
      submitPickupEvidence: jest.fn(),
      markReturned: jest.fn(async (input) => ({
        ...input,
        status: 'RETURNED',
      })),
      confirmNoIncident: jest.fn(async (input) => ({
        ...input,
        status: 'RETURNED',
      })),
      markCompleted: jest.fn(),
    };
    const slotLeaseService = {
      reconcileTurnaroundLeases: jest.fn().mockResolvedValue(undefined),
    };
    const timeEngineService = {
      calculateReturnAvailableFrom: jest
        .fn()
        .mockReturnValue(new Date('2026-11-20T10:00:00.000Z')),
    };

    return {
      service: new RentalFulfillmentWorkflowService(
        bookingModel as any,
        itemModel as any,
        providerModel as any,
        evidenceModel as any,
        fulfillment as any,
        { coordinate: jest.fn() } as any,
        { settleBooking: jest.fn() } as any,
        slotLeaseService as any,
        timeEngineService as any,
      ),
      fulfillment,
      evidenceModel,
      inventoryItemModel,
      reservationModel,
      itemModel,
      slotLeaseService,
      timeEngineService,
    };
  }

  it('allows only the provider that owns this booking item to mark it ready', async () => {
    const { service, fulfillment } = setup(true);

    await service.markReady(
      bookingId.toString(),
      itemId.toString(),
      providerUser,
      'Ready at shop',
    );

    expect(fulfillment.markReady).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: itemId.toString(),
        actor: { id: providerUserId.toString(), role: 'PROVIDER' },
      }),
    );
  });

  it('rejects a provider that does not own this booking item', async () => {
    const { service } = setup(false);
    const otherProviderUser = {
      sub: otherProviderUserId.toString(),
      roles: ['PROVIDER'],
    } as any;

    await expect(
      service.markReady(
        bookingId.toString(),
        itemId.toString(),
        otherProviderUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts evidence only when every private file belongs to the actor and item', async () => {
    const { service, evidenceModel } = setup(true);
    evidenceModel.find.mockReturnValue(query([{ fileId: 'owned-file' }]));

    await service.markPickedUp(
      bookingId.toString(),
      itemId.toString(),
      providerUser,
      { fileIds: ['owned-file'] },
    );

    expect(evidenceModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId,
        bookingItemId: itemId,
        uploadedBy: providerUserId,
      }),
    );
  });

  it('consumes pickup evidence so it cannot be reused for a later handover', async () => {
    const { service, evidenceModel } = setup(true);
    evidenceModel.find.mockReturnValue(query([{ fileId: 'owned-file' }]));

    await service.markPickedUp(
      bookingId.toString(),
      itemId.toString(),
      providerUser,
      { fileIds: ['owned-file'] },
    );

    expect(evidenceModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: { $in: ['owned-file'] },
        consumedAt: null,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ consumedFor: 'PICKUP' }),
      }),
    );
  });
  it('passes an allowed final inventory state only after authorization', async () => {
    const { service, fulfillment } = setup(true);

    await service.markCompleted(
      bookingId.toString(),
      itemId.toString(),
      providerUser,
      RentalInventoryStatus.Available,
    );

    expect(fulfillment.markCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: itemId.toString() }),
      RentalInventoryStatus.Available,
    );
  });

  describe('markReturned & markCleaningCompleted Guards and Turnaround Lifecycle', () => {
    it('markReturned does not set CLEANING, confirmNoIncident calculates availableFrom and sets status CLEANING with operationalAvailableFrom', async () => {
      const { service, inventoryItemModel, evidenceModel } = setup(true);
      evidenceModel.find.mockReturnValue(query([{ fileId: 'return-file' }]));

      await service.markReturned(
        bookingId.toString(),
        itemId.toString(),
        providerUser,
        { fileIds: ['return-file'], note: 'Khách trả đúng hẹn' },
      );

      expect(inventoryItemModel.updateOne).not.toHaveBeenCalled();

      await service.confirmNoIncident(
        bookingId.toString(),
        itemId.toString(),
        providerUser,
        'Đồ nguyên vẹn',
      );

      expect(inventoryItemModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $ne: 'MAINTENANCE' },
          conditionStatus: { $nin: ['LOCKED', 'RETIRED', 'MINOR_DAMAGE'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'CLEANING',
            operationalAvailableFrom: expect.any(Date),
            activeTurnaroundBookingItemId: itemId,
          }),
        }),
      );
    });

    it('markCleaningCompleted succeeds when item is CLEANING, updates to AVAILABLE, clears operationalAvailableFrom and reconciles leases', async () => {
      const { service, inventoryItemModel, itemModel, slotLeaseService } =
        setup(true);
      // Item fulfillment status is RETURNED
      itemModel.findOne.mockReturnValue(
        query({
          ...item,
          rentalFulfillment: { status: 'RETURNED' },
        }),
      );

      const res = await service.markCleaningCompleted(
        bookingId.toString(),
        itemId.toString(),
        providerUser,
        'Đã giặt xong sớm',
      );

      expect(res.message).toContain('thành công');
      expect(inventoryItemModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CLEANING',
          conditionStatus: { $nin: ['RETIRED', 'LOCKED', 'MINOR_DAMAGE'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'AVAILABLE',
            operationalAvailableFrom: null,
            activeTurnaroundBookingItemId: null,
          }),
        }),
      );
      expect(slotLeaseService.reconcileTurnaroundLeases).toHaveBeenCalledWith(
        itemId,
        expect.any(Date),
      );
      expect(itemModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: itemId }),
        expect.objectContaining({
          $push: expect.objectContaining({
            'rentalFulfillment.history': expect.objectContaining({
              action: 'CLEANING_COMPLETED',
            }),
          }),
        }),
      );
    });

    it('markCleaningCompleted rejects with ConflictException if repeated call (modifiedCount === 0), no duplicate history', async () => {
      const { service, inventoryItemModel, itemModel, slotLeaseService } =
        setup(true);
      itemModel.findOne.mockReturnValue(
        query({
          ...item,
          rentalFulfillment: { status: 'RETURNED' },
        }),
      );
      // Simulate modifiedCount 0 (already marked AVAILABLE previously)
      inventoryItemModel.updateMany.mockReturnValue({
        exec: async () => ({ modifiedCount: 0 }),
      });

      await expect(
        service.markCleaningCompleted(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
        ),
      ).rejects.toThrow(ConflictException);

      expect(slotLeaseService.reconcileTurnaroundLeases).not.toHaveBeenCalled();
      expect(itemModel.updateOne).not.toHaveBeenCalled();
    });

    it('markCleaningCompleted rejects with ConflictException if item is MAINTENANCE or RETIRED, zero lease release', async () => {
      const { service, inventoryItemModel, itemModel, slotLeaseService } =
        setup(true);
      itemModel.findOne.mockReturnValue(
        query({
          ...item,
          rentalFulfillment: { status: 'RETURNED' },
        }),
      );
      // Item is currently in MAINTENANCE
      inventoryItemModel.find.mockReturnValue(
        query([
          {
            _id: new Types.ObjectId(),
            status: 'MAINTENANCE',
            conditionStatus: 'GOOD',
          },
        ]),
      );

      await expect(
        service.markCleaningCompleted(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
        ),
      ).rejects.toThrow(ConflictException);

      expect(inventoryItemModel.updateMany).not.toHaveBeenCalled();
      expect(slotLeaseService.reconcileTurnaroundLeases).not.toHaveBeenCalled();
    });

    describe('Transition-level Returned status guards (Requirement 2)', () => {
      it('AVAILABLE + GOOD -> Returned -> CLEANING có operationalAvailableFrom', async () => {
        const { service, inventoryItemModel, reservationModel, evidenceModel } =
          setup(true);
        evidenceModel.find.mockReturnValue(
          query([{ fileId: 'return-file-1' }]),
        );

        const goodItemId = new Types.ObjectId();
        reservationModel.find.mockReturnValue(
          query([{ inventoryItemId: goodItemId }]),
        );

        const storedItem: any = {
          _id: goodItemId,
          status: 'AVAILABLE',
          conditionStatus: 'GOOD',
          operationalAvailableFrom: null,
          activeTurnaroundBookingItemId: null,
        };

        inventoryItemModel.updateOne.mockImplementation(
          (filter: any, update: any) => {
            const statusOk =
              !filter.status?.$ne || storedItem.status !== filter.status.$ne;
            const conditionOk =
              !filter.conditionStatus?.$nin ||
              !filter.conditionStatus.$nin.includes(storedItem.conditionStatus);
            const match =
              filter._id.toString() === storedItem._id.toString() &&
              statusOk &&
              conditionOk;
            if (match) {
              Object.assign(storedItem, update.$set);
              return { exec: async () => ({ modifiedCount: 1 }) };
            }
            return { exec: async () => ({ modifiedCount: 0 }) };
          },
        );

        await service.markReturned(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
          { fileIds: ['return-file-1'], note: 'Trang phục bình thường' },
        );

        expect(storedItem.status).toBe('AVAILABLE');

        await service.confirmNoIncident(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
          'Xác nhận không sự cố',
        );

        expect(storedItem.status).toBe('CLEANING');
        expect(storedItem.operationalAvailableFrom).toBeInstanceOf(Date);
        expect(storedItem.activeTurnaroundBookingItemId).toEqual(itemId);
      });

      it('MAINTENANCE + MINOR_DAMAGE -> Returned -> vẫn MAINTENANCE, không thay operationalAvailableFrom', async () => {
        const { service, inventoryItemModel, reservationModel, evidenceModel } =
          setup(true);
        evidenceModel.find.mockReturnValue(
          query([{ fileId: 'return-file-2' }]),
        );

        const damagedItemId = new Types.ObjectId();
        reservationModel.find.mockReturnValue(
          query([{ inventoryItemId: damagedItemId }]),
        );

        const storedItem: any = {
          _id: damagedItemId,
          status: 'MAINTENANCE',
          conditionStatus: 'MINOR_DAMAGE',
          operationalAvailableFrom: null,
          activeTurnaroundBookingItemId: null,
        };

        inventoryItemModel.updateOne.mockImplementation(
          (filter: any, update: any) => {
            const statusOk =
              !filter.status?.$ne || storedItem.status !== filter.status.$ne;
            const conditionOk =
              !filter.conditionStatus?.$nin ||
              !filter.conditionStatus.$nin.includes(storedItem.conditionStatus);
            const match =
              filter._id.toString() === storedItem._id.toString() &&
              statusOk &&
              conditionOk;
            if (match) {
              Object.assign(storedItem, update.$set);
              return { exec: async () => ({ modifiedCount: 1 }) };
            }
            return { exec: async () => ({ modifiedCount: 0 }) };
          },
        );

        await service.markReturned(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
          { fileIds: ['return-file-2'], note: 'Trang phục bị rách nhỏ' },
        );

        await service.confirmNoIncident(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
          'Xác nhận',
        );

        // Guard must prevent update!
        expect(storedItem.status).toBe('MAINTENANCE');
        expect(storedItem.conditionStatus).toBe('MINOR_DAMAGE');
        expect(storedItem.operationalAvailableFrom).toBeNull();
        expect(storedItem.activeTurnaroundBookingItemId).toBeNull();
      });

      it('LOCKED / RETIRED -> Returned -> không thay đổi', async () => {
        const { service, inventoryItemModel, reservationModel, evidenceModel } =
          setup(true);
        evidenceModel.find.mockReturnValue(
          query([{ fileId: 'return-file-3' }]),
        );

        const lockedItemId = new Types.ObjectId();
        const retiredItemId = new Types.ObjectId();
        reservationModel.find.mockReturnValue(
          query([
            { inventoryItemId: lockedItemId },
            { inventoryItemId: retiredItemId },
          ]),
        );

        const storedItems: any[] = [
          {
            _id: lockedItemId,
            status: 'AVAILABLE',
            conditionStatus: 'LOCKED',
            operationalAvailableFrom: null,
          },
          {
            _id: retiredItemId,
            status: 'AVAILABLE',
            conditionStatus: 'RETIRED',
            operationalAvailableFrom: null,
          },
        ];

        inventoryItemModel.updateOne.mockImplementation(
          (filter: any, update: any) => {
            const item = storedItems.find(
              (it) => it._id.toString() === filter._id.toString(),
            );
            if (!item) return { exec: async () => ({ modifiedCount: 0 }) };
            const statusOk =
              !filter.status?.$ne || item.status !== filter.status.$ne;
            const conditionOk =
              !filter.conditionStatus?.$nin ||
              !filter.conditionStatus.$nin.includes(item.conditionStatus);
            if (statusOk && conditionOk) {
              Object.assign(item, update.$set);
              return { exec: async () => ({ modifiedCount: 1 }) };
            }
            return { exec: async () => ({ modifiedCount: 0 }) };
          },
        );

        await service.markReturned(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
          { fileIds: ['return-file-3'] },
        );

        await service.confirmNoIncident(
          bookingId.toString(),
          itemId.toString(),
          providerUser,
        );

        expect(storedItems[0].conditionStatus).toBe('LOCKED');
        expect(storedItems[0].status).toBe('AVAILABLE');
        expect(storedItems[0].operationalAvailableFrom).toBeNull();

        expect(storedItems[1].conditionStatus).toBe('RETIRED');
        expect(storedItems[1].status).toBe('AVAILABLE');
        expect(storedItems[1].operationalAvailableFrom).toBeNull();
      });

      it('Sau thời gian turnaround, đồ hư hỏng/bảo trì vẫn unavailable', async () => {
        const damagedItem = {
          _id: new Types.ObjectId(),
          status: 'MAINTENANCE',
          conditionStatus: 'MINOR_DAMAGE',
          operationalAvailableFrom: null,
        };

        const timeEngine = new TimeSlotEngineService();
        const mockAvailability = {
          find: jest.fn().mockImplementation((query: any) => {
            const excludedByCondition = query.conditionStatus?.$nin?.includes(
              damagedItem.conditionStatus,
            );
            if (excludedByCondition) return { exec: async () => [] };
            const matchesStatus = query.$or?.some((cond: any) => {
              if (cond.status === damagedItem.status) return true;
              return false;
            });
            return { exec: async () => (matchesStatus ? [damagedItem] : []) };
          }),
        };

        const testProductId = new Types.ObjectId();
        const prodAvailService = new ProductAvailabilityService(
          {
            findPublicById: jest
              .fn()
              .mockResolvedValue({ _id: testProductId, providerId }),
          } as any,
          mockAvailability as any,
          {
            find: jest.fn().mockReturnValue({
              select: () => ({ lean: () => ({ exec: async () => [] }) }),
            }),
          } as any,
          {
            find: jest
              .fn()
              .mockReturnValue({ lean: () => ({ exec: async () => [] }) }),
          } as any,
          {
            findById: jest.fn().mockReturnValue({
              select: () => ({
                lean: () => ({
                  exec: async () => ({
                    _id: providerId,
                    useSlotLeases: false,
                  }),
                }),
              }),
            }),
          } as any,
          {
            find: jest.fn().mockReturnValue({
              select: () => ({ lean: () => ({ exec: async () => [] }) }),
            }),
          } as any,
          timeEngine,
        );

        const checkResult = await prodAvailService.check(
          testProductId.toString(),
          'M',
          'RED',
          '2026-11-25',
          '2026-11-25',
          1,
          'HOURLY',
          '11:00',
          '13:00',
        );

        expect(checkResult.available).toBe(false);
        expect(checkResult.availableQuantity).toBe(0);
      });
    });
  });
});
