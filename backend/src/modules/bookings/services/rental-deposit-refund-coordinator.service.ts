import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { DepositSettlementStatus } from '../schemas/rental-fulfillment.types';
import { RefundStatus } from '../../payments/schemas/refund-request.schema';
import { RefundWorkflowService } from '../../payments/services/refund-workflow.service';

const finalDepositStatuses = [DepositSettlementStatus.FullyReleased, DepositSettlementStatus.PartiallyDeducted, DepositSettlementStatus.FullyDeducted];

@Injectable()
export class RentalDepositRefundCoordinatorService {
  private readonly logger = new Logger(RentalDepositRefundCoordinatorService.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItem>,
    private readonly refunds: RefundWorkflowService,
  ) {}

  /** Creates exactly one refund request after every physical rental unit has been settled. */
  async coordinate(bookingIdValue: string) {
    if (!Types.ObjectId.isValid(bookingIdValue)) return { status: 'PENDING' as const };
    const bookingId = new Types.ObjectId(bookingIdValue);
    const booking = await this.bookingModel.findById(bookingId).lean().exec();
    if (!booking) return { status: 'PENDING' as const };
    const existing = booking.rentalDepositRefund;
    if (existing?.status && existing.status !== 'PENDING' && existing.status !== 'FAILED') return existing;

    const items = await this.bookingItemModel.find({ bookingId, itemType: BookingItemType.Product }).lean().exec();
    if (!items.length || items.some((item) => !item.rentalFulfillment || !finalDepositStatuses.includes(item.rentalFulfillment.depositSettlementStatus))) return { status: 'PENDING' as const };

    const amount = items.reduce((sum, item) => sum + Math.max(item.rentalFulfillment?.depositRefundAmount ?? 0, 0), 0);
    if (amount === 0) {
      await this.bookingModel.updateOne({ _id: bookingId, 'rentalDepositRefund.status': { $in: ['PENDING', 'FAILED'] } }, { $set: { 'rentalDepositRefund.status': 'NO_REFUND', 'rentalDepositRefund.amount': 0, 'rentalDepositRefund.completedAt': new Date(), 'rentalDepositRefund.failureReason': null } }).exec();
      return { status: 'NO_REFUND' as const, amount: 0 };
    }

    try {
      const request = await this.refunds.createFromRentalSettlement({ bookingId: bookingId.toString(), requestedBy: booking.customerId.toString(), amount, sourceEventId: `rental-deposit-refund:${bookingId.toString()}:v1` });
      const status = request.status === RefundStatus.Completed ? 'REFUNDED' : 'REQUESTED';
      await this.bookingModel.updateOne({ _id: bookingId }, { $set: { 'rentalDepositRefund.status': status, 'rentalDepositRefund.amount': amount, 'rentalDepositRefund.refundRequestId': request._id, 'rentalDepositRefund.requestedAt': new Date(), 'rentalDepositRefund.completedAt': status === 'REFUNDED' ? new Date() : null, 'rentalDepositRefund.failureReason': null } }).exec();
      return { status, amount, refundRequestId: request._id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo yêu cầu hoàn cọc.';
      this.logger.error(`Rental deposit refund coordinator failed for ${bookingId}: ${message}`);
      await this.bookingModel.updateOne({ _id: bookingId }, { $set: { 'rentalDepositRefund.status': 'FAILED', 'rentalDepositRefund.failureReason': message } }).exec();
      return { status: 'FAILED' as const, amount, failureReason: message };
    }
  }
}