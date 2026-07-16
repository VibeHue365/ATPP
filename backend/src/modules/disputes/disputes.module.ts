import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dispute, DisputeSchema } from './schemas/dispute.schema';
import { IncidentReport, IncidentReportSchema } from './schemas/incident-report.schema';
import { PrivateEvidenceUpload, PrivateEvidenceUploadSchema } from './schemas/private-evidence-upload.schema';
import { DisputesService } from './services/disputes.service';
import { PrivateEvidenceCleanupService } from './services/private-evidence-cleanup.service';
import { DisputesController } from './controllers/disputes.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { ProductsModule } from '../products/products.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { StorageModule } from '../storage/storage.module';

export const disputeModels = MongooseModule.forFeature([
  { name: Dispute.name, schema: DisputeSchema },
  { name: IncidentReport.name, schema: IncidentReportSchema },
  { name: PrivateEvidenceUpload.name, schema: PrivateEvidenceUploadSchema },
]);

@Module({
  imports: [
    disputeModels,
    forwardRef(() => BookingsModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => PaymentsModule),
    SettlementsModule,
    SystemPoliciesModule,
    StorageModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService, PrivateEvidenceCleanupService],
  exports: [disputeModels, DisputesService],
})
export class DisputesModule {}
