import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  PriceVersion,
  PriceVersionSchema,
} from './schemas/price-version.schema';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from './schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
} from './schemas/inventory-reservation.schema';
import {
  PhotographyPackage,
  PhotographyPackageSchema,
} from './schemas/photography-package.schema';
import {
  ProviderSchedule,
  ProviderScheduleSchema,
} from './schemas/provider-schedule.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { PromotionsController } from './controllers/promotions.controller';
import { PromotionsService } from './services/promotions.service';

export const productModels = MongooseModule.forFeature([
  { name: Category.name, schema: CategorySchema },
  { name: Product.name, schema: ProductSchema },
  { name: PriceVersion.name, schema: PriceVersionSchema },
  { name: Promotion.name, schema: PromotionSchema },
  { name: InventoryItem.name, schema: InventoryItemSchema },
  { name: InventoryReservation.name, schema: InventoryReservationSchema },
  { name: PhotographyPackage.name, schema: PhotographyPackageSchema },
  { name: ProviderSchedule.name, schema: ProviderScheduleSchema },
  { name: Provider.name, schema: ProviderSchema },
]);

@Module({
  imports: [productModels],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [productModels, PromotionsService],
})
export class ProductsModule {}
