import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentRecovery, PaymentRecoverySchema } from './schemas/payment-recovery.schema';
import {
  PaymentWebhookEvent,
  PaymentWebhookEventSchema,
} from './schemas/payment-webhook-event.schema';
import {
  RefundRequest,
  RefundRequestSchema,
} from './schemas/refund-request.schema';
import { RefundAttempt, RefundAttemptSchema } from './schemas/refund-attempt.schema';
import { SettlementAdjustment, SettlementAdjustmentSchema } from '../settlements/schemas/settlement-adjustment.schema';
import { Settlement, SettlementSchema } from '../settlements/schemas/settlement.schema';
import {
  BookingSettlement,
  BookingSettlementSchema,
} from './schemas/booking-settlement.schema';
import {
  BookingEscrow,
  BookingEscrowSchema,
} from './schemas/booking-escrow.schema';
import {
  SettlementTransfer,
  SettlementTransferSchema,
} from './schemas/settlement-transfer.schema';
import { PaymentsController } from './controllers/payments.controller';
import { RefundsController } from './controllers/refunds.controller';
import { PaymentsService } from './services/payments.service';
import { RefundWorkflowService } from './services/refund-workflow.service';
import { PayOSRefundService } from './services/payos-refund.service';
import { MockBankingService } from './services/mock-banking.service';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsRepository } from './repositories/payments.repository';
import { EscrowRepository } from './repositories/escrow.repository';
import { SettlementRepository } from './repositories/settlement.repository';
import { TransferRepository } from './repositories/transfer.repository';
import { WebhookEventRepository } from './repositories/webhook-event.repository';
import { SettlementTransferMapper } from './mappers/settlement-transfer.mapper';
import { SettlementsModule } from '../settlements/settlements.module';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { ProductsModule } from '../products/products.module';
import { ContractsModule } from '../contracts/contracts.module';
import { PaymentExpiryClaimService } from './services/payment-expiry-claim.service';
import { PaymentRecoveryService } from './services/payment-recovery.service';
import { V2PaymentFinalizationService } from './services/v2-payment-finalization.service';

export const paymentModels = MongooseModule.forFeature([
  { name: Payment.name, schema: PaymentSchema },
  { name: PaymentRecovery.name, schema: PaymentRecoverySchema },
  { name: PaymentWebhookEvent.name, schema: PaymentWebhookEventSchema },
  { name: RefundRequest.name, schema: RefundRequestSchema },
  { name: RefundAttempt.name, schema: RefundAttemptSchema },
  { name: Settlement.name, schema: SettlementSchema },
  { name: SettlementAdjustment.name, schema: SettlementAdjustmentSchema },
  { name: BookingSettlement.name, schema: BookingSettlementSchema },
  { name: BookingEscrow.name, schema: BookingEscrowSchema },
  { name: SettlementTransfer.name, schema: SettlementTransferSchema },
]);

@Module({
  imports: [
    paymentModels,
    ConfigModule,
    forwardRef(() => BookingsModule),
    NotificationsModule,
    SettlementsModule,
    SystemPoliciesModule,
    ProductsModule,
    ContractsModule,
  ],
  controllers: [PaymentsController, RefundsController],
  providers: [
    PaymentsService, 
    RefundWorkflowService, 
    PayOSRefundService, 
    MockBankingService,
    PaymentsRepository,
    EscrowRepository,
    SettlementRepository,
    TransferRepository,
    WebhookEventRepository,
    SettlementTransferMapper,
    PaymentExpiryClaimService,
    PaymentRecoveryService,
    V2PaymentFinalizationService,
  ],
  exports: [
    paymentModels,
    PaymentsService,
    RefundWorkflowService,
    PayOSRefundService,
    MockBankingService,
    PaymentsRepository,
    EscrowRepository,
    SettlementRepository,
    TransferRepository,
    WebhookEventRepository,
    SettlementTransferMapper,
    PaymentExpiryClaimService,
    PaymentRecoveryService,
    V2PaymentFinalizationService,
  ],
})
export class PaymentsModule {}
