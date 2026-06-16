import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentWebhookEventDocument = HydratedDocument<PaymentWebhookEvent>;

@Schema({ collection: 'payment_webhook_events', timestamps: true })
export class PaymentWebhookEvent {
  @Prop({ required: true, unique: true, index: true, trim: true })
  webhookId: string; // Unique message ID from webhook provider

  @Prop({ type: String, default: 'PAYOS', trim: true, uppercase: true })
  provider: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ type: String, default: null })
  signature?: string | null;

  @Prop({ type: Boolean, default: false })
  isValid: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  processed: boolean;

  @Prop({ type: String, default: null })
  error?: string | null;

  @Prop({ type: Date, default: null })
  processedAt?: Date | null;
}

export const PaymentWebhookEventSchema =
  SchemaFactory.createForClass(PaymentWebhookEvent);
