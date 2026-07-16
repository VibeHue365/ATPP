import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ClientSession, Model, Types } from 'mongoose';
import {
  OcrAssessment,
  OcrExecutionStatus,
  OcrStatus,
  ProviderDocumentType,
  ProviderVerification,
} from '../schemas/provider-verification.schema';
import {
  OcrOutboxStatus,
  ProviderVerificationOcrOutboxEvent,
  ProviderVerificationOcrOutboxEventDocument,
} from '../schemas/provider-verification-ocr-outbox.schema';
import { ProviderOcrQueueService } from './provider-ocr-queue.service';

@Injectable()
export class ProviderOcrOutboxService implements OnModuleInit {
  private readonly logger = new Logger(ProviderOcrOutboxService.name);
  private dispatching = false;

  constructor(
    @InjectModel(ProviderVerification.name)
    private readonly verificationModel: Model<ProviderVerification>,
    @InjectModel(ProviderVerificationOcrOutboxEvent.name)
    private readonly outbox: Model<ProviderVerificationOcrOutboxEvent>,
    private readonly queue: ProviderOcrQueueService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.enabled()) await this.dispatchPending();
  }

  isEnabled(): boolean {
    return this.enabled();
  }

  async createRequest(
    verificationId: Types.ObjectId,
    documentType: ProviderDocumentType,
    versionNo: number,
    session?: ClientSession,
  ): Promise<{ attemptId: string; operationId: string }> {
    const attemptId = randomUUID();
    const operationId = randomUUID();
    await new this.outbox({
      verificationId,
      documentType,
      versionNo,
      attemptId,
      operationId,
      status: OcrOutboxStatus.Pending,
    }).save({ session });
    return { attemptId, operationId };
  }

  @Cron('*/10 * * * * *')
  async dispatchPending(): Promise<void> {
    if (!this.enabled() || this.dispatching) return;
    this.dispatching = true;
    try {
      const now = new Date();
      const events = await this.outbox
        .find({
          $or: [
            { status: OcrOutboxStatus.Pending },
            {
              status: OcrOutboxStatus.Failed,
              $or: [
                { nextAttemptAt: null },
                { nextAttemptAt: { $lte: now } },
              ],
            },
          ],
        })
        .sort({ createdAt: 1 })
        .limit(25);
      for (const event of events) await this.dispatchOne(event);
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchOne(
    event: ProviderVerificationOcrOutboxEventDocument,
  ): Promise<void> {
    const now = new Date();
    const transition = await this.verificationModel.updateOne(
      { _id: event.verificationId },
      {
        $set: {
          'documents.$[d].versions.$[v].ocr.executionStatus': OcrExecutionStatus.Processing,
          'documents.$[d].versions.$[v].ocr.startedAt': now,
          'documents.$[d].versions.$[v].ocr.heartbeatAt': now,
        },
      },
      {
        arrayFilters: [
          { 'd.documentType': event.documentType },
          {
            'v.versionNo': event.versionNo,
            'v.isCurrent': true,
            'v.ocr.activeAttemptId': event.attemptId,
            'v.ocr.executionStatus': OcrExecutionStatus.NotStarted,
          },
        ],
      },
    );

    if (!transition.modifiedCount) {
      await this.outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: OcrOutboxStatus.Delivered,
            deliveredAt: now,
            lastErrorCode: 'STALE_EVENT',
            nextAttemptAt: null,
          },
        },
      );
      return;
    }

    try {
      await this.queue.enqueue({
        verificationId: event.verificationId.toString(),
        documentType: event.documentType,
        versionNo: event.versionNo,
        attemptId: event.attemptId,
        operationId: event.operationId,
      });
      await this.outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: OcrOutboxStatus.Delivered,
            deliveredAt: new Date(),
            lastErrorCode: null,
            nextAttemptAt: null,
          },
        },
      );
    } catch {
      this.logger.warn(`Unable to dispatch OCR outbox event ${event._id}`);
      await this.verificationModel.updateOne(
        { _id: event.verificationId },
        {
          $set: {
            'documents.$[d].versions.$[v].ocr.executionStatus': OcrExecutionStatus.NotStarted,
            'documents.$[d].versions.$[v].ocr.startedAt': null,
            'documents.$[d].versions.$[v].ocr.heartbeatAt': null,
          },
        },
        {
          arrayFilters: [
            { 'd.documentType': event.documentType },
            {
              'v.versionNo': event.versionNo,
              'v.isCurrent': true,
              'v.ocr.activeAttemptId': event.attemptId,
              'v.ocr.executionStatus': OcrExecutionStatus.Processing,
            },
          ],
        },
      );
      await this.recordDeliveryFailure(event, now);
    }
  }

  private async recordDeliveryFailure(
    event: ProviderVerificationOcrOutboxEventDocument,
    now: Date,
  ): Promise<void> {
    const deliveryAttempts = event.deliveryAttempts + 1;
    const exhausted = deliveryAttempts >= this.number(
      'OCR_OUTBOX_MAX_DELIVERY_ATTEMPTS',
      5,
    );

    await this.outbox.updateOne(
      { _id: event._id },
      {
        $set: exhausted
          ? {
              status: OcrOutboxStatus.DeadLetter,
              lastErrorCode: 'QUEUE_ENQUEUE_FAILED',
              deadLetteredAt: now,
              nextAttemptAt: null,
            }
          : {
              status: OcrOutboxStatus.Failed,
              lastErrorCode: 'QUEUE_ENQUEUE_FAILED',
              nextAttemptAt: new Date(
                now.getTime() + this.deliveryRetryDelayMs(deliveryAttempts),
              ),
            },
        $inc: { deliveryAttempts: 1 },
      },
    );

    if (!exhausted) return;

    const result = await this.verificationModel.updateOne(
      { _id: event.verificationId },
      {
        $set: {
          'documents.$[d].versions.$[v].ocr.executionStatus': OcrExecutionStatus.Failed,
          'documents.$[d].versions.$[v].ocr.assessment': OcrAssessment.ManualReview,
          'documents.$[d].versions.$[v].ocr.completedAt': now,
          'documents.$[d].versions.$[v].ocr.warningCodes': [
            'OCR_QUEUE_DELIVERY_FAILED',
          ],
          'documents.$[d].versions.$[v].ocrStatus': OcrStatus.Failed,
          'documents.$[d].versions.$[v].mismatchFlags': [
            'OCR_QUEUE_DELIVERY_FAILED',
          ],
        },
        $inc: { verificationRevision: 1 },
      },
      {
        arrayFilters: [
          { 'd.documentType': event.documentType },
          {
            'v.versionNo': event.versionNo,
            'v.isCurrent': true,
            'v.ocr.activeAttemptId': event.attemptId,
            'v.ocr.executionStatus': OcrExecutionStatus.NotStarted,
          },
        ],
      },
    );
    if (result.modifiedCount) {
      this.logger.error(
        `OCR outbox event moved to dead letter after ${deliveryAttempts} delivery attempts: ${event._id}`,
      );
    }
  }

  private deliveryRetryDelayMs(deliveryAttempts: number): number {
    const base = this.number('OCR_OUTBOX_RETRY_DELAY_MS', 30_000);
    const max = this.number('OCR_OUTBOX_MAX_RETRY_DELAY_MS', 600_000);
    return Math.min(base * 2 ** Math.max(0, deliveryAttempts - 1), max);
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private enabled(): boolean {
    return this.config.get<string>('OCR_V2_ENABLED', 'false') === 'true';
  }
}