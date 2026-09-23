import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { BookingItem, BookingItemSchema } from '../bookings/schemas/booking-item.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-token.schema';
import { AnalyticsModule } from '../analytics/analytics.module';
import {
  ProviderVerification,
  ProviderVerificationSchema,
} from '../providers/schemas/provider-verification.schema';
import { Dispute, DisputeSchema } from '../disputes/schemas/dispute.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: BookingItem.name, schema: BookingItemSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: ProviderVerification.name, schema: ProviderVerificationSchema },
      { name: Dispute.name, schema: DisputeSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    AnalyticsModule,
  ],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
