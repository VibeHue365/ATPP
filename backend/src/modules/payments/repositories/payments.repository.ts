import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentPurpose, PaymentStatus } from '../schemas/payment.schema';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  async findPendingPaymentByBooking(bookingId: Types.ObjectId): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.Pending,
    });
  }

  async createPayment(data: Partial<Payment>): Promise<PaymentDocument> {
    return this.paymentModel.create(data);
  }

  async findByBookingIds(bookingIds: Types.ObjectId[]): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ bookingId: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .populate('bookingId')
      .exec();
  }

  async findPaymentByCode(paymentCode: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ paymentCode });
  }

  async findPaymentWithBooking(paymentCode: string): Promise<PaymentDocument | null> {
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

  async findPaymentByBookingAndStatus(bookingId: Types.ObjectId, status: PaymentStatus): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ bookingId, status });
  }

  async findDepositPaymentByBooking(bookingId: Types.ObjectId): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ bookingId, status: PaymentStatus.Success, purpose: PaymentPurpose.DepositPayment });
  }

  async completedRefundedAmount(bookingId: Types.ObjectId): Promise<number> {
    const payments = await this.paymentModel.find({ bookingId, status: PaymentStatus.Success }).lean().exec();
    return payments.reduce((sum, payment) => sum + (payment.refundedAmount || 0), 0);
  }
  async updateStatus(paymentCode: string, status: PaymentStatus): Promise<PaymentDocument | null> {
    return this.paymentModel.findOneAndUpdate(
      { paymentCode },
      { $set: { status } },
      { new: true },
    );
  }
}
