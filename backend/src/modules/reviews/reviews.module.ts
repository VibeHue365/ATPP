import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './schemas/review.schema';

export const reviewModels = MongooseModule.forFeature([
  { name: Review.name, schema: ReviewSchema },
]);

@Module({
  imports: [reviewModels],
  exports: [reviewModels],
})
export class ReviewsModule {}
