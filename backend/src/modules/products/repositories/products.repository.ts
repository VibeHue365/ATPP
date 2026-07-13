import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductModerationStatus,
  ProductStatus,
} from '../schemas/product.schema';

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
    categoryId?: string;
  }): Promise<ProductDocument[]> {
    const query: any = {
      status: ProductStatus.Active,
      moderationStatus: ProductModerationStatus.Approved,
    };

    if (options?.categoryId && Types.ObjectId.isValid(options.categoryId)) {
      query.categoryId = new Types.ObjectId(options.categoryId);
    }

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

    const products = await this.productModel
      .find(query)
      .populate('categoryId')
      .populate('providerId')
      .exec();

    return products.filter(p => {
      const provider = p.providerId as any;
      return provider && provider.status === 'ACTIVE';
    });
  }

  async create(data: Partial<Product>): Promise<ProductDocument> {
    return this.productModel.create(data);
  }

  async findById(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findById(id).populate('categoryId').populate('providerId').exec();
  }

  async findPublicById(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel
      .findOne({
        _id: id,
        status: ProductStatus.Active,
        moderationStatus: ProductModerationStatus.Approved,
      })
      .populate('categoryId')
      .populate('providerId')
      .exec();
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

  async findModerationQueue(
    status: ProductModerationStatus,
  ): Promise<ProductDocument[]> {
    return this.productModel
      .find({ moderationStatus: status })
      .sort({ updatedAt: 1 })
      .populate('categoryId')
      .populate('providerId')
      .exec();
  }

  async moveLegacyProductsToPendingReview(): Promise<void> {
    await this.productModel.updateMany(
      { moderationStatus: { $exists: false } },
      {
        $set: {
          moderationStatus: ProductModerationStatus.PendingReview,
          moderationReason: null,
          moderatedAt: null,
          moderatedBy: null,
        },
      },
    );
  }

  async moderate(
    id: Types.ObjectId,
    expectedStatus: ProductModerationStatus,
    data: Partial<Product>,
  ): Promise<ProductDocument | null> {
    return this.productModel
      .findOneAndUpdate(
        { _id: id, moderationStatus: expectedStatus },
        { $set: data },
        { new: true },
      )
      .populate('categoryId')
      .populate('providerId')
      .exec();
  }

  async delete(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndDelete(id).exec();
  }
}
