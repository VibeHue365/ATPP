import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RefundWorkflowService } from './refund-workflow.service';
import { RefundStatus, RefundType } from '../schemas/refund-request.schema';

describe('RefundWorkflowService financial safety', () => {
  const bookingId = new Types.ObjectId().toString();
  const customerId = new Types.ObjectId().toString();

  function paymentChain(payments: any[]) {
    return { sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(payments) }) };
  }

  function createService(overrides: Record<string, any> = {}) {
    const refundModel = { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn(), ...overrides.refundModel };
    const attemptModel = { countDocuments: jest.fn().mockResolvedValue(0), create: jest.fn(), updateOne: jest.fn(), ...overrides.attemptModel };
    const paymentModel = { find: jest.fn(), updateOne: jest.fn(), findOneAndUpdate: jest.fn(), ...overrides.paymentModel };
    const bookingModel = { findOne: jest.fn(), updateOne: jest.fn(), ...overrides.bookingModel };
    const settlementModel = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }), updateOne: jest.fn(), ...overrides.settlementModel };
    const adjustmentModel = { updateOne: jest.fn(), ...overrides.adjustmentModel };
    const policyResolver = {
      getRefundPolicy: jest.fn().mockResolvedValue({
        autoApproveFreeCancelRefund: true,
        manualReviewThresholdAmount: 1000000,
        refundProcessingMode: 'SIMULATED',
      }),
      ...overrides.policyResolver,
    };
    return { service: new RefundWorkflowService(refundModel as any, attemptModel as any, paymentModel as any, bookingModel as any, settlementModel as any, adjustmentModel as any, policyResolver as any), refundModel, paymentModel, policyResolver };
  }

  it('allocates one refund across multiple successful payments', async () => {
    const first = new Types.ObjectId();
    const second = new Types.ObjectId();
    const { service, paymentModel } = createService();
    paymentModel.find.mockReturnValue(paymentChain([{ _id: first, amount: 500000, refundedAmount: 0, refundReservedAmount: 0 }, { _id: second, amount: 400000, refundedAmount: 0, refundReservedAmount: 0 }]));
    await expect((service as any).buildAllocations(bookingId, 700000)).resolves.toEqual([{ paymentId: first, amount: 500000 }, { paymentId: second, amount: 200000 }]);
  });

  it('rejects a refund that exceeds all payment balances', async () => {
    const { service, paymentModel } = createService();
    paymentModel.find.mockReturnValue(paymentChain([{ _id: new Types.ObjectId(), amount: 500000, refundedAmount: 0, refundReservedAmount: 0 }]));
    await expect((service as any).buildAllocations(bookingId, 600000)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deduplicates cancellation events by sourceEventId', async () => {
    const existing = { _id: new Types.ObjectId(), status: RefundStatus.Completed };
    const { service, refundModel } = createService();
    refundModel.findOne.mockResolvedValue(existing);
    const result = await service.createFromCancellation({ bookingId, requestedBy: customerId, amount: 100000, reason: 'Cancelled', type: RefundType.Cancellation, sourceEventId: `refund:cancellation:${bookingId}`, isFreeCancel: true });
    expect(result).toBe(existing);
    expect(refundModel.create).not.toHaveBeenCalled();
  });

  it('keeps a high-value cancellation refund pending for manual review', async () => {
    const created = { _id: new Types.ObjectId(), status: RefundStatus.Pending };
    const { service, refundModel, paymentModel } = createService({
      policyResolver: {
        getRefundPolicy: jest.fn().mockResolvedValue({
          autoApproveFreeCancelRefund: true,
          manualReviewThresholdAmount: 1000000,
          refundProcessingMode: 'MANUAL',
        }),
      },
    });
    refundModel.findOne.mockResolvedValue(null);
    refundModel.create.mockResolvedValue(created);
    paymentModel.find.mockReturnValue(paymentChain([{ _id: new Types.ObjectId(), amount: 2000000, refundedAmount: 0, refundReservedAmount: 0 }]));

    const result = await service.createFromCancellation({ bookingId, requestedBy: customerId, amount: 1500000, reason: 'Cancelled', type: RefundType.Cancellation, sourceEventId: `refund:cancellation:high:${bookingId}`, isFreeCancel: true });

    expect(result).toBe(created);
    expect(refundModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(refundModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'MANUAL' }),
    );
  });

  it('returns a conflict when another admin already approved the request', async () => {
    const { service, refundModel } = createService();
    refundModel.findOne.mockResolvedValue(null);
    await expect(service.approve(new Types.ObjectId().toString(), customerId, 100000, 0)).rejects.toBeInstanceOf(ConflictException);
  });

  it('retries only a failed request and creates the next processing attempt', async () => {
    const refundId = new Types.ObjectId();
    const failed = { _id: refundId, status: RefundStatus.Failed, version: 2 };
    const approved = { _id: refundId, status: RefundStatus.Approved, version: 3 };
    const { service, refundModel } = createService();
    refundModel.findOne.mockResolvedValue(failed);
    refundModel.findOneAndUpdate.mockResolvedValue(approved);
    const process = jest.spyOn(service, 'process').mockResolvedValue({ status: RefundStatus.Completed } as any);
    await service.retry(refundId.toString(), customerId, 2);
    expect(process).toHaveBeenCalledWith(refundId.toString(), customerId, 3, undefined, undefined);
  });
});
