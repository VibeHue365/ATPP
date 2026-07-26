import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { Product } from '../../products/schemas/product.schema';

@Injectable()
export class CategoryUsageService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photographyPackageModel: Model<PhotographyPackage>,
  ) {}

  async assertCategoryNotInUse(categoryId: Types.ObjectId): Promise<void> {
    if (await this.isUsedByProducts(categoryId)) {
      throw new BadRequestException('CATEGORY_IN_USE_BY_PRODUCTS');
    }

    if (await this.isUsedByPhotographyPackages(categoryId)) {
      throw new BadRequestException('CATEGORY_IN_USE_BY_PACKAGES');
    }
  }

  async isUsedByProducts(categoryId: Types.ObjectId): Promise<boolean> {
    const product = await this.productModel.exists({ categoryId });
    return Boolean(product);
  }

  async isUsedByPhotographyPackages(
    categoryId: Types.ObjectId,
  ): Promise<boolean> {
    const photographyPackage = await this.photographyPackageModel.exists({
      categoryId,
    } as Record<string, unknown>);
    return Boolean(photographyPackage);
  }
}
