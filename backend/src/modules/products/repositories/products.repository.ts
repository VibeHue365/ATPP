import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from '../schemas/product.schema';

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async findAllActive(options?: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    colors?: string[];
    sizes?: string[];
    materials?: string[];
  }): Promise<ProductDocument[]> {
    const query: any = { status: ProductStatus.Active };

    if (options?.search) {
      const searchRegex = new RegExp(options.search, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
    }

    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      query.basePrice = {};
      if (options.minPrice !== undefined) {
        query.basePrice.$gte = options.minPrice;
      }
      if (options.maxPrice !== undefined) {
        query.basePrice.$lte = options.maxPrice;
      }
    }

    if (options?.minRating !== undefined) {
      query['rating.averageRating'] = { $gte: options.minRating };
    }

    if (options?.colors && options.colors.length > 0) {
      query.colors = { $in: options.colors.map(c => new RegExp(`^${c}$`, 'i')) };
    }

    if (options?.sizes && options.sizes.length > 0) {
      query.sizes = { $in: options.sizes.map(s => new RegExp(`^${s}$`, 'i')) };
    }

    if (options?.materials && options.materials.length > 0) {
      query.materials = { $in: options.materials.map(m => new RegExp(`^${m}$`, 'i')) };
    }

    return this.productModel
      .find(query)
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
