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
  DigitalContract,
  DigitalContractSchema,
} from './schemas/digital-contract.schema';
import {
  RentalHandover,
  RentalHandoverSchema,
} from './schemas/rental-handover.schema';
import { BookingsController } from './controllers/bookings.controller';
import { PhotographyHoldsController } from './controllers/photography-holds.controller';
import { BookingsService } from './services/bookings.service';
import { BookingsSchedulerService } from './services/bookings-scheduler.service';
import { PhotographyHoldService } from './services/photography-hold.service';
import { PhotographyQuoteService } from '../photographers/services/photography-quote.service';
import { ProductsModule } from '../products/products.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProvidersModule } from '../providers/providers.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { SystemPoliciesModule } from '../system-policies/system-policies.module';
import { StorageModule } from '../storage/storage.module';

export const bookingModels = MongooseModule.forFeature([
  { name: Cart.name, schema: CartSchema },
  { name: Booking.name, schema: BookingSchema },
  { name: BookingItem.name, schema: BookingItemSchema },
  { name: BookingSchedule.name, schema: BookingScheduleSchema },
  { name: ProviderScheduleLock.name, schema: ProviderScheduleLockSchema },
  { name: DigitalContract.name, schema: DigitalContractSchema },
  { name: RentalHandover.name, schema: RentalHandoverSchema },
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
  ],
  controllers: [BookingsController, PhotographyHoldsController],
  providers: [
    BookingsService,
    BookingsSchedulerService,
    PhotographyQuoteService,
    PhotographyHoldService,
  ],
  exports: [
    bookingModels,
    BookingsService,
    PhotographyQuoteService,
    PhotographyHoldService,
  ],
})
export class BookingsModule {}
