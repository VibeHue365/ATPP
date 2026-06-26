import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  PaymentPurpose,
  PaymentStatus,
} from '../schemas/payment.schema';
import {
  Booking,
  BookingStatus,
  PaymentStatus as BookingPaymentStatus,
} from '../../bookings/schemas/booking.schema';
import { BookingEscrow, EscrowStatus } from '../schemas/booking-escrow.schema';
import {
  SettlementTransfer,
  SettlementTransferStatus,
} from '../schemas/settlement-transfer.schema';
import {
  BookingSettlement,
  SettlementStatus,
  CommissionCollectionMethod,
  CommissionCollectionStatus,
} from '../schemas/booking-settlement.schema';
import { PayOSRefundService } from './payos-refund.service';
import { MockBankingService } from './mock-banking.service';

interface PaymentAccountDoc {
  bankName?: string;
  accountNumberMasked?: string;
  accountHolder?: string;
  isDefault?: boolean;
}

interface ProviderDoc {
  _id: Types.ObjectId;
  paymentAccounts?: PaymentAccountDoc[];
}

interface RefundResult {
  status: string;
  amount: number;
  orderCode: number;
  refundId?: string;
}

interface TransferResult {
  success: boolean;
  bankTxnId?: string;
  error?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingEscrow.name)
    private readonly escrowModel: Model<BookingEscrow>,
    @InjectModel(SettlementTransfer.name)
    private readonly transferModel: Model<SettlementTransfer>,
    @InjectModel(BookingSettlement.name)
    private readonly settlementModel: Model<BookingSettlement>,
    private readonly refundService: PayOSRefundService,
    private readonly bankingService: MockBankingService,
  ) {}

  async createPaymentLink(
    bookingIdStr: string,
    purpose: PaymentPurpose,
  ): Promise<PaymentDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let amount = 0;
    if (purpose === PaymentPurpose.DepositPayment) {
      amount = booking.pricingSummary.depositTotal;
    } else if (purpose === PaymentPurpose.FullPayment) {
      amount = booking.pricingSummary.grandTotal;
    } else if (purpose === PaymentPurpose.RemainingPayment) {
      amount =
        booking.pricingSummary.grandTotal - booking.paymentSummary.totalPaid;
    } else {
      amount = booking.pricingSummary.grandTotal;
    }

    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const paymentCode = `PAY${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    const orderCode = Math.floor(100000 + Math.random() * 900000);
    const checkoutUrl = `http://127.0.0.1:3000/payments/checkout/${paymentCode}`;

    const payment = await this.paymentModel.create({
      bookingId,
      paymentCode,
      amount,
      purpose,
      paymentMethod: 'PAYOS_SIMULATOR',
      status: PaymentStatus.Pending,
      payos: {
        orderCode,
        paymentLinkId: `link_${paymentCode}`,
        checkoutUrl,
        qrCode: `mock_qr_${paymentCode}`,
        description: `Thanh toan don hang ${booking.bookingCode}`,
      },
    });

    return payment;
  }

  async getTransactions(userIdStr: string, roles: string[]): Promise<any[]> {
    const userId = new Types.ObjectId(userIdStr);

    if (roles.includes('PROVIDER')) {
      interface ProviderDoc {
        _id: Types.ObjectId;
      }
      const providerDoc = await this.bookingModel.db
        .model('Provider')
        .findOne({ userId })
        .lean()
        .exec();
      const provider = providerDoc as ProviderDoc | null;
      if (!provider) return [];

      const bookings = await this.bookingModel.find({
        providerIds: provider._id,
      });
      const bookingIds = bookings.map((b) => b._id);
      return this.paymentModel
        .find({ bookingId: { $in: bookingIds } })
        .sort({ createdAt: -1 })
        .populate('bookingId');
    } else {
      const bookings = await this.bookingModel.find({ customerId: userId });
      const bookingIds = bookings.map((b) => b._id);
      return this.paymentModel
        .find({ bookingId: { $in: bookingIds } })
        .sort({ createdAt: -1 })
        .populate('bookingId');
    }
  }

  async confirmPayment(paymentCode: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findOne({ paymentCode });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.Success) {
      return payment;
    }

    payment.status = PaymentStatus.Success;
    payment.paidAt = new Date();
    await payment.save();

    const booking = await this.bookingModel.findById(payment.bookingId);
    if (booking) {
      booking.paymentSummary.totalPaid += payment.amount;

      if (
        booking.paymentSummary.totalPaid >= booking.pricingSummary.grandTotal
      ) {
        booking.paymentSummary.paymentStatus = BookingPaymentStatus.Paid;
        booking.status = BookingStatus.Confirmed;
      } else if (booking.paymentSummary.totalPaid > 0) {
        booking.paymentSummary.paymentStatus =
          BookingPaymentStatus.PartiallyPaid;
      }

      booking.statusTimeline.push({
        status: booking.status,
        changedAt: new Date(),
        note: 'Thanh toán thành công đơn hàng',
      });

      await booking.save();

      // Tạo Escrow Entry ghi nhận tiền ký quỹ
      await this.createEscrowEntry(
        booking._id,
        booking.pricingSummary.grandTotal,
        booking.pricingSummary.depositTotal,
      );
    }

    return payment;
  }

  async cancelPayment(paymentCode: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findOne({ paymentCode });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.status = PaymentStatus.Cancelled;
    await payment.save();
    return payment;
  }

  async createEscrowEntry(
    bookingId: Types.ObjectId,
    totalAmountCollected: number,
    damageDepositAmount: number,
  ): Promise<BookingEscrow> {
    return this.escrowModel.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          totalAmountCollected,
          damageDepositAmount,
          status: EscrowStatus.Held,
        },
      },
      { upsert: true, new: true },
    );
  }

  async executeAutoTransfer(
    bankCode: string,
    accountNumber: string,
    accountHolder: string,
    amount: number,
    reference: string,
  ) {
    return this.bankingService.executeAutoTransfer(
      bankCode,
      accountNumber,
      accountHolder,
      amount,
      reference,
    );
  }

  async executeProfitSplit(booking: any): Promise<void> {
    const items = await this.bookingModel.db
      .model('BookingItem')
      .find({ bookingId: booking._id });

    // Group items by provider
    const providerItems = new Map<string, any[]>();
    for (const item of items) {
      const pId = item.providerId.toString();
      if (!providerItems.has(pId)) providerItems.set(pId, []);
      providerItems.get(pId)!.push(item);
    }

    const totalSubTotal = booking.pricingSummary.subTotal;
    const discount = booking.pricingSummary.discountAmount || 0;
    const travelFee = booking.pricingSummary.travelFee || 0;

    for (const [providerIdStr, pItems] of providerItems.entries()) {
      let providerSubTotal = 0;
      let hasPhotography = false;
      for (const item of pItems) {
        providerSubTotal += item.unitPrice * item.quantity;
        if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
          hasPhotography = true;
        }
      }

      // Phân bổ mã giảm giá theo tỷ lệ
      const providerDiscount = totalSubTotal > 0
        ? Math.round((providerSubTotal / totalSubTotal) * discount)
        : 0;

      // Phân bổ phí đi lại cho nhiếp ảnh gia
      const providerTravelFee = hasPhotography ? travelFee : 0;

      const providerReceivableRaw = providerSubTotal - providerDiscount + providerTravelFee;
      const platformCommission = Math.round(providerReceivableRaw * 0.1);
      const providerReceivable = providerReceivableRaw - platformCommission;

      if (providerReceivable > 0) {
        const provider = await this.bookingModel.db
          .model('Provider')
          .findById(new Types.ObjectId(providerIdStr));

        if (provider) {
          let bankName = 'VietinBank';
          let accountNumber = '1029384756';
          let accountHolder = 'PROVIDER STUDIO';

          if (provider.paymentAccounts && provider.paymentAccounts.length > 0) {
            const activeAccount = provider.paymentAccounts.find((a: any) => a.isDefault) || provider.paymentAccounts[0];
            bankName = activeAccount.bankName || bankName;
            accountNumber = activeAccount.accountNumberMasked
              ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
              : accountNumber;
            accountHolder = activeAccount.accountHolder || accountHolder;
          }

          const transferRef = `SETTLE_${booking.bookingCode}`;
          const transferResult = await this.bankingService.executeAutoTransfer(
            bankName,
            accountNumber,
            accountHolder,
            providerReceivable,
            transferRef,
          );

          // Tạo lịch sử giao dịch chuyển khoản
          await this.transferModel.create({
            bookingId: booking._id,
            providerId: provider._id,
            amountSent: providerReceivable,
            destinationBankAccount: {
              bankName,
              accountNumber,
              accountHolder,
            },
            status: transferResult.success
              ? SettlementTransferStatus.Success
              : SettlementTransferStatus.Failed,
            transactionReference: transferRef,
            errorMessage: transferResult.error || null,
          });

          // Tạo BookingSettlement lưu trữ
          await this.settlementModel.create({
            bookingId: booking._id,
            providerId: provider._id,
            grossAmount: providerReceivableRaw,
            platformCommission,
            providerReceivable,
            commissionCollection: {
              method: CommissionCollectionMethod.DirectDeduction,
              status: CommissionCollectionStatus.CommissionPaid,
              paidAt: new Date(),
            },
            settlementStatus: SettlementStatus.Completed,
          });
        }
      }
    }
  }

  async settleBooking(bookingIdStr: string): Promise<any> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let escrow = await this.escrowModel.findOne({ bookingId });
    if (escrow && escrow.status === EscrowStatus.Settled) {
      return { message: 'Booking already settled' };
    }

    // 1. Chuyển khoản trực tiếp chia tiền dịch vụ cho các Provider
    await this.executeProfitSplit(booking);

    // 2. Tự động hoàn cọc giữ đồ (depositTotal) cho khách hàng
    if (booking.pricingSummary.depositTotal > 0) {
      await this.refundDeposit(bookingIdStr, booking.pricingSummary.depositTotal);
    }

    if (!escrow) {
      escrow = await this.escrowModel.create({
        bookingId,
        totalAmountCollected: booking.pricingSummary.grandTotal,
        damageDepositAmount: booking.pricingSummary.depositTotal,
        status: EscrowStatus.Settled,
      });
    } else {
      escrow.status = EscrowStatus.Settled;
      await escrow.save();
    }

    return {
      message: 'Settlement completed and deposit refunded successfully',
    };
  }

  async refundDeposit(
    bookingIdStr: string,
    refundAmount?: number,
  ): Promise<RefundResult | { message: string }> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const amountToRefund =
      refundAmount !== undefined
        ? refundAmount
        : booking.pricingSummary.depositTotal;
    if (amountToRefund <= 0) {
      return { message: 'No deposit to refund' };
    }

    const payment = await this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.Success,
    });

    const orderCode =
      payment?.payos?.orderCode || Math.floor(100000 + Math.random() * 900000);

    const refundResult = await this.refundService.refundPayment(
      orderCode,
      amountToRefund,
    );

    const escrow = await this.escrowModel.findOne({ bookingId });
    if (escrow) {
      escrow.status =
        refundAmount !== undefined &&
        refundAmount < booking.pricingSummary.depositTotal
          ? EscrowStatus.DisputedResolved
          : EscrowStatus.Refunded;
      await escrow.save();
    }

    return refundResult;
  }

  async resolveDispute(
    bookingIdStr: string,
    refundToCustomer: number,
    payToProvider: number,
  ): Promise<{
    message: string;
    refundResult: unknown;
    transferResult: unknown;
  }> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const escrow = await this.escrowModel.findOne({ bookingId });
    if (!escrow) {
      throw new NotFoundException('Booking escrow not found');
    }

    if (refundToCustomer + payToProvider > escrow.damageDepositAmount) {
      throw new BadRequestException(
        `Total resolution amount (${refundToCustomer + payToProvider}) cannot exceed deposit amount (${escrow.damageDepositAmount})`,
      );
    }

    let refundResult: RefundResult | { message: string } | null = null;
    if (refundToCustomer > 0) {
      refundResult = await this.refundDeposit(bookingIdStr, refundToCustomer);
    }

    let transferResult: TransferResult | null = null;
    if (payToProvider > 0 && booking.providerIds.length > 0) {
      const providerDoc2 = await this.bookingModel.db
        .model('Provider')
        .findById(booking.providerIds[0])
        .lean()
        .exec();

      const provider2 = providerDoc2 as ProviderDoc | null;
      let bankName = 'VietinBank';
      let accountNumber = '1029384756';
      let accountHolder = 'PROVIDER STUDIO';

      if (provider2?.paymentAccounts && provider2.paymentAccounts.length > 0) {
        const activeAccount: PaymentAccountDoc =
          provider2.paymentAccounts.find((a) => a.isDefault) ??
          provider2.paymentAccounts[0];
        bankName = activeAccount.bankName ?? bankName;
        accountNumber = activeAccount.accountNumberMasked
          ? activeAccount.accountNumberMasked.replace(/\*/g, '8')
          : accountNumber;
        accountHolder = activeAccount.accountHolder ?? accountHolder;
      }

      const transactionReference = `DISPUTE_${booking.bookingCode}`;
      transferResult = await this.bankingService.executeAutoTransfer(
        bankName,
        accountNumber,
        accountHolder,
        payToProvider,
        transactionReference,
      );

      await this.transferModel.create({
        bookingId,
        providerId: booking.providerIds[0],
        amountSent: payToProvider,
        destinationBankAccount: {
          bankName,
          accountNumber,
          accountHolder,
        },
        status: transferResult.success
          ? SettlementTransferStatus.Success
          : SettlementTransferStatus.Failed,
        transactionReference,
        errorMessage: transferResult.error || null,
      });

      if (!transferResult.success) {
        throw new BadRequestException(
          `Bank transfer to provider failed: ${transferResult.error}`,
        );
      }
    }

    escrow.status = EscrowStatus.DisputedResolved;
    await escrow.save();

    booking.status = BookingStatus.Completed;
    booking.statusTimeline.push({
      status: BookingStatus.Completed,
      changedAt: new Date(),
      note: `Tranh chấp đã giải quyết bởi Admin. Hoàn khách: ${refundToCustomer}đ, trả shop: ${payToProvider}đ.`,
    });
    await booking.save();

    return {
      message: 'Dispute resolved successfully',
      refundResult,
      transferResult,
    };
  }
}
