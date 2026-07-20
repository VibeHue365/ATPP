import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../schemas/booking-schedule.schema';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { Notification, NotificationDocument, NotificationType } from '../../notifications/schemas/notification.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { PhotographyHoldService } from './photography-hold.service';

@Injectable()
export class BookingsSchedulerService {
  private readonly logger = new Logger(BookingsSchedulerService.name);

  constructor(
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly photographyHoldService: PhotographyHoldService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePhotographyHolds() {
    try {
      const expiredCount = await this.photographyHoldService.expireExpiredHolds();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} photography schedule hold(s).`);
      }
    } catch (error) {
      this.logger.error('Unable to expire photography schedule holds.', error);
    }
  }
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduleReminders() {
    this.logger.log('Running automatic schedule reminders cron-job...');
    const now = new Date();

    // 1. Remind 24 hours in advance
    const start24h = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const end24h = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    const upcomingSchedules24h = await this.bookingScheduleModel.find({
      status: { $in: [BookingScheduleStatus.Scheduled, BookingScheduleStatus.Confirmed] },
      $or: [
        { startsAt: { $gte: start24h, $lte: end24h } },
        { startsAt: null, scheduledDate: { $gte: start24h, $lte: end24h } },
      ],
    });

    for (const schedule of upcomingSchedules24h) {
      await this.sendReminderIfNeeded(schedule, '24h', '24 giờ');
    }

    // 2. Remind 2 hours in advance
    const start2h = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const end2h = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    const upcomingSchedules2h = await this.bookingScheduleModel.find({
      status: { $in: [BookingScheduleStatus.Scheduled, BookingScheduleStatus.Confirmed] },
      $or: [
        { startsAt: { $gte: start2h, $lte: end2h } },
        { startsAt: null, scheduledDate: { $gte: start2h, $lte: end2h } },
      ],
    });

    for (const schedule of upcomingSchedules2h) {
      await this.sendReminderIfNeeded(schedule, '2h', '2 giờ');
    }
  }

  private async sendReminderIfNeeded(
    schedule: BookingScheduleDocument,
    reminderType: '24h' | '2h',
    timeLabel: string,
  ) {
    try {
      const booking = await this.bookingModel.findById(schedule.bookingId);
      if (!booking) return;

      const customerId = booking.customerId.toString();

      // Check if notification already sent to avoid duplicate
      const alreadySent = await this.notificationModel.findOne({
        userId: new Types.ObjectId(customerId),
        type: NotificationType.Booking,
        'metadata.bookingScheduleId': schedule._id,
        'metadata.reminderType': reminderType,
      });

      if (alreadySent) return;

      let eventTypeLabel = '';
      switch (schedule.scheduleType) {
        case BookingScheduleType.Pickup:
          eventTypeLabel = 'nhận đồ thuê';
          break;
        case BookingScheduleType.Return:
          eventTypeLabel = 'trả đồ thuê';
          break;
        case BookingScheduleType.Photoshoot:
          eventTypeLabel = 'chụp ảnh';
          break;
        case BookingScheduleType.RentalPeriod:
          eventTypeLabel = 'kỳ hạn thuê';
          break;
        default:
          eventTypeLabel = 'lịch trình';
      }

      const scheduledAt = schedule.startsAt ?? schedule.scheduledDate;
      if (!scheduledAt) {
        this.logger.warn(`Skipping reminder for schedule ${schedule._id}: missing start time.`);
        return;
      }

      const title = `Nhắc nhở lịch trình - Còn ${timeLabel}`;
      const content = `Bạn có lịch trình ${eventTypeLabel} cho đơn hàng ${booking.bookingCode} vào lúc ${scheduledAt.toLocaleTimeString('vi-VN')} ngày ${scheduledAt.toLocaleDateString('vi-VN')}. Vui lòng chuẩn bị đúng giờ!`;

      await this.notificationsService.createNotification(
        customerId,
        title,
        content,
        NotificationType.Booking,
        {
          bookingId: booking._id,
          bookingScheduleId: schedule._id,
          reminderType,
        },
      );

      this.logger.log(
        `Sent ${reminderType} schedule reminder for booking ${booking.bookingCode}, schedule ID: ${schedule._id}`,
      );
    } catch (err) {
      this.logger.error(`Error sending schedule reminder for schedule ${schedule._id}:`, err);
    }
  }
}
