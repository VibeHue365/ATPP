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
  Provider,
  ProviderDocument,
} from '../../providers/schemas/provider.schema';
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
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
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

    // 1. Remind from BookingSchedule model (24h & 2h)
    await this.processBookingScheduleReminders(now);

    // 2. Direct check on active BookingItems for Rental Pickup, Return, Overdue Return, and Photoshoots
    await this.processBookingItemReminders(now);
  }

  private async processBookingScheduleReminders(now: Date) {
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
      await this.sendScheduleReminderIfNeeded(schedule, '24h', '24 giờ');
    }

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
      await this.sendScheduleReminderIfNeeded(schedule, '2h', '2 giờ');
    }
  }

  private async sendScheduleReminderIfNeeded(
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
          eventTypeLabel = 'nhận áo dài';
          break;
        case BookingScheduleType.Return:
          eventTypeLabel = 'trả áo dài';
          break;
        case BookingScheduleType.Photoshoot:
          eventTypeLabel = 'chụp ảnh';
          break;
        case BookingScheduleType.RentalPeriod:
          eventTypeLabel = 'kỳ hạn thuê áo dài';
          break;
        default:
          eventTypeLabel = 'lịch trình';
      }

      const scheduledAt = schedule.startsAt ?? schedule.scheduledDate;
      if (!scheduledAt) return;

      const title = `Nhắc nhở: Lịch ${eventTypeLabel} – Còn ${timeLabel}`;
      const content = `Bạn có lịch ${eventTypeLabel} cho đơn hàng ${booking.bookingCode} vào lúc ${scheduledAt.toLocaleTimeString('vi-VN')} ngày ${scheduledAt.toLocaleDateString('vi-VN')}. Vui lòng chuẩn bị đúng giờ!`;

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
    } catch (err) {
      this.logger.error(
        `Error sending schedule reminder for schedule ${schedule._id}:`,
        err,
      );
    }
  }

  private async processBookingItemReminders(now: Date) {
    try {
      const activeBookings = await this.bookingModel
        .find({
          status: {
            $in: [
              BookingStatus.Confirmed,
              BookingStatus.DepositPaid,
              BookingStatus.PickupPending,
              BookingStatus.PickedUp,
              BookingStatus.InProgress,
            ],
          },
        })
        .select('_id bookingCode customerId providerIds status pricingSummary')
        .lean();

      if (!activeBookings || activeBookings.length === 0) return;

      const bookingIds = activeBookings.map((b) => b._id);
      const items = await this.bookingItemModel
        .find({ bookingId: { $in: bookingIds } })
        .lean();

      const bookingMap = new Map(
        activeBookings.map((b) => [b._id.toString(), b]),
      );

      for (const item of items) {
        const booking = bookingMap.get(item.bookingId.toString());
        if (!booking) continue;
        const customerId = (
          (booking.customerId as any)?._id || booking.customerId
        ).toString();

        // 1. RENTAL ITEM REMINDERS (Nhắc nhận áo & Nhắc trả áo & Cảnh báo quá hạn)
        if (item.itemType === BookingItemType.Product) {
          await this.handleRentalItemReminders(item, booking, customerId, now);
        }

        // 2. PHOTOGRAPHY ITEM REMINDERS (Nhắc lịch chụp ảnh cho Customer & Photographer)
        if (item.itemType === BookingItemType.PhotographyPackage) {
          await this.handlePhotographyItemReminders(
            item,
            booking,
            customerId,
            now,
          );
        }
      }
    } catch (err) {
      this.logger.error('Error in processBookingItemReminders:', err);
    }
  }

  private async handleRentalItemReminders(
    item: any,
    booking: any,
    customerId: string,
    now: Date,
  ) {
    try {
      // Determine pickup time & return time
      let pickupTime: Date | null = null;
      let returnTime: Date | null = null;

      if (item.rentalType === 'HOURLY') {
        if (item.shootDate) {
          const d = new Date(item.shootDate);
          let startH = 8;
          let startM = 0;
          let endH = 12;
          let endM = 0;
          if (item.shootTimeSlot && item.shootTimeSlot.includes('-')) {
            const parts = item.shootTimeSlot.split('-');
            const [sh, sm] = parts[0].trim().split(':').map(Number);
            if (!isNaN(sh)) {
              startH = sh;
              startM = sm || 0;
            }
            const [eh, em] = parts[1].trim().split(':').map(Number);
            if (!isNaN(eh)) {
              endH = eh;
              endM = em || 0;
            }
          }
          pickupTime = new Date(d);
          pickupTime.setHours(startH, startM, 0, 0);
          returnTime = new Date(d);
          returnTime.setHours(endH, endM, 0, 0);
        }
      } else {
        // DAILY
        if (item.rentalFrom) {
          const fromObj = new Date(item.rentalFrom);
          pickupTime = new Date(item.rentalFrom);
          if (fromObj.getHours() === 0 && fromObj.getMinutes() === 0) {
            pickupTime.setHours(8, 0, 0, 0);
          }
        }
        if (item.rentalTo) {
          const toObj = new Date(item.rentalTo);
          returnTime = new Date(item.rentalTo);
          if (toObj.getHours() === 0 && toObj.getMinutes() === 0) {
            returnTime.setHours(20, 0, 0, 0);
          }
        }
      }

      // --- A. Pickup Reminders (24h and 2h before pickupTime) ---
      if (
        pickupTime &&
        (booking.status === BookingStatus.Confirmed ||
          booking.status === BookingStatus.DepositPaid)
      ) {
        const msUntilPickup = pickupTime.getTime() - now.getTime();
        const hoursUntilPickup = msUntilPickup / (1000 * 60 * 60);

        // 24h pickup reminder (18h to 36h window)
        if (hoursUntilPickup >= 18 && hoursUntilPickup <= 36) {
          const key = `pickup_24h_${item._id}`;
          const exists = await this.notificationModel.findOne({
            userId: new Types.ObjectId(customerId),
            'metadata.reminderKey': key,
          });
          if (!exists) {
            await this.notificationsService.createNotification(
              customerId,
              'Nhắc nhở: Lịch nhận áo dài ngày mai',
              `Bạn có lịch nhận áo dài cho đơn hàng ${booking.bookingCode} vào ngày ${pickupTime.toLocaleDateString('vi-VN')}. Vui lòng đến cửa hàng đúng hẹn để nhận trang phục!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: key },
            );
          }
        }

        // 2h pickup reminder (1h to 3h window)
        if (hoursUntilPickup >= 1.0 && hoursUntilPickup <= 3.0) {
          const key = `pickup_2h_${item._id}`;
          const exists = await this.notificationModel.findOne({
            userId: new Types.ObjectId(customerId),
            'metadata.reminderKey': key,
          });
          if (!exists) {
            await this.notificationsService.createNotification(
              customerId,
              'Nhắc nhở: Sắp đến giờ nhận áo dài (còn 2 tiếng)',
              `Chỉ còn 2 tiếng nữa là đến giờ nhận áo dài cho đơn hàng ${booking.bookingCode}. Vui lòng chuẩn bị đến cửa hàng nhận trang phục!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: key },
            );
          }
        }
      }

      // --- B. Return Reminders (24h and 2h before returnTime) ---
      if (
        returnTime &&
        (booking.status === BookingStatus.PickedUp ||
          booking.status === BookingStatus.InProgress ||
          booking.status === BookingStatus.Confirmed)
      ) {
        const msUntilReturn = returnTime.getTime() - now.getTime();
        const hoursUntilReturn = msUntilReturn / (1000 * 60 * 60);

        // 24h return reminder (18h to 36h window)
        if (hoursUntilReturn >= 18 && hoursUntilReturn <= 36) {
          const key = `return_24h_${item._id}`;
          const exists = await this.notificationModel.findOne({
            userId: new Types.ObjectId(customerId),
            'metadata.reminderKey': key,
          });
          if (!exists) {
            const depositStr = (
              booking.pricingSummary?.depositTotal || 0
            ).toLocaleString('vi-VN');
            await this.notificationsService.createNotification(
              customerId,
              'Nhắc nhở: Hạn trả áo dài ngày mai',
              `Đơn hàng ${booking.bookingCode} sẽ đến hạn trả áo dài vào ngày ${returnTime.toLocaleDateString('vi-VN')}. Vui lòng hoàn trả áo đúng hạn để nhận lại 100% tiền cọc (${depositStr}đ)!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: key },
            );
          }
        }

        // 2h return reminder (1h to 3h window)
        if (hoursUntilReturn >= 1.0 && hoursUntilReturn <= 3.0) {
          const key = `return_2h_${item._id}`;
          const exists = await this.notificationModel.findOne({
            userId: new Types.ObjectId(customerId),
            'metadata.reminderKey': key,
          });
          if (!exists) {
            await this.notificationsService.createNotification(
              customerId,
              'Nhắc nhở: Sắp hết hạn thuê áo dài (còn 2 tiếng)',
              `Đơn hàng ${booking.bookingCode} chỉ còn 2 tiếng nữa là đến hạn hoàn trả áo dài. Vui lòng hoàn trả trước giờ hẹn để tránh phát sinh phụ phí trễ hạn!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: key },
            );
          }
        }

        // --- C. Overdue Return Alert (Quá hạn trả áo) ---
        if (
          (booking.status === BookingStatus.PickedUp ||
            booking.status === BookingStatus.InProgress) &&
          now.getTime() > returnTime.getTime()
        ) {
          const todayKey = `overdue_return_${item._id}_${now.toISOString().split('T')[0]}`;
          const exists = await this.notificationModel.findOne({
            userId: new Types.ObjectId(customerId),
            'metadata.reminderKey': todayKey,
          });
          if (!exists) {
            await this.notificationsService.createNotification(
              customerId,
              'Cảnh báo: Đơn hàng quá hạn trả áo dài',
              `Đơn hàng ${booking.bookingCode} đã quá thời hạn trả áo dài. Vui lòng liên hệ cửa hàng hoặc hoàn trả ngay hôm nay để tránh bị trừ phí trễ hạn từ tiền cọc.`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: todayKey },
            );
          }
        }
      }
    } catch (e) {
      this.logger.error('Error handling rental item reminders:', e);
    }
  }

  private async handlePhotographyItemReminders(
    item: any,
    booking: any,
    customerId: string,
    now: Date,
  ) {
    try {
      if (!item.shootDate) return;
      const d = new Date(item.shootDate);
      let startH = 8;
      let startM = 0;
      if (item.shootTimeSlot && item.shootTimeSlot.includes('-')) {
        const [sh, sm] = item.shootTimeSlot
          .split('-')[0]
          .trim()
          .split(':')
          .map(Number);
        if (!isNaN(sh)) {
          startH = sh;
          startM = sm || 0;
        }
      }
      const shootStartTime = new Date(d);
      shootStartTime.setHours(startH, startM, 0, 0);

      const msUntilShoot = shootStartTime.getTime() - now.getTime();
      const hoursUntilShoot = msUntilShoot / (1000 * 60 * 60);

      // Resolve photographer User ID
      let photographerUserId: string | null = null;
      if (item.providerId) {
        const provQuery = this.providerModel.findById(item.providerId);
        const prov =
          typeof (provQuery as any)?.select === 'function'
            ? await (provQuery as any).select('userId').lean()
            : await provQuery;
        if (prov && (prov as any).userId) {
          photographerUserId = (prov as any).userId.toString();
        }
      }

      // 24h Photoshoot reminder (18h to 30h window)
      if (hoursUntilShoot >= 18 && hoursUntilShoot <= 30) {
        const key = `photo_24h_${item._id}`;
        const exists = await this.notificationModel.findOne({
          userId: new Types.ObjectId(customerId),
          'metadata.reminderKey': key,
        });
        if (!exists) {
          const slotStr = item.shootTimeSlot || '';
          await this.notificationsService.createNotification(
            customerId,
            'Nhắc nhở: Lịch chụp ảnh ngày mai',
            `Bạn có lịch chụp ảnh cho đơn hàng ${booking.bookingCode} vào lúc ${slotStr} ngày ${shootStartTime.toLocaleDateString('vi-VN')}. Vui lòng chuẩn bị trang phục và đến đúng hẹn!`,
            NotificationType.Booking,
            { bookingId: booking._id, reminderKey: key },
          );

          if (photographerUserId) {
            await this.notificationsService.createNotification(
              photographerUserId,
              'Nhắc nhở: Lịch chụp ảnh với khách hàng ngày mai',
              `Bạn có lịch chụp ảnh cho đơn hàng ${booking.bookingCode} vào lúc ${slotStr} ngày ${shootStartTime.toLocaleDateString('vi-VN')}. Vui lòng chuẩn bị thiết bị đúng giờ!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: `prov_${key}` },
            );
          }
        }
      }

      // 2h Photoshoot reminder (1h to 3h window)
      if (hoursUntilShoot >= 1.0 && hoursUntilShoot <= 3.0) {
        const key = `photo_2h_${item._id}`;
        const exists = await this.notificationModel.findOne({
          userId: new Types.ObjectId(customerId),
          'metadata.reminderKey': key,
        });
        if (!exists) {
          const slotStr = item.shootTimeSlot || '';
          await this.notificationsService.createNotification(
            customerId,
            'Nhắc nhở: Sắp đến giờ chụp ảnh (còn 2 tiếng)',
            `Chỉ còn 2 tiếng nữa là đến buổi chụp ảnh đơn ${booking.bookingCode} (${slotStr}). Vui lòng chuẩn bị sẵn sàng!`,
            NotificationType.Booking,
            { bookingId: booking._id, reminderKey: key },
          );

          if (photographerUserId) {
            await this.notificationsService.createNotification(
              photographerUserId,
              'Nhắc nhở: Sắp đến giờ chụp ảnh với khách hàng (còn 2 tiếng)',
              `Chỉ còn 2 tiếng nữa là đến buổi chụp ảnh đơn ${booking.bookingCode} (${slotStr}). Vui lòng kiểm tra địa điểm và thiết bị!`,
              NotificationType.Booking,
              { bookingId: booking._id, reminderKey: `prov_${key}` },
            );
          }
        }
      }
    } catch (e) {
      this.logger.error('Error handling photography item reminders:', e);
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
