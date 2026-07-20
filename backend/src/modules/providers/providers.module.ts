import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import {
  PortfolioItem,
  PortfolioItemSchema,
} from './schemas/portfolio-item.schema';
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
import {
  RefreshToken,
  RefreshTokenSchema,
} from '../auth/schemas/refresh-token.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemSchema,
} from '../bookings/schemas/booking-item.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { ProviderVerificationsController } from './controllers/provider-verifications.controller';
import { AdminProviderVerificationsController } from './controllers/admin-provider-verifications.controller';
import { AdminProvidersController } from './controllers/admin-providers.controller';
import { ProvidersController } from './controllers/providers.controller';
import { AdminPortfolioModerationController } from './controllers/admin-portfolio-moderation.controller';
import { ProvidersService } from './services/providers.service';
import { ProvidersRepository } from './repositories/providers.repository';
import { ProviderVerificationService } from './services/provider-verification.service';
import { ProviderOcrQueueService } from './services/provider-ocr-queue.service';
import { ProviderOcrOutboxService } from './services/provider-ocr-outbox.service';
import { ProviderDocumentOcrService } from './services/provider-document-ocr.service';
import { ProviderOcrRecoveryService } from './services/provider-ocr-recovery.service';
import { ProviderVerificationOcrAttempt, ProviderVerificationOcrAttemptSchema } from './schemas/provider-verification-ocr-attempt.schema';
import { ProviderVerificationOcrOutboxEvent, ProviderVerificationOcrOutboxEventSchema } from './schemas/provider-verification-ocr-outbox.schema';
import { SmartTaggingModule } from '../smart-tagging/smart-tagging.module';

export const providerModels = MongooseModule.forFeature([
  { name: Provider.name, schema: ProviderSchema },
  { name: ProviderVerification.name, schema: ProviderVerificationSchema },
  { name: ProviderVerificationOcrAttempt.name, schema: ProviderVerificationOcrAttemptSchema },
  { name: ProviderVerificationOcrOutboxEvent.name, schema: ProviderVerificationOcrOutboxEventSchema },
  { name: PortfolioItem.name, schema: PortfolioItemSchema },
]);

const providerSupportModels = MongooseModule.forFeature([
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: Notification.name, schema: NotificationSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: Product.name, schema: ProductSchema },
  { name: Booking.name, schema: BookingSchema },
  { name: BookingItem.name, schema: BookingItemSchema },
  { name: Review.name, schema: ReviewSchema },
  { name: Payment.name, schema: PaymentSchema },
]);

@Module({
  imports: [
    providerModels,
    providerSupportModels,
    userModels,
    ProductsModule,
    StorageModule,
    SmartTaggingModule,
  ],
  controllers: [
    ProvidersController,
    ProviderVerificationsController,
    AdminProviderVerificationsController,
    AdminProvidersController,
    AdminPortfolioModerationController,
  ],
  providers: [
    ProvidersService,
    ProvidersRepository,
    ProviderVerificationService,

    ProviderOcrQueueService,
    ProviderOcrOutboxService,
    ProviderDocumentOcrService,
    ProviderOcrRecoveryService,
  ],
  exports: [
    providerModels,
    ProvidersService,
    ProvidersRepository,
    ProviderVerificationService,
    ProviderOcrQueueService,
    ProviderOcrOutboxService,
    ProviderDocumentOcrService,
    ProviderOcrRecoveryService,
  ],
})
export class ProvidersModule {}
