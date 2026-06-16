import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from './schemas/product.schema';
import { PriceVersion, PriceVersionSchema } from './schemas/price-version.schema';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import { InventoryItem, InventoryItemSchema } from './schemas/inventory-item.schema';
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
import { ProductsRepository } from './repositories/products.repository';
import { ProductsService } from './services/products.service';
import { ProductsController } from './controllers/products.controller';

export const productModels = MongooseModule.forFeature([
  { name: Category.name, schema: CategorySchema },
  { name: Product.name, schema: ProductSchema },
  { name: PriceVersion.name, schema: PriceVersionSchema },
  { name: Promotion.name, schema: PromotionSchema },
  { name: InventoryItem.name, schema: InventoryItemSchema },
  { name: InventoryReservation.name, schema: InventoryReservationSchema },
  { name: PhotographyPackage.name, schema: PhotographyPackageSchema },
  { name: ProviderSchedule.name, schema: ProviderScheduleSchema },
]);

@Module({
  imports: [productModels],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [productModels, ProductsService],
})
export class ProductsModule {}
