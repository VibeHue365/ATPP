import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityLogModule } from '../auth/security-log.module';
import {
  PhotographyPackage,
  PhotographyPackageSchema,
} from '../products/schemas/photography-package.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { AdminCategoriesController } from './controllers/admin-categories.controller';
import { CategoriesController } from './controllers/categories.controller';
import { Category, CategorySchema } from './schemas/category.schema';
import { CategoriesService } from './services/categories.service';
import { CategoryUsageService } from './services/category-usage.service';
import { CategoryValidationService } from './services/category-validation.service';

export const categoryModels = MongooseModule.forFeature([
  { name: Category.name, schema: CategorySchema },
  { name: Product.name, schema: ProductSchema },
  { name: PhotographyPackage.name, schema: PhotographyPackageSchema },
]);

@Module({
  imports: [categoryModels, SecurityLogModule],
  controllers: [AdminCategoriesController, CategoriesController],
  providers: [
    CategoriesService,
    CategoryUsageService,
    CategoryValidationService,
  ],
  exports: [categoryModels, CategoriesService],
})
export class CategoriesModule {}
