import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OutboxStatus,
  RefundOutboxTask,
  RefundOutboxTaskDocument,
} from '../schemas/refund-outbox.schema';

export interface EnqueueRefundInput {
  bookingId: string | Types.ObjectId;
  amount: number;
  reason: string;
  sourceEventId: string;
  refundRequestId?: string | Types.ObjectId | null;
}

@Injectable()
export class RefundOutboxService {
  private readonly logger = new Logger(RefundOutboxService.name);

  constructor(
    @InjectModel(RefundOutboxTask.name)
    private readonly outboxModel: Model<RefundOutboxTaskDocument>,
  ) {}

  /**
   * Idempotently enqueues a refund task into the Transactional Outbox.
   * Duplicate sourceEventIds will return the existing task without creating a duplicate.
   */
  async enqueueRefund(
    input: EnqueueRefundInput,
  ): Promise<RefundOutboxTaskDocument> {
    const bookingObjectId =
      typeof input.bookingId === 'string'
        ? new Types.ObjectId(input.bookingId)
        : input.bookingId;

    const refundRequestObjectId = input.refundRequestId
      ? typeof input.refundRequestId === 'string'
        ? new Types.ObjectId(input.refundRequestId)
        : input.refundRequestId
      : null;

    try {
      const task = await this.outboxModel.findOneAndUpdate(
        { sourceEventId: input.sourceEventId },
        {
          $setOnInsert: {
            sourceEventId: input.sourceEventId,
            bookingId: bookingObjectId,
            amount: input.amount,
            reason: input.reason,
            status: OutboxStatus.PENDING,
            retryCount: 0,
            lastAttemptAt: null,
            lastError: null,
            refundRequestId: refundRequestObjectId,
          },
        },
        { upsert: true, new: true },
      );

      this.logger.log(
        `Enqueued refund outbox task ${task._id} for booking ${input.bookingId} [sourceEventId: ${input.sourceEventId}]`,
      );
      return task;
    } catch (err: any) {
      if (err?.code === 11000) {
        // Handled race condition: existing record already inserted
        const existing = await this.outboxModel.findOne({
          sourceEventId: input.sourceEventId,
        });
        if (existing) return existing;
      }
      this.logger.error(
        `Failed to enqueue refund outbox task: ${err?.message}`,
        err,
      );
      throw err;
    }
  }

  /**
   * Retrieves task by sourceEventId
   */
  async getTask(
    sourceEventId: string,
  ): Promise<RefundOutboxTaskDocument | null> {
    return this.outboxModel.findOne({ sourceEventId }).exec();
  }

  /**
   * Retrieves task by ID
   */
  async getTaskById(id: string): Promise<RefundOutboxTaskDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.outboxModel.findById(id).exec();
  }

  /**
   * Lists tasks for a specific booking
   */
  async listTasksByBooking(
    bookingId: string | Types.ObjectId,
  ): Promise<RefundOutboxTaskDocument[]> {
    const bId =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;
    return this.outboxModel
      .find({ bookingId: bId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Lists tasks by status
   */
  async listTasksByStatus(
    status: OutboxStatus,
    limit = 20,
  ): Promise<RefundOutboxTaskDocument[]> {
    return this.outboxModel
      .find({ status })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }
}
