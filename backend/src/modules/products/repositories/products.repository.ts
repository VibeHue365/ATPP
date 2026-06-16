import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from '../schemas/product.schema';

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async findAllActive(): Promise<ProductDocument[]> {
    return this.productModel
      .find({ status: ProductStatus.Active })
      .populate('categoryId')
      .exec();
  }
}
