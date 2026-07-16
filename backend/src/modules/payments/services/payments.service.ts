import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
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
  BookingType,
  PaymentStatus as BookingPaymentStatus,
} from '../../bookings/schemas/booking.schema';
import { BookingEscrow, EscrowStatus } from '../schemas/booking-escrow.schema';
import {
  SettlementTransfer,
  SettlementTransferStatus,
} from '../schemas/settlement-transfer.schema';
import { PayOSRefundService } from './payos-refund.service';
import { MockBankingService } from './mock-banking.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { PaymentsRepository } from '../repositories/payments.repository';
import { EscrowRepository } from '../repositories/escrow.repository';
import { SettlementRepository } from '../repositories/settlement.repository';
import { TransferRepository } from '../repositories/transfer.repository';
import { SettlementTransferMapper } from '../mappers/settlement-transfer.mapper';
import { SettlementsService } from '../../settlements/services/settlements.service';

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
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    private readonly escrowRepository: EscrowRepository,
    private readonly transferRepository: TransferRepository,
    private readonly settlementRepository: SettlementRepository,
    private readonly refundService: PayOSRefundService,
    private readonly bankingService: MockBankingService,
    private readonly notificationsService: NotificationsService,
    private readonly transferMapper: SettlementTransferMapper,
    @InjectModel(BookingEscrow.name)
    private readonly escrowModel: Model<BookingEscrow>,
    @InjectModel(SettlementTransfer.name)
    private readonly transferModel: Model<SettlementTransfer>,
    private readonly settlementsService: SettlementsService,
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

    // Check for existing PENDING payment for the same booking — reuse if found
    const existingPendingPayment = await this.paymentsRepository.findPendingPaymentByBooking(bookingId);
    if (existingPendingPayment) {
      return existingPendingPayment;
    }

    let amount = 0;
    if (purpose === PaymentPurpose.DepositPayment) {
      if (booking.bookingType === BookingType.Combo) {
        // Combo deposit = 100% Product rental + 100% Product deposit + 30% Photographer fee + serviceFee - comboDiscount
        const items = await this.bookingModel.db.model('BookingItem').find({ bookingId: booking._id });
        const prodItems = items.filter((i: any) => i.itemType === 'PRODUCT');
        const photoItems = items.filter((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');

        const prodRentalTotal = prodItems.reduce((sum: number, i: any) => sum + i.unitPrice * i.quantity, 0);
        const prodDepositTotal = prodItems.reduce((sum: number, i: any) => sum + i.depositAmount * i.quantity, 0);
        const photoDepositTotal = photoItems.reduce((sum: number, i: any) => sum + Math.round(i.unitPrice * 0.3) * i.quantity, 0);

        amount = prodRentalTotal + prodDepositTotal + photoDepositTotal - (booking.pricingSummary.comboDiscountTotal || 0);
      } else {
        amount = booking.pricingSummary.depositTotal;
      }
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

    const payment = await this.paymentsRepository.createPayment({
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
      return this.paymentsRepository.findByBookingIds(bookingIds);
    } else {
      const bookings = await this.bookingModel.find({ customerId: userId });
      const bookingIds = bookings.map((b) => b._id);
      return this.paymentsRepository.findByBookingIds(bookingIds);
    }
  }

  async getProviderSettlementTransfers(userIdStr: string): Promise<any[]> {
    const userId = new Types.ObjectId(userIdStr);
    const providerDoc = await this.bookingModel.db
      .model('Provider')
      .findOne({ userId })
      .lean()
      .exec();
    if (!providerDoc) return [];

    const transfers = await this.transferRepository.findTransfersByProvider((providerDoc as any)._id);
    return this.transferMapper.toProviderResponseList(transfers);
  }

  async confirmPayment(paymentCode: string): Promise<PaymentDocument> {
    const payment = await this.paymentsRepository.confirmPayment(paymentCode);

    if (!payment) {
      const existing = await this.paymentsRepository.findPaymentByCode(paymentCode);
      if (!existing) {
        throw new NotFoundException('Payment not found');
      }
      if (existing.status === PaymentStatus.Success) {
        return existing;
      }
      throw new BadRequestException(
        `Cannot confirm payment with status: ${existing.status}`,
      );
    }

    const booking = await this.bookingModel.findById(payment.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch tương ứng với giao dịch.');
    }
    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Đơn đặt lịch đã bị hủy, không thể tiếp tục xác nhận thanh toán.');
    }

    const updatedBooking = await this.bookingModel.findOneAndUpdate(
      { _id: payment.bookingId },
      { $inc: { 'paymentSummary.totalPaid': payment.amount } },
      { new: true },
    );

    if (updatedBooking) {
      const isPaid =
        updatedBooking.paymentSummary.totalPaid >=
        updatedBooking.pricingSummary.grandTotal;

      let isConfirmedEligible = false;
      if (updatedBooking.bookingType === BookingType.Photography) {
        isConfirmedEligible =
          updatedBooking.paymentSummary.totalPaid >=
          updatedBooking.pricingSummary.depositTotal;
      } else if (updatedBooking.bookingType === BookingType.Combo) {
        const items = await this.bookingModel.db.model('BookingItem').find({ bookingId: updatedBooking._id });
        const photoItems = items.filter((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
        const photoRemainingTotal = photoItems.reduce((sum: number, i: any) => sum + Math.round(i.unitPrice * 0.7) * i.quantity, 0);

        isConfirmedEligible =
          updatedBooking.paymentSummary.totalPaid >=
          (updatedBooking.pricingSummary.grandTotal - photoRemainingTotal);
      } else {
        isConfirmedEligible = isPaid;
      }

      const newStatus = isConfirmedEligible
        ? BookingStatus.Confirmed
        : updatedBooking.status;

      const newPaymentStatus = isPaid
        ? BookingPaymentStatus.Paid
        : updatedBooking.paymentSummary.totalPaid > 0
          ? BookingPaymentStatus.PartiallyPaid
          : BookingPaymentStatus.Unpaid;

      await this.bookingModel.updateOne(
        { _id: payment.bookingId },
        {
          $set: {
            status: newStatus,
            'paymentSummary.paymentStatus': newPaymentStatus,
          },
          $push: {
            statusTimeline: {
              status: newStatus,
              changedAt: new Date(),
              note: 'Thanh toán thành công đơn hàng',
            },
          },
        },
      );

      if (newStatus === BookingStatus.Confirmed || newStatus === BookingStatus.DepositPaid) {
        const reservationModel = this.bookingModel.db.model('InventoryReservation');
        await reservationModel.updateMany(
          { bookingId: payment.bookingId },
          {
            $set: { status: 'CONFIRMED' },
            $unset: { expiresAt: 1 }
          }
        );
      }

      try {
        // Bắn thông báo cho khách hàng
        await this.notificationsService.createNotification(
          updatedBooking.customerId.toString(),
          `Thanh toán thành công`,
          `Bạn đã thanh toán thành công số tiền ${payment.amount.toLocaleString('vi-VN')}đ cho đơn hàng ${updatedBooking.bookingCode}.`,
          NotificationType.Payment,
          { bookingId: updatedBooking._id },
        );

        // Bắn thông báo cho các nhà cung cấp liên quan
        for (const providerId of updatedBooking.providerIds) {
          await this.notificationsService.createNotification(
            providerId.toString(),
            `Lịch đặt mới được thanh toán`,
            `Đơn đặt lịch ${updatedBooking.bookingCode} đã được khách hàng thanh toán cọc thành công.`,
            NotificationType.Booking,
            { bookingId: updatedBooking._id },
          );
        }
      } catch (e) {
        console.error('Failed to create payment/booking notifications:', e);
      }

      // Tạo Escrow Entry ghi nhận tiền ký quỹ
      await this.createEscrowEntry(
        updatedBooking._id,
        updatedBooking.pricingSummary.grandTotal,
        updatedBooking.pricingSummary.depositTotal,
      );

      // Cập nhật trạng thái các Reservation tương ứng sang CONFIRMED
      try {
        await this.bookingModel.db
          .model('InventoryReservation')
          .updateMany(
            { bookingId: payment.bookingId },
            { $set: { status: 'CONFIRMED' } }
          );
      } catch (err) {
        console.error('Failed to update InventoryReservation status to CONFIRMED:', err);
      }
    }

    return payment;
  }

  async cancelPayment(paymentCode: string): Promise<PaymentDocument> {
    const payment = await this.paymentsRepository.updateStatus(paymentCode, PaymentStatus.Cancelled);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async createEscrowEntry(
    bookingId: Types.ObjectId,
    totalAmountCollected: number,
    damageDepositAmount: number,
  ): Promise<BookingEscrow> {
    return this.escrowRepository.createOrUpdateEscrow(
      bookingId,
      totalAmountCollected,
      damageDepositAmount,
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

  async executeProfitSplit(
    booking: { _id: Types.ObjectId | string },
  ): Promise<void> {
    await this.settlementsService.createSettlementsForBooking(
      booking._id.toString(),
    );
  }

  async settleBooking(bookingIdStr: string): Promise<any> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Cập nhật trạng thái Escrow sang Settled một cách atomic để chặn các request song song
    const escrow = await this.escrowRepository.trySettleEscrow(bookingId);

    if (!escrow) {
      const currentEscrow = await this.escrowRepository.findByBookingId(bookingId);
      if (currentEscrow && currentEscrow.status === EscrowStatus.Settled) {
        return { message: 'Booking already settled' };
      }
      throw new BadRequestException(
        'Booking escrow is not in Held status or not found',
      );
    }

    try {
      // 1. Chuyển khoản trực tiếp chia tiền dịch vụ cho các Provider
      await this.executeProfitSplit(booking);

      // 2. Tự động hoàn cọc giữ đồ (depositTotal) cho khách hàng
      if (booking.pricingSummary.depositTotal > 0) {
        await this.refundDeposit(
          bookingIdStr,
          booking.pricingSummary.depositTotal,
        );
      }
    } catch (err) {
      // Revert lại trạng thái Held nếu gặp lỗi để có thể retry
      await this.escrowRepository.updateEscrowStatus(bookingId, EscrowStatus.Held);
      throw err;
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

    const payment = await this.paymentsRepository.findPaymentByBookingAndStatus(
      bookingId,
      PaymentStatus.Success,
    );

    const orderCode =
      payment?.payos?.orderCode || Math.floor(100000 + Math.random() * 900000);

    const refundResult = await this.refundService.refundPayment(
      orderCode,
      amountToRefund,
    );

    // Create a Payment record representing the deposit refund for transaction history
    try {
      const refundPaymentCode = `REF${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
      await this.paymentsRepository.createPayment({
        bookingId,
        paymentCode: refundPaymentCode,
        amount: amountToRefund,
        purpose: PaymentPurpose.DepositRefund,
        paymentMethod: 'PAYOS_REFUND',
        status: PaymentStatus.Success,
        paidAt: new Date(),
      });
    } catch (createRefundErr) {
      this.logger.error(`Failed to create refund payment record for booking ${bookingIdStr}:`, createRefundErr);
    }

    const escrow = await this.escrowRepository.findByBookingId(bookingId);
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

    const escrow = await this.escrowRepository.findByBookingId(bookingId);
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

      await this.transferRepository.createTransfer({
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

    async cancelSettlementsForBooking(bookingIdStr: string): Promise<void> {
    await this.settlementsService.cancelSettlementsForBooking(
      bookingIdStr,
      'PAYMENT_CANCELLED',
    );
  }
}
