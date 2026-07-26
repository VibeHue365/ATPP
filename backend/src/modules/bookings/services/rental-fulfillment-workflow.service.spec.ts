import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RentalFulfillmentWorkflowService } from './rental-fulfillment-workflow.service';
import { RentalInventoryStatus } from '../schemas/rental-fulfillment.types';

const query = (value: unknown) => ({ lean: () => ({ exec: async () => value }) });

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
  const providerUser = { sub: providerUserId.toString(), roles: ['PROVIDER'] } as any;

  function setup(providerMatch = true) {
    const bookingModel = { findById: jest.fn(() => query(booking)) };
    const itemModel = { findOne: jest.fn(() => query(item)) };
    const providerModel = {
      findOne: jest.fn(() => query(providerMatch ? { _id: providerId } : null)),
    };
    const evidenceModel = { find: jest.fn(() => query([])), findOne: jest.fn(() => query(null)), create: jest.fn(), updateMany: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })) };
    const fulfillment = {
      markReady: jest.fn(async (input) => ({ ...input, status: 'READY_FOR_PICKUP' })),
      markPickedUp: jest.fn(),
      markReturned: jest.fn(),
      markCompleted: jest.fn(),
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
      ),
      fulfillment,
      evidenceModel,
    };
  }

  it('allows only the provider that owns this booking item to mark it ready', async () => {
    const { service, fulfillment } = setup(true);

    await service.markReady(bookingId.toString(), itemId.toString(), providerUser, 'Ready at shop');

    expect(fulfillment.markReady).toHaveBeenCalledWith(expect.objectContaining({
      itemId: itemId.toString(),
      actor: { id: providerUserId.toString(), role: 'PROVIDER' },
    }));
  });

  it('rejects a provider that does not own this booking item', async () => {
    const { service } = setup(false);
    const otherProviderUser = { sub: otherProviderUserId.toString(), roles: ['PROVIDER'] } as any;

    await expect(service.markReady(bookingId.toString(), itemId.toString(), otherProviderUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts evidence only when every private file belongs to the actor and item', async () => {
    const { service, evidenceModel } = setup(true);
    evidenceModel.find.mockReturnValue(query([{ fileId: 'owned-file' }]));

    await service.markPickedUp(bookingId.toString(), itemId.toString(), providerUser, { fileIds: ['owned-file'] });

    expect(evidenceModel.find).toHaveBeenCalledWith(expect.objectContaining({
      bookingId,
      bookingItemId: itemId,
      uploadedBy: providerUserId,
    }));
  });

  it('consumes pickup evidence so it cannot be reused for a later handover', async () => {
    const { service, evidenceModel } = setup(true);
    evidenceModel.find.mockReturnValue(query([{ fileId: 'owned-file' }]));

    await service.markPickedUp(bookingId.toString(), itemId.toString(), providerUser, { fileIds: ['owned-file'] });

    expect(evidenceModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: { $in: ['owned-file'] }, consumedAt: null }),
      expect.objectContaining({ $set: expect.objectContaining({ consumedFor: 'PICKUP' }) }),
    );
  });
  it('passes an allowed final inventory state only after authorization', async () => {
    const { service, fulfillment } = setup(true);

    await service.markCompleted(bookingId.toString(), itemId.toString(), providerUser, RentalInventoryStatus.Available);

    expect(fulfillment.markCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: itemId.toString() }),
      RentalInventoryStatus.Available,
    );
  });
});