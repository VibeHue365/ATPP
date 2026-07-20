import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RentalFulfillmentService } from './rental-fulfillment.service';
import {
  DepositSettlementStatus,
  RentalIssueStatus,
  RentalFulfillmentStatus,
  RentalInventoryStatus,
} from '../schemas/rental-fulfillment.types';

describe('RentalFulfillmentService', () => {
  const itemId = new Types.ObjectId().toString();
  const actor = { id: new Types.ObjectId().toString(), role: 'PROVIDER' as const };

  function createService(result: unknown = { _id: itemId }) {
    const exec = jest.fn().mockResolvedValue(result);
    const bookingItemModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec }),
      }),
    };
    return { service: new RentalFulfillmentService(bookingItemModel as any), bookingItemModel };
  }

  it('atomically marks a reserved item ready for pickup and appends history', async () => {
    const { service, bookingItemModel } = createService();

    await service.markReady({ itemId, actor, note: 'Đã chuẩn bị xong' });

    expect(bookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: 'PRODUCT',
        'rentalFulfillment.status': RentalFulfillmentStatus.Pending,
        'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Reserved,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ 'rentalFulfillment.status': RentalFulfillmentStatus.ReadyForPickup }),
        $push: expect.objectContaining({ 'rentalFulfillment.history': expect.objectContaining({ action: 'MARKED_READY' }) }),
      }),
      { new: true },
    );
  });

  it('requires pickup evidence before marking an item picked up', async () => {
    const { service, bookingItemModel } = createService();

    await expect(service.markPickedUp({ itemId, actor })).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingItemModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns conflict when an atomic transition no longer matches the current state', async () => {
    const { service } = createService(null);
    const evidence = { files: [{ fileId: 'evidence-1', type: 'IMAGE' as const, uploadedAt: new Date(), uploadedBy: actor }] };

    await expect(service.markPickedUp({ itemId, actor, evidence })).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a provider proposal only after return and within the item deposit', async () => {
    const { service, bookingItemModel } = createService();

    await service.proposeCharge({ itemId, actor, chargeType: 'damageFee', amount: 100_000, reason: 'Rách tay áo' });

    expect(bookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
        'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement,
        depositAmount: { $gte: 100_000 },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ 'rentalFulfillment.issueStatus': RentalIssueStatus.Reported }),
      }),
      { new: true },
    );
  });

  it('settles a deposit only up to the Admin-approved charges', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: itemId });
    const current = {
      _id: itemId,
      depositAmount: 300_000,
      rentalFulfillment: {
        status: RentalFulfillmentStatus.Returned,
        charges: { damageFee: { amount: 120_000, status: 'APPROVED' } },
      },
    };
    const bookingItemModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(current) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec }) }),
    };
    const service = new RentalFulfillmentService(bookingItemModel as any);

    await service.settleDeposit({ itemId, actor: { ...actor, role: 'ADMIN' }, deductAmount: 120_000, inventoryStatus: RentalInventoryStatus.Maintenance });

    expect(bookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement }),
      expect.objectContaining({
        $set: expect.objectContaining({ 'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PartiallyDeducted }),
      }),
      { new: true },
    );
    await expect(service.settleDeposit({ itemId, actor: { ...actor, role: 'ADMIN' }, deductAmount: 120_001, inventoryStatus: RentalInventoryStatus.Maintenance })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires resolved issues, a settled deposit and final inventory before completion', async () => {
    const { service, bookingItemModel } = createService();

    await service.markCompleted({ itemId, actor }, RentalInventoryStatus.Available);

    expect(bookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
        'rentalFulfillment.issueStatus': expect.objectContaining({ $in: expect.any(Array) }),
        'rentalFulfillment.depositSettlementStatus': expect.objectContaining({ $in: [
          DepositSettlementStatus.FullyReleased,
          DepositSettlementStatus.PartiallyDeducted,
          DepositSettlementStatus.FullyDeducted,
        ] }),
      }),
      expect.anything(),
      { new: true },
    );
  });
});