import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ProposalChangeType,
  ProposalStatus,
  WeatherProposal,
  WeatherProposalDocument,
} from '../schemas/weather-proposal.schema';
import { Booking, BookingDocument, BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemDocument, BookingItemType } from '../../bookings/schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { HeritageSpotsService } from './heritage-spots.service';
import { RefundOutboxService } from './refund-outbox.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ComboRescheduleCoordinatorService } from './combo-reschedule-coordinator.service';
import { WeatherNotificationService } from './weather-notification.service';
import { CreateWeatherProposalDto } from '../dto/create-weather-proposal.dto';
import { RespondWeatherProposalDto } from '../dto/respond-weather-proposal.dto';

@Injectable()
export class WeatherProposalsService {
  private readonly logger = new Logger(WeatherProposalsService.name);

  constructor(
    @InjectModel(WeatherProposal.name)
    private readonly proposalModel: Model<WeatherProposalDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    private readonly heritageSpotsService: HeritageSpotsService,
    private readonly refundOutboxService: RefundOutboxService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly comboCoordinator: ComboRescheduleCoordinatorService,
    @Optional()
    private readonly weatherNotificationService?: WeatherNotificationService,
  ) {}

  /**
   * Customer submits a Plan B proposal.
   * Adheres strictly to AD-01 (fee delta), AD-02 (quota rule), and hard ceiling TTL.
   */
  async createProposal(
    bookingIdStr: string,
    customerIdStr: string,
    dto: CreateWeatherProposalDto,
  ): Promise<WeatherProposalDocument> {
    if (!Types.ObjectId.isValid(bookingIdStr)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ.');
    }

    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch.');
    }

    // Authorization
    if (booking.customerId.toString() !== customerIdStr) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng này.');
    }

    // Must be active
    const allowedStatuses: BookingStatus[] = [BookingStatus.Confirmed, BookingStatus.DepositPaid];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Không thể gửi đề xuất Plan B khi đơn hàng ở trạng thái ${booking.status}.`,
      );
    }

    // Check financial locking flag
    if (booking.hasPendingWeatherAction) {
      throw new BadRequestException(
        'Đơn hàng đang có một đề xuất đổi lịch hoặc yêu cầu hủy thời tiết đang chờ xử lý.',
      );
    }

    // Quota Enforcement (AD-02 & AD-03):
    // LOCATION_ONLY is permitted even if quota >= 2
    if (dto.changeType !== ProposalChangeType.LOCATION_ONLY) {
      if ((booking.weatherRescheduleCount || 0) >= 2) {
        throw new BadRequestException(
          'Đơn hàng đã sử dụng hết 02 lần đổi ngày/giờ miễn phí theo chính sách thời tiết.',
        );
      }
    }

    // Retrieve original photography details
    const photoItem = await this.bookingItemModel.findOne({
      bookingId: booking._id,
      itemType: BookingItemType.PhotographyPackage,
    });

    if (!photoItem) {
      throw new BadRequestException('Đơn hàng không chứa gói chụp ảnh để áp dụng Plan B.');
    }

    const schedule = await this.bookingScheduleModel.findOne({
      bookingId: booking._id,
      scheduleType: BookingScheduleType.Photoshoot,
    });

    const oldDateStr = photoItem.shootDate
      ? new Date(photoItem.shootDate).toISOString().split('T')[0]
      : (schedule?.providerLocalDate || '');
    const oldTimeSlot = photoItem.shootTimeSlot || schedule?.timeSlot || '09:00-11:00';
    const oldSpotName = photoItem.shootLocation || 'Trung tâm TP. Huế';

    // Calculate original start time
    const now = new Date();
    let oldStartsAt: Date;
    if (schedule && schedule.startsAt) {
      oldStartsAt = new Date(schedule.startsAt);
    } else {
      const [sH, sM] = oldTimeSlot.split('-')[0].trim().split(':').map(Number);
      oldStartsAt = new Date(`${oldDateStr}T${String(sH || 9).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}:00+07:00`);
    }

    if (oldStartsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Buổi chụp ban đầu đã diễn ra hoặc đã bắt đầu, không thể tạo đề xuất đổi lịch.');
    }

    // Hard ceiling for Proposal TTL: min(now + 4h, oldStartsAt)
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const proposalExpiresAt = new Date(Math.min(fourHoursLater.getTime(), oldStartsAt.getTime()));

    if (proposalExpiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Thời gian còn lại trước giờ chụp cũ không đủ để tạo đề xuất.');
    }

    // Target schedule resolution
    let targetDate = oldDateStr;
    let targetTimeSlot = oldTimeSlot;

    if (dto.changeType === ProposalChangeType.SLOT_ONLY) {
      if (!dto.proposedTimeSlot) throw new BadRequestException('Vui lòng chọn khung giờ mới.');
      targetTimeSlot = dto.proposedTimeSlot;
    } else if (dto.changeType === ProposalChangeType.DATE_AND_SLOT) {
      if (!dto.proposedDate || !dto.proposedTimeSlot) {
        throw new BadRequestException('Vui lòng chọn ngày và khung giờ mới.');
      }
      targetDate = dto.proposedDate;
      targetTimeSlot = dto.proposedTimeSlot;
    }

    // Resolve spot details
    let proposedSpot: any = null;
    let proposedSpotIdObj: Types.ObjectId | null = null;
    if (dto.proposedSpotId && Types.ObjectId.isValid(dto.proposedSpotId)) {
      proposedSpot = await this.heritageSpotsService.findById(dto.proposedSpotId);
      proposedSpotIdObj = proposedSpot._id;
    }

    // Travel Fee Delta Calculation (AD-01)
    const oldSpotIdStr = (photoItem as any).spotId ? (photoItem as any).spotId.toString() : null;
    const proposedSpotIdStr = proposedSpotIdObj ? proposedSpotIdObj.toString() : null;

    const feeDelta = await this.heritageSpotsService.calculateTravelFeeDelta(
      oldSpotIdStr,
      proposedSpotIdStr,
    );

    // Acquire temporary Redis slot hold
    const photographerId = booking.providerIds[0];
    const holdKey = `hold:photographer:${photographerId}:${targetDate}:${targetTimeSlot}`;
    const ttlSeconds = Math.max(60, Math.floor((proposalExpiresAt.getTime() - now.getTime()) / 1000));

    await this.redisService.set(
      holdKey,
      { bookingId: booking._id.toString(), customerId: customerIdStr },
      ttlSeconds,
    );

    // Create WeatherProposal
    const proposal = await this.proposalModel.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      providerIds: booking.providerIds,
      changeType: dto.changeType,
      originalSchedule: {
        spotId: oldSpotIdStr ? new Types.ObjectId(oldSpotIdStr) : null,
        spotName: oldSpotName,
        date: oldDateStr,
        timeSlot: oldTimeSlot,
        travelFee: feeDelta.oldTravelFee,
      },
      proposedSchedule: {
        spotId: proposedSpotIdObj,
        spotName: proposedSpot ? proposedSpot.name : oldSpotName,
        date: targetDate,
        timeSlot: targetTimeSlot,
        travelFee: feeDelta.newTravelFee,
      },
      rawFeeDelta: feeDelta.rawFeeDelta,
      additionalFeeDue: feeDelta.additionalFeeDue, // AD-01: max(rawFeeDelta, 0)
      status: ProposalStatus.PENDING,
      proposalExpiresAt,
      temporaryHoldRef: holdKey,
    });

    // Update Booking financial locks
    await this.bookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          hasPendingWeatherAction: true,
          activeWeatherProposalId: proposal._id,
          disputeDeferredUntil: proposalExpiresAt,
        },
      },
    );

    this.logger.log(
      `Created weather proposal ${proposal._id} for booking ${booking.bookingCode} (additionalFeeDue: ${feeDelta.additionalFeeDue})`,
    );

    if (this.weatherNotificationService && proposal.providerIds && proposal.providerIds.length > 0) {
      await this.weatherNotificationService.sendPlanBProposed({
        proposal,
        booking,
        providerIds: proposal.providerIds,
      }).catch((e) => this.logger.warn(`Failed to send plan_b_proposed notification: ${e?.message}`));
    }

    return proposal;
  }

  /**
   * Provider responds (APPROVED | REJECTED) to a Plan B proposal.
   */
  async respondProposal(
    proposalIdStr: string,
    providerIdStr: string,
    dto: RespondWeatherProposalDto,
  ): Promise<WeatherProposalDocument> {
    const proposal = await this.proposalModel.findById(proposalIdStr);
    if (!proposal) {
      throw new NotFoundException('Không tìm thấy đề xuất đổi lịch.');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException(
        `Đề xuất đang ở trạng thái ${proposal.status}, không thể phản hồi.`,
      );
    }

    // Verify provider authorization
    const isAuthorized = proposal.providerIds.some(
      (pId) => pId.toString() === providerIdStr,
    );
    if (!isAuthorized) {
      throw new ForbiddenException('Bạn không phải đối tác của đơn đặt lịch này.');
    }

    const booking = await this.bookingModel.findById(proposal.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch tương ứng.');
    }

    // Multi-Provider Combo coordination
    if (
      this.comboCoordinator.isComboBooking(booking) ||
      (proposal.providerIds && proposal.providerIds.length > 1)
    ) {
      const result = await this.comboCoordinator.coordinateComboProposalResponse(
        proposalIdStr,
        providerIdStr,
        dto.decision,
        dto.rejectionReason,
      );
      return result.proposal;
    }

    const now = new Date();

    // 1. If REJECTED
    if (dto.decision === 'REJECTED') {
      proposal.status = ProposalStatus.REJECTED;
      proposal.providerResponses.set(providerIdStr, {
        decision: 'REJECTED',
        respondedAt: now,
        rejectionReason: dto.rejectionReason,
      });

      // Release temporary Redis lock
      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }

      // Reset booking lock
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );

      await proposal.save();
      this.logger.log(`Proposal ${proposal._id} REJECTED by provider ${providerIdStr}`);
      return proposal;
    }

    // 2. If APPROVED
    proposal.providerResponses.set(providerIdStr, {
      decision: 'APPROVED',
      respondedAt: now,
    });

    // CASE A: No fee due (additionalFeeDue === 0) -> Immediately apply!
    if (proposal.additionalFeeDue === 0) {
      await this.applyProposalChanges(proposal, booking);
      proposal.status = ProposalStatus.APPLIED;
      proposal.appliedAt = now;

      // Release Redis hold
      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }

      // Reset booking lock
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );

      await proposal.save();
      this.logger.log(`Proposal ${proposal._id} APPROVED & APPLIED (zero additional fee).`);
      return proposal;
    }

    // CASE B: Additional fee required (additionalFeeDue > 0)
    // Establish Payment TTL with hard ceiling: min(now + 15m, oldStartsAt)
    const oldDateStr = proposal.originalSchedule.date;
    const [sH, sM] = proposal.originalSchedule.timeSlot.split('-')[0].trim().split(':').map(Number);
    const oldStartsAt = new Date(`${oldDateStr}T${String(sH || 9).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}:00+07:00`);

    const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);
    const paymentExpiresAt = new Date(Math.min(fifteenMinsLater.getTime(), oldStartsAt.getTime()));

    if (paymentExpiresAt.getTime() <= now.getTime()) {
      // Payment TTL expired before payment could start -> Reject
      proposal.status = ProposalStatus.REJECTED;
      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );
      await proposal.save();
      throw new BadRequestException(
        'Thời gian trước giờ chụp cũ không còn đủ 15 phút để thanh toán phụ phí. Đề xuất tự động hủy.',
      );
    }

    // Create PayOS payment link details
    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
    const frontendBase = this.configService.get<string>('FRONTEND_URL', 'https://vibe-hue.vn');
    const checkoutUrl = `${frontendBase}/checkout/payment?orderCode=${orderCode}&amount=${proposal.additionalFeeDue}`;

    proposal.status = ProposalStatus.APPROVED_PENDING_PAYMENT;
    proposal.paymentExpiresAt = paymentExpiresAt;
    proposal.additionalPayment = {
      orderCode,
      amount: proposal.additionalFeeDue,
      status: 'PENDING',
      checkoutUrl,
      paymentLinkId: `link_prop_${orderCode}`,
    };

    // Extend Redis hold to match paymentExpiresAt
    if (proposal.temporaryHoldRef) {
      const ttlSec = Math.max(60, Math.floor((paymentExpiresAt.getTime() - now.getTime()) / 1000));
      await this.redisService.set(
        proposal.temporaryHoldRef,
        { bookingId: booking._id.toString(), orderCode },
        ttlSec,
      );
    }

    await proposal.save();
    this.logger.log(
      `Proposal ${proposal._id} APPROVED_PENDING_PAYMENT (orderCode: ${orderCode}, amount: ${proposal.additionalFeeDue})`,
    );

    if (this.weatherNotificationService) {
      await this.weatherNotificationService.sendPlanBPaymentRequired({
        proposal,
        booking,
        paymentUrl: checkoutUrl,
      }).catch((e) => this.logger.warn(`Failed to send plan_b_payment_required notification: ${e?.message}`));
    }

    return proposal;
  }

  /**
   * Captures additional travel fee payment.
   * Handles on-time success and late webhook durable auto-refund.
   */
  async captureProposalPayment(orderCode: number, amountPaid: number) {
    const proposal = await this.proposalModel.findOne({
      'additionalPayment.orderCode': orderCode,
    });

    if (!proposal) {
      throw new NotFoundException(`Không tìm thấy đề xuất tương ứng với mã thanh toán: ${orderCode}`);
    }

    const booking = await this.bookingModel.findById(proposal.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng tương ứng.');
    }

    const now = new Date();

    // 1. On-time payment (now <= paymentExpiresAt)
    if (
      proposal.status === ProposalStatus.APPROVED_PENDING_PAYMENT &&
      proposal.paymentExpiresAt &&
      now <= proposal.paymentExpiresAt
    ) {
      if (
        this.comboCoordinator.isComboBooking(booking) ||
        (proposal.providerIds && proposal.providerIds.length > 1)
      ) {
        await this.comboCoordinator.applyComboProposalChanges(proposal, booking);
      } else {
        await this.applyProposalChanges(proposal, booking);
      }

      proposal.status = ProposalStatus.APPLIED;
      proposal.appliedAt = now;
      if (proposal.additionalPayment) {
        proposal.additionalPayment.status = 'PAID';
        proposal.additionalPayment.paidAt = now;
      }

      if (proposal.temporaryHoldRef) {
        await this.redisService.del(proposal.temporaryHoldRef);
      }

      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            hasPendingWeatherAction: false,
            activeWeatherProposalId: null,
            disputeDeferredUntil: null,
          },
        },
      );

      await proposal.save();
      this.logger.log(`Proposal ${proposal._id} successfully APPLIED after on-time fee payment.`);
      return { success: true, status: ProposalStatus.APPLIED, proposal };
    }

    // 2. Late Webhook: payment captured after paymentExpiresAt
    this.logger.warn(
      `Late payment detected for proposal ${proposal._id} (orderCode: ${orderCode}). Enqueuing auto-refund.`,
    );

    proposal.status = ProposalStatus.EXPIRED_PAYMENT_CAPTURED;
    if (proposal.additionalPayment) {
      proposal.additionalPayment.status = 'PAID_LATE';
      proposal.additionalPayment.paidAt = now;
    }

    if (proposal.temporaryHoldRef) {
      await this.redisService.del(proposal.temporaryHoldRef);
    }

    await this.bookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          hasPendingWeatherAction: false,
          activeWeatherProposalId: null,
          disputeDeferredUntil: null,
        },
      },
    );

    await proposal.save();

    // Enqueue automatic refund into Transactional Outbox
    await this.refundOutboxService.enqueueRefund({
      bookingId: proposal.bookingId,
      amount: amountPaid,
      reason: 'Hoàn trả phụ phí do thanh toán sau khi đề xuất đổi lịch đã hết hạn',
      sourceEventId: `refund:late_fee:${proposal._id}`,
    });

    return {
      success: false,
      status: ProposalStatus.EXPIRED_PAYMENT_CAPTURED,
      message: 'Thanh toán phụ phí quá hạn. Hệ thống đã đưa giao dịch vào hàng đợi hoàn tiền tự động.',
      proposal,
    };
  }

  /**
   * Applies the proposed schedule changes to Booking, BookingItem and BookingSchedule.
   * Increments weatherRescheduleCount per AD-02 (unless LOCATION_ONLY).
   */
  private async applyProposalChanges(
    proposal: WeatherProposalDocument,
    booking: BookingDocument,
  ): Promise<void> {
    const proposed = proposal.proposedSchedule;

    // 1. Update BookingItem
    await this.bookingItemModel.updateOne(
      {
        bookingId: booking._id,
        itemType: BookingItemType.PhotographyPackage,
      },
      {
        $set: {
          shootDate: new Date(proposed.date),
          shootTimeSlot: proposed.timeSlot,
          shootLocation: proposed.spotName,
          spotId: proposed.spotId,
        },
      },
    );

    // 2. Update BookingSchedule
    const [sH, sM] = proposed.timeSlot.split('-')[0].trim().split(':').map(Number);
    const [eH, eM] = proposed.timeSlot.split('-')[1].trim().split(':').map(Number);
    const startsAt = new Date(`${proposed.date}T${String(sH || 9).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}:00+07:00`);
    const endsAt = new Date(`${proposed.date}T${String(eH || 11).padStart(2, '0')}:${String(eM || 0).padStart(2, '0')}:00+07:00`);

    await this.bookingScheduleModel.updateOne(
      {
        bookingId: booking._id,
        scheduleType: BookingScheduleType.Photoshoot,
      },
      {
        $set: {
          startsAt,
          endsAt,
          providerLocalDate: proposed.date,
          timeSlot: proposed.timeSlot,
        },
      },
    );

    // 3. Increment weatherRescheduleCount per AD-02
    // LOCATION_ONLY -> do NOT increment
    // SLOT_ONLY or DATE_AND_SLOT -> increment by 1
    if (proposal.changeType !== ProposalChangeType.LOCATION_ONLY) {
      await this.bookingModel.updateOne(
        { _id: booking._id },
        {
          $inc: { weatherRescheduleCount: 1 },
        },
      );
    }

    if (this.weatherNotificationService) {
      const recipientUserIds = [booking.customerId.toString()];
      await this.weatherNotificationService.sendPlanBApplied({
        proposal,
        booking,
        recipientUserIds,
      }).catch((e) => this.logger.warn(`Failed to send plan_b_applied notification: ${e?.message}`));
    }
  }

  /**
   * Customer cancels pending proposal
   */
  async cancelProposal(proposalIdStr: string, customerIdStr: string): Promise<WeatherProposalDocument> {
    const proposal = await this.proposalModel.findById(proposalIdStr);
    if (!proposal) throw new NotFoundException('Không tìm thấy đề xuất.');

    if (proposal.customerId.toString() !== customerIdStr) {
      throw new ForbiddenException('Bạn không có quyền hủy đề xuất này.');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể hủy đề xuất đang ở trạng thái PENDING.');
    }

    proposal.status = ProposalStatus.CANCELLED;
    if (proposal.temporaryHoldRef) {
      await this.redisService.del(proposal.temporaryHoldRef);
    }

    await this.bookingModel.updateOne(
      { _id: proposal.bookingId },
      {
        $set: {
          hasPendingWeatherAction: false,
          activeWeatherProposalId: null,
          disputeDeferredUntil: null,
        },
      },
    );

    await proposal.save();
    return proposal;
  }

  async getProposal(id: string): Promise<WeatherProposalDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.proposalModel.findById(id).exec();
  }

  async listProposalsByBooking(bookingId: string): Promise<WeatherProposalDocument[]> {
    if (!Types.ObjectId.isValid(bookingId)) return [];
    return this.proposalModel.find({ bookingId }).sort({ createdAt: -1 }).exec();
  }
}
