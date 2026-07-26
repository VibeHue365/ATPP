/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
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
import {
  BookingItem,
  BookingItemDocument,
  BookingItemType,
} from '../schemas/booking-item.schema';
import {
  Booking,
  BookingDocument,
  BookingStatus,
} from '../schemas/booking.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from '../../notifications/schemas/notification.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { PhotographyHoldService } from './photography-hold.service';
import { BookingStatusService } from './booking-status.service';

@Injectable()
export class BookingsSchedulerService {
  private readonly logger = new Logger(BookingsSchedulerService.name);

  constructor(
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly photographyHoldService: PhotographyHoldService,
    private readonly bookingStatusService: BookingStatusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePhotographyHolds() {
    try {
      const expiredCount =
        await this.photographyHoldService.expireExpiredHolds();
      if (expiredCount > 0) {
        this.logger.log(
          `Expired ${expiredCount} photography schedule hold(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Unable to expire photography schedule holds.', error);
    }
  }

  /**
   * Auto-complete photography bookings that have been in AWAITING_REVIEW for > 48 hours.
   * Runs every hour. Uses atomic findOneAndUpdate to prevent double-processing
   * (idempotency: if two cron instances run simultaneously, only one wins the status lock).
   * TODO: Use Promise.all or batch processing for scalability at high volume.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteAwaitingReviewBookings() {
    this.logger.log('Running auto-complete for AWAITING_REVIEW bookings...');
    const deadline = new Date(Date.now() - 48 * 60 * 60 * 1000);

    try {
      // Find all bookings past deadline (just IDs — don't lock yet)
      const candidates = await this.bookingModel
        .find({
          status: BookingStatus.AwaitingReview,
          awaitingReviewSince: { $lte: deadline },
        })
        .select('_id bookingCode')
        .lean();

      if (candidates.length === 0) return;
      this.logger.log(
        `Found ${candidates.length} AWAITING_REVIEW booking(s) to auto-complete.`,
      );

      for (const candidate of candidates) {
        try {
          // Atomic status lock: only succeeds if status is STILL AWAITING_REVIEW.
          // Prevents double-processing if cron overlaps with a customer confirm-complete call.
          const locked = await this.bookingModel.findOneAndUpdate(
            { _id: candidate._id, status: BookingStatus.AwaitingReview },
            { $set: { status: BookingStatus.Completed } },
            { new: false }, // return OLD doc — if null, someone else already changed it
          );

          if (!locked) {
            this.logger.warn(
              `Booking ${candidate.bookingCode} already processed — skipping.`,
            );
            continue;
          }

          // Run the full completion logic (settlement, wallet update, notifications)
          await this.bookingStatusService.completeBooking(
            candidate._id.toString(),
          );
          this.logger.log(
            `Auto-completed booking ${candidate.bookingCode} after 48h review window.`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to auto-complete booking ${candidate.bookingCode}:`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error('Auto-complete cron job failed:', err);
    }
  }

  /**
   * Auto-confirm bookings in PICKUP_PENDING status if they have been initiated for more than 30 minutes.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCompleteHandoverTimeout() {
    this.logger.log('Running auto-confirm for PICKUP_PENDING bookings...');
    const deadline = new Date(Date.now() - 30 * 60 * 1000);

    try {
      const candidates = await this.bookingModel
        .find({
          status: BookingStatus.PickupPending,
          handoverInitiatedAt: { $lte: deadline },
        })
        .select('_id bookingCode')
        .lean();

      if (candidates.length === 0) return;
      this.logger.log(
        `Found ${candidates.length} PICKUP_PENDING booking(s) past 30m window.`,
      );

      for (const candidate of candidates) {
        try {
          const locked = await this.bookingModel.findOneAndUpdate(
            { _id: candidate._id, status: BookingStatus.PickupPending },
            {
              $set: { status: BookingStatus.PickedUp },
              $push: {
                statusTimeline: {
                  status: BookingStatus.PickedUp,
                  changedAt: new Date(),
                  note: 'Hệ thống tự động xác nhận đã nhận đồ sau 30 phút bàn giao tại quầy.',
                },
              },
            },
            { new: false },
          );

          if (!locked) continue;

          // Notify customer
          try {
            await this.notificationsService.createNotification(
              (locked.customerId?._id || locked.customerId).toString(),
              'Đơn hàng tự động nhận đồ',
              `Đơn hàng ${locked.bookingCode} đã tự động kích hoạt trạng thái Đang thuê do hết thời gian 30 phút xác nhận tại quầy.`,
              NotificationType.Booking,
              { bookingId: locked._id },
            );
          } catch (e) {
            this.logger.error('Failed to notify auto-confirm pickup:', e);
          }

          this.logger.log(
            `Auto-confirmed pickup for booking ${candidate.bookingCode} after 30m.`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to auto-confirm pickup for booking ${candidate.bookingCode}:`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error('Auto-confirm handover timeout cron failed:', err);
    }
  }

  /**
   * Auto-unlock maintenance items (LOCKED status) after 48 hours.
   * Runs every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoUnlockMaintenanceItems() {
    this.logger.log('Running auto-unlock for maintenance items...');
    try {
      const inventoryItemModel = this.bookingModel.db.model('InventoryItem');
      const lockedItems = await inventoryItemModel.find({
        conditionStatus: 'LOCKED',
        notes: { $regex: /^LOCKED_UNTIL_/ },
      });

      const now = new Date();
      for (const item of lockedItems) {
        const notesStr = item.notes || '';
        const match = notesStr.match(/^LOCKED_UNTIL_([^:]+):/);
        if (match && match[1]) {
          const lockedUntil = new Date(match[1]);
          if (now >= lockedUntil) {
            item.conditionStatus = 'GOOD';
            item.notes = 'Tự động mở khóa sau 48 giờ bảo trì.';
            await item.save();
            this.logger.log(
              `Auto-unlocked inventory item SKU ${item.sku} after maintenance.`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to auto-unlock maintenance items:', err);
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
      status: {
        $in: [BookingScheduleStatus.Scheduled, BookingScheduleStatus.Confirmed],
      },
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
      status: {
        $in: [BookingScheduleStatus.Scheduled, BookingScheduleStatus.Confirmed],
      },
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

      const customerId = (
        booking.customerId?._id || booking.customerId
      ).toString();

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
        this.logger.warn(
          `Skipping reminder for schedule ${schedule._id}: missing start time.`,
        );
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
      this.logger.error(
        `Error sending schedule reminder for schedule ${schedule._id}:`,
        err,
      );
    }
  }

  /**
   * Auto-flag photography bookings that are overdue by > 2 hours in CONFIRMED or DEPOSIT_PAID
   * where the photographer has NOT clicked "Bắt đầu buổi chụp".
   * Transitions status to DISPUTED to prevent bookings from being stuck in CONFIRMED indefinitely.
   */
  @Cron('0 */15 * * * *')
  async autoDisputeUnstartedPastBookings() {
    this.logger.log(
      'Running auto-dispute sweeper for unstarted past photography bookings...',
    );
    const now = new Date();

    try {
      const pendingBookings = await this.bookingModel
        .find({
          status: { $in: [BookingStatus.Confirmed, BookingStatus.DepositPaid] },
        })
        .select('_id bookingCode customerId providerIds status statusTimeline')
        .lean();

      for (const booking of pendingBookings) {
        const photoItem = await this.bookingItemModel.findOne({
          bookingId: booking._id,
          itemType: BookingItemType.PhotographyPackage,
        });

        if (!photoItem || !photoItem.shootDate) continue;

        let endHour = 23;
        let endMin = 59;
        if (photoItem.shootTimeSlot && photoItem.shootTimeSlot.includes('-')) {
          const parts = photoItem.shootTimeSlot.split('-');
          if (parts.length >= 2) {
            const [h, m] = parts[1].trim().split(':').map(Number);
            if (!isNaN(h)) {
              endHour = h;
              endMin = m || 0;
            }
          }
        }

        const shootEnd = new Date(photoItem.shootDate);
        shootEnd.setHours(endHour, endMin, 0, 0);

        // 2 hours past shootEnd time
        const overdueDeadline = new Date(
          shootEnd.getTime() + 2 * 60 * 60 * 1000,
        );

        if (now > overdueDeadline) {
          const locked = await this.bookingModel.findOneAndUpdate(
            { _id: booking._id, status: booking.status },
            {
              $set: {
                status: BookingStatus.Disputed,
              },
              $push: {
                statusTimeline: {
                  status: BookingStatus.Disputed,
                  changedAt: now,
                  note: 'Hệ thống tự động chuyển đơn sang Tranh Chấp do Quá giờ chụp 2 tiếng mà Thợ ảnh chưa kích hoạt "Bắt đầu buổi chụp"',
                },
              },
            },
            { new: true },
          );

          if (locked) {
            this.logger.log(
              `Auto-flagged booking ${booking.bookingCode} as DISPUTED (2h overdue unstarted).`,
            );

            try {
              const disputeModel = this.bookingModel.db.model('Dispute');
              const existing = await disputeModel.findOne({
                bookingId: booking._id,
              });
              if (!existing) {
                await disputeModel.create({
                  bookingId: booking._id,
                  bookingItemId: photoItem._id,
                  openedBy: booking.customerId,
                  againstProviderId: booking.providerIds?.[0] || null,
                  reason:
                    'Hệ thống tự động ghi nhận khiếu nại do quá giờ chụp 2 tiếng mà Thợ ảnh chưa bắt đầu buổi chụp',
                  evidencePhotos: [],
                  status: 'OPEN',
                });
              }
            } catch (disputeErr) {
              this.logger.warn(
                'Failed to create Dispute record for overdue booking:',
                disputeErr,
              );
            }

            try {
              await this.notificationsService.createNotification(
                booking.customerId.toString(),
                'Tranh chấp tự động - Quá giờ chụp',
                `Đơn hàng ${booking.bookingCode} đã tự động chuyển sang Tranh Chấp do quá thời gian chụp 2 tiếng. Admin sẽ hỗ trợ kiểm tra & hoàn tiền nếu có sự cố.`,
                NotificationType.Booking,
                { bookingId: booking._id },
              );
            } catch (e) {
              this.logger.warn(
                'Failed to send auto-dispute notification to customer',
                e,
              );
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(
        'autoDisputeUnstartedPastBookings cron job failed:',
        err,
      );
    }
  }
}
