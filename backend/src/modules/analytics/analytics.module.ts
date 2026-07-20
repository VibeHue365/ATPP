import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchLog, SearchLogSchema } from './schemas/search-log.schema';
import { ProductViewLog, ProductViewLogSchema } from './schemas/product-view-log.schema';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsController } from './controllers/analytics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchLog.name, schema: SearchLogSchema },
      { name: ProductViewLog.name, schema: ProductViewLogSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
