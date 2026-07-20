import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityLogModule } from '../auth/security-log.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemSchema,
} from '../bookings/schemas/booking-item.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { AdminSettlementsController } from './controllers/admin-settlements.controller';
import { ProviderSettlementsController } from './controllers/provider-settlements.controller';
import { SettlementAccessPolicy } from './policies/settlement-access.policy';
import { Settlement, SettlementSchema } from './schemas/settlement.schema';
import { SettlementAdjustment, SettlementAdjustmentSchema } from './schemas/settlement-adjustment.schema';
import { SettlementCalculationService } from './services/settlement-calculation.service';
import { SettlementCodeService } from './services/settlement-code.service';
import { SettlementQueryService } from './services/settlement-query.service';
import { SettlementStatusService } from './services/settlement-status.service';
import { SettlementsService } from './services/settlements.service';

export const settlementModels = MongooseModule.forFeature([
  { name: Settlement.name, schema: SettlementSchema },
  { name: SettlementAdjustment.name, schema: SettlementAdjustmentSchema },
  { name: Booking.name, schema: BookingSchema },
  { name: BookingItem.name, schema: BookingItemSchema },
  { name: Payment.name, schema: PaymentSchema },
  { name: Provider.name, schema: ProviderSchema },
]);

@Module({
  imports: [settlementModels, SystemPoliciesModule, SecurityLogModule],
  controllers: [AdminSettlementsController, ProviderSettlementsController],
  providers: [
    SettlementAccessPolicy,
    SettlementCalculationService,
    SettlementCodeService,
    SettlementQueryService,
    SettlementStatusService,
    SettlementsService,
  ],
  exports: [
    settlementModels,
    SettlementCalculationService,
    SettlementQueryService,
    SettlementsService,
  ],
})
export class SettlementsModule {}
