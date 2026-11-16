import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { ChatGateway } from '../../chat/chat.gateway';
import { Provider, ProviderDocument } from '../../providers/schemas/provider.schema';

export interface SendWeatherRedAlertInput {
  booking: any;
  shootDate: string;
  timeSlot: string;
  milestone: 'T-24h' | 'T-3h';
  reason: string;
  spotName: string;
  planBUrl?: string;
}

export interface SendPlanBProposedInput {
  proposal: any;
  booking: any;
  providerIds: Types.ObjectId[];
}

export interface SendPlanBPaymentRequiredInput {
  proposal: any;
  booking: any;
  qrCodeUrl?: string;
  paymentUrl?: string;
}

export interface SendPlanBAppliedInput {
  proposal: any;
  booking: any;
  recipientUserIds: string[];
}

export interface SendRefundStatusUpdatedInput {
  userId: string;
  refundId: string;
  bookingId: string;
  status: string;
  amount: number;
  message?: string;
}

export interface SendWeatherCancellationReviewedInput {
  cancellation: any;
  booking: any;
}

@Injectable()
export class WeatherNotificationService {
  private readonly logger = new Logger(WeatherNotificationService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
  ) {}

  /**
   * Helper to emit socket event to a specific user's active sockets
   */
  emitToUser(userId: string, event: string, payload: any): void {
    try {
      if (!this.chatGateway?.server) return;
      const connections = this.chatGateway.getActiveConnections();
      const sockets = connections.get(userId) || [];
      for (const socketId of sockets) {
        this.chatGateway.server.to(socketId).emit(event, payload);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to emit ${event} to user ${userId}: ${e?.message}`);
    }
  }

  /**
   * Helper to emit socket event to a room
   */
  emitToRoom(room: string, event: string, payload: any): void {
    try {
      if (!this.chatGateway?.server) return;
      this.chatGateway.server.to(room).emit(event, payload);
    } catch (e: any) {
      this.logger.warn(`Failed to emit ${event} to room ${room}: ${e?.message}`);
    }
  }

  /**
   * Proactive Weather Red Alert Notification (T-24h & T-3h)
   */
  async sendWeatherRedAlert(input: SendWeatherRedAlertInput): Promise<void> {
    const customerId = input.booking.customerId.toString();
    const planBUrl =
      input.planBUrl || `/bookings/${input.booking._id.toString()}/plan-b`;

    const title = `[Cảnh báo thời tiết] Buổi chụp tại ${input.spotName} (${input.milestone})`;
    const content = `Thời tiết tại ${input.spotName} vào ngày ${input.shootDate} (${input.timeSlot}) được dự báo xấu: ${input.reason}. Bạn có thể chọn phương án B (đổi địa điểm hoặc đổi ngày/giờ chụp) để buổi chụp diễn ra thuận lợi nhất.`;

    const metadata = {
      channel: 'WEATHER_ALERT',
      bookingId: input.booking._id.toString(),
      bookingCode: input.booking.bookingCode,
      milestone: input.milestone,
      shootDate: input.shootDate,
      timeSlot: input.timeSlot,
      spotName: input.spotName,
      isRedAlert: true,
      planBUrl,
    };

    // 1. In-app Notification + Email
    await this.notificationsService.createNotification(
      customerId,
      title,
      content,
      NotificationType.Weather,
      metadata,
    );

    // 2. Realtime WebSocket emit: weather_red_alert
    this.emitToUser(customerId, 'weather_red_alert', {
      bookingId: input.booking._id.toString(),
      bookingCode: input.booking.bookingCode,
      shootDate: input.shootDate,
      timeSlot: input.timeSlot,
      milestone: input.milestone,
      reason: input.reason,
      spotName: input.spotName,
      planBUrl,
      isRedAlert: true,
    });

    this.logger.log(
      `Sent ${input.milestone} weather_red_alert for booking ${input.booking.bookingCode} to customer ${customerId}`,
    );
  }

  /**
   * Plan B Proposal Received -> Notify Providers
   */
  async sendPlanBProposed(input: SendPlanBProposedInput): Promise<void> {
    const { proposal, booking, providerIds } = input;

    for (const providerId of providerIds) {
      try {
        const provider = await this.providerModel.findById(providerId);
        if (!provider || !provider.userId) continue;

        const providerUserId = provider.userId.toString();
        const title = `[Đề xuất đổi lịch] Khách hàng gửi Plan B cho đơn ${booking.bookingCode}`;
        const content = `Khách hàng đề xuất đổi lịch: Ngày ${proposal.proposedDate || 'giữ nguyên'} (${proposal.proposedTimeSlot || 'giữ nguyên'}) tại ${proposal.proposedSpotName || 'địa điểm mới'}. Vui lòng phản hồi trước khi đề xuất hết hạn.`;

        const metadata = {
          channel: 'PLAN_B_PROPOSED',
          proposalId: proposal._id.toString(),
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          expiresAt: proposal.expiresAt,
        };

        await this.notificationsService.createNotification(
          providerUserId,
          title,
          content,
          NotificationType.Weather,
          metadata,
        );

        this.emitToUser(providerUserId, 'plan_b_proposed', {
          proposalId: proposal._id.toString(),
          bookingId: booking._id.toString(),
          bookingCode: booking.bookingCode,
          proposedDate: proposal.proposedDate,
          proposedTimeSlot: proposal.proposedTimeSlot,
          changeType: proposal.changeType,
          expiresAt: proposal.expiresAt,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to notify provider ${providerId}: ${err?.message}`);
      }
    }
  }

  /**
   * Plan B Approved requiring payment -> Notify Customer
   */
  async sendPlanBPaymentRequired(
    input: SendPlanBPaymentRequiredInput,
  ): Promise<void> {
    const { proposal, booking, qrCodeUrl, paymentUrl } = input;
    const customerId = booking.customerId.toString();

    const title = `[Thanh toán phụ phí] Đề xuất Plan B đã được duyệt`;
    const content = `Đối tác đã đồng ý với đề xuất đổi lịch của bạn. Vui lòng thanh toán phụ phí di chuyển ${proposal.additionalFeeDue.toLocaleString()}đ trong vòng 15 phút để hoàn tất xác nhận lịch mới.`;

    const metadata = {
      channel: 'PLAN_B_PAYMENT_REQUIRED',
      proposalId: proposal._id.toString(),
      bookingId: booking._id.toString(),
      additionalFee: proposal.additionalFeeDue,
      paymentExpiresAt: proposal.paymentExpiresAt,
      paymentUrl,
      qrCodeUrl,
    };

    await this.notificationsService.createNotification(
      customerId,
      title,
      content,
      NotificationType.Weather,
      metadata,
    );

    this.emitToUser(customerId, 'plan_b_approved_payment_required', {
      proposalId: proposal._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      additionalFee: proposal.additionalFeeDue,
      paymentExpiresAt: proposal.paymentExpiresAt,
      paymentUrl,
      qrCodeUrl,
    });
  }

  /**
   * Plan B Applied -> Notify all parties and broadcast to room
   */
  async sendPlanBApplied(input: SendPlanBAppliedInput): Promise<void> {
    const { proposal, booking, recipientUserIds } = input;

    const title = `[Cập nhật lịch mới] Đổi lịch thành công cho đơn ${booking.bookingCode}`;
    const content = `Đơn đặt lịch ${booking.bookingCode} đã được chuyển sang ngày ${proposal.proposedDate || 'giữ nguyên'} (${proposal.proposedTimeSlot || 'giữ nguyên'}) tại ${proposal.proposedSpotName || 'địa điểm mới'}. Chúc bạn có một buổi chụp trọn vẹn!`;

    const metadata = {
      channel: 'PLAN_B_APPLIED',
      proposalId: proposal._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      newDate: proposal.proposedDate,
      newSlot: proposal.proposedTimeSlot,
      spotName: proposal.proposedSpotName,
    };

    for (const userId of recipientUserIds) {
      await this.notificationsService.createNotification(
        userId,
        title,
        content,
        NotificationType.Weather,
        metadata,
      );

      this.emitToUser(userId, 'plan_b_applied', {
        proposalId: proposal._id.toString(),
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        newDate: proposal.proposedDate,
        newSlot: proposal.proposedTimeSlot,
        spotName: proposal.proposedSpotName,
      });
    }

    this.emitToRoom(`booking:${booking._id.toString()}`, 'plan_b_applied', {
      proposalId: proposal._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      newDate: proposal.proposedDate,
      newSlot: proposal.proposedTimeSlot,
      spotName: proposal.proposedSpotName,
    });
  }

  /**
   * Refund status updated (Issue 05 - Neutral Tone)
   */
  async sendRefundStatusUpdated(
    input: SendRefundStatusUpdatedInput,
  ): Promise<void> {
    const { userId, refundId, bookingId, status, amount, message } = input;

    const defaultMsg =
      status === 'COMPLETED'
        ? `Giao dịch hoàn tiền ${amount.toLocaleString()}đ đã được cổng thanh toán xử lý thành công.`
        : `Yêu cầu hoàn tiền ${amount.toLocaleString()}đ hiện đang ở trạng thái: ${status}.`;

    const title = `[Cập nhật hoàn tiền] Trạng thái giao dịch hoàn tiền`;
    const content = message || defaultMsg;

    const metadata = {
      channel: 'REFUND_STATUS_UPDATED',
      refundId,
      bookingId,
      status,
      amount,
    };

    await this.notificationsService.createNotification(
      userId,
      title,
      content,
      NotificationType.Weather,
      metadata,
    );

    this.emitToUser(userId, 'refund_status_updated', {
      refundId,
      bookingId,
      status,
      amount,
      message: content,
    });
  }

  /**
   * Weather Cancellation Reviewed by Admin
   */
  async sendWeatherCancellationReviewed(
    input: SendWeatherCancellationReviewedInput,
  ): Promise<void> {
    const { cancellation, booking } = input;
    const customerId = booking.customerId.toString();

    const isApproved =
      cancellation.status === 'APPROVED_FULL_REFUND' ||
      cancellation.status === 'APPROVED_PARTIAL_REFUND';

    const title = isApproved
      ? `[Hủy đơn thời tiết] Yêu cầu hủy đơn đã được chấp thuận`
      : `[Hủy đơn thời tiết] Yêu cầu hủy đơn không được chấp thuận`;

    const content = isApproved
      ? `Yêu cầu hủy do thời tiết bất khả kháng cho đơn ${booking.bookingCode} đã được Admin phê duyệt (${cancellation.status}). Số tiền duyệt hoàn: ${(cancellation.reviewDecision?.approvedRefundAmount || 0).toLocaleString()}đ. Hệ thống đang tiến hành xử lý hoàn tiền.`
      : `Yêu cầu hủy do thời tiết bất khả kháng cho đơn ${booking.bookingCode} đã bị từ chối. Lý do từ Admin: ${cancellation.reviewDecision?.notes || 'Không đủ điều kiện theo quy định'}.`;

    const metadata = {
      channel: 'WEATHER_CANCELLATION_REVIEWED',
      cancellationId: cancellation._id.toString(),
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      status: cancellation.status,
      approvedRefundAmount: cancellation.reviewDecision?.approvedRefundAmount ?? 0,
      notes: cancellation.reviewDecision?.notes ?? null,
    };

    await this.notificationsService.createNotification(
      customerId,
      title,
      content,
      NotificationType.Weather,
      metadata,
    );

    this.emitToUser(customerId, 'weather_cancellation_reviewed', metadata);
  }
}
