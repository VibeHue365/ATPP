import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SecurityRequestContext, SecurityLogService } from '../../auth/services/security-log.service';
import { AdminAuditAction } from '../../auth/schemas/admin-audit-log.schema';
import { Booking, BookingStatus, PaymentStatus as BookingPaymentStatus } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import { Payment, PaymentStatus } from '../../payments/schemas/payment.schema';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';
import { SettlementStatus } from '../constants/settlement-status.enum';
import {
  HoldSettlementDto,
  MarkSettlementSettledDto,
  RegenerateSettlementsDto,
  ReleaseSettlementDto,
} from '../dto/settlement.dto';
import { Settlement } from '../schemas/settlement.schema';
import { SettlementAdjustment } from '../schemas/settlement-adjustment.schema';
import { SettlementCalculationService } from './settlement-calculation.service';
import { SettlementCodeService } from './settlement-code.service';

@Injectable()
export class SettlementsService {
  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<Settlement>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,
    @InjectModel(SettlementAdjustment.name)
    private readonly adjustmentModel: Model<SettlementAdjustment>,
    private readonly calculationService: SettlementCalculationService,
    private readonly codeService: SettlementCodeService,
    private readonly securityLogService: SecurityLogService,
  ) {}

  async createSettlementsForBooking(bookingId: string): Promise<Settlement[]> {
    const bookingObjectId = this.toObjectId(bookingId);
    const booking = await this.bookingModel.findById(bookingObjectId);

    if (!booking) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.BookingNotFound);
    }

    if (!this.isEligibleForSettlement(booking)) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.BookingNotCompleted,
      );
    }

    const validPaymentStatuses = [
      BookingPaymentStatus.Paid,
      BookingPaymentStatus.PartiallyPaid,
    ];
    if (
      booking.status !== BookingStatus.Completed &&
      !validPaymentStatuses.includes(booking.paymentSummary?.paymentStatus as any)
    ) {
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.BookingNotPaid);
    }

    const items = await this.loadBookingItems(bookingObjectId);
    if (items.length === 0) {
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.NoBookingItems);
    }

    const distinctProviderCount = this.countDistinctProviders(items);
    const existing = await this.assertNoPartialStateOrReturnExisting(
      bookingObjectId,
      distinctProviderCount,
    );

    if (existing) {
      return existing;
    }

    const latestPayment = await this.paymentModel
      .findOne({
        bookingId: bookingObjectId,
        status: PaymentStatus.Success,
      })
      .sort({ paidAt: -1, createdAt: -1 });

    const payloads = await this.calculationService.calculateSettlementsForBooking(
      {
        _id: booking._id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        paymentSummary: booking.paymentSummary,
      },
      items,
      latestPayment
        ? {
            _id: latestPayment._id,
            amount: latestPayment.amount,
            status: latestPayment.status,
            paidAt: latestPayment.paidAt,
          }
        : null,
      false,
    );

    const settlementCodes: string[] = [];
    const documents = [];
    for (const payload of payloads) {
      const settlementCode = await this.codeService.generateSettlementCode();
      settlementCodes.push(settlementCode);
      documents.push({ settlementCode, ...payload });
    }

    try {
      const settlements = await this.settlementModel.insertMany(documents, {
        ordered: true,
      });
      await this.markGenerationSuccess(bookingObjectId);
      await this.auditCreated(settlements);
      return settlements;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const concurrentExisting =
          await this.assertNoPartialStateOrReturnExisting(
            bookingObjectId,
            distinctProviderCount,
          );

        if (concurrentExisting) {
          return concurrentExisting;
        }
      }

      await this.settlementModel.deleteMany({
        settlementCode: { $in: settlementCodes },
      });
      await this.markGenerationFailure(bookingObjectId, error);
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.GenerationFailed);
    }
  }

  async regenerateSettlementsForBooking(
    bookingId: string,
    actorId: string,
    dto: RegenerateSettlementsDto,
    context?: SecurityRequestContext,
  ): Promise<Settlement[]> {
    const bookingObjectId = this.toObjectId(bookingId);
    const booking = await this.bookingModel.findById(bookingObjectId);

    if (!booking) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.BookingNotFound);
    }

    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.BookingNotCompleted,
      );
    }

    const items = await this.loadBookingItems(bookingObjectId);
    const distinctProviderCount = this.countDistinctProviders(items);
    const existing = await this.assertNoPartialStateOrReturnExisting(
      bookingObjectId,
      distinctProviderCount,
    );

    if (existing) {
      return existing;
    }

    const settlements = await this.createSettlementsForBooking(bookingId);
    await this.auditMany(
      settlements,
      actorId,
      AdminAuditAction.SettlementRegenerated,
      dto.reason,
      context,
    );

    return settlements;
  }

  async holdSettlement(
    actorId: string,
    settlementId: string,
    dto: HoldSettlementDto,
    context?: SecurityRequestContext,
  ): Promise<Settlement> {
    const id = this.toObjectId(settlementId);
    const before = await this.findByIdOrThrow(id);
    const settlement = await this.settlementModel.findOneAndUpdate(
      { _id: id, status: SettlementStatus.ReadyToSettle },
      {
        $set: {
          status: SettlementStatus.OnHold,
          holdReason: dto.reason,
        },
      },
      { new: true },
    );

    if (!settlement) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }

    await this.auditOne(
      settlement,
      actorId,
      AdminAuditAction.SettlementHeld,
      dto.reason,
      context,
      before,
    );

    return settlement;
  }

  async releaseSettlement(
    actorId: string,
    settlementId: string,
    dto: ReleaseSettlementDto,
    context?: SecurityRequestContext,
  ): Promise<Settlement> {
    const id = this.toObjectId(settlementId);
    const before = await this.findByIdOrThrow(id);
    const settlement = await this.settlementModel.findOneAndUpdate(
      { _id: id, status: SettlementStatus.OnHold },
      {
        $set: {
          status: SettlementStatus.ReadyToSettle,
          holdReason: null,
        },
      },
      { new: true },
    );

    if (!settlement) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }

    await this.auditOne(
      settlement,
      actorId,
      AdminAuditAction.SettlementReleased,
      dto.reason,
      context,
      before,
    );

    return settlement;
  }

  async markSettled(
    actorId: string,
    settlementId: string,
    dto: MarkSettlementSettledDto,
    context?: SecurityRequestContext,
  ): Promise<Settlement> {
    const id = this.toObjectId(settlementId);
    const before = await this.findByIdOrThrow(id);
    const adjustmentAmount = await this.applyPendingAdjustments(before);
    const settlement = await this.settlementModel.findOneAndUpdate(
      {
        _id: id,
        status: SettlementStatus.ReadyToSettle,
        payableAmount: { $gte: 0 },
      },
      {
        $set: {
          status: SettlementStatus.Settled,
          settledBy: this.toObjectId(actorId),
          settledAt: new Date(),
          payoutReference: dto.payoutReference ?? null,
          note: [dto.note, adjustmentAmount > 0 ? `Applied refund adjustment: ${adjustmentAmount}` : null].filter(Boolean).join(' | ') || null,
        },
      },
      { new: true },
    );

    if (!settlement) {
      throw new BadRequestException(
        SETTLEMENT_ERROR_CODES.StatusTransitionInvalid,
      );
    }

    await this.auditOne(
      settlement,
      actorId,
      AdminAuditAction.SettlementMarkedSettled,
      dto.note ?? dto.payoutReference ?? null,
      context,
      before,
    );

    return settlement;
  }

  private async applyPendingAdjustments(settlement: Settlement): Promise<number> {
    let remainingPayable = settlement.payableAmount;
    let appliedTotal = 0;
    const adjustments = await this.adjustmentModel.find({ providerId: settlement.providerId, status: 'PENDING' }).sort({ createdAt: 1 });
    for (const adjustment of adjustments) {
      if (remainingPayable <= 0) break;
      const outstanding = adjustment.amount - (adjustment.appliedAmount || 0);
      const applied = Math.min(remainingPayable, outstanding);
      if (applied <= 0) continue;
      const nextApplied = (adjustment.appliedAmount || 0) + applied;
      await this.adjustmentModel.updateOne(
        { _id: adjustment._id, status: 'PENDING', appliedAmount: adjustment.appliedAmount || 0 },
        { $set: { appliedAmount: nextApplied, status: nextApplied >= adjustment.amount ? 'APPLIED' : 'PENDING' } },
      );
      remainingPayable -= applied;
      appliedTotal += applied;
    }
    if (appliedTotal > 0) {
      await this.settlementModel.updateOne(
        { _id: (settlement as any)._id, status: SettlementStatus.ReadyToSettle, payableAmount: { $gte: appliedTotal } },
        { $inc: { payableAmount: -appliedTotal, refundAmount: appliedTotal } },
      );
    }
    return appliedTotal;
  }

  async holdSettlementsForBooking(
    bookingId: string,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    await this.settlementModel.updateMany(
      {
        bookingId: this.toObjectId(bookingId),
        status: SettlementStatus.ReadyToSettle,
      },
      {
        $set: {
          status: SettlementStatus.OnHold,
          holdReason: reason,
        },
      },
    );

    if (actorId) {
      const settlements = await this.settlementModel.find({
        bookingId: this.toObjectId(bookingId),
      });
      await this.auditMany(
        settlements,
        actorId,
        AdminAuditAction.SettlementHeld,
        reason,
      );
    }
  }

  async releaseSettlementsForBooking(
    bookingId: string,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    await this.settlementModel.updateMany(
      {
        bookingId: this.toObjectId(bookingId),
        status: SettlementStatus.OnHold,
      },
      {
        $set: {
          status: SettlementStatus.ReadyToSettle,
          holdReason: null,
        },
      },
    );

    if (actorId) {
      const settlements = await this.settlementModel.find({
        bookingId: this.toObjectId(bookingId),
      });
      await this.auditMany(
        settlements,
        actorId,
        AdminAuditAction.SettlementReleased,
        reason,
      );
    }
  }

  async cancelSettlementsForBooking(
    bookingId: string,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    await this.settlementModel.updateMany(
      {
        bookingId: this.toObjectId(bookingId),
        status: { $in: [SettlementStatus.ReadyToSettle, SettlementStatus.OnHold] },
      },
      {
        $set: {
          status: SettlementStatus.Cancelled,
          holdReason: reason,
        },
      },
    );

    if (actorId) {
      const settlements = await this.settlementModel.find({
        bookingId: this.toObjectId(bookingId),
      });
      await this.auditMany(
        settlements,
        actorId,
        AdminAuditAction.SettlementCancelled,
        reason,
      );
    }
  }

  private async loadBookingItems(bookingId: Types.ObjectId) {
    return this.bookingItemModel
      .find({ bookingId })
      .populate('productId')
      .populate('photographyPackageId');
  }

  private countDistinctProviders(items: Array<{ providerId: Types.ObjectId }>): number {
    return new Set(items.map((item) => item.providerId.toString())).size;
  }

  private async assertNoPartialStateOrReturnExisting(
    bookingId: Types.ObjectId,
    distinctProviderCount: number,
  ): Promise<Settlement[] | null> {
    const existing = await this.settlementModel
      .find({ bookingId })
      .sort({ providerId: 1 });

    if (existing.length === 0) {
      return null;
    }

    if (existing.length === distinctProviderCount) {
      return existing;
    }

    throw new BadRequestException(
      SETTLEMENT_ERROR_CODES.PartialStateDetected,
    );
  }

  private isEligibleForSettlement(booking: Booking): boolean {
    if (booking.status === BookingStatus.Completed) return true;
    if (booking.status !== BookingStatus.Returned) return false;
    if ((booking.bookingType as string) === 'AODAI_RENTAL') return true;
    const isComboPhotoDelivered =
      Boolean(booking.photosApproved) ||
      Boolean((booking as any).photosApproved) ||
      Boolean((booking as any).deliveredPhotos?.length > 0) ||
      Boolean((booking as any).deliveryDriveUrl) ||
      booking.statusTimeline?.some((t) => t.status === BookingStatus.ComboPhotosApproved || t.status === BookingStatus.Completed);
    return (booking.bookingType as string) === 'COMBO' && isComboPhotoDelivered;
  }

  private async markGenerationSuccess(bookingId: Types.ObjectId): Promise<void> {
    await this.bookingModel.updateOne(
      { _id: bookingId },
      {
        $set: { settlementsGeneratedAt: new Date() },
        $unset: {
          settlementGenerationFailedAt: '',
          settlementGenerationError: '',
        },
      },
    );
  }

  private async markGenerationFailure(
    bookingId: Types.ObjectId,
    error: unknown,
  ): Promise<void> {
    await this.bookingModel.updateOne(
      { _id: bookingId },
      {
        $set: {
          settlementGenerationFailedAt: new Date(),
          settlementGenerationError:
            error instanceof Error ? error.message : String(error),
        },
      },
    );
  }

  private async findByIdOrThrow(id: Types.ObjectId): Promise<Settlement> {
    const settlement = await this.settlementModel.findById(id);
    if (!settlement) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.NotFound);
    }
    return settlement;
  }

  private async auditCreated(settlements: Settlement[]): Promise<void> {
    await this.auditMany(
      settlements,
      null,
      AdminAuditAction.SettlementCreated,
      'Settlement generated after booking completed',
    );
  }

  private async auditMany(
    settlements: Settlement[],
    actorId: string | null,
    action: AdminAuditAction,
    reason?: string | null,
    context?: SecurityRequestContext,
  ): Promise<void> {
    for (const settlement of settlements) {
      await this.auditOne(settlement, actorId, action, reason, context);
    }
  }

  private async auditOne(
    settlement: Settlement,
    actorId: string | null,
    action: AdminAuditAction,
    reason?: string | null,
    context?: SecurityRequestContext,
    before?: Settlement | null,
  ): Promise<void> {
    await this.securityLogService.recordAdminAudit({
      actorId: actorId ? this.toObjectId(actorId) : null,
      targetSettlementId:
        (settlement as unknown as { _id?: Types.ObjectId })._id ?? null,
      action,
      before: before ? this.toAuditState(before) : null,
      after: this.toAuditState(settlement),
      reason,
      context,
    });
  }

  private toAuditState(settlement: Settlement): Record<string, unknown> {
    return {
      settlementCode: settlement.settlementCode,
      bookingId: settlement.bookingId?.toString(),
      providerId: settlement.providerId?.toString(),
      status: settlement.status,
      grossAmount: settlement.grossAmount,
      commissionAmount: settlement.commissionAmount,
      allocatedPlatformFee: settlement.allocatedPlatformFee,
      netAmount: settlement.netAmount,
      payableAmount: settlement.payableAmount,
      holdReason: settlement.holdReason ?? null,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
