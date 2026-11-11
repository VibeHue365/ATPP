import {
  BadRequestException,
  Injectable,
  Inject,
  Optional,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
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
import { ContractCheckoutGuard } from '../../contracts/contract-checkout-guard.service';
import { CONTRACTS_V2_ENABLED } from '../../contracts/contracts.constants';
import { contractIntentKey, paymentMatchesBinding } from './contract-payment-binding';
import { PaymentExpiryClaimService } from './payment-expiry-claim.service';
import { PaymentRecoveryService } from './payment-recovery.service';
import { hashContract } from '../../contracts/canonical-contract';
import { freePaymentClaimBranches, newPaymentClaim } from '../../bookings/services/payment-expiry-claim';
import { V2PaymentFinalizationService } from './v2-payment-finalization.service';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';

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
    @Inject(CONTRACTS_V2_ENABLED) private readonly contractsV2Enabled: boolean,
    private readonly contractCheckoutGuard: ContractCheckoutGuard,
    private readonly paymentExpiryClaim: PaymentExpiryClaimService,
    private readonly paymentRecovery: PaymentRecoveryService,
    @Optional()
    @Inject(forwardRef(() => V2PaymentFinalizationService))
    private readonly v2Finalizer?: V2PaymentFinalizationService,
    @Optional()
    private readonly webhookEventRepository?: WebhookEventRepository,
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

    if (
      booking.contractFlowVersion === 2 &&
      booking.bookingType !== BookingType.Photography
    ) {
      if (!this.contractsV2Enabled)
        throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
      const v2Amount = await this.calculatePaymentAmount(booking, purpose);
      return this.createV2PaymentIntent(booking, purpose, v2Amount);
    }

    // Check for existing PENDING payment for the same booking — reuse if found
    const existingPendingPayment =
      await this.paymentsRepository.findPendingPaymentByBooking(bookingId);
    if (existingPendingPayment) {
      return existingPendingPayment;
    }

    const amount = await this.calculatePaymentAmount(booking, purpose);

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

  private async calculatePaymentAmount(
    booking: Booking & { _id: Types.ObjectId },
    purpose: PaymentPurpose,
  ): Promise<number> {
    if (
      purpose === PaymentPurpose.DepositPayment &&
      booking.pricingSummary?.amountDueNow !== undefined &&
      booking.pricingSummary?.amountDueNow !== null
    )
      return booking.pricingSummary.amountDueNow;
    if (purpose === PaymentPurpose.DepositPayment) {
      if (booking.bookingType === BookingType.Combo) {
        const items = await this.bookingModel.db
          .model('BookingItem')
          .find({ bookingId: booking._id });
        const prodItems = items.filter((item: any) => item.itemType === 'PRODUCT');
        const photoItems = items.filter(
          (item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE',
        );
        const prodRentalTotal = prodItems.reduce(
          (sum: number, item: any) => sum + item.unitPrice * item.quantity,
          0,
        );
        const prodDepositTotal = prodItems.reduce(
          (sum: number, item: any) => sum + item.depositAmount * item.quantity,
          0,
        );
        const photoDepositTotal = photoItems.reduce(
          (sum: number, item: any) => sum + item.unitPrice * item.quantity,
          0,
        );
        return (
          prodRentalTotal +
          prodDepositTotal +
          photoDepositTotal -
          (booking.pricingSummary.comboDiscountTotal || 0) -
          (booking.pricingSummary.voucherDiscountTotal || 0)
        );
      }
      return booking.bookingType === BookingType.Photography
        ? booking.pricingSummary.grandTotal || booking.pricingSummary.subTotal
        : booking.pricingSummary.depositTotal || booking.pricingSummary.grandTotal;
    }
    if (purpose === PaymentPurpose.RemainingPayment)
      return booking.pricingSummary.grandTotal - booking.paymentSummary.totalPaid;
    return booking.pricingSummary.grandTotal || booking.pricingSummary.subTotal;
  }

  private async createV2PaymentIntent(
    booking: Booking & { _id: Types.ObjectId },
    purpose: PaymentPurpose,
    amount: number,
  ): Promise<PaymentDocument> {
    if (purpose === PaymentPurpose.RemainingPayment)
      throw new ConflictException('V2_REMAINING_PAYMENT_NOT_IMPLEMENTED');
    const decision = await this.contractCheckoutGuard.evaluate(
      booking._id.toString(),
      amount,
      purpose,
    );
    const binding = decision.binding;
    if (!binding) throw new ConflictException('CONTRACT_BINDING_REQUIRED');
    await this.assertV2IntentIndex();
    const pending = await this.paymentsRepository.findPendingPaymentByBooking(booking._id);
    if (pending && paymentMatchesBinding(pending, binding)) {
      return pending;
    }

    const key = contractIntentKey(binding);
    const existingBound = await this.paymentsRepository.model.findOne({
      contractIntentKey: key,
      bookingId: booking._id,
      purpose,
      status: { $in: [PaymentStatus.Pending, PaymentStatus.Success] },
    });
    if (existingBound) {
      if (!paymentMatchesBinding(existingBound, binding))
        throw new ConflictException('PAYMENT_BINDING_STALE');
      return existingBound;
    }
    const paymentId = new Types.ObjectId();
    const paymentCode = `PAYV2_${paymentId.toHexString().toUpperCase()}`;
    const orderCode = Math.floor(100000 + Math.random() * 900000);
    const checkoutUrl = `${getPrimaryFrontendUrl(process.env.FRONTEND_URL)}/checkout/result?paymentCode=${paymentCode}`;
    const session = await this.bookingModel.db.startSession();
    let created: PaymentDocument | null = null;
    try {
      await session.withTransaction(async () => {
        await this.contractCheckoutGuard.assertCurrent(decision, session);
        const concurrent = await this.paymentsRepository.model.findOne({
          bookingId: booking._id,
          status: PaymentStatus.Pending,
          purpose: { $ne: PaymentPurpose.DepositRefund },
        }).session(session);
        if (concurrent) {
          if (paymentMatchesBinding(concurrent, binding)) {
            created = concurrent;
            return;
          }
          // The existing pending payment has a stale binding (e.g. from an older contract version).
          // Safely supersede the previous pending payment without erasing its data, binding or evidence.
          await this.paymentsRepository.model.updateOne(
            { _id: concurrent._id, status: PaymentStatus.Pending },
            {
              $set: {
                status: PaymentStatus.Cancelled,
                supersededAt: new Date(),
                supersededByPaymentId: paymentId,
                supersededReason: 'CONTRACT_VERSION_UPGRADED',
              },
            },
            { session },
          );
          // Free the booking claim if held by concurrent so that claimIntent can atomically claim for paymentId
          await this.bookingModel.updateOne(
            { _id: booking._id, 'paymentExpiryClaim.paymentId': concurrent._id },
            { $set: { paymentExpiryClaim: null } },
            { session },
          );
        }
        await this.paymentExpiryClaim.claimIntent(booking._id, paymentId, session);
        const zero = amount === 0;
        const rows = await this.paymentsRepository.model.create(
          [{
            _id: paymentId,
            bookingId: booking._id,
            paymentCode,
            amount,
            purpose,
            paymentMethod: 'PAYOS_SIMULATOR',
            status: zero ? PaymentStatus.Success : PaymentStatus.Pending,
            paidAt: zero ? new Date() : null,
            contractBinding: binding,
            contractIntentKey: key,
            payos: {
              orderCode,
              paymentLinkId: `${zero ? 'zero' : 'link'}_${paymentCode}`,
              checkoutUrl,
              qrCode: `${zero ? 'zero' : 'mock_qr'}_${paymentCode}`,
              description: `Thanh toan don hang ${booking.bookingCode}`,
            },
          }],
          { session },
        );
        created = rows[0];
        if (zero) {
          await this.paymentExpiryClaim.claimFinalization(
            booking._id,
            paymentId,
            session,
          );
          await this.paymentRecovery.recordAcknowledged(
            paymentId,
            booking._id,
            key,
            session,
          );
        }
      });
    } catch (error) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const winner = await this.paymentsRepository.model.findOne({
          contractIntentKey: key,
          bookingId: booking._id,
          purpose,
          status: { $in: [PaymentStatus.Pending, PaymentStatus.Success] },
        });
        if (winner && paymentMatchesBinding(winner, binding)) return winner;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!created) throw new ConflictException('PAYMENT_INTENT_NOT_CREATED');
    if (amount === 0 && this.v2Finalizer) {
      this.v2Finalizer.processPayment(paymentId).catch(() => {});
    }
    return created;
  }

  private async assertV2IntentIndex() {
    const col = this.paymentsRepository.model.collection;
    let indexes: any[] = [];
    try {
      indexes = await col.indexes();
    } catch {
      indexes = [];
    }
    const hasIndex = indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ contractIntentKey: 1 }),
    );
    if (!hasIndex) {
      try {
        await col.createIndex(
          { contractIntentKey: 1 },
          {
            unique: true,
            partialFilterExpression: { contractIntentKey: { $type: 'string' } },
            name: 'payments_contract_intent_key_unique',
          },
        );
      } catch (err: any) {
        try {
          const recheck = await col.indexes();
          const ok = recheck.some(
            (index) =>
              index.unique &&
              JSON.stringify(index.key) ===
                JSON.stringify({ contractIntentKey: 1 }),
          );
          if (!ok) {
            throw new ServiceUnavailableException('PAYMENT_INTENT_INDEX_REQUIRED');
          }
        } catch {
          throw new ServiceUnavailableException('PAYMENT_INTENT_INDEX_REQUIRED');
        }
      }
    }
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

    // In sandbox / simulator environment, auto-confirm pending payments immediately
    if (
      payment.status === PaymentStatus.Pending &&
      payment.paymentMethod === 'PAYOS_SIMULATOR'
    ) {
      try {
        const isV2Rental =
          booking.contractFlowVersion === 2 &&
          booking.bookingType !== BookingType.Photography;
        if (isV2Rental) {
          await this.confirmPayment(paymentCode, {
            source: 'SIMULATOR',
            orderCode: payment.payos?.orderCode,
          });
        } else {
          await this.confirmPayment(paymentCode);
        }
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
    const visible: typeof payments = [];
    for (const payment of payments) {
      const booking = await this.bookingModel.findById(payment.bookingId).lean();
      if (booking?.contractFlowVersion === 2 && booking.bookingType !== BookingType.Photography) {
        if (!this.contractsV2Enabled || !payment.contractBinding) continue;
        try {
          const decision = await this.contractCheckoutGuard.evaluate(
            booking._id.toString(), payment.amount, payment.purpose,
          );
          if (!decision.binding || !paymentMatchesBinding(payment, decision.binding)) continue;
        } catch {
          continue;
        }
      }
      visible.push(payment);
    }
    return visible
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

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileStuckWebhooks(): Promise<number> {
    if (!this.webhookEventRepository) return 0;
    const stuckEvents = await this.webhookEventRepository.findStuckEvents();
    let reconciled = 0;
    for (const event of stuckEvents) {
      try {
        const claim = await this.webhookEventRepository.claimVerifiedEvent(
          event.webhookId,
          event.payload,
          event.signature ?? null,
        );
        if (claim.state !== 'claimed') continue;
        const { orderCode, status, amount } = (event.payload || {}) as Record<string, any>;
        if (status === 'PAID' && typeof orderCode === 'number') {
          const payment = await this.paymentsRepository.findByOrderCode(orderCode);
          if (payment && payment.status === PaymentStatus.Pending) {
            if (typeof amount === 'number' && amount !== payment.amount) {
              await this.webhookEventRepository.markError(event.webhookId, 'AMOUNT_MISMATCH');
              continue;
            }
            const isV2 = payment.contractBinding?.flowVersion === 2;
            if (isV2) {
              await this.confirmPayment(payment.paymentCode, { source: 'WEBHOOK', orderCode });
            } else {
              await this.confirmPayment(payment.paymentCode);
            }
            await this.webhookEventRepository.markProcessed(event.webhookId);
            reconciled++;
            continue;
          }
        }
        await this.webhookEventRepository.markProcessed(event.webhookId);
      } catch (err: any) {
        await this.webhookEventRepository.markError(
          event.webhookId,
          err?.message || 'RECONCILE_FAILED',
        );
      }
    }
    return reconciled;
  }

  async confirmPayment(
    paymentCode: string,
    evidence?: { source: 'WEBHOOK' | 'SIMULATOR'; orderCode?: number },
  ): Promise<PaymentDocument> {
    const candidate =
      await this.paymentsRepository.findPaymentByCode(paymentCode);
    if (!candidate) throw new NotFoundException('Payment not found');
    const booking = await this.bookingModel.findById(candidate.bookingId);
    if (!booking) {
      throw new NotFoundException(
        'Không tìm thấy đơn đặt lịch tương ứng với giao dịch.',
      );
    }
    if (
      booking.contractFlowVersion === 2 &&
      booking.bookingType !== BookingType.Photography
    ) {
      if (!this.contractsV2Enabled)
        throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
      if (
        evidence?.source === 'WEBHOOK' &&
        evidence.orderCode !== undefined &&
        evidence.orderCode !== candidate.payos?.orderCode
      )
        throw new ConflictException('PAYMENT_ORDER_MISMATCH');
      if (
        candidate.status !== PaymentStatus.Pending &&
        candidate.status !== PaymentStatus.Success
      ) {
        if (evidence?.source !== 'WEBHOOK')
          throw new ForbiddenException('V2_PAYMENT_EVIDENCE_REQUIRED');
        return this.acknowledgeV2ForReview(
          candidate,
          booking,
          'PAYMENT_AFTER_FAILURE_EVENT',
        );
      }
      if (candidate.status === PaymentStatus.Pending && !evidence)
        throw new ForbiddenException('V2_PAYMENT_EVIDENCE_REQUIRED');
      return this.confirmV2Payment(candidate, booking);
    }
    if (
      candidate.status !== PaymentStatus.Pending &&
      candidate.status !== PaymentStatus.Success
    ) {
      throw new BadRequestException(
        `Cannot confirm payment with status: ${candidate.status}`,
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

  private async confirmV2Payment(
    candidate: PaymentDocument,
    booking: Booking & { _id: Types.ObjectId },
  ): Promise<PaymentDocument> {
    const binding = candidate.contractBinding;
    const key = candidate.contractIntentKey;
    if (candidate.status === PaymentStatus.Success) {
      await this.paymentRecovery.recordAcknowledged(
        candidate._id,
        booking._id,
        key ?? hashContract({ unboundPaymentId: candidate._id.toString() }),
      );
      if (
        booking.status === BookingStatus.Cancelled ||
        (booking.status === BookingStatus.PendingPayment &&
          (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()))
      )
        await this.paymentRecovery.requireReview(
          candidate._id,
          'PAYMENT_AFTER_HOLD_EXPIRY',
        );
      return candidate;
    }
    let ready = false;
    let decision: Awaited<ReturnType<ContractCheckoutGuard['evaluate']>> | null = null;
    if (binding && key) {
      try {
        decision = await this.contractCheckoutGuard.evaluate(
          booking._id.toString(),
          candidate.amount,
          candidate.purpose,
        );
        ready =
          !!decision.binding && paymentMatchesBinding(candidate, decision.binding);
      } catch {
        ready = false;
      }
    }
    if (!ready || !decision) {
      return this.acknowledgeV2ForReview(candidate, booking, 'CONTRACT_BINDING_STALE');
    }

    const session = await this.bookingModel.db.startSession();
    let acknowledged: PaymentDocument | null = null;
    try {
      await session.withTransaction(async () => {
        await this.contractCheckoutGuard.assertCurrent(decision!, session);
        await this.paymentExpiryClaim.claimFinalization(
          booking._id,
          candidate._id,
          session,
        );
        acknowledged = await this.paymentsRepository.model.findOneAndUpdate(
          { _id: candidate._id, status: PaymentStatus.Pending },
          { $set: { status: PaymentStatus.Success, paidAt: new Date() } },
          { new: true, session },
        );
        if (!acknowledged)
          throw new ConflictException('PAYMENT_STATUS_CHANGED');
        await this.paymentRecovery.recordAcknowledged(
          candidate._id,
          booking._id,
          key!,
          session,
        );
      });
    } catch (error) {
      const currentPayment = await this.paymentsRepository.findPaymentByCode(
        candidate.paymentCode,
      );
      if (currentPayment?.status === PaymentStatus.Success) return currentPayment;
      const currentBooking = await this.bookingModel.findById(booking._id);
      if (
        currentBooking?.status !== BookingStatus.PendingPayment ||
        !currentBooking.holdExpiresAt ||
        currentBooking.holdExpiresAt <= new Date()
      )
        return this.acknowledgeV2ForReview(
          candidate,
          booking,
          'PAYMENT_AFTER_HOLD_EXPIRY',
        );
      throw error;
    } finally {
      await session.endSession();
    }
    if (this.v2Finalizer && acknowledged) {
      try {
        await this.v2Finalizer.processPayment(candidate._id);
      } catch (e) {
        console.warn('V2 finalizer failed during confirmV2Payment:', e);
      }
    }
    return acknowledged!;
  }

  private async acknowledgeV2ForReview(
    candidate: PaymentDocument,
    booking: Booking & { _id: Types.ObjectId },
    reason: string,
  ): Promise<PaymentDocument> {
    const key =
      candidate.contractIntentKey ??
      hashContract({ unboundPaymentId: candidate._id.toString() });
    const session = await this.bookingModel.db.startSession();
    let payment: PaymentDocument | null = null;
    try {
      await session.withTransaction(async () => {
        payment = await this.paymentsRepository.model.findOneAndUpdate(
          {
            _id: candidate._id,
            status: {
              $in: [PaymentStatus.Pending, PaymentStatus.Failed, PaymentStatus.Cancelled],
            },
          },
          {
            $set: {
              status: PaymentStatus.Success,
              paidAt: new Date(),
              needsManualReview: true,
            },
          },
          { new: true, session },
        );
        if (!payment) {
          payment = await this.paymentsRepository.model.findById(candidate._id).session(session);
          if (payment?.status !== PaymentStatus.Success)
            throw new ConflictException('PAYMENT_STATUS_CHANGED');
        }
        await this.paymentRecovery.recordAcknowledged(
          candidate._id,
          booking._id,
          key,
          session,
        );
        await this.paymentRecovery.requireReview(candidate._id, reason, session);
        await this.bookingModel.updateOne(
          { _id: booking._id },
          {
            $set: {
              paymentReviewRequired: true,
              paymentReviewReason: reason,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return payment!;
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

        for (const providerId of updatedBooking.providerIds) {
          await this.notificationsService.createNotification(
            providerId.toString(),
            'Lịch đặt mới được thanh toán',
            'Đơn đặt lịch ' +
              updatedBooking.bookingCode +
              ' đã được khách hàng thanh toán cọc thành công.',
            NotificationType.Booking,
            { bookingId: updatedBooking._id },
          );
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
    const candidate = await this.paymentsRepository.findPaymentByCode(paymentCode);
    if (!candidate) throw new NotFoundException('Payment not found');
    const candidateBooking = await this.bookingModel.findById(candidate.bookingId).lean();
    if (candidateBooking?.contractFlowVersion === 2 && candidateBooking.bookingType !== BookingType.Photography) {
      if (!this.contractsV2Enabled)
        throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
      return this.failV2Payment(candidate, status);
    }
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
      if (!result) throw new NotFoundException('Payment not found');
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async failV2Payment(
    candidate: PaymentDocument,
    status: PaymentStatus.Failed | PaymentStatus.Cancelled,
  ): Promise<PaymentDocument> {
    if (candidate.status === PaymentStatus.Success) return candidate;
    if (candidate.status === status) return candidate;
    const session = await this.bookingModel.db.startSession();
    let result: PaymentDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const booking = await this.bookingModel.findById(candidate.bookingId).session(session).lean();
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status === BookingStatus.PendingPayment) {
          const moved = await this.bookingModel.updateOne({
            _id: booking._id,
            contractFlowVersion: 2,
            status: BookingStatus.PendingPayment,
            $or: [
              ...freePaymentClaimBranches(now),
              { 'paymentExpiryClaim.phase': 'INTENT', 'paymentExpiryClaim.paymentId': candidate._id },
            ],
          }, {
            $set: {
              status: BookingStatus.Cancelled,
              paymentExpiryClaim: newPaymentClaim('EXPIRY', now, new Date(now.getTime() + 60_000)),
            },
            $push: { statusTimeline: { status: BookingStatus.Cancelled, changedAt: now, note: 'V2_PAYMENT_FAILED' } },
          }, { session });
          if (moved.modifiedCount !== 1)
            throw new ConflictException('PAYMENT_EXPIRY_CLAIM_BUSY');
          await this.bookingModel.db.model('BookingSchedule').updateMany(
            { bookingId: booking._id, status: 'HELD' },
            { $set: { status: 'CANCELLED' } }, { session },
          );
          await this.bookingModel.db.model('InventoryReservation').updateMany(
            { bookingId: booking._id, status: 'TEMP_RESERVED' },
            { $set: { status: 'CANCELLED' }, $unset: { expiresAt: 1 } }, { session },
          );
          await this.promotionsService.releaseVoucher(booking._id, session);
        } else if (booking.status !== BookingStatus.Cancelled) {
          throw new ConflictException('BOOKING_ALREADY_FINALIZED');
        }
        result = await this.paymentsRepository.model.findOneAndUpdate(
          { _id: candidate._id, status: PaymentStatus.Pending },
          { $set: { status } }, { new: true, session },
        );
        if (!result) throw new ConflictException('PAYMENT_STATUS_CHANGED');
      });
    } finally {
      await session.endSession();
    }
    return result!;
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
