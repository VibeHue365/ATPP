import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentWebhookEvent, PaymentWebhookEventDocument } from '../schemas/payment-webhook-event.schema';

@Injectable()
export class WebhookEventRepository {
  constructor(
    @InjectModel(PaymentWebhookEvent.name) private readonly webhookEventModel: Model<PaymentWebhookEvent>,
  ) {}

  async findOrCreateEvent(
    webhookId: string,
    payload: Record<string, any>,
    signature: string | null,
  ): Promise<PaymentWebhookEventDocument | null> {
    return this.webhookEventModel.findOneAndUpdate(
      { webhookId },
      {
        $setOnInsert: {
          provider: 'PAYOS',
          payload,
          signature,
          processed: false,
        },
      },
      { upsert: true, new: false },
    );
  }

  async markProcessed(webhookId: string): Promise<void> {
    await this.webhookEventModel.updateOne(
      { webhookId },
      { $set: { processed: true, processedAt: new Date() } },
    );
  }

  async markError(webhookId: string, error: string): Promise<void> {
    await this.webhookEventModel.updateOne(
      { webhookId },
      { $set: { error } },
    );
  }
}
