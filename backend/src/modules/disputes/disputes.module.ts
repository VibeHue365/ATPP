import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dispute, DisputeSchema } from './schemas/dispute.schema';
import { IncidentReport, IncidentReportSchema } from './schemas/incident-report.schema';
import { DisputesService } from './services/disputes.service';
import { DisputesController } from './controllers/disputes.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { ProductsModule } from '../products/products.module';
import { PaymentsModule } from '../payments/payments.module';

export const disputeModels = MongooseModule.forFeature([
  { name: Dispute.name, schema: DisputeSchema },
  { name: IncidentReport.name, schema: IncidentReportSchema },
]);

@Module({
  imports: [
    disputeModels,
    forwardRef(() => BookingsModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [disputeModels, DisputesService],
})
export class DisputesModule {}
