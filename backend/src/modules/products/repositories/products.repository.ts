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
    styleCategoryIds?: string[];
    eventCategoryIds?: string[];
    providerId?: string;
    limit?: number;
  }): Promise<ProductDocument[]> {
    const query: any = {
      status: ProductStatus.Active,
      moderationStatus: ProductModerationStatus.Approved,
    };

    if (options?.providerId && Types.ObjectId.isValid(options.providerId)) {
      query.providerId = new Types.ObjectId(options.providerId);
    }

    if (options?.categoryId && Types.ObjectId.isValid(options.categoryId)) {
      query.categoryId = new Types.ObjectId(options.categoryId);
    }

    const addCategoryArrayFilter = (
      field: 'styleCategoryIds' | 'eventCategoryIds',
      categoryIds?: string[],
    ) => {
      const validIds = (categoryIds ?? []).filter((id) =>
        Types.ObjectId.isValid(id),
      );
      if (validIds.length > 0) {
        query[field] = {
          $in: validIds.map((id) => new Types.ObjectId(id)),
        };
      }
    };

    addCategoryArrayFilter('styleCategoryIds', options?.styleCategoryIds);
    addCategoryArrayFilter('eventCategoryIds', options?.eventCategoryIds);

    if (options?.search) {
      // Treat the search text literally to prevent malformed user regexes.
      const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
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
      query.colors = {
        $in: options.colors.map((c) => new RegExp(`^${c}$`, 'i')),
      };
    }

    if (options?.sizes && options.sizes.length > 0) {
      query.sizes = {
        $in: options.sizes.map((s) => new RegExp(`^${s}$`, 'i')),
      };
    }

    if (options?.materials && options.materials.length > 0) {
      query.materials = {
        $in: options.materials.map((m) => new RegExp(`^${m}$`, 'i')),
      };
    }

    let queryBuilder = this.productModel
      .find(query)
      .populate('categoryId')
      .populate('providerId');

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(Math.min(Math.max(options.limit, 1), 24));
    }

    const products = await queryBuilder.exec();

    return products.filter((p) => {
      const provider = p.providerId as any;
      return provider && provider.status === 'ACTIVE';
    });
  }

  async create(data: Partial<Product>): Promise<ProductDocument> {
    return this.productModel.create(data);
  }

  async findById(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel
      .findById(id)
      .populate('categoryId')
      .populate('providerId')
      .exec();
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

  async update(
    id: Types.ObjectId,
    data: Partial<Product>,
    options?: { incrementTaggingRevision?: boolean },
  ): Promise<ProductDocument | null> {
    const update: Record<string, unknown> = { $set: data };
    if (options?.incrementTaggingRevision) {
      update.$inc = { taggingRevision: 1 };
    }

    return this.productModel
      .findByIdAndUpdate(id, update, { new: true })
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
    // Tự động chuyển tất cả sản phẩm đang ở bản nháp DỰ THẢO (DRAFT) sang ĐANG BÁN (ACTIVE)
    await this.productModel.updateMany(
      { status: ProductStatus.Draft },
      { $set: { status: ProductStatus.Active } },
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
