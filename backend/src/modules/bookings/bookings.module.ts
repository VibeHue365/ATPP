import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './schemas/cart.schema';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { BookingItem, BookingItemSchema } from './schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleSchema,
} from './schemas/booking-schedule.schema';

import {
  ProviderScheduleLock,
  ProviderScheduleLockSchema,
} from './schemas/provider-schedule-lock.schema';
import {
  RentalHandover,
  RentalHandoverSchema,
} from './schemas/rental-handover.schema';
import { BookingsController } from './controllers/bookings.controller';
import { PublicBookingAvailabilityController } from './controllers/public-booking-availability.controller';
import { PhotographyHoldsController } from './controllers/photography-holds.controller';
import { StaffSchedulesController } from './controllers/staff-schedules.controller';
import { BookingsService } from './services/bookings.service';
import { BookingsSchedulerService } from './services/bookings-scheduler.service';
import { PhotographyHoldService } from './services/photography-hold.service';
import { StaffAvailabilityService } from './services/staff-availability.service';
import { StaffSchedulesService } from './services/staff-schedules.service';
import { RentalFulfillmentService } from './services/rental-fulfillment.service';
import { RentalFulfillmentWorkflowService } from './services/rental-fulfillment-workflow.service';
import { RentalDepositRefundCoordinatorService } from './services/rental-deposit-refund-coordinator.service';
import { RentalFulfillmentController } from './controllers/rental-fulfillment.controller';
import { AdminRentalMigrationController } from './controllers/admin-rental-migration.controller';
import {
  RentalEvidenceUpload,
  RentalEvidenceUploadSchema,
} from './schemas/rental-evidence-upload.schema';
import { PhotographyQuoteService } from '../photographers/services/photography-quote.service';
import { ProductsModule } from '../products/products.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProvidersModule } from '../providers/providers.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { StorageModule } from '../storage/storage.module';
import { ContractsModule } from '../contracts/contracts.module';

import { BookingStatusService } from './services/booking-status.service';
import { BookingCreationService } from './services/booking-creation.service';
import { BookingsRepository } from './repositories/bookings.repository';
import {
  InventorySlotLease,
  InventorySlotLeaseSchema,
} from './schemas/inventory-slot-lease.schema';
import { TimeSlotEngineService } from './services/time-slot-engine.service';
import { InventorySlotLeaseService } from './services/inventory-slot-lease.service';
import { ProductBusyCacheService } from './services/product-busy-cache.service';
import { RentalEvidenceCleanupService } from './services/rental-evidence-cleanup.service';
import { RentalOverdueDominoService } from './services/rental-overdue-domino.service';

export const bookingModels = MongooseModule.forFeature([
  { name: Cart.name, schema: CartSchema },
  { name: Booking.name, schema: BookingSchema },
  { name: BookingItem.name, schema: BookingItemSchema },
  { name: BookingSchedule.name, schema: BookingScheduleSchema },
  { name: ProviderScheduleLock.name, schema: ProviderScheduleLockSchema },
  { name: RentalHandover.name, schema: RentalHandoverSchema },
  { name: RentalEvidenceUpload.name, schema: RentalEvidenceUploadSchema },
  { name: InventorySlotLease.name, schema: InventorySlotLeaseSchema },
]);

@Module({
  imports: [
    bookingModels,
    ProductsModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    ProvidersModule,
    SettlementsModule,
    SystemPoliciesModule,
    StorageModule,
    ContractsModule,
  ],
  controllers: [
    BookingsController,
    PublicBookingAvailabilityController,
    PhotographyHoldsController,
    StaffSchedulesController,
    RentalFulfillmentController,
    AdminRentalMigrationController,
  ],
  providers: [
    BookingsRepository,
    BookingsService,
    BookingStatusService,
    BookingCreationService,
    BookingsSchedulerService,
    StaffAvailabilityService,
    StaffSchedulesService,
    PhotographyQuoteService,
    PhotographyHoldService,
    RentalFulfillmentService,
    RentalFulfillmentWorkflowService,
    RentalDepositRefundCoordinatorService,
    TimeSlotEngineService,
    InventorySlotLeaseService,
    ProductBusyCacheService,
    RentalEvidenceCleanupService,
    RentalOverdueDominoService,
  ],
  exports: [
    bookingModels,
    BookingsService,
    BookingStatusService,
    StaffAvailabilityService,
    StaffSchedulesService,
    PhotographyQuoteService,
    PhotographyHoldService,
    RentalFulfillmentService,
    RentalFulfillmentWorkflowService,
    RentalDepositRefundCoordinatorService,
    TimeSlotEngineService,
    InventorySlotLeaseService,
    ProductBusyCacheService,
    RentalOverdueDominoService,
  ],
})
export class BookingsModule {}
