import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  OutboxStatus,
  RefundOutboxTask,
  RefundOutboxTaskDocument,
} from '../schemas/refund-outbox.schema';
import {
  PayOSRefundRejectedError,
  PayOSRefundService,
} from '../../payments/services/payos-refund.service';
import { Payment, PaymentStatus } from '../../payments/schemas/payment.schema';
import {
  RefundRequest,
  RefundStatus,
} from '../../payments/schemas/refund-request.schema';
import { Booking } from '../../bookings/schemas/booking.schema';
import { WeatherNotificationService } from './weather-notification.service';

@Injectable()
export class RefundOutboxSweeperService {
  private readonly logger = new Logger(RefundOutboxSweeperService.name);
  private isRunning = false;

  constructor(
    @InjectModel(RefundOutboxTask.name)
    private readonly outboxModel: Model<RefundOutboxTaskDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestModel: Model<RefundRequest>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    private readonly payOSRefundService: PayOSRefundService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly weatherNotificationService?: WeatherNotificationService,
  ) {}

  /**
   * Sweeper runs every 2 minutes to recover orphan refund tasks and execute durable refunds.
   */
  @Cron('0 */2 * * * *')
  async sweepPendingRefunds(): Promise<number> {
    if (this.isRunning) {
      this.logger.debug(
        'Previous refund sweeper run is still active. Skipping.',
      );
      return 0;
    }

    this.isRunning = true;
    let processedCount = 0;

    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // 1. Fetch up to 10 tasks: PENDING or stale PROCESSING (> 15m)
      const tasks = await this.outboxModel
        .find({
          $or: [
            { status: OutboxStatus.PENDING },
            {
              status: OutboxStatus.PROCESSING,
              lastAttemptAt: { $lt: fifteenMinutesAgo },
            },
          ],
        })
        .sort({ createdAt: 1 })
        .limit(10)
        .exec();

      if (tasks.length === 0) {
        return 0;
      }

      this.logger.log(
        `Found ${tasks.length} refund outbox task(s) to process.`,
      );

      for (const task of tasks) {
        const handled = await this.processSingleTask(task);
        if (handled) processedCount++;
      }
    } catch (error: any) {
      this.logger.error(
        `Error in sweepPendingRefunds: ${error?.message}`,
        error,
      );
    } finally {
      this.isRunning = false;
    }

    return processedCount;
  }

  /**
   * Processes a single refund task with atomic state transitions and retry limits.
   */
  async processSingleTask(task: RefundOutboxTaskDocument): Promise<boolean> {
    const now = new Date();

    // 2. Atomic lock
    const locked = await this.outboxModel.findOneAndUpdate(
      { _id: task._id, status: task.status },
      {
        $set: {
          status: OutboxStatus.PROCESSING,
          lastAttemptAt: now,
        },
      },
      { new: true },
    );

    if (!locked) {
      this.logger.debug(`Could not acquire atomic lock for task ${task._id}`);
      return false;
    }

    try {
      // 3. Locate PayOS orderCode for the booking
      const payment = await this.paymentModel
        .findOne({
          bookingId: locked.bookingId,
          status: PaymentStatus.Success,
          'payos.orderCode': { $exists: true, $ne: null },
        })
        .lean()
        .exec();

      let orderCode: number | null = payment?.payos?.orderCode ?? null;

      if (!orderCode) {
        const nodeEnv = this.configService.get<string>(
          'NODE_ENV',
          'development',
        );
        if (nodeEnv !== 'production') {
          // Fallback mock order code in non-production environments
          orderCode = 999999;
          this.logger.warn(
            `No PayOS payment record found for booking ${locked.bookingId} in ${nodeEnv}. Using mock orderCode 999999.`,
          );
        } else {
          throw new Error(
            `No successful PayOS payment record found for booking ${locked.bookingId}`,
          );
        }
      }

      // 4. Call PayOS Refund API
      this.logger.log(
        `Executing refund for task ${locked._id} [orderCode: ${orderCode}, amount: ${locked.amount}]`,
      );
      await this.payOSRefundService.refundPayment(orderCode, locked.amount);

      // 5. Success -> Mark COMPLETED
      await this.outboxModel.updateOne(
        { _id: locked._id },
        {
          $set: {
            status: OutboxStatus.COMPLETED,
            lastError: null,
          },
        },
      );

      // Synchronize RefundRequest if present
      if (locked.refundRequestId) {
        await this.refundRequestModel.updateOne(
          { _id: locked.refundRequestId },
          {
            $set: {
              status: RefundStatus.Completed,
              processedAmount: locked.amount,
            },
            $inc: { version: 1 },
          },
        );
      }

      // Update Booking totalRefunded
      await this.bookingModel.updateOne(
        { _id: locked.bookingId },
        {
          $inc: { 'paymentSummary.totalRefunded': locked.amount },
        },
      );

      if (this.weatherNotificationService) {
        const booking = await this.bookingModel
          .findById(locked.bookingId)
          .select('customerId')
          .lean();
        if (booking && booking.customerId) {
          await this.weatherNotificationService
            .sendRefundStatusUpdated({
              userId: booking.customerId.toString(),
              refundId:
                locked.refundRequestId?.toString() || locked._id.toString(),
              bookingId: locked.bookingId.toString(),
              status: 'COMPLETED',
              amount: locked.amount,
            })
            .catch((e) =>
              this.logger.warn(
                `Failed to send refund_status_updated notification: ${e?.message}`,
              ),
            );
        }
      }

      this.logger.log(
        `Successfully completed refund outbox task ${locked._id}`,
      );
      return true;
    } catch (err: any) {
      if (err instanceof PayOSRefundRejectedError) {
        // PayOS hard rejection -> Mark FAILED
        this.logger.error(
          `PayOS permanently rejected refund for task ${locked._id}: ${err.message}`,
        );
        await this.outboxModel.updateOne(
          { _id: locked._id },
          {
            $set: {
              status: OutboxStatus.FAILED,
              lastError: err.message,
            },
          },
        );
        return false;
      }

      // Transient or network failure -> Check retry threshold
      const nextRetryCount = (locked.retryCount || 0) + 1;
      if (nextRetryCount >= 3) {
        // Threshold reached -> Transition to NEEDS_MANUAL_REVIEW to prevent double refund
        this.logger.warn(
          `Task ${locked._id} reached maximum retries (${nextRetryCount}). Moving to NEEDS_MANUAL_REVIEW. Error: ${err.message}`,
        );
        await this.outboxModel.updateOne(
          { _id: locked._id },
          {
            $set: {
              status: OutboxStatus.NEEDS_MANUAL_REVIEW,
              retryCount: nextRetryCount,
              lastError: err.message,
            },
          },
        );
      } else {
        // Retry later
        this.logger.warn(
          `Transient error on refund task ${locked._id} (attempt ${nextRetryCount}/3): ${err.message}`,
        );
        await this.outboxModel.updateOne(
          { _id: locked._id },
          {
            $set: {
              status: OutboxStatus.PENDING,
              retryCount: nextRetryCount,
              lastError: err.message,
            },
          },
        );
      }
      return false;
    }
  }
}
