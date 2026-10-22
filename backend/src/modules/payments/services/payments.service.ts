import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { BookingEscrow, EscrowStatus } from '../schemas/booking-escrow.schema';
import {
  SettlementTransfer,
  SettlementTransferStatus,
} from '../schemas/settlement-transfer.schema';
import {
  PayOSRefundService,
  PayOSRefundRejectedError,
} from './payos-refund.service';
import { MockBankingService } from './mock-banking.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RentalDepositRefundCoordinatorService } from '../../bookings/services/rental-deposit-refund-coordinator.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { PaymentsRepository } from '../repositories/payments.repository';
import { EscrowRepository } from '../repositories/escrow.repository';
import { SettlementRepository } from '../repositories/settlement.repository';
import { TransferRepository } from '../repositories/transfer.repository';
import { SettlementTransferMapper } from '../mappers/settlement-transfer.mapper';
import { SettlementsService } from '../../settlements/services/settlements.service';
import { SettlementStatus } from '../../settlements/constants/settlement-status.enum';
import { PhotographyHoldService } from '../../bookings/services/photography-hold.service';
import { PromotionsService } from '../../products/services/promotions.service';
import { getPrimaryFrontendUrl } from '../../../common/config/frontend-url.util';

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
    @Inject(forwardRef(() => PhotographyHoldService))
    private readonly photographyHoldService: PhotographyHoldService,
    @Inject(forwardRef(() => RentalDepositRefundCoordinatorService))
    private readonly depositCoordinator: RentalDepositRefundCoordinatorService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async createPaymentLink(
    bookingIdStr: string,
    purpose: PaymentPurpose,
    userIdStr?: string,
  ): Promise<PaymentDocument> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (userIdStr && booking.customerId.toString() !== userIdStr) {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn này.');
    }
    if (
      purpose !== PaymentPurpose.RemainingPayment &&
      booking.status !== BookingStatus.PendingPayment
    ) {
      throw new BadRequestException(
        'Đơn không còn ở trạng thái chờ thanh toán.',
      );
    }

    // Check for existing PENDING payment for the same booking — reuse if found
    const existingPendingPayment =
      await this.paymentsRepository.findPendingPaymentByBooking(bookingId);
    if (existingPendingPayment) {
      return existingPendingPayment;
    }

    let amount = 0;
    if (
      purpose === PaymentPurpose.DepositPayment &&
      booking.pricingSummary?.amountDueNow !== undefined &&
      booking.pricingSummary?.amountDueNow !== null
    ) {
      amount = booking.pricingSummary.amountDueNow;
    } else if (purpose === PaymentPurpose.DepositPayment) {
      if (booking.bookingType === BookingType.Combo) {
        // Combo deposit = 100% Product rental + 100% Product deposit + 100% Photographer fee + serviceFee - comboDiscount - voucherDiscount
        const items = await this.bookingModel.db
          .model('BookingItem')
          .find({ bookingId: booking._id });
        const prodItems = items.filter((i: any) => i.itemType === 'PRODUCT');
        const photoItems = items.filter(
          (i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE',
        );

        const prodRentalTotal = prodItems.reduce(
          (sum: number, i: any) => sum + i.unitPrice * i.quantity,
          0,
        );
        const prodDepositTotal = prodItems.reduce(
          (sum: number, i: any) => sum + i.depositAmount * i.quantity,
          0,
        );
        const photoDepositTotal = photoItems.reduce(
          (sum: number, i: any) => sum + i.unitPrice * i.quantity,
          0,
        );

        amount =
          prodRentalTotal +
          prodDepositTotal +
          photoDepositTotal -
          (booking.pricingSummary.comboDiscountTotal || 0) -
          (booking.pricingSummary.voucherDiscountTotal || 0);
      } else if (booking.bookingType === BookingType.Photography) {
        amount =
          booking.pricingSummary.grandTotal || booking.pricingSummary.subTotal;
      } else {
        amount =
          booking.pricingSummary.depositTotal ||
          booking.pricingSummary.grandTotal;
      }
    } else if (purpose === PaymentPurpose.FullPayment) {
      amount =
        booking.pricingSummary.grandTotal || booking.pricingSummary.subTotal;
    } else if (purpose === PaymentPurpose.RemainingPayment) {
      amount =
        booking.pricingSummary.grandTotal - booking.paymentSummary.totalPaid;
    } else {
      amount =
        booking.pricingSummary.grandTotal || booking.pricingSummary.subTotal;
    }

    const frontendBase = getPrimaryFrontendUrl(process.env.FRONTEND_URL);

    // Đơn 0 đồng (sau khi áp voucher 100% hoặc được sàn bù phần lẻ)
    if (amount <= 0) {
      const paymentCode = `PAY0D_${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
      const orderCode = Math.floor(100000 + Math.random() * 900000);
      const checkoutUrl = `${frontendBase}/checkout/result?paymentCode=${paymentCode}`;

      const zeroPayment = await this.paymentsRepository.createPayment({
        bookingId,
        paymentCode,
        amount: 0,
        purpose,
        paymentMethod: 'PAYOS_SIMULATOR',
        status: PaymentStatus.Success,
        payos: {
          orderCode,
          paymentLinkId: `zero_${paymentCode}`,
          checkoutUrl,
          qrCode: `zero_${paymentCode}`,
          description: `Don hang 0 dong ${booking.bookingCode}`,
        },
      });

      await this.finalizeAfterPayment(zeroPayment);
      return zeroPayment;
    }

    const paymentCode = `PAY${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    const orderCode = Math.floor(100000 + Math.random() * 900000);
    const checkoutUrl = `${frontendBase}/checkout/result?paymentCode=${paymentCode}`;

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

  async getPaymentStatus(paymentCode: string, userIdStr: string) {
    let payment =
      await this.paymentsRepository.findPaymentWithBooking(paymentCode);
    if (!payment) throw new NotFoundException('Payment not found');
    let booking = payment.bookingId as unknown as Booking & {
      _id: Types.ObjectId;
    };
    if (booking.customerId.toString() !== userIdStr) {
      throw new ForbiddenException('Bạn không có quyền xem giao dịch này.');
    }

    // In sandbox environment, auto-confirm pending payments immediately
    if (payment.status === PaymentStatus.Pending) {
      try {
        await this.confirmPayment(paymentCode);
        const updated =
          await this.paymentsRepository.findPaymentWithBooking(paymentCode);
        if (updated) {
          payment = updated;
          booking = updated.bookingId as unknown as Booking & {
            _id: Types.ObjectId;
          };
        }
      } catch (e) {
        console.warn('Sandbox auto-confirm payment skipped:', e);
      }
    }

    return {
      paymentCode: payment.paymentCode,
      paymentStatus: payment.status,
      bookingId: booking._id.toString(),
      bookingStatus: booking.status,
      bookingPaymentStatus: booking.paymentSummary.paymentStatus,
      confirmed:
        booking.status === BookingStatus.Confirmed ||
        booking.status === BookingStatus.DepositPaid,
      checkoutUrl:
        payment.status === PaymentStatus.Pending
          ? payment.payos?.checkoutUrl || null
          : null,
    };
  }

  async getPendingCheckouts(userIdStr: string) {
    const bookings = await this.bookingModel
      .find({
        customerId: new Types.ObjectId(userIdStr),
        status: BookingStatus.PendingPayment,
      })
      .select('_id bookingCode')
      .lean()
      .exec();
    if (!bookings.length) return [];

    const payments =
      await this.paymentsRepository.findPendingPaymentsByBookingIds(
        bookings.map((booking) => booking._id),
      );
    return payments
      .filter((payment) => payment.payos?.checkoutUrl)
      .map((payment) => ({
        paymentCode: payment.paymentCode,
        bookingId: payment.bookingId.toString(),
        checkoutUrl: payment.payos?.checkoutUrl,
      }));
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
      for (const booking of bookings) {
        const subTotal = booking.pricingSummary?.subTotal || 0;
        const discount = booking.pricingSummary?.discountAmount || 0;
        const grandTotal = booking.pricingSummary?.grandTotal || 0;
        const storedDeposit = booking.pricingSummary?.depositTotal || 0;
        const bookingAny = booking as any;
        const isComboOrPhoto = booking.bookingType === 'COMBO' || booking.bookingType === 'PHOTOGRAPHY' || (bookingAny.items || []).some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');

        let productDepositTotal = (bookingAny.items || [])
          .filter((i: any) => i.itemType === 'PRODUCT')
          .reduce((sum: number, i: any) => sum + ((i.depositAmount || 0) * (i.quantity || 1)), 0);

        if (productDepositTotal === 0 && isComboOrPhoto && grandTotal > 0 && subTotal > 0) {
          const netRental = Math.max(0, subTotal - discount);
          productDepositTotal = Math.max(0, grandTotal - netRental);
        }

        const depositTotal = (booking as any).rentalDepositRefund?.amount
          || (isComboOrPhoto ? productDepositTotal : storedDeposit);

        const disputeRefundAmount = (booking as any).disputeResult?.refundAmount || 0;
        const cancelRefundAmount = booking.cancellation?.refundAmount || 0;

        const isDepositRefundEligible = ['RETURNED', 'COMPLETED'].includes(booking.status) && depositTotal > 0 && (booking as any).rentalDepositRefund?.status !== 'NO_REFUND';
        const isDisputeOrCancelRefund = ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED', 'COMPLETED'].includes(booking.status) && (cancelRefundAmount > 0 || disputeRefundAmount > 0);

        if (isDepositRefundEligible || isDisputeOrCancelRefund) {
          try {
            const existingRefund = await this.bookingModel.db
              .model('Payment')
              .findOne({
                bookingId: booking._id,
                purpose: PaymentPurpose.DepositRefund,
              })
              .exec();
            if (!existingRefund) {
              const amountToRefund = isDepositRefundEligible
                ? depositTotal
                : cancelRefundAmount > 0
                  ? cancelRefundAmount
                  : disputeRefundAmount;
              if (amountToRefund > 0) {
                await this.refundDeposit(
                  booking._id.toString(),
                  amountToRefund,
                );
              }
            }
          } catch (e) {
            this.logger.error(`Error auto-generating refund for booking ${booking.bookingCode}: ${e}`);
          }
        }
      }

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

    const transfers = await this.transferRepository.findTransfersByProvider(
      (providerDoc as any)._id,
    );
    return this.transferMapper.toProviderResponseList(transfers);
  }

  async getRefundableAmount(
    bookingId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    return this.paymentsRepository.getRefundableAmount(bookingId, session);
  }

  async cancelPendingPaymentsForBooking(
    bookingId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.paymentsRepository.cancelPendingPaymentsForBooking(
      bookingId,
      session,
    );
  }

  async createRefundIntents(
    bookingId: Types.ObjectId,
    amountToRefund: number,
    reason: string,
    session?: ClientSession,
  ): Promise<PaymentDocument[]> {
    if (amountToRefund <= 0) return [];

    const refundable = await this.getRefundableAmount(bookingId, session);
    const targetRefund = Math.min(amountToRefund, refundable);
    if (targetRefund <= 0) {
      this.logger.warn(
        `Không thể tạo refund intent cho booking ${bookingId}: số tiền yêu cầu ${amountToRefund}, nhưng số tiền có thể hoàn là ${refundable}`,
      );
      return [];
    }

    const paidPayments = await this.paymentsRepository.model
      .find({
        bookingId,
        status: PaymentStatus.Success,
        purpose: { $ne: PaymentPurpose.DepositRefund },
      })
      .sort({ paidAt: -1, createdAt: -1 })
      .session(session || null)
      .exec();

    if (paidPayments.length === 0) {
      this.logger.warn(
        `Không tìm thấy giao dịch thanh toán thành công nào cho booking ${bookingId} để hoàn tiền.`,
      );
      return [];
    }

    const intents: PaymentDocument[] = [];
    let remainingToRefund = targetRefund;

    for (const p of paidPayments) {
      const existingRefunds = await this.paymentsRepository.model
        .find({
          originalPaymentId: p._id,
          purpose: PaymentPurpose.DepositRefund,
          status: {
            $in: [
              PaymentStatus.Pending,
              PaymentStatus.Processing,
              PaymentStatus.Success,
            ],
          },
        })
        .session(session || null)
        .exec();

      const alreadyRefunded = existingRefunds.reduce(
        (sum, r) => sum + (r.amount || 0),
        0,
      );
      const availableFromThisPayment = Math.max(0, p.amount - alreadyRefunded);
      if (availableFromThisPayment <= 0) continue;

      const chunk = Math.min(availableFromThisPayment, remainingToRefund);
      if (chunk <= 0) break;

      const refundPaymentCode = `REF-${new Types.ObjectId().toString()}`;
      try {
        const [created] = await this.paymentsRepository.model.create(
          [
            {
              bookingId,
              paymentCode: refundPaymentCode,
              amount: chunk,
              purpose: PaymentPurpose.DepositRefund,
              paymentMethod: 'PAYOS_REFUND',
              status: PaymentStatus.Pending,
              originalPaymentId: p._id,
              refundReason: reason,
              retryCount: 0,
              needsManualReview: false,
            },
          ],
          { session },
        );

        intents.push(created);
        remainingToRefund -= chunk;
      } catch (err: any) {
        if (err.code === 11000) {
          this.logger.warn(
            `Refund intent cho originalPaymentId ${p._id} với lý do ${reason} đã tồn tại. Bỏ qua duplicate.`,
          );
        } else {
          throw err;
        }
      }

      if (remainingToRefund <= 0) break;
    }

    return intents;
  }

  async executeRefundIntent(
    paymentCode: string,
  ): Promise<PaymentDocument | null> {
    const intent = await this.paymentsRepository.model.findOneAndUpdate(
      {
        paymentCode,
        status: PaymentStatus.Pending,
        needsManualReview: { $ne: true },
      },
      {
        $set: { status: PaymentStatus.Processing },
      },
      { new: true },
    );

    if (!intent) {
      return this.paymentsRepository.findPaymentByCode(paymentCode);
    }

    const originalPayment = intent.originalPaymentId
      ? await this.paymentsRepository.model.findById(intent.originalPaymentId)
      : null;

    const orderCode = originalPayment?.payos?.orderCode;
    if (!orderCode) {
      this.logger.error(
        `Refund intent ${paymentCode} không có orderCode hợp lệ từ payment gốc. Yêu cầu Admin can thiệp.`,
      );
      return this.paymentsRepository.model.findOneAndUpdate(
        { paymentCode },
        {
          $set: {
            status: PaymentStatus.Pending,
            needsManualReview: true,
            lastError: 'Không tìm thấy payOS orderCode từ giao dịch gốc.',
          },
        },
        { new: true },
      );
    }

    try {
      this.logger.log(
        `Thực thi hoàn tiền PayOS cho ${paymentCode}: orderCode=${orderCode}, amount=${intent.amount}`,
      );
      await this.refundService.refundPayment(orderCode, intent.amount);

      const updated = await this.paymentsRepository.model.findOneAndUpdate(
        { paymentCode },
        {
          $set: {
            status: PaymentStatus.Success,
            paidAt: new Date(),
            lastError: null,
          },
        },
        { new: true },
      );

      if (updated?.bookingId) {
        const remainingRefundable = await this.getRefundableAmount(
          updated.bookingId,
        );
        if (remainingRefundable <= 0) {
          const escrow = await this.escrowRepository.findByBookingId(
            updated.bookingId,
          );
          if (escrow && escrow.status === EscrowStatus.Held) {
            escrow.status = EscrowStatus.Refunded;
            await escrow.save();
          }
        }
      }

      return updated;
    } catch (err: any) {
      if (err instanceof PayOSRefundRejectedError) {
        const nextRetryCount = (intent.retryCount || 0) + 1;
        const needsReview = nextRetryCount >= 5;
        this.logger.warn(
          `PayOS từ chối hoàn tiền cho ${paymentCode} (lần ${nextRetryCount}): ${err.message}`,
        );
        return this.paymentsRepository.model.findOneAndUpdate(
          { paymentCode },
          {
            $set: {
              status: PaymentStatus.Pending,
              lastError: err.message,
              retryCount: nextRetryCount,
              needsManualReview: needsReview,
            },
          },
          { new: true },
        );
      }

      this.logger.error(
        `Lỗi mạng/timeout khi gọi hoàn tiền PayOS cho ${paymentCode}: ${err.message}`,
        err.stack,
      );
      return this.paymentsRepository.model.findOneAndUpdate(
        { paymentCode },
        {
          $set: {
            status: PaymentStatus.Processing,
            lastError: `Lỗi kết nối / timeout: ${err.message}`,
            needsManualReview: true,
          },
        },
        { new: true },
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryRefunds(): Promise<void> {
    const pendingRefunds = await this.paymentsRepository.model
      .find({
        purpose: PaymentPurpose.DepositRefund,
        status: PaymentStatus.Pending,
        needsManualReview: { $ne: true },
      })
      .limit(20)
      .exec();

    for (const p of pendingRefunds) {
      try {
        await this.executeRefundIntent(p.paymentCode);
      } catch (err) {
        this.logger.warn(`Cron retry refund ${p.paymentCode} thất bại: ${err}`);
      }
    }
  }

  async confirmPayment(paymentCode: string): Promise<PaymentDocument> {
    const candidate =
      await this.paymentsRepository.findPaymentByCode(paymentCode);
    if (!candidate) throw new NotFoundException('Payment not found');
    if (
      candidate.status !== PaymentStatus.Pending &&
      candidate.status !== PaymentStatus.Success
    ) {
      throw new BadRequestException(
        `Cannot confirm payment with status: ${candidate.status}`,
      );
    }
    const booking = await this.bookingModel.findById(candidate.bookingId);
    if (!booking) {
      throw new NotFoundException(
        'Không tìm thấy đơn đặt lịch tương ứng với giao dịch.',
      );
    }
    if (booking.status === BookingStatus.Cancelled) {
      const payment = await this.paymentsRepository.confirmPayment(paymentCode);
      await this.bookingModel.updateOne(
        { _id: candidate.bookingId },
        {
          $set: {
            paymentReviewRequired: true,
            paymentReviewReason:
              'Thanh toán ghi nhận sau khi đơn đã hủy. Hệ thống tự động xếp hàng hoàn tiền.',
          },
        },
      );
      try {
        const intents = await this.createRefundIntents(
          candidate.bookingId,
          candidate.amount,
          'LATE_PAYMENT_CLOSED_BOOKING',
        );
        for (const intent of intents) {
          this.executeRefundIntent(intent.paymentCode).catch((err) =>
            this.logger.warn(
              `Thực thi hoàn tiền trễ ${intent.paymentCode} lỗi: ${err}`,
            ),
          );
        }
      } catch (err) {
        this.logger.error(
          `Lỗi khi tạo refund intent cho late payment ${paymentCode}:`,
          err,
        );
      }
      return payment || candidate;
    }
    const payment =
      candidate.status === PaymentStatus.Success
        ? candidate
        : await this.paymentsRepository.confirmPayment(paymentCode);
    if (!payment) {
      const concurrent =
        await this.paymentsRepository.findPaymentByCode(paymentCode);
      if (concurrent?.status === PaymentStatus.Success) {
        return this.confirmPayment(paymentCode);
      }
      throw new BadRequestException(
        'Trạng thái thanh toán đã thay đổi, vui lòng xác minh lại.',
      );
    }

    await this.finalizeAfterPayment(payment);
    return payment;
  }

  async finalizeAfterPayment(payment: PaymentDocument): Promise<void> {
    const successfulPayments = (await this.bookingModel.db
      .model('Payment')
      .find({ bookingId: payment.bookingId, status: PaymentStatus.Success })
      .select('amount')
      .lean()
      .exec()) as Array<{ amount?: number }>;
    const totalPaid = successfulPayments.reduce(
      (sum: number, item: { amount?: number }) => sum + (item.amount || 0),
      0,
    );
    const updatedBooking = await this.bookingModel.findOneAndUpdate(
      { _id: payment.bookingId },
      { $set: { 'paymentSummary.totalPaid': totalPaid } },
      { new: true },
    );

    if (!updatedBooking) return;

    const holdConfirmation =
      await this.photographyHoldService.confirmForBooking(payment.bookingId);

    const subsidy = updatedBooking.pricingSummary?.platformSubsidyAmount || 0;
    const isPaid =
      totalPaid + subsidy >= updatedBooking.pricingSummary.grandTotal;

    let isConfirmedEligible = false;
    if (updatedBooking.bookingType === BookingType.Photography) {
      isConfirmedEligible =
        totalPaid >=
        (updatedBooking.pricingSummary.amountDueNow ??
          updatedBooking.pricingSummary.depositTotal);
    } else if (updatedBooking.bookingType === BookingType.Combo) {
      const items = await this.bookingModel.db
        .model('BookingItem')
        .find({ bookingId: updatedBooking._id });
      const photoItems = items.filter(
        (i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE',
      );
      const photoRemainingTotal = photoItems.reduce(
        (sum: number, i: any) =>
          sum + Math.round(i.unitPrice * 0.7) * i.quantity,
        0,
      );

      isConfirmedEligible =
        totalPaid + subsidy >=
        updatedBooking.pricingSummary.grandTotal - photoRemainingTotal;
    } else {
      isConfirmedEligible = isPaid;
    }

    let newStatus = updatedBooking.status;
    if (isConfirmedEligible && holdConfirmation.confirmed) {
      if (updatedBooking.bookingType === BookingType.Photography) {
        newStatus = BookingStatus.DepositPaid;
      } else {
        newStatus = BookingStatus.Confirmed;
      }
    }

    const newPaymentStatus = isPaid
      ? BookingPaymentStatus.Paid
      : totalPaid > 0
        ? BookingPaymentStatus.PartiallyPaid
        : BookingPaymentStatus.Unpaid;

    // Trọng tài trạng thái cấp booking: Chỉ bên nào thấy đúng trạng thái cũ mới được cập nhật
    const moved = await this.bookingModel.findOneAndUpdate(
      { _id: payment.bookingId, status: updatedBooking.status },
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
      { new: true },
    );

    if (!moved) {
      await this.handlePaymentOnClosedBooking(payment.bookingId);
      return;
    }

    if (
      newStatus === BookingStatus.Confirmed ||
      newStatus === BookingStatus.DepositPaid
    ) {
      // 1. Chuyển voucher RESERVED -> REDEEMED
      const r = await this.promotionsService.redeemVoucher(payment.bookingId);
      if (!r) {
        const redemption =
          await this.promotionsService.findRedemptionByBooking(
            payment.bookingId,
          );
        if (redemption?.status === 'RELEASED') {
          await this.bookingModel.updateOne(
            { _id: payment.bookingId },
            {
              $set: {
                paymentReviewRequired: true,
                paymentReviewReason:
                  'Tiền về sau khi lượt voucher đã bị hệ thống nhả tự động.',
              },
            },
          );
        }
      }

      // 2. Khóa giữ tồn kho
      const reservationModel = this.bookingModel.db.model(
        'InventoryReservation',
      );
      await reservationModel.updateMany(
        { bookingId: payment.bookingId },
        {
          $set: { status: 'CONFIRMED' },
          $unset: { expiresAt: 1 },
        },
      );

    }

    if (!holdConfirmation.confirmed) {
      await this.bookingModel.updateOne(
        { _id: payment.bookingId },
        {
          $set: {
            paymentReviewRequired: true,
            paymentReviewReason:
              'Lịch giữ chỗ hoặc trang phục đã hết hạn trước khi thanh toán hoàn tất.',
          },
        },
      );
    }

    try {
      if (holdConfirmation.paymentReviewRequired) {
        await this.notificationsService.createNotification(
          updatedBooking.customerId.toString(),
          'Thanh toán đang chờ kiểm tra',
          'Hệ thống đã ghi nhận ' +
            payment.amount.toLocaleString('vi-VN') +
            'đ cho đơn ' +
            updatedBooking.bookingCode +
            ', nhưng lịch chụp giữ chỗ đã hết hạn. Chúng tôi sẽ liên hệ để xác nhận lại lịch hoặc hỗ trợ hoàn tiền.',
          NotificationType.Payment,
          { bookingId: updatedBooking._id, paymentReviewRequired: true },
        );
      } else {
        await this.notificationsService.createNotification(
          updatedBooking.customerId.toString(),
          'Thanh toán thành công',
          'Bạn đã thanh toán thành công số tiền ' +
            payment.amount.toLocaleString('vi-VN') +
            'đ cho đơn hàng ' +
            updatedBooking.bookingCode +
            '.',
          NotificationType.Payment,
          { bookingId: updatedBooking._id },
        );

        if (updatedBooking.providerIds?.length) {
          const providers = await this.bookingModel.db
            .model('Provider')
            .find({ _id: { $in: updatedBooking.providerIds } })
            .select('userId')
            .lean();

          for (const provider of providers as Array<{ userId?: Types.ObjectId }>) {
            if (!provider.userId) continue;
            await this.notificationsService.createNotification(
              provider.userId.toString(),
              'Lịch đặt mới được thanh toán',
              `Đơn đặt lịch ${updatedBooking.bookingCode} đã được khách hàng thanh toán cọc thành công.`,
              NotificationType.Booking,
              { bookingId: updatedBooking._id },
            );
          }
        }
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
  }

  async handlePaymentOnClosedBooking(bookingId: Types.ObjectId): Promise<void> {
    const current = await this.bookingModel.findById(bookingId);
    if (current?.paymentSummary?.paymentStatus === BookingPaymentStatus.Paid) {
      return;
    }
    await this.bookingModel.updateOne(
      { _id: bookingId },
      {
        $set: {
          paymentReviewRequired: true,
          paymentReviewReason:
            'Thanh toán ghi nhận trên đơn đã đóng hoặc hết hạn. Chờ đối soát hoàn tiền.',
        },
      },
    );
  }

  async cancelPayment(paymentCode: string): Promise<PaymentDocument> {
    return this.failPayment(paymentCode, PaymentStatus.Cancelled);
  }

  async failPayment(
    paymentCode: string,
    status:
      PaymentStatus.Failed | PaymentStatus.Cancelled = PaymentStatus.Failed,
  ): Promise<PaymentDocument> {
    const session = await this.bookingModel.db.startSession();
    let result: PaymentDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const payment = await this.paymentsRepository.updatePendingStatus(
          paymentCode,
          status,
          session,
        );
        if (!payment) {
          const existing = await this.paymentsRepository.findPaymentByCode(
            paymentCode,
            session,
          );
          if (!existing) throw new NotFoundException('Payment not found');
          if (existing.status === status) {
            result = existing;
            return;
          }
          throw new BadRequestException(
            `Cannot fail payment with status: ${existing.status}`,
          );
        }

        result = payment;
        const bookingId = payment.bookingId;
        const releasedStatus =
          status === PaymentStatus.Cancelled ? 'CANCELLED' : 'EXPIRED';
        await this.bookingModel.updateOne(
          { _id: bookingId, status: BookingStatus.PendingPayment },
          {
            $set: { status: BookingStatus.Cancelled },
            $push: {
              statusTimeline: {
                status: BookingStatus.Cancelled,
                changedAt: new Date(),
                note:
                  status === PaymentStatus.Cancelled
                    ? 'Thanh toán đã bị hủy'
                    : 'Thanh toán thất bại hoặc hết hạn',
              },
            },
          },
          { session },
        );
        await this.bookingModel.db
          .model('BookingSchedule')
          .updateMany(
            { bookingId, status: 'HELD' },
            { $set: { status: releasedStatus } },
            { session },
          );
        await this.bookingModel.db
          .model('InventoryReservation')
          .updateMany(
            { bookingId, status: 'TEMP_RESERVED' },
            { $set: { status: releasedStatus }, $unset: { expiresAt: 1 } },
            { session },
          );
        await this.promotionsService.releaseVoucher(bookingId, session);
      });
      const finalPayment: PaymentDocument | null = result;
      if (!finalPayment) throw new NotFoundException('Payment not found');

      try {
        const booking = await this.bookingModel
          .findById((finalPayment as any).bookingId)
          .select('customerId bookingCode')
          .lean();
        if (booking) {
          const customerId =
            ((booking.customerId as any)?._id || booking.customerId).toString();
          await this.notificationsService.createNotification(
            customerId,
            status === PaymentStatus.Cancelled
              ? 'Giao dịch thanh toán đã hủy'
              : 'Thanh toán thất bại / hết hạn',
            `Giao dịch thanh toán cho đơn hàng ${booking.bookingCode} đã bị ${status === PaymentStatus.Cancelled ? 'hủy' : 'hết hạn/thất bại'}. Các mục giữ chỗ đã được giải phóng.`,
            NotificationType.Payment,
            { bookingId: (finalPayment as any).bookingId },
          );
        }
      } catch (e) {
        this.logger.warn('Failed to send failPayment notification:', e);
      }

      return finalPayment;
    } finally {
      await session.endSession();
    }
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

  async executeProfitSplit(booking: {
    _id: Types.ObjectId | string;
  }): Promise<void> {
    await this.settlementsService.createSettlementsForBooking(
      booking._id.toString(),
    );
  }

  async creditWalletsForBooking(bookingId: Types.ObjectId): Promise<void> {
    const settlementModel = this.bookingModel.db.model('Settlement');
    const settlements = (await settlementModel
      .find({
        bookingId,
        status: {
          $in: [SettlementStatus.ReadyToSettle, SettlementStatus.OnHold],
        },
        walletCreditedAt: null,
      })
      .exec()) as Array<{
      _id: Types.ObjectId;
      providerId: Types.ObjectId;
      payableAmount?: number;
      netAmount?: number;
      settlementCode?: string;
    }>;

    if (!settlements || settlements.length === 0) {
      return;
    }

    const providerModel = this.bookingModel.db.model('Provider');
    const now = new Date();

    for (const s of settlements) {
      const payableAmt = s.payableAmount || 0;
      const netAmt = s.netAmount || 0;

      const updated = await settlementModel.findOneAndUpdate(
        { _id: s._id, walletCreditedAt: null },
        {
          $set: {
            walletCreditedAt: now,
            walletCreditedAmount: payableAmt,
          },
        },
        { new: true },
      );

      if (updated) {
        await providerModel.updateOne(
          { _id: s.providerId },
          {
            $inc: {
              'wallet.availableBalance': payableAmt,
              'wallet.totalEarned': netAmt,
            },
            $set: { 'wallet.lastUpdatedAt': now },
          },
        );
        this.logger.log(
          `Cộng ví Provider ${s.providerId}: +${payableAmt} availableBalance, +${netAmt} totalEarned từ Settlement ${s.settlementCode || s._id}`,
        );
      }
    }
  }

  async settleBooking(bookingIdStr: string): Promise<any> {
    const bookingId = new Types.ObjectId(bookingIdStr);
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 1. Chặn đứng đơn đã hủy hoặc escrow không ở trạng thái Held
    const escrow = await this.escrowRepository.trySettleEscrow(bookingId);
    if (!escrow) {
      const currentEscrow =
        await this.escrowRepository.findByBookingId(bookingId);
      if (currentEscrow && currentEscrow.status === EscrowStatus.Settled) {
        return { message: 'Booking already settled' };
      }
      throw new ConflictException(
        `Escrow của đơn đặt lịch không ở trạng thái Held (hiện tại: ${currentEscrow?.status || 'NOT_FOUND'}), không thể chia tiền.`,
      );
    }

    try {
      // 2. Tạo Settlement cho các Provider (nếu chưa có)
      await this.executeProfitSplit(booking);

      // 3. Tự động hoàn cọc giữ đồ áo dài (chỉ tính cọc áo dài, không lấy depositTotal của chụp ảnh)
      if (booking.bookingType !== BookingType.Photography) {
        try {
          const items = await this.bookingModel.db
            .model('BookingItem')
            .find({ bookingId: booking._id })
            .lean()
            .exec();
          const rentalItems = items.filter(
            (i: any) =>
              i.itemType === 'PRODUCT' || i.itemType === BookingItemType.Product,
          );
          const rentalDepositTotal = rentalItems.reduce(
            (sum: number, i: any) => sum + (i.depositAmount || 0),
            0,
          );
          const depositAmt =
            (booking as any).rentalDepositRefund?.amount ?? rentalDepositTotal;

          if (
            depositAmt > 0 &&
            (booking as any).rentalDepositRefund?.status !== 'NO_REFUND'
          ) {
            const intents = await this.createRefundIntents(
              booking._id,
              depositAmt,
              'RENTAL_DEPOSIT_RETURN',
            );
            for (const intent of intents) {
              await this.executeRefundIntent(intent.paymentCode);
            }
          }
        } catch (coordErr) {
          this.logger.error(
            `Lỗi khi hoàn cọc giữ đồ trong settleBooking cho ${bookingIdStr}:`,
            coordErr,
          );
        }
      }

      // 4. Cộng ví chuẩn xác cho từng Provider theo từng Settlement (thay thế khối cũ L836)
      await this.creditWalletsForBooking(bookingId);

    } catch (err) {
      // Revert lại trạng thái Held nếu gặp lỗi để có thể retry
      await this.escrowRepository.updateEscrowStatus(
        bookingId,
        EscrowStatus.Held,
      );
      throw err;
    }

    return {
      message: 'Settlement completed and wallets credited successfully',
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

    const refundable = await this.getRefundableAmount(bookingId);
    const amountToRefund =
      refundAmount !== undefined
        ? refundAmount
        : Math.min(booking.pricingSummary?.depositTotal || 0, refundable);

    if (amountToRefund <= 0) {
      return { message: 'No deposit to refund' };
    }

    const intents = await this.createRefundIntents(
      bookingId,
      amountToRefund,
      'DEPOSIT_REFUND',
    );

    let lastResult: any = {
      status: 'PENDING',
      amount: amountToRefund,
      orderCode: 0,
    };

    for (const intent of intents) {
      const res = await this.executeRefundIntent(intent.paymentCode);
      if (res?.status === PaymentStatus.Success) {
        lastResult = {
          status: 'COMPLETED',
          amount: intent.amount,
          orderCode: intent.originalPaymentId,
          refundId: intent.paymentCode,
        };
      } else {
        lastResult = {
          status: res?.status || 'PENDING',
          amount: intent.amount,
          orderCode: intent.originalPaymentId,
          refundId: intent.paymentCode,
          error: res?.lastError,
        };
      }
    }

    const escrow = await this.escrowRepository.findByBookingId(bookingId);
    if (escrow && escrow.status === EscrowStatus.Held) {
      const remainingRefundable = await this.getRefundableAmount(bookingId);
      if (remainingRefundable <= 0) {
        escrow.status = EscrowStatus.Refunded;
      } else {
        escrow.status = EscrowStatus.DisputedResolved;
      }
      await escrow.save();
    }

    if (lastResult.status === 'COMPLETED') {
      try {
        const customerId = (
          (booking.customerId as any)?._id || booking.customerId
        ).toString();
        await this.notificationsService.createNotification(
          customerId,
          'Hoàn tiền cọc thành công',
          `Hệ thống đã hoàn trả thành công số tiền cọc ${amountToRefund.toLocaleString('vi-VN')}đ cho đơn hàng ${booking.bookingCode}. Tiền sẽ về tài khoản của bạn theo quy định ngân hàng.`,
          NotificationType.Refund,
          { bookingId: booking._id, refundAmount: amountToRefund },
        );
      } catch (error) {
        this.logger.warn('Failed to send refundDeposit notification:', error);
      }
    }

    return lastResult;
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
      note: `Tranh chấp đã giải quyết bởi Admin. Hoàn khách: ${refundToCustomer.toLocaleString('vi-VN')}đ, trả shop: ${payToProvider.toLocaleString('vi-VN')}đ.`,
    });
    await booking.save();

    try {
      const customerId = (
        (booking.customerId as any)?._id || booking.customerId
      ).toString();
      await this.notificationsService.createNotification(
        customerId,
        'Tranh chấp đã được xử lý',
        `Tranh chấp đơn hàng ${booking.bookingCode} đã được giải quyết. Hoàn tiền: ${refundToCustomer.toLocaleString('vi-VN')}đ.`,
        NotificationType.Dispute,
        { bookingId: booking._id, refundToCustomer, payToProvider },
      );

      if (booking.providerIds && booking.providerIds.length > 0) {
        const providers = await this.bookingModel.db
          .model('Provider')
          .find({ _id: { $in: booking.providerIds } })
          .select('userId')
          .lean();

        for (const prov of providers as any[]) {
          if (prov.userId) {
            await this.notificationsService.createNotification(
              prov.userId.toString(),
              'Tranh chấp đã được xử lý',
              `Tranh chấp đơn hàng ${booking.bookingCode} đã được Admin giải quyết xong. Quyết toán: ${payToProvider.toLocaleString('vi-VN')}đ.`,
              NotificationType.Dispute,
              { bookingId: booking._id, refundToCustomer, payToProvider },
            );
          }
        }
      }
    } catch (e) {
      this.logger.warn('Failed to send resolveDispute notification:', e);
    }

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
