import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentWebhookEvent, PaymentWebhookEventDocument } from '../schemas/payment-webhook-event.schema';

export type WebhookEventClaim =
  | { state: 'claimed'; event: PaymentWebhookEventDocument }
  | { state: 'processed'; event: PaymentWebhookEventDocument }
  | { state: 'processing'; event: PaymentWebhookEventDocument };

const PROCESSING_LEASE_MS = 60_000;

@Injectable()
export class WebhookEventRepository {
  constructor(
    @InjectModel(PaymentWebhookEvent.name)
    private readonly webhookEventModel: Model<PaymentWebhookEvent>,
  ) {}

  async claimVerifiedEvent(
    webhookId: string,
    payload: Record<string, unknown>,
    signature: string | null,
  ): Promise<WebhookEventClaim> {
    let event: PaymentWebhookEventDocument | null;
    try {
      event = await this.webhookEventModel.create({
        webhookId,
        provider: 'PAYOS',
        payload,
        signature,
        isValid: true,
        processed: false,
        processingAttempts: 0,
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      event = await this.webhookEventModel.findOne({ webhookId }).exec();
    }

    if (!event) throw new Error(`Unable to read webhook event ${webhookId}.`);
    if (event.processed) return { state: 'processed', event };

    const now = new Date();
    const leaseExpiredAt = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const claimed = await this.webhookEventModel
      .findOneAndUpdate(
        {
          _id: event._id,
          processed: false,
          $or: [
            { processingStartedAt: null },
            { processingStartedAt: { $exists: false } },
            { processingStartedAt: { $lte: leaseExpiredAt } },
          ],
        },
        {
          $set: { processingStartedAt: now, error: null, isValid: true },
          $inc: { processingAttempts: 1 },
        },
        { new: true },
      )
      .exec();

    if (claimed) return { state: 'claimed', event: claimed };
    const current = await this.webhookEventModel.findById(event._id).exec();
    if (!current) throw new Error(`Webhook event ${webhookId} disappeared.`);
    return current.processed
      ? { state: 'processed', event: current }
      : { state: 'processing', event: current };
  }

  async markProcessed(webhookId: string): Promise<void> {
    await this.webhookEventModel.updateOne(
      { webhookId },
      { $set: { processed: true, processedAt: new Date(), error: null }, $unset: { processingStartedAt: 1 } },
    );
  }

  async markError(webhookId: string, error: string): Promise<void> {
    await this.webhookEventModel.updateOne(
      { webhookId },
      { $set: { error }, $unset: { processingStartedAt: 1 } },
    );
  }
}