import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from '../providers/schemas/provider-verification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: ProviderVerification.name, schema: ProviderVerificationSchema },
    ]),
  ],
  controllers: [AdminController],
})
export class AdminModule {}
