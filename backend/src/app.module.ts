import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { PhotographersModule } from './modules/photographers/photographers.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SystemPoliciesModule } from './modules/system-policies/system-policies.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { ProductsModule } from './modules/products/products.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { SmartTaggingModule } from './modules/smart-tagging/smart-tagging.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { validateEnv } from './common/config/env.validation';
import { ApiDocsController } from './common/controllers/api-docs.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://127.0.0.1:27017/vibehue_auth',
        ),
      }),
    }),
    AuthModule,
    UsersModule,
    ProvidersModule,
    PhotographersModule,
    CategoriesModule,
    SystemPoliciesModule,
    SettlementsModule,
    ProductsModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    DisputesModule,
    NotificationsModule,
    AuditModule,
    AiModule,
    ChatModule,
    AdminStatsModule,
    AdminModule,
    SmartTaggingModule,
    AnalyticsModule,
  ],
  controllers: [AppController, ApiDocsController],
  providers: [AppService],
})
export class AppModule {}
