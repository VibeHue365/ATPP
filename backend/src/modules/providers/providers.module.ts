import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from './schemas/provider-verification.schema';
import { ProductsModule } from '../products/products.module';
import { StorageModule } from '../storage/storage.module';
import { userModels } from '../users/users.module';
import { AuditLog, AuditLogSchema } from '../audit/schemas/audit-log.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import { ProviderVerificationsController } from './controllers/provider-verifications.controller';
import { AdminProviderVerificationsController } from './controllers/admin-provider-verifications.controller';
import { AdminProvidersController } from './controllers/admin-providers.controller';
import { ProvidersController } from './controllers/providers.controller';
import { ProvidersService } from './services/providers.service';
import { ProvidersRepository } from './repositories/providers.repository';
import { PhotographersController } from './controllers/photographers.controller';
import { PhotographersService } from './services/photographers.service';
import { ProviderVerificationService } from './services/provider-verification.service';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
]);

const providerSupportModels = MongooseModule.forFeature([
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: Notification.name, schema: NotificationSchema },
]);

@Module({
  imports: [providerModels, providerSupportModels, userModels, ProductsModule, StorageModule],
  controllers: [
    ProvidersController,
    PhotographersController,
    ProviderVerificationsController,
    AdminProviderVerificationsController,
    AdminProvidersController,
  ],
  providers: [
    ProvidersService,
    ProvidersRepository,
    PhotographersService,
    ProviderVerificationService,
  ],
  exports: [
    providerModels,
    ProvidersService,
    ProvidersRepository,
    PhotographersService,
    ProviderVerificationService,
  ],
})
export class ProvidersModule {}
