import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './schemas/cart.schema';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { BookingItem, BookingItemSchema } from './schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleSchema,
} from './schemas/booking-schedule.schema';
import {
  DigitalContract,
  DigitalContractSchema,
} from './schemas/digital-contract.schema';
import {
  RentalHandover,
  RentalHandoverSchema,
} from './schemas/rental-handover.schema';

export const bookingModels = MongooseModule.forFeature([
  { name: Cart.name, schema: CartSchema },
  { name: Booking.name, schema: BookingSchema },
  { name: BookingItem.name, schema: BookingItemSchema },
  { name: BookingSchedule.name, schema: BookingScheduleSchema },
  { name: DigitalContract.name, schema: DigitalContractSchema },
  { name: RentalHandover.name, schema: RentalHandoverSchema },
]);

@Module({
  imports: [bookingModels],
  exports: [bookingModels],
})
export class BookingsModule {}
