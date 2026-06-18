import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from '../schemas/product.schema';
import { PhotographyPackage, PhotographyPackageDocument, PackageStatus } from '../schemas/photography-package.schema';

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name) private readonly photographyPackageModel: Model<PhotographyPackage>,
  ) {}

  async findAllActivePhotographyPackages(): Promise<PhotographyPackageDocument[]> {
    return this.photographyPackageModel
      .find({ status: PackageStatus.Active })
      .populate('providerId')
      .exec() as unknown as Promise<PhotographyPackageDocument[]>;
  }

  async findAllActive(): Promise<ProductDocument[]> {
    return this.productModel
      .find({ status: ProductStatus.Active })
      .populate('categoryId')
      .exec();
  }

  async findById(id: string): Promise<ProductDocument | null> {
    return this.productModel
      .findById(id)
      .populate('categoryId')
      .populate('providerId')
      .exec();
  }
}
