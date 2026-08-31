import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductModerationStatus,
  ProductStatus,
} from '../schemas/product.schema';
import { Provider, ProviderStatus } from '../../providers/schemas/provider.schema';

@Injectable()
export class ProductsRepository {
  private activeProviderIdsCache: {
    value: Types.ObjectId[];
    expiresAt: number;
  } | null = null;
  private providerLocationIdsCache = new Map<
    string,
    { value: Types.ObjectId[]; expiresAt: number }
  >();
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  /**
   * Both public listing and public facets need the same active-provider set.
   * Cache it briefly because the database is remote and this lookup otherwise
   * becomes an extra round trip for every public products request.
   */
  private async getActiveProviderIds(): Promise<Types.ObjectId[]> {
    const now = Date.now();
    if (this.activeProviderIdsCache && this.activeProviderIdsCache.expiresAt > now) {
      return this.activeProviderIdsCache.value;
    }

    const value = await this.providerModel
      .find({ status: ProviderStatus.Active })
      .distinct('_id')
      .exec();

    this.activeProviderIdsCache = { value, expiresAt: now + 60_000 };
    return value;
  }

  private async getProviderIdsByLocation(
    location: string,
  ): Promise<Types.ObjectId[]> {
    const normalized = location.trim().toLowerCase();
    const cached = this.providerLocationIdsCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const escaped = normalized.replace(/[.*+?^{}()|[]\]/g, '\$&');
    const regex = new RegExp(escaped, 'i');
    const providers = await this.providerModel
      .find({
        status: ProviderStatus.Active,
        $or: [
          { businessName: regex },
          { 'address.city': regex },
          { 'address.district': regex },
        ],
      })
      .select({ _id: 1 })
      .lean()
      .exec();
    const value = providers.map((provider) => provider._id);
    this.providerLocationIdsCache.set(normalized, {
      value,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return value;
  }

  async findActivePage(
    options: {
      search?: string; minPrice?: number; maxPrice?: number; minRating?: number;
      colors?: string[]; sizes?: string[]; materials?: string[]; categoryId?: string;
      styleCategoryIds?: string[]; eventCategoryIds?: string[]; providerId?: string;
      providerLocation?: string; productTypes?: string[];
    },
    page: number,
    limit: number,
    sort: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc' = 'newest',
  ): Promise<{ items: any[]; total: number }> {
    const activeProviderIds = await this.getActiveProviderIds();
    const query: any = {
      status: ProductStatus.Active,
      moderationStatus: ProductModerationStatus.Approved,
      providerId: { $in: activeProviderIds },
    };
    if (options.providerId && Types.ObjectId.isValid(options.providerId)) query.providerId = new Types.ObjectId(options.providerId);
    if (options.categoryId && Types.ObjectId.isValid(options.categoryId)) query.categoryId = new Types.ObjectId(options.categoryId);
    if (options.providerLocation?.trim()) {
      const providerIds = await this.getProviderIdsByLocation(options.providerLocation);
      query.providerId = { $in: providerIds };
    }
    for (const [field, ids] of [['styleCategoryIds', options.styleCategoryIds], ['eventCategoryIds', options.eventCategoryIds]] as const) {
      const validIds = (ids ?? []).filter((id) => Types.ObjectId.isValid(id));
      if (validIds.length) query[field] = { $in: validIds.map((id) => new Types.ObjectId(id)) };
    }
    const typePatterns: Record<string, string> = {
      female: '(nu|nữ)',
      male: 'nam',
      couple: '(doi|đôi|cap|cặp)',
      yearbook: '(ky yeu|kỷ yếu|hoc sinh|học sinh|sinh vien|sinh viên)',
      wedding: '(cuoi|cưới|hy|hỷ|dau|dâu|re|rể)',
    };
    const selectedTypePatterns = (options.productTypes ?? [])
      .map((type) => typePatterns[type])
      .filter(Boolean);
    if (selectedTypePatterns.length) {
      query.name = { $regex: selectedTypePatterns.join('|'), $options: 'i' };
    }
    if (options.search) {
      const escaped = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      query.basePrice = {};
      if (options.minPrice !== undefined) query.basePrice.$gte = options.minPrice;
      if (options.maxPrice !== undefined) query.basePrice.$lte = options.maxPrice;
    }
    if (options.minRating !== undefined) query['rating.averageRating'] = { $gte: options.minRating };
    if (options.colors?.length) query.colors = { $in: options.colors.map((value) => new RegExp(`^${value}$`, 'i')) };
    if (options.sizes?.length) query.sizes = { $in: options.sizes.map((value) => new RegExp(`^${value}$`, 'i')) };
    if (options.materials?.length) query.materials = { $in: options.materials.map((value) => new RegExp(`^${value}$`, 'i')) };

    const safeLimit = Math.min(Math.max(limit, 1), 24);
    const safePage = Math.max(page, 1);
    const order = sort === 'price_asc' ? { basePrice: 1, _id: 1 }
      : sort === 'price_desc' ? { basePrice: -1, _id: -1 }
      : sort === 'rating_desc' ? { 'rating.averageRating': -1, createdAt: -1 }
      : { createdAt: -1 };
    const [items, total] = await Promise.all([
      this.productModel.find(query)
        .select('providerId categoryId styleCategoryIds eventCategoryIds name slug images basePrice depositAmount sizes colors materials style occasions taggingRevision rating status createdAt')
        .populate('categoryId', 'name slug')
        .populate('providerId', 'businessName status address.city address.district media rating')
        .sort(order as any).skip((safePage - 1) * safeLimit).limit(safeLimit).lean().exec(),
      this.productModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async getPublicFilterFacets(): Promise<{ colors: string[]; sizes: string[]; materials: string[]; categoryCounts: Array<{ categoryId: string; count: number }> }> {
    const activeProviderIds = await this.getActiveProviderIds();
    const match = { status: ProductStatus.Active, moderationStatus: ProductModerationStatus.Approved, providerId: { $in: activeProviderIds } };
    const [result] = await this.productModel.aggregate([
      { $match: match },
      { $facet: {
        colors: [{ $unwind: '$colors' }, { $group: { _id: { $toUpper: '$colors' } } }, { $sort: { _id: 1 } }],
        sizes: [{ $unwind: '$sizes' }, { $group: { _id: { $toUpper: '$sizes' } } }, { $sort: { _id: 1 } }],
        materials: [{ $unwind: '$materials' }, { $group: { _id: { $toUpper: '$materials' } } }, { $sort: { _id: 1 } }],
        categoryCounts: [{ $group: { _id: '$categoryId', count: { $sum: 1 } } }],
      } },
    ]).exec();
    return {
      colors: (result?.colors ?? []).map((item: { _id: string }) => item._id),
      sizes: (result?.sizes ?? []).map((item: { _id: string }) => item._id),
      materials: (result?.materials ?? []).map((item: { _id: string }) => item._id),
      categoryCounts: (result?.categoryCounts ?? []).map((item: { _id: Types.ObjectId; count: number }) => ({ categoryId: String(item._id), count: item.count })),
    };
  }

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
    providerLocation?: string;
    productTypes?: string[];
    limit?: number;
  }): Promise<any[]> {
    const activeProviderIds = await this.getActiveProviderIds();

    const query: any = {
      status: ProductStatus.Active,
      moderationStatus: ProductModerationStatus.Approved,
      providerId: { $in: activeProviderIds },
    };

    if (options?.providerId && Types.ObjectId.isValid(options.providerId)) {
      query.providerId = new Types.ObjectId(options.providerId);
    }
    if (options?.providerLocation?.trim()) {
      const providerIds = await this.getProviderIdsByLocation(options.providerLocation);
      query.providerId = { $in: providerIds };
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

    const typePatterns: Record<string, string> = {
      female: '(nu|nữ)',
      male: 'nam',
      couple: '(doi|đôi|cap|cặp)',
      yearbook: '(ky yeu|kỷ yếu|hoc sinh|học sinh|sinh vien|sinh viên)',
      wedding: '(cuoi|cưới|hy|hỷ|dau|dâu|re|rể)',
    };
    const selectedTypePatterns = (options?.productTypes ?? [])
      .map((type) => typePatterns[type])
      .filter(Boolean);
    if (selectedTypePatterns.length) {
      query.name = { $regex: selectedTypePatterns.join('|'), $options: 'i' };
    }
    if (options?.search) {
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
      .populate('categoryId', 'name slug')
      .populate('providerId', 'businessName status address.city address.district media rating')
      .sort({ createdAt: -1 });

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(Math.min(Math.max(options.limit, 1), 24));
    }

    return queryBuilder.lean().exec();
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
