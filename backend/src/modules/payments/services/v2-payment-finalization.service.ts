import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Booking, BookingStatus, BookingType, PaymentStatus as BookingPaymentStatus } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleStatus } from '../../bookings/schemas/booking-schedule.schema';
import { PhotographyHoldService } from '../../bookings/services/photography-hold.service';
import { CONTRACTS_V2_ENABLED } from '../../contracts/contracts.constants';
import { ContractPolicyService } from '../../contracts/contract-policy.service';
import { ContractPreparationService } from '../../contracts/contract-preparation.service';
import { ContractSnapshotService } from '../../contracts/contract-snapshot.service';
import { ContractTemplateService } from '../../contracts/contract-template';
import { ContractEvidenceService } from '../../contracts/contract-evidence.service';
import { hashContract } from '../../contracts/canonical-contract';
import { DigitalContract } from '../../bookings/schemas/digital-contract.schema';
import { ContractVersion, ContractVersionState } from '../../contracts/schemas/contract-version.schema';
import { ContractConsent, ContractConsentAction } from '../../contracts/schemas/contract-consent.schema';
import { InventoryReservation, ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { PromotionsService } from '../../products/services/promotions.service';
import { Notification, NotificationType } from '../../notifications/schemas/notification.schema';
import { BookingEscrow, EscrowStatus } from '../schemas/booking-escrow.schema';
import { Payment, PaymentStatus } from '../schemas/payment.schema';
import { PaymentRecovery, PaymentRecoveryState } from '../schemas/payment-recovery.schema';
import { contractIntentKey } from './contract-payment-binding';
import { PaymentRecoveryService } from './payment-recovery.service';

export class FinalizationReviewError extends Error {
  constructor(readonly code: string) { super(code); }
}

/** V2 database finalizer. Every durable side effect and COMPLETED share one transaction. */
@Injectable()
export class V2PaymentFinalizationService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(BookingItem.name) private readonly items: Model<BookingItem>,
    @InjectModel(BookingSchedule.name) private readonly schedules: Model<BookingSchedule>,
    @InjectModel(InventoryReservation.name) private readonly reservations: Model<InventoryReservation>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(PaymentRecovery.name) private readonly recoveries: Model<PaymentRecovery>,
    @InjectModel(BookingEscrow.name) private readonly escrows: Model<BookingEscrow>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(DigitalContract.name) private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name) private readonly versions: Model<ContractVersion>,
    @InjectModel(ContractConsent.name) private readonly consents: Model<ContractConsent>,
    private readonly photoHolds: PhotographyHoldService,
    private readonly promotions: PromotionsService,
    private readonly recovery: PaymentRecoveryService,
    private readonly contractPolicy: ContractPolicyService,
    private readonly preparation: ContractPreparationService,
    private readonly snapshots: ContractSnapshotService,
    private readonly templates: ContractTemplateService,
    @Optional()
    private readonly contractEvidence?: ContractEvidenceService,
  ) {}

  @Interval(15_000)
  async processDue(): Promise<number> {
    if (!this.enabled) return 0;
    const now = new Date();
    const due = await this.recoveries.find({
      $or: [
        { state: PaymentRecoveryState.FinalizationPending, nextAttemptAt: { $lte: now } },
        { state: PaymentRecoveryState.Finalizing, leaseUntil: { $lte: now } },
      ],
    }).select('paymentId').limit(25).lean();
    let processed = 0;
    for (const row of due) {
      if (await this.processPayment(row.paymentId)) {
        processed++;
      }
    }
    return processed;
  }

  async processPayment(paymentId: Types.ObjectId): Promise<boolean> {
    if (!this.enabled) return false;
    const claimed = await this.recovery.claim(paymentId);
    if (!claimed) return false;
    try {
      await this.finalize(paymentId, claimed.token);
      return true;
    } catch (error) {
      if (error instanceof FinalizationReviewError && error.code === 'RECOVERY_LEASE_LOST') {
        return false;
      }
      if (error instanceof FinalizationReviewError) {
        if (await this.recovery.requireReviewClaimed(paymentId, claimed.token, error.code))
          await this.payments.updateOne({ _id: paymentId }, { $set: { needsManualReview: true } });
      } else {
        await this.recovery.retry(paymentId, claimed.token, 'FINALIZATION_RETRY');
      }
      return false;
    }
  }

  async finalize(paymentId: Types.ObjectId, token: string): Promise<void> {
    if (!this.enabled) throw new FinalizationReviewError('CONTRACTS_V2_DISABLED');
    const session = await this.bookings.db.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const job = await this.recoveries.findOne({
          paymentId,
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: { $gt: now },
        }).session(session).lean();
        if (!job) throw new FinalizationReviewError('RECOVERY_LEASE_LOST');
        const payment = await this.payments.findById(paymentId).session(session).lean();
        if (!payment || payment.status !== PaymentStatus.Success ||
          !payment.contractBinding || payment.contractBinding.flowVersion !== 2 ||
          payment.contractIntentKey !== job.bindingKey ||
          contractIntentKey(payment.contractBinding) !== job.bindingKey ||
          !payment.bookingId.equals(job.bookingId))
          throw new FinalizationReviewError('PAYMENT_BINDING_INVALID');
        const booking = await this.bookings.findById(job.bookingId).session(session).lean();
        const isAlreadyConfirmed =
          booking?.status === BookingStatus.Confirmed &&
          booking?.contractFlowVersion === 2 &&
          booking?.finalizedPaymentId?.equals(paymentId) &&
          booking?.finalizedContractKey === job.bindingKey;
        if (
          !booking ||
          booking.contractFlowVersion !== 2 ||
          (!isAlreadyConfirmed &&
            (booking.status !== BookingStatus.PendingPayment ||
              booking.paymentExpiryClaim?.phase !== 'FINALIZING' ||
              !booking.paymentExpiryClaim.paymentId?.equals(paymentId)))
        )
          throw new FinalizationReviewError('BOOKING_CLAIM_INVALID');

        const context = await this.contractPolicy.getContext(booking._id.toString());
        const template = this.templates.getApproved();
        if (context.rentalProviderIds.length !== payment.contractBinding.versions.length)
          throw new FinalizationReviewError('CONTRACT_PROVIDER_SET_CHANGED');
        for (const bound of payment.contractBinding.versions) {
          if (!context.rentalProviderIds.some((id) => id.equals(bound.providerId)))
            throw new FinalizationReviewError('CONTRACT_PROVIDER_SET_CHANGED');
          await this.preparation.assertSourcesUnchanged(context, bound.providerId, session);
          const contract = await this.contracts.findById(bound.contractId).session(session).lean();
          const version = await this.versions.findById(bound.contractVersionId).session(session).lean();
          const consent = await this.consents.findOne({
            contractVersionId: bound.contractVersionId,
            actorUserId: booking.customerId,
            action: ContractConsentAction.Accept,
          }).session(session).lean();
          const snapshot = await this.snapshots.build(context, bound.providerId, template);
          const fingerprint = hashContract({
            booking: snapshot.booking,
            providerItems: snapshot.providerItems,
            pricing: snapshot.pricing,
          });
          if (!contract?.currentVersionId?.equals(bound.contractVersionId) ||
            version?.state !== ContractVersionState.Accepted ||
            version.contentHash !== bound.contentHash ||
            version.bookingFingerprint !== bound.bookingFingerprint ||
            consent?.contentHash !== bound.contentHash ||
            consent.bookingFingerprint !== bound.bookingFingerprint ||
            fingerprint !== bound.bookingFingerprint ||
            hashContract({ template, snapshot }) !== bound.contentHash)
            throw new FinalizationReviewError('CONTRACT_BINDING_STALE');
        }

        const productItems = await this.items.find({
          bookingId: booking._id,
          itemType: BookingItemType.Product,
        }).session(session).lean();
        if (!productItems.length) throw new FinalizationReviewError('RENTAL_ITEMS_MISSING');
        for (const item of productItems) {
          const held = await this.reservations.countDocuments({
            bookingId: booking._id,
            bookingItemId: item._id,
            $or: [
              { status: ReservationStatus.TempReserved, expiresAt: { $gt: now } },
              { status: ReservationStatus.Confirmed },
            ],
          }).session(session);
          if (held < item.quantity) throw new FinalizationReviewError('INVENTORY_HOLD_MISSING');
        }
        const photo = await this.photoHolds.confirmForBooking(booking._id, session);
        if (!photo.confirmed) throw new FinalizationReviewError('PHOTOGRAPHY_HOLD_MISSING');

        const successful = await this.payments.find({
          bookingId: booking._id,
          status: PaymentStatus.Success,
          contractIntentKey: job.bindingKey,
          needsManualReview: { $ne: true },
        })
          .select('amount').session(session).lean();
        const totalPaid = successful.reduce((sum, row) => sum + row.amount, 0);
        const subsidy = booking.pricingSummary?.platformSubsidyAmount || 0;
        const photoItems = await this.items.find({ bookingId: booking._id, itemType: BookingItemType.PhotographyPackage })
          .session(session).lean();
        const photoRemaining = photoItems.reduce((sum, item) => sum + Math.round(item.unitPrice * 0.7) * item.quantity, 0);
        const required = booking.bookingType === BookingType.Combo
          ? booking.pricingSummary.grandTotal - photoRemaining
          : booking.pricingSummary.grandTotal;
        if (totalPaid + subsidy < required) throw new FinalizationReviewError('PAYMENT_AMOUNT_INSUFFICIENT');

        if (!isAlreadyConfirmed) {
          const moved = await this.bookings.updateOne({
            _id: booking._id,
            status: BookingStatus.PendingPayment,
            contractFlowVersion: 2,
            'paymentExpiryClaim.phase': 'FINALIZING',
            'paymentExpiryClaim.paymentId': paymentId,
          }, {
            $set: {
              status: BookingStatus.Confirmed,
              'paymentSummary.totalPaid': totalPaid,
              'paymentSummary.paymentStatus': totalPaid + subsidy >= booking.pricingSummary.grandTotal
                ? BookingPaymentStatus.Paid : BookingPaymentStatus.PartiallyPaid,
              paymentExpiryClaim: null,
              finalizedPaymentId: paymentId,
              finalizedContractKey: job.bindingKey,
            },
            $inc: { revision: 1 },
            $push: { statusTimeline: { status: BookingStatus.Confirmed, changedAt: now, note: 'V2_PAYMENT_FINALIZED' } },
          }, { session });
          if (moved.modifiedCount !== 1) throw new FinalizationReviewError('BOOKING_CLAIM_LOST');
        }
        await this.reservations.updateMany({ bookingId: booking._id, status: ReservationStatus.TempReserved },
          { $set: { status: ReservationStatus.Confirmed }, $unset: { expiresAt: 1 } }, { session });
        await this.schedules.updateMany({ bookingId: booking._id, status: BookingScheduleStatus.Held },
          { $set: { status: BookingScheduleStatus.Confirmed }, $unset: { holdExpiresAt: 1 } }, { session });
        const redemption = await this.promotions.findRedemptionByBooking(booking._id, session);
        if (redemption?.status === 'RELEASED') throw new FinalizationReviewError('VOUCHER_ALREADY_RELEASED');
        if (redemption?.status === 'RESERVED') await this.promotions.redeemVoucher(booking._id, session);
        await this.escrows.updateOne({ bookingId: booking._id }, { $setOnInsert: {
          bookingId: booking._id,
          totalAmountCollected: booking.pricingSummary.grandTotal,
          damageDepositAmount: booking.pricingSummary.depositTotal,
          status: EscrowStatus.Held,
        } }, { upsert: true, session });
        const notificationId = new Types.ObjectId(createHash('sha256')
          .update(`v2-payment:${paymentId.toString()}:customer`).digest('hex').slice(0, 24));
        await this.notifications.updateOne({ _id: notificationId }, { $setOnInsert: {
          _id: notificationId,
          userId: booking.customerId,
          title: 'Thanh toán thành công',
          content: `Đơn ${booking.bookingCode} đã được ghi nhận thanh toán.`,
          type: NotificationType.Payment,
          isRead: false,
          metadata: { bookingId: booking._id, paymentId },
        } }, { upsert: true, session });
        const completed = await this.recoveries.updateOne({
          paymentId, state: PaymentRecoveryState.Finalizing, leaseToken: token,
        }, { $set: { state: PaymentRecoveryState.Completed, completedAt: now,
          leaseToken: null, leaseUntil: null, lastErrorCode: null } }, { session });
        if (completed.modifiedCount !== 1) throw new FinalizationReviewError('RECOVERY_LEASE_LOST');
      });
    } finally {
      await session.endSession();
    }

    // Decoupled asynchronous PDF evidence generation (out-of-transaction)
    if (this.contractEvidence) {
      try {
        const paymentDoc = await this.payments.findById(paymentId).lean();
        if (paymentDoc?.contractBinding?.versions) {
          for (const bound of paymentDoc.contractBinding.versions) {
            try {
              await this.contractEvidence.generateAndStorePdf(bound.contractVersionId);
            } catch (err: any) {
              console.warn(`[Phase6] Deferred PDF generation for version ${bound.contractVersionId.toString()} logged error: ${err?.message}`);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Phase6] Deferred PDF evidence trigger error: ${err?.message}`);
      }
    }
  }
}
