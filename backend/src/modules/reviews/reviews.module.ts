import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Review,
  ReviewSchema,
  CustomerReview,
  CustomerReviewSchema,
} from './schemas/review.schema';
import { ReviewsController } from './controllers/reviews.controller';
import { ReviewsService } from './services/reviews.service';
import { BookingsModule } from '../bookings/bookings.module';
import { ProductsModule } from '../products/products.module';
import { ProvidersModule } from '../providers/providers.module';
import { NotificationsModule } from '../notifications/notifications.module';

export const reviewModels = MongooseModule.forFeature([
  { name: Review.name, schema: ReviewSchema },
  { name: CustomerReview.name, schema: CustomerReviewSchema },
]);

@Module({
  imports: [
    reviewModels,
    BookingsModule,
    ProductsModule,
    ProvidersModule,
    NotificationsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [reviewModels, ReviewsService],
})
export class ReviewsModule {}
