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
    if (existing?.status === 'REFUNDED') return existing;

    if (booking.bookingType === 'PHOTOGRAPHY' && booking.status !== 'CANCELLED' && booking.status !== 'DISPUTED') {
      await this.bookingModel.updateOne(
        { _id: bookingId },
        { $set: { 'rentalDepositRefund.status': 'NO_REFUND', 'rentalDepositRefund.amount': 0, 'rentalDepositRefund.completedAt': new Date(), 'rentalDepositReason': null } }
      ).exec();
      return { status: 'NO_REFUND' as const, amount: 0 };
    }

    let items = await this.bookingItemModel.find({ bookingId }).lean().exec();
    const isProductItem = (i: any) => i.itemType === BookingItemType.Product || (!i.itemType && booking.bookingType !== 'PHOTOGRAPHY');
    const productItems = items.filter(isProductItem);
    if (!productItems.length) {
      await this.bookingModel.updateOne(
        { _id: bookingId },
        { $set: { 'rentalDepositRefund.status': 'NO_REFUND', 'rentalDepositRefund.amount': 0, 'rentalDepositRefund.completedAt': new Date(), 'rentalDepositReason': null } }
      ).exec();
      return { status: 'NO_REFUND' as const, amount: 0 };
    }

    for (const item of productItems) {
      if (
        item.rentalFulfillment &&
        ['RETURNED', 'COMPLETED'].includes(item.rentalFulfillment.status) &&
        (item.rentalFulfillment.depositSettlementStatus === DepositSettlementStatus.PendingSettlement ||
          !finalDepositStatuses.includes(item.rentalFulfillment.depositSettlementStatus))
      ) {
        const charges = Object.values(item.rentalFulfillment.charges || {}).filter(Boolean) as Array<{ status: string }>;
        const hasProposedCharges = charges.some((c) => c?.status === 'PROPOSED');
        if (!hasProposedCharges) {
          let depositAmt = (item.depositAmount || 0) * (item.quantity || 1);
          if (depositAmt === 0 && productItems.length === 1 && booking.bookingType === 'AODAI_RENTAL') {
            depositAmt = (booking.pricingSummary?.depositTotal || 0);
          }
          await this.bookingItemModel.updateOne(
            { _id: item._id },
            {
              $set: {
                'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.FullyReleased,
                'rentalFulfillment.depositDeductedAmount': 0,
                'rentalFulfillment.depositRefundAmount': depositAmt,
              },
            },
          ).exec();
        }
      }
    }

    items = await this.bookingItemModel.find({ bookingId }).lean().exec();
    const updatedProductItems = items.filter(isProductItem);
    if (updatedProductItems.some((item) => !item.rentalFulfillment || !finalDepositStatuses.includes(item.rentalFulfillment.depositSettlementStatus))) return { status: 'PENDING' as const };

    let amount = updatedProductItems.reduce((sum, item) => sum + Math.max(item.rentalFulfillment?.depositRefundAmount ?? 0, 0), 0);
    if (amount === 0) {
      const hasDeductions = updatedProductItems.some((item) => (item.rentalFulfillment?.depositDeductedAmount || 0) > 0);
      if (!hasDeductions && booking.bookingType !== 'PHOTOGRAPHY') {
        const productItemsDepositSum = updatedProductItems.reduce((sum, item) => sum + ((item.depositAmount || 0) * (item.quantity || 1)), 0);
        if (productItemsDepositSum > 0) {
          amount = productItemsDepositSum;
        } else if (['AODAI_RENTAL', 'COMBO'].includes(booking.bookingType)) {
          amount = booking.pricingSummary?.depositTotal || 0;
        }
      }
    }

    if (amount === 0) {
      await this.bookingModel.updateOne({ _id: bookingId }, { $set: { 'rentalDepositRefund.status': 'NO_REFUND', 'rentalDepositRefund.amount': 0, 'rentalDepositRefund.completedAt': new Date(), 'rentalDepositReason': null } }).exec();
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