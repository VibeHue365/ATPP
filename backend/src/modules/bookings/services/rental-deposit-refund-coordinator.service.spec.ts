import { Types } from 'mongoose';
import { RentalDepositRefundCoordinatorService } from './rental-deposit-refund-coordinator.service';

const query = (value: unknown) => ({ lean: () => ({ exec: async () => value }) });

describe('RentalDepositRefundCoordinatorService', () => {
  const bookingId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  function setup(items: any[]) {
    const bookingModel = {
      findById: jest.fn(() => query({ _id: bookingId, customerId, rentalDepositRefund: { status: 'PENDING' } })),
      updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
    };
    const itemModel = { find: jest.fn(() => query(items)) };
    const refunds = { createFromRentalSettlement: jest.fn(async () => ({ _id: new Types.ObjectId(), status: 'COMPLETED' })) };
    return { service: new RentalDepositRefundCoordinatorService(bookingModel as any, itemModel as any, refunds as any), refunds, bookingModel };
  }

  it('does not create a refund until every physical rental unit has a final deposit decision', async () => {
    const { service, refunds } = setup([{ rentalFulfillment: { depositSettlementStatus: 'PENDING_SETTLEMENT', depositRefundAmount: 100_000 } }]);

    const result = await service.coordinate(bookingId.toString());

    expect(result).toEqual({ status: 'PENDING' });
    expect(refunds.createFromRentalSettlement).not.toHaveBeenCalled();
  });

  it('creates one idempotent booking-level refund for the sum of finalized item refunds', async () => {
    const { service, refunds, bookingModel } = setup([
      { rentalFulfillment: { depositSettlementStatus: 'FULLY_RELEASED', depositRefundAmount: 100_000 } },
      { rentalFulfillment: { depositSettlementStatus: 'PARTIALLY_DEDUCTED', depositRefundAmount: 40_000 } },
    ]);

    const result = await service.coordinate(bookingId.toString());

    expect(result).toEqual(expect.objectContaining({ status: 'REFUNDED', amount: 140_000 }));
    expect(refunds.createFromRentalSettlement).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: bookingId.toString(),
      requestedBy: customerId.toString(),
      amount: 140_000,
      sourceEventId: `rental-deposit-refund:${bookingId.toString()}:v1`,
    }));
    expect(bookingModel.updateOne).toHaveBeenCalled();
  });
});