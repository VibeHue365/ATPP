import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CancellationEligibilityBasis,
  CancellationReviewStatus,
  WeatherCancellationRequest,
  WeatherCancellationRequestDocument,
} from '../schemas/weather-cancellation.schema';
import {
  HeritageSpot,
  HeritageSpotDocument,
  HeritageSpotSpaceType,
} from '../schemas/heritage-spot.schema';
import {
  Booking,
  BookingDocument,
  BookingStatus,
} from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemDocument,
  BookingItemType,
} from '../../bookings/schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { Payment, PaymentStatus } from '../../payments/schemas/payment.schema';
import {
  RefundMode,
  RefundRequest,
  RefundRequestDocument,
  RefundStatus,
  RefundType,
} from '../../payments/schemas/refund-request.schema';
import { OpenMeteoClientService } from './open-meteo-client.service';
import { HeritageScoringService } from './heritage-scoring.service';
import { RefundOutboxService } from './refund-outbox.service';
import { WeatherNotificationService } from './weather-notification.service';
import { SubmitWeatherCancellationDto } from '../dto/submit-weather-cancellation.dto';
import { AdminReviewWeatherCancellationDto } from '../dto/admin-review-weather-cancellation.dto';
import { ListWeatherCancellationsQueryDto } from '../dto/list-weather-cancellations-query.dto';

@Injectable()
export class WeatherCancellationsService {
  private readonly logger = new Logger(WeatherCancellationsService.name);

  constructor(
    @InjectModel(WeatherCancellationRequest.name)
    private readonly cancellationModel: Model<WeatherCancellationRequestDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(HeritageSpot.name)
    private readonly spotModel: Model<HeritageSpotDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestModel: Model<RefundRequestDocument>,
    private readonly openMeteoService: OpenMeteoClientService,
    private readonly scoringService: HeritageScoringService,
    private readonly refundOutboxService: RefundOutboxService,
    @Optional()
    private readonly weatherNotificationService?: WeatherNotificationService,
  ) {}

  /**
   * Customer submits a weather cancellation request.
   * Strictly enforces AD-03, BR-CANCEL-01, and financial safety lock.
   */
  async submitCancellationRequest(
    bookingIdStr: string,
    customerIdStr: string,
    dto: SubmitWeatherCancellationDto,
  ): Promise<WeatherCancellationRequestDocument> {
    if (!Types.ObjectId.isValid(bookingIdStr)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ.');
    }

    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch.');
    }

    // Customer authorization
    if (booking.customerId.toString() !== customerIdStr) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng này.');
    }

    // Booking status eligibility
    const allowedStatuses: BookingStatus[] = [
      BookingStatus.Confirmed,
      BookingStatus.DepositPaid,
      BookingStatus.PendingPayment,
    ];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Không thể gửi yêu cầu hủy do thời tiết khi đơn hàng ở trạng thái ${booking.status}.`,
      );
    }

    // Prevent duplicate pending weather actions
    if (booking.hasPendingWeatherAction || booking.activeWeatherCancellationId) {
      throw new ConflictException(
        'Đơn hàng đang có một yêu cầu thời tiết hoặc yêu cầu hủy đang chờ xử lý.',
      );
    }

    const existingPending = await this.cancellationModel.findOne({
      bookingId: booking._id,
      status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
    });
    if (existingPending) {
      throw new ConflictException('Đơn hàng đã có yêu cầu hủy đang chờ Admin xét duyệt.');
    }

    // Extract photoshoot item and schedule
    const photoItem = await this.bookingItemModel.findOne({
      bookingId: booking._id,
      itemType: BookingItemType.PhotographyPackage,
    });

    const schedule = await this.bookingScheduleModel.findOne({
      bookingId: booking._id,
      scheduleType: BookingScheduleType.Photoshoot,
    });

    const shootDateStr = photoItem?.shootDate
      ? new Date(photoItem.shootDate).toISOString().split('T')[0]
      : (schedule?.providerLocalDate || '');
    const timeSlot = photoItem?.shootTimeSlot || schedule?.timeSlot || '09:00-11:00';
    const spotLocation = photoItem?.shootLocation || 'Trung tâm TP. Huế';

    // Resolve Spot Coordinates
    let spot: HeritageSpotDocument | null = null;
    let lat = 16.4637;
    let lng = 107.5909;
    let spaceType = HeritageSpotSpaceType.OUTDOOR;

    if (photoItem && (photoItem as any).spotId && Types.ObjectId.isValid((photoItem as any).spotId)) {
      spot = await this.spotModel.findById((photoItem as any).spotId);
    } else if (spotLocation) {
      spot = await this.spotModel.findOne({
        name: { $regex: new RegExp(spotLocation, 'i') },
      });
    }

    if (spot && spot.location && Array.isArray(spot.location.coordinates)) {
      lng = spot.location.coordinates[0];
      lat = spot.location.coordinates[1];
      spaceType = spot.spaceType;
    }

    // Check weather forecast & RED_ALERT
    const metrics = await this.openMeteoService.getHourlyMetrics(lat, lng);
    const assessment = this.scoringService.assessTimeSlot(
      timeSlot,
      shootDateStr,
      metrics,
      spaceType,
      lat,
      lng,
    );

    if (!assessment.isRedAlert) {
      throw new BadRequestException(
        'Buổi chụp hiện không thuộc diện cảnh báo thời tiết xấu (RED_ALERT) để yêu cầu hủy.',
      );
    }

    // AD-03 Quota & Force Majeure check
    const rescheduleCount = booking.weatherRescheduleCount || 0;
    let eligibilityBasis: CancellationEligibilityBasis;

    if (rescheduleCount >= 2) {
      // Basis A: Quota exhausted (count >= 2) + RED_ALERT
      eligibilityBasis = CancellationEligibilityBasis.BASIS_A_QUOTA_EXHAUSTED;
    } else {
      // Basis B: Quota not exhausted (< 2) + RED_ALERT + Force Majeure Evidence
      if (!dto.evidencePhotos || dto.evidencePhotos.length === 0) {
        throw new BadRequestException(
          'Yêu cầu hủy bất khả kháng khi chưa dùng hết 02 lần đổi lịch bắt buộc phải đính kèm bằng chứng (vé tàu/xe/máy bay, giấy tờ công tác/y tế).',
        );
      }
      eligibilityBasis = CancellationEligibilityBasis.BASIS_B_FORCE_MAJEURE;
    }

    // Build snapshot from worst hour in breakdown
    const worstHour =
      assessment.hourlyBreakdown.find((h) => h.isRedAlert) ||
      assessment.hourlyBreakdown[0];

    const weatherSnapshot = {
      spotName: spot?.name || spotLocation,
      precipitationMm: worstHour ? worstHour.precipitationMm : 0,
      popPercent: worstHour ? worstHour.precipitationProbability : 0,
      wmoCode: worstHour ? worstHour.weatherCode : 0,
      isRedAlert: assessment.isRedAlert,
      fetchedAt: new Date(),
    };

    // Create WeatherCancellationRequest
    const cancellationRequest = await this.cancellationModel.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      eligibilityBasis,
      weatherRescheduleCountAtSubmission: rescheduleCount,
      weatherSnapshot,
      reason: dto.reason,
      evidencePhotos: dto.evidencePhotos ?? [],
      status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
    });

    // Atomically lock booking from cancellation penalties and defer auto-dispute
    booking.hasPendingWeatherAction = true;
    booking.activeWeatherCancellationId = cancellationRequest._id;
    booking.disputeDeferredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days deferral
    await booking.save();

    this.logger.log(
      `Weather cancellation request ${cancellationRequest._id} created for booking ${booking._id} [basis: ${eligibilityBasis}]`,
    );

    return cancellationRequest;
  }

  /**
   * Get weather cancellation request for a booking
   */
  async getBookingCancellationRequest(
    bookingIdStr: string,
    customerIdStr?: string,
  ): Promise<WeatherCancellationRequestDocument | null> {
    if (!Types.ObjectId.isValid(bookingIdStr)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ.');
    }

    const booking = await this.bookingModel.findById(bookingIdStr);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt lịch.');
    }

    if (customerIdStr && booking.customerId.toString() !== customerIdStr) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin đơn hàng này.');
    }

    return this.cancellationModel
      .findOne({ bookingId: booking._id })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get weather cancellation request by ID
   */
  async getCancellationRequestById(
    id: string,
  ): Promise<WeatherCancellationRequestDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã yêu cầu hủy không hợp lệ.');
    }

    const request = await this.cancellationModel
      .findById(id)
      .populate('bookingId', 'bookingCode status pricingSummary paymentSummary')
      .populate('customerId', 'profile.fullName auth.email phone')
      .exec();

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy thời tiết.');
    }

    return request;
  }

  /**
   * List weather cancellation requests for Admin Portal
   */
  async listCancellationRequests(
    query: ListWeatherCancellationsQueryDto,
  ): Promise<{ items: WeatherCancellationRequestDocument[]; total: number; page: number; limit: number }> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.bookingId && Types.ObjectId.isValid(query.bookingId)) {
      filter.bookingId = new Types.ObjectId(query.bookingId);
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.cancellationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('bookingId', 'bookingCode status pricingSummary paymentSummary')
        .populate('customerId', 'profile.fullName auth.email phone')
        .exec(),
      this.cancellationModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Admin reviews and decides on a weather cancellation request (AD-03).
   * Supports APPROVED_FULL_REFUND, APPROVED_PARTIAL_REFUND, and REJECTED.
   * If approved, enqueues durable refund task in Transactional Outbox.
   */
  async adminReviewCancellation(
    id: string,
    adminIdStr: string,
    dto: AdminReviewWeatherCancellationDto,
  ): Promise<WeatherCancellationRequestDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã yêu cầu hủy không hợp lệ.');
    }

    const request = await this.cancellationModel.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy do thời tiết.');
    }

    if (request.status !== CancellationReviewStatus.PENDING_ADMIN_REVIEW) {
      throw new ConflictException('Yêu cầu hủy đơn này đã được xét duyệt trước đó.');
    }

    const booking = await this.bookingModel.findById(request.bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn hàng tương ứng.');
    }

    const adminObjectId = new Types.ObjectId(adminIdStr);

    // 1. REJECTION BRANCH
    if (dto.decision === CancellationReviewStatus.REJECTED) {
      request.status = CancellationReviewStatus.REJECTED;
      request.reviewDecision = {
        adminId: adminObjectId,
        reviewedAt: new Date(),
        approvedRefundAmount: 0,
        penaltyDeducted: 0,
        notes: dto.notes,
      };

      // Release financial locks on booking
      booking.hasPendingWeatherAction = false;
      booking.activeWeatherCancellationId = null;
      await booking.save();
      await request.save();

      this.logger.log(`Weather cancellation request ${request._id} was REJECTED by admin ${adminIdStr}`);

      if (this.weatherNotificationService) {
        await this.weatherNotificationService.sendWeatherCancellationReviewed({
          cancellation: request,
          booking,
        }).catch((e) => this.logger.warn(`Failed to send cancellation reviewed notification: ${e?.message}`));
      }

      return request;
    }

    // 2. APPROVAL BRANCH (FULL or PARTIAL REFUND)
    const payments = await this.paymentModel
      .find({ bookingId: booking._id, status: PaymentStatus.Success })
      .lean();

    const capturedAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const completedRefund = payments.reduce((sum, p) => sum + (p.refundedAmount || 0), 0);
    const reservedRefund = payments.reduce((sum, p) => sum + (p.refundReservedAmount || 0), 0);
    const maxRefundable = Math.max(capturedAmount - completedRefund - reservedRefund, 0);
    const fallbackAmount =
      booking.paymentSummary?.totalPaid || booking.pricingSummary?.grandTotal || 0;
    const baseAmount = maxRefundable > 0 ? maxRefundable : fallbackAmount;

    let approvedRefundAmount = dto.approvedRefundAmount;
    if (approvedRefundAmount === undefined || approvedRefundAmount === null) {
      if (dto.decision === CancellationReviewStatus.APPROVED_FULL_REFUND) {
        approvedRefundAmount = baseAmount;
      } else {
        throw new BadRequestException(
          'Vui lòng chỉ định số tiền hoàn cho quyết định hoàn tiền một phần.',
        );
      }
    }

    if (approvedRefundAmount < 0) {
      throw new BadRequestException('Số tiền hoàn không được nhỏ hơn 0.');
    }

    if (baseAmount > 0 && approvedRefundAmount > baseAmount) {
      throw new BadRequestException(
        `Số tiền hoàn (${approvedRefundAmount.toLocaleString()}đ) vượt quá hạn mức có thể hoàn (${baseAmount.toLocaleString()}đ).`,
      );
    }

    const finalApprovedRefundAmount = approvedRefundAmount;
    const penaltyDeducted =
      dto.penaltyDeducted ?? Math.max(0, baseAmount - finalApprovedRefundAmount);

    // Cancel Booking and update cancellation record
    booking.status = BookingStatus.Cancelled;
    booking.cancellation = {
      cancelledBy: adminObjectId,
      reason: dto.notes || 'WEATHER_FORCE_MAJEURE',
      cancelledAt: new Date(),
      refundAmount: finalApprovedRefundAmount,
    };
    booking.hasPendingWeatherAction = false;
    booking.activeWeatherCancellationId = null;
    await booking.save();

    let refundRequestDoc: RefundRequestDocument | null = null;

    if (finalApprovedRefundAmount > 0) {
      // Create RefundRequest entity for historical auditing
      try {
        const code = `REF-WEATHER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        refundRequestDoc = await this.refundRequestModel.create({
          code,
          bookingId: booking._id,
          requestedBy: booking.customerId,
          type: RefundType.Cancellation,
          sourceEventId: `refund:weather_cancel:${request._id.toString()}`,
          mode: RefundMode.Gateway,
          amount: finalApprovedRefundAmount,
          approvedAmount: finalApprovedRefundAmount,
          processedAmount: 0,
          reservedAmount: finalApprovedRefundAmount,
          reason: dto.notes || `Hoàn tiền do thời tiết bất khả kháng (${dto.decision})`,
          status: RefundStatus.Approved,
          adminNotes: dto.notes,
          decidedBy: adminObjectId,
          decidedAt: new Date(),
          version: 0,
        });
      } catch (e: any) {
        this.logger.warn(`Could not create RefundRequest record directly: ${e?.message}`);
      }

      // Enqueue refund task in Durable Transactional Outbox
      await this.refundOutboxService.enqueueRefund({
        bookingId: booking._id,
        amount: finalApprovedRefundAmount,
        reason: dto.notes || `Hoàn tiền do thời tiết bất khả kháng (${dto.decision})`,
        sourceEventId: `refund:weather_cancel:${request._id.toString()}`,
        refundRequestId: refundRequestDoc?._id ?? null,
      });
    }

    // Finalize request state
    request.status = dto.decision;
    request.reviewDecision = {
      adminId: adminObjectId,
      reviewedAt: new Date(),
      approvedRefundAmount: finalApprovedRefundAmount,
      penaltyDeducted,
      notes: dto.notes,
    };
    if (refundRequestDoc) {
      request.refundRequestId = refundRequestDoc._id;
    }
    await request.save();

    this.logger.log(
      `Weather cancellation request ${request._id} APPROVED (${dto.decision}) by admin ${adminIdStr}. Refund amount: ${finalApprovedRefundAmount}`,
    );

    if (this.weatherNotificationService) {
      await this.weatherNotificationService.sendWeatherCancellationReviewed({
        cancellation: request,
        booking,
      }).catch((e) => this.logger.warn(`Failed to send cancellation reviewed notification: ${e?.message}`));
    }

    return request;
  }
}
