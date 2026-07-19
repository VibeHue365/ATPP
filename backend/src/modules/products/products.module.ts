import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
import { CategoriesModule } from '../categories/categories.module';
import { PromotionsController } from './controllers/promotions.controller';
import { PromotionsService } from './services/promotions.service';
import { ProductsController } from './controllers/products.controller';
import { AdminProductsModerationController } from './controllers/admin-products-moderation.controller';
import { ProductsService } from './services/products.service';
import { ProductsRepository } from './repositories/products.repository';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryService } from './services/inventory.service';
import { ProductAvailabilityService } from './services/product-availability.service';
import { DiscountCampaign, DiscountCampaignSchema } from './schemas/discount-campaign.schema';
import { DiscountCampaignService } from './services/discount-campaign.service';
import { DiscountCampaignController } from './controllers/discount-campaign.controller';
import { UsersModule } from '../users/users.module';
import { SmartTaggingModule } from '../smart-tagging/smart-tagging.module';
import { StorageModule } from '../storage/storage.module';

export const productModels = MongooseModule.forFeature([
  { name: Product.name, schema: ProductSchema },
  { name: PriceVersion.name, schema: PriceVersionSchema },
  { name: Promotion.name, schema: PromotionSchema },
  { name: InventoryItem.name, schema: InventoryItemSchema },
  { name: InventoryReservation.name, schema: InventoryReservationSchema },
  { name: PhotographyPackage.name, schema: PhotographyPackageSchema },
  { name: ProviderSchedule.name, schema: ProviderScheduleSchema },
  { name: Provider.name, schema: ProviderSchema },
  { name: DiscountCampaign.name, schema: DiscountCampaignSchema },
]);

@Module({
  imports: [productModels, UsersModule, CategoriesModule, SmartTaggingModule, StorageModule],
  controllers: [
    PromotionsController,
    ProductsController,
    AdminProductsModerationController,
    InventoryController,
    DiscountCampaignController,
  ],
  providers: [
    PromotionsService,
    ProductsService,
    ProductsRepository,
    InventoryService,
    ProductAvailabilityService,
    DiscountCampaignService,
  ],
  exports: [
    productModels,
    PromotionsService,
    ProductsService,
    InventoryService,
    DiscountCampaignService,
  ],
})
export class ProductsModule {}
