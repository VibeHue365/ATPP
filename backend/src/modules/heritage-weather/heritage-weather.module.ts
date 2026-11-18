import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HeritageSpot,
  HeritageSpotSchema,
} from './schemas/heritage-spot.schema';
import {
  WeatherProposal,
  WeatherProposalSchema,
} from './schemas/weather-proposal.schema';
import {
  WeatherCancellationRequest,
  WeatherCancellationRequestSchema,
} from './schemas/weather-cancellation.schema';
import {
  RefundOutboxTask,
  RefundOutboxTaskSchema,
} from './schemas/refund-outbox.schema';
import { HeritageSpotsService } from './services/heritage-spots.service';
import { HeritageSpotsController } from './controllers/heritage-spots.controller';
import { OpenMeteoClientService } from './services/open-meteo-client.service';
import { AstronomicalCalculatorService } from './services/astronomical-calculator.service';
import { HeritageScoringService } from './services/heritage-scoring.service';
import { WeatherAdvisorController } from './controllers/weather-advisor.controller';
import { RefundOutboxService } from './services/refund-outbox.service';
import { RefundOutboxSweeperService } from './services/refund-outbox-sweeper.service';
import { WeatherProposalsService } from './services/weather-proposals.service';
import { WeatherProposalSupervisorService } from './services/weather-proposal-supervisor.service';
import { WeatherProposalsController } from './controllers/weather-proposals.controller';
import { ComboRescheduleCoordinatorService } from './services/combo-reschedule-coordinator.service';
import { WeatherCancellationsService } from './services/weather-cancellations.service';
import { WeatherCancellationsController } from './controllers/weather-cancellations.controller';
import { AdminWeatherCancellationsController } from './controllers/admin-weather-cancellations.controller';
import { WeatherNotificationService } from './services/weather-notification.service';
import { WeatherAlertSchedulerService } from './services/weather-alert-scheduler.service';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule, notificationModels } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { providerModels } from '../providers/providers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HeritageSpot.name, schema: HeritageSpotSchema },
      { name: WeatherProposal.name, schema: WeatherProposalSchema },
      {
        name: WeatherCancellationRequest.name,
        schema: WeatherCancellationRequestSchema,
      },
      { name: RefundOutboxTask.name, schema: RefundOutboxTaskSchema },
    ]),
    notificationModels,
    providerModels,
    forwardRef(() => PaymentsModule),
    forwardRef(() => BookingsModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [
    HeritageSpotsController,
    WeatherAdvisorController,
    WeatherProposalsController,
    WeatherCancellationsController,
    AdminWeatherCancellationsController,
  ],
  providers: [
    HeritageSpotsService,
    OpenMeteoClientService,
    AstronomicalCalculatorService,
    HeritageScoringService,
    RefundOutboxService,
    RefundOutboxSweeperService,
    WeatherProposalsService,
    WeatherProposalSupervisorService,
    ComboRescheduleCoordinatorService,
    WeatherCancellationsService,
    WeatherNotificationService,
    WeatherAlertSchedulerService,
  ],
  exports: [
    HeritageSpotsService,
    OpenMeteoClientService,
    AstronomicalCalculatorService,
    HeritageScoringService,
    RefundOutboxService,
    RefundOutboxSweeperService,
    WeatherProposalsService,
    WeatherProposalSupervisorService,
    ComboRescheduleCoordinatorService,
    WeatherCancellationsService,
    WeatherNotificationService,
    WeatherAlertSchedulerService,
    MongooseModule,
  ],
})
export class HeritageWeatherModule {}
