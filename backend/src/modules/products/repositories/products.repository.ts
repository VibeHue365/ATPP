import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  async create(data: Partial<Product>): Promise<ProductDocument> {
    return this.productModel.create(data);
  }

  async findById(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findById(id).populate('categoryId').populate('providerId').exec();
  }

  async findByProvider(providerId: Types.ObjectId): Promise<ProductDocument[]> {
    return this.productModel
      .find({ providerId, status: { $ne: ProductStatus.Inactive } })
      .populate('categoryId')
      .exec();
  }

  async update(id: Types.ObjectId, data: Partial<Product>): Promise<ProductDocument | null> {
    return this.productModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .populate('categoryId')
      .exec();
  }

  async delete(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndDelete(id).exec();
  }
}
