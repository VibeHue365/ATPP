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

  async findByProvider(
    providerId: Types.ObjectId,
    search?: string,
    sortBy?: string,
    page: number = 1,
    limit: number = 10,
    sizes?: string,
    colors?: string,
  ): Promise<{ items: ProductDocument[]; total: number }> {
    const filter: any = { providerId, status: { $ne: ProductStatus.Inactive } };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (sizes) {
      const sizesArray = sizes.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (sizesArray.length > 0) {
        filter.sizes = { $in: sizesArray };
      }
    }
    if (colors) {
      const colorsArray = colors.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (colorsArray.length > 0) {
        filter.colors = { $in: colorsArray };
      }
    }

    const total = await this.productModel.countDocuments(filter);

    let query = this.productModel
      .find(filter)
      .populate('categoryId')
      .skip((page - 1) * limit)
      .limit(limit);

    if (sortBy === 'price_asc') {
      query = query.sort({ basePrice: 1 });
    } else if (sortBy === 'price_desc') {
      query = query.sort({ basePrice: -1 });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const items = await query.exec();
    return { items, total };
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
