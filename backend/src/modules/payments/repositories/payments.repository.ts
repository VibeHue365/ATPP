import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  PaymentPurpose,
  PaymentStatus,
} from '../schemas/payment.schema';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  async findPendingPaymentByBooking(
    bookingId: Types.ObjectId,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.Pending,
      purpose: { $ne: PaymentPurpose.DepositRefund },
    });
  }

  async findPendingPaymentsByBookingIds(
    bookingIds: Types.ObjectId[],
  ): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({
        bookingId: { $in: bookingIds },
        status: PaymentStatus.Pending,
        purpose: { $ne: PaymentPurpose.DepositRefund },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async createPayment(data: Partial<Payment>): Promise<PaymentDocument> {
    return this.paymentModel.create(data);
  }

  async findByBookingIds(
    bookingIds: Types.ObjectId[],
  ): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({
        bookingId: { $in: bookingIds },
        status: { $in: [PaymentStatus.Success, PaymentStatus.Processing] },
      })
      .sort({ createdAt: -1 })
      .populate('bookingId')
      .exec();
  }

  async deleteRefundPaymentsByBookingIds(
    bookingIds: Types.ObjectId[],
  ): Promise<void> {
    await this.paymentModel
      .deleteMany({
        bookingId: { $in: bookingIds },
        purpose: PaymentPurpose.DepositRefund,
      })
      .exec();
  }

  async findPaymentByCode(
    paymentCode: string,
    session?: ClientSession,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ paymentCode }).session(session || null);
  }

  async findPaymentWithBooking(
    paymentCode: string,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ paymentCode }).populate('bookingId');
  }

  async confirmPayment(paymentCode: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOneAndUpdate(
      { paymentCode, status: PaymentStatus.Pending },
      { $set: { status: PaymentStatus.Success, paidAt: new Date() } },
      { new: true },
    );
  }

  async findByOrderCode(orderCode: number): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      'payos.orderCode': orderCode,
    });
  }

  async findPaymentByBookingAndStatus(
    bookingId: Types.ObjectId,
    status: PaymentStatus,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ bookingId, status });
  }

  async findDepositPaymentByBooking(
    bookingId: Types.ObjectId,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.Success,
      purpose: PaymentPurpose.DepositPayment,
    });
  }

  async completedRefundedAmount(bookingId: Types.ObjectId): Promise<number> {
    const payments = await this.paymentModel
      .find({ bookingId, status: PaymentStatus.Success })
      .lean()
      .exec();
    return payments.reduce(
      (sum, payment) => sum + (payment.refundedAmount || 0),
      0,
    );
  }
  async updateStatus(
    paymentCode: string,
    status: PaymentStatus,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOneAndUpdate(
      { paymentCode },
      { $set: { status } },
      { new: true },
    );
  }

  async updatePendingStatus(
    paymentCode: string,
    status: PaymentStatus.Failed | PaymentStatus.Cancelled,
    session?: ClientSession,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel.findOneAndUpdate(
      { paymentCode, status: PaymentStatus.Pending },
      { $set: { status } },
      { new: true, session },
    );
  }

  get model(): Model<Payment> {
    return this.paymentModel;
  }

  async getRefundableAmount(
    bookingId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    const pipeline: any[] = [
      { $match: { bookingId } },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', PaymentStatus.Success] },
                    { $ne: ['$purpose', PaymentPurpose.DepositRefund] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          totalRefundedOrPending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$purpose', PaymentPurpose.DepositRefund] },
                    {
                      $in: [
                        '$status',
                        [
                          PaymentStatus.Pending,
                          PaymentStatus.Processing,
                          PaymentStatus.Success,
                        ],
                      ],
                    },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
    ];

    const result = session
      ? await this.paymentModel.aggregate(pipeline).session(session)
      : await this.paymentModel.aggregate(pipeline);

    if (!result || result.length === 0) return 0;
    const { totalPaid, totalRefundedOrPending } = result[0];
    return Math.max(0, (totalPaid || 0) - (totalRefundedOrPending || 0));
  }

  async cancelPendingPaymentsForBooking(
    bookingId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.paymentModel.updateMany(
      {
        bookingId,
        status: PaymentStatus.Pending,
        purpose: { $ne: PaymentPurpose.DepositRefund },
      },
      { $set: { status: PaymentStatus.Cancelled } },
      { session },
    );
  }
}
