import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingStatus, PaymentStatus as BookingPaymentStatus } from '../../bookings/schemas/booking.schema';
import { Payment, PaymentStatus } from '../schemas/payment.schema';
import { RefundAttempt, RefundAttemptStatus } from '../schemas/refund-attempt.schema';
import { RefundMode, RefundRequest, RefundStatus, RefundType } from '../schemas/refund-request.schema';
import { Settlement } from '../../settlements/schemas/settlement.schema';
import { SettlementStatus } from '../../settlements/constants/settlement-status.enum';
import { SettlementAdjustment } from '../../settlements/schemas/settlement-adjustment.schema';
import { PolicyResolverService } from '../../system-policies/services/policy-resolver.service';

interface CreateSystemRefundInput {
  bookingId: string;
  requestedBy: string;
  amount: number;
  reason: string;
  type: RefundType;
  sourceEventId: string;
  autoApprove?: boolean;
  isFreeCancel?: boolean;
}

@Injectable()
export class RefundWorkflowService {
  constructor(
    @InjectModel(RefundRequest.name) private readonly refundModel: Model<RefundRequest>,
    @InjectModel(RefundAttempt.name) private readonly attemptModel: Model<RefundAttempt>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Settlement.name) private readonly settlementModel: Model<Settlement>,
    @InjectModel(SettlementAdjustment.name) private readonly adjustmentModel: Model<SettlementAdjustment>,
    private readonly policyResolverService: PolicyResolverService,
  ) {}

  async createCustomerRequest(bookingId: string, customerId: string, amount: number, reason: string, idempotencyKey: string) {
    const booking = await this.findOwnedBooking(bookingId, customerId);
    if (booking.status === BookingStatus.Cancelled || booking.status === BookingStatus.Disputed) {
      throw new BadRequestException('Booking is not eligible for a customer refund request');
    }
    return this.createRequest({ bookingId, requestedBy: customerId, amount, reason, type: RefundType.CustomerRequest, sourceEventId: `refund:request:${customerId}:${bookingId}:${idempotencyKey}` });
  }

  async getEligibility(bookingId: string, customerId: string) {
    const booking = await this.findOwnedBooking(bookingId, customerId);
    if ([BookingStatus.Cancelled, BookingStatus.Disputed].includes(booking.status)) {
      return { eligible: false, reason: 'Đơn hàng đang được xử lý bởi luồng hủy hoặc tranh chấp.' };
    }
    const payments = await this.paymentModel.find({ bookingId: booking._id, status: PaymentStatus.Success }).lean();
    const capturedAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const completedRefundAmount = payments.reduce((sum, payment) => sum + (payment.refundedAmount || 0), 0);
    const reservedRefundAmount = payments.reduce((sum, payment) => sum + (payment.refundReservedAmount || 0), 0);
    const maximumRefundableAmount = Math.max(capturedAmount - completedRefundAmount - reservedRefundAmount, 0);
    const policy = await this.policyResolverService.getRefundPolicy();
    return { eligible: maximumRefundableAmount > 0, reason: maximumRefundableAmount > 0 ? null : 'Không còn số tiền có thể hoàn.', capturedAmount, completedRefundAmount, reservedRefundAmount, maximumRefundableAmount, estimatedRefundAmount: maximumRefundableAmount, policy: { manualReviewThresholdAmount: policy.manualReviewThresholdAmount, refundProcessingMode: policy.refundProcessingMode } };
  }

  async createFromCancellation(input: CreateSystemRefundInput) {
    const policy = await this.policyResolverService.getRefundPolicy();
    const belowManualReviewThreshold = input.amount <= policy.manualReviewThresholdAmount;
    return this.createRequest({
      ...input,
      type: RefundType.Cancellation,
      autoApprove: input.autoApprove
        ?? Boolean(input.isFreeCancel && policy.autoApproveFreeCancelRefund && belowManualReviewThreshold),
    });
  }

  async createFromDispute(input: CreateSystemRefundInput) {
    return this.createRequest({ ...input, type: RefundType.Dispute, autoApprove: input.autoApprove ?? true });
  }

  async listMine(userId: string) {
    return this.refundModel.find({ requestedBy: this.id(userId) }).sort({ createdAt: -1 }).lean();
  }

  async listAdmin(status?: RefundStatus) {
    return this.refundModel.find(status ? { status } : {}).sort({ createdAt: -1 }).populate('bookingId', 'bookingCode customerId').populate('requestedBy', 'fullName email').lean();
  }

  async getMine(refundId: string, userId: string) {
    const refund = await this.refundModel.findOne({ _id: this.id(refundId), requestedBy: this.id(userId) }).lean();
    if (!refund) throw new NotFoundException('Refund request not found');
    return refund;
  }

  async approve(refundId: string, adminId: string, amount: number, expectedVersion: number, reason?: string) {
    const refund = await this.refundModel.findOne({ _id: this.id(refundId), status: RefundStatus.Pending, version: expectedVersion });
    if (!refund) throw new ConflictException('REFUND_STATE_CHANGED');
    const allocations = await this.buildAllocations(refund.bookingId.toString(), amount);
    const reserved = await this.reserveAllocations(allocations);
    if (!reserved) throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_AVAILABLE_BALANCE');
    const updated = await this.refundModel.findOneAndUpdate(
      { _id: refund._id, status: RefundStatus.Pending, version: expectedVersion },
      { $set: { status: RefundStatus.Approved, approvedAmount: amount, reservedAmount: amount, allocations, paymentId: allocations[0]?.paymentId ?? null, adminNotes: reason ?? null, decidedBy: this.id(adminId), decidedAt: new Date() }, $inc: { version: 1 } },
      { new: true },
    );
    if (!updated) {
      await this.releaseAllocations(allocations);
      throw new ConflictException('REFUND_STATE_CHANGED');
    }
    return updated;
  }

  async reject(refundId: string, adminId: string, expectedVersion: number, reason: string) {
    return this.transition(refundId, RefundStatus.Pending, RefundStatus.Rejected, expectedVersion, { adminNotes: reason, decidedBy: this.id(adminId), decidedAt: new Date() });
  }

  async process(refundId: string, adminId: string, expectedVersion: number, mode?: RefundMode, reference?: string) {
    const policy = await this.policyResolverService.getRefundPolicy();
    const processingMode = mode ?? policy.refundProcessingMode as RefundMode;
    const refund = await this.transition(refundId, RefundStatus.Approved, RefundStatus.Processing, expectedVersion, { mode: processingMode });
    const attemptNo = await this.attemptModel.countDocuments({ refundRequestId: refund._id }) + 1;
    const attempt = await this.attemptModel.create({ refundRequestId: refund._id, attemptNo, idempotencyKey: `refund:process:${refund._id}:${attemptNo}`, mode: refund.mode, amount: refund.approvedAmount, status: RefundAttemptStatus.Initiated, reference: reference ?? null });
    if (refund.mode === RefundMode.Gateway) {
      await this.attemptModel.updateOne({ _id: attempt._id }, { $set: { status: RefundAttemptStatus.Failed, failureReason: 'Gateway processor is not enabled for this MVP' } });
      return this.fail(refund, 'Gateway processor is not enabled for this MVP');
    }
    if (refund.mode === RefundMode.Manual && !reference) {
      await this.attemptModel.updateOne({ _id: attempt._id }, { $set: { status: RefundAttemptStatus.Failed, failureReason: 'Manual refund requires a transaction reference' } });
      return this.fail(refund, 'Manual refund requires a transaction reference');
    }
    await this.attemptModel.updateOne({ _id: attempt._id }, { $set: { status: RefundAttemptStatus.Succeeded } });
    return this.complete(refund);
  }

  async retry(refundId: string, adminId: string, expectedVersion: number, mode?: RefundMode, reference?: string) {
    const refund = await this.refundModel.findOne({ _id: this.id(refundId), status: RefundStatus.Failed, version: expectedVersion });
    if (!refund) throw new ConflictException('REFUND_STATE_CHANGED');
    const updated = await this.refundModel.findOneAndUpdate({ _id: refund._id, status: RefundStatus.Failed, version: expectedVersion }, { $set: { status: RefundStatus.Approved, failureReason: null, decidedBy: this.id(adminId) }, $inc: { version: 1 } }, { new: true });
    if (!updated) throw new ConflictException('REFUND_STATE_CHANGED');
    return this.process(updated._id.toString(), adminId, updated.version, mode, reference);
  }

  private async createRequest(input: CreateSystemRefundInput) {
    if (input.amount <= 0) throw new BadRequestException('REFUND_AMOUNT_INVALID');
    const existing = await this.refundModel.findOne({ sourceEventId: input.sourceEventId });
    if (existing) return existing;
    await this.buildAllocations(input.bookingId, input.amount);
    const policy = await this.policyResolverService.getRefundPolicy();
    const created = await this.refundModel.create({ code: `RF-${Date.now()}-${Math.floor(Math.random() * 1000)}`, bookingId: this.id(input.bookingId), requestedBy: this.id(input.requestedBy), type: input.type, sourceEventId: input.sourceEventId, mode: policy.refundProcessingMode as RefundMode, amount: input.amount, reason: input.reason, approvedAmount: 0, processedAmount: 0, reservedAmount: 0, allocations: [] });
    if (!input.autoApprove) return created;
    const approved = await this.approve(created._id.toString(), input.requestedBy, input.amount, 0, 'Automatically approved by workflow');
    if (policy.refundProcessingMode !== RefundMode.Simulated) return approved;
    return this.process(approved._id.toString(), input.requestedBy, approved.version, RefundMode.Simulated);
  }

  private async complete(refund: any) {
    const amount = refund.approvedAmount;
    for (const allocation of refund.allocations) {
      const payment = await this.paymentModel.findOneAndUpdate({ _id: allocation.paymentId, refundReservedAmount: { $gte: allocation.amount } }, { $inc: { refundReservedAmount: -allocation.amount, refundedAmount: allocation.amount } }, { new: true });
      if (!payment) throw new ConflictException('REFUND_RESERVATION_NOT_FOUND');
    }
    const updated = await this.refundModel.findOneAndUpdate({ _id: refund._id, status: RefundStatus.Processing }, { $set: { status: RefundStatus.Completed, processedAmount: amount, reservedAmount: 0 }, $inc: { version: 1 } }, { new: true });
    await this.bookingModel.updateOne({ _id: refund.bookingId }, { $inc: { 'paymentSummary.totalRefunded': amount }, $set: { 'paymentSummary.paymentStatus': BookingPaymentStatus.Refunded } });
    await this.applySettlementImpact(refund, amount);
    return updated;
  }

  private async fail(refund: any, reason: string) {
    return this.refundModel.findOneAndUpdate({ _id: refund._id, status: RefundStatus.Processing }, { $set: { status: RefundStatus.Failed, failureReason: reason }, $inc: { version: 1 } }, { new: true });
  }

  private async transition(refundId: string, current: RefundStatus, next: RefundStatus, version: number, fields: Record<string, unknown>) {
    const updated = await this.refundModel.findOneAndUpdate({ _id: this.id(refundId), status: current, version }, { $set: { status: next, ...fields }, $inc: { version: 1 } }, { new: true });
    if (!updated) throw new ConflictException('REFUND_STATE_CHANGED');
    return updated;
  }

  private async reservePayment(paymentId: Types.ObjectId, amount: number) {
    const result = await this.paymentModel.updateOne({ _id: paymentId, status: PaymentStatus.Success, $expr: { $gte: [{ $subtract: ['$amount', { $add: [{ $ifNull: ['$refundedAmount', 0] }, { $ifNull: ['$refundReservedAmount', 0] }] }] }, amount] } }, { $inc: { refundReservedAmount: amount } });
    return result.modifiedCount === 1;
  }

  private async buildAllocations(bookingId: string, amount: number) {
    let remaining = amount;
    const payments = await this.paymentModel.find({ bookingId: this.id(bookingId), status: PaymentStatus.Success }).sort({ paidAt: 1, createdAt: 1 }).lean();
    const allocations: Array<{ paymentId: Types.ObjectId; amount: number }> = [];
    for (const payment of payments) {
      const available = Math.max(payment.amount - (payment.refundedAmount || 0) - (payment.refundReservedAmount || 0), 0);
      const allocated = Math.min(available, remaining);
      if (allocated > 0) allocations.push({ paymentId: payment._id, amount: allocated });
      remaining -= allocated;
      if (remaining === 0) break;
    }
    if (remaining > 0) throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_AVAILABLE_BALANCE');
    return allocations;
  }

  private async reserveAllocations(allocations: Array<{ paymentId: Types.ObjectId; amount: number }>) {
    const reserved: Array<{ paymentId: Types.ObjectId; amount: number }> = [];
    for (const allocation of allocations) {
      if (await this.reservePayment(allocation.paymentId, allocation.amount)) reserved.push(allocation);
      else { await this.releaseAllocations(reserved); return false; }
    }
    return true;
  }

  private async releaseAllocations(allocations: Array<{ paymentId: Types.ObjectId; amount: number }>) {
    await Promise.all(allocations.map((allocation) => this.paymentModel.updateOne({ _id: allocation.paymentId, refundReservedAmount: { $gte: allocation.amount } }, { $inc: { refundReservedAmount: -allocation.amount } })));
  }

  private async applySettlementImpact(refund: any, amount: number) {
    let remaining = amount;
    const settlements = await this.settlementModel.find({ bookingId: refund.bookingId }).sort({ payableAmount: -1 });
    for (const settlement of settlements) {
      if (remaining <= 0) break;
      const adjustment = Math.min(Math.max(settlement.payableAmount || 0, 0), remaining);
      if (adjustment <= 0) continue;
      if (settlement.status === SettlementStatus.Settled) {
        await this.adjustmentModel.updateOne({ settlementId: settlement._id, refundRequestId: refund._id }, { $setOnInsert: { settlementId: settlement._id, bookingId: refund.bookingId, providerId: settlement.providerId, refundRequestId: refund._id, amount: adjustment, appliedAmount: 0, status: 'PENDING', reason: `Refund ${refund.code}` } }, { upsert: true });
      } else if ([SettlementStatus.ReadyToSettle, SettlementStatus.OnHold].includes(settlement.status)) {
        await this.settlementModel.updateOne({ _id: settlement._id }, { $inc: { refundAmount: adjustment, payableAmount: -adjustment } });
      }
      remaining -= adjustment;
    }
  }

  private async findRefundablePayment(bookingId: string, amount: number) {
    const payment = await this.paymentModel.findOne({ bookingId: this.id(bookingId), status: PaymentStatus.Success, $expr: { $gte: [{ $subtract: ['$amount', { $add: [{ $ifNull: ['$refundedAmount', 0] }, { $ifNull: ['$refundReservedAmount', 0] }] }] }, amount] } }).sort({ paidAt: -1, createdAt: -1 });
    if (!payment) throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_AVAILABLE_BALANCE');
    return payment;
  }

  private async findOwnedBooking(bookingId: string, customerId: string) {
    const booking = await this.bookingModel.findOne({ _id: this.id(bookingId), customerId: this.id(customerId) });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private id(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Invalid id');
    return new Types.ObjectId(value);
  }
}
