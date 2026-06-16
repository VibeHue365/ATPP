import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  PaymentWebhookEvent,
  PaymentWebhookEventSchema,
} from './schemas/payment-webhook-event.schema';
import {
  RefundRequest,
  RefundRequestSchema,
} from './schemas/refund-request.schema';
import {
  BookingSettlement,
  BookingSettlementSchema,
} from './schemas/booking-settlement.schema';

export const paymentModels = MongooseModule.forFeature([
  { name: Payment.name, schema: PaymentSchema },
  { name: PaymentWebhookEvent.name, schema: PaymentWebhookEventSchema },
  { name: RefundRequest.name, schema: RefundRequestSchema },
  { name: BookingSettlement.name, schema: BookingSettlementSchema },
]);

@Module({
  imports: [paymentModels],
  exports: [paymentModels],
})
export class PaymentsModule {}
