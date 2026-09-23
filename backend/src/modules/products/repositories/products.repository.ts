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
import { QueryModerationProductsDto } from '../dto/product-moderation.dto';
import { PhotographyPackage } from '../schemas/photography-package.schema';

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
    @InjectModel(PhotographyPackage.name) private readonly packageModel: Model<PhotographyPackage>,
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
      .select('name description images basePrice depositAmount status moderationStatus moderationReason updatedAt categoryId providerId taggingRevision')
      .sort({ updatedAt: 1 })
      .populate('categoryId', 'name')
      .populate('providerId', 'businessName userId')
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

  async findEnhancedModerationList(query: QueryModerationProductsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 8));
    const skip = (page - 1) * limit;

    // Self-healing legacy packages without moderationStatus
    await this.packageModel.updateMany(
      { moderationStatus: { $exists: false } },
      { $set: { moderationStatus: ProductModerationStatus.PendingReview } },
    );

    const [
      pendingAodai,
      approvedAodai,
      rejectedAodai,
      changesRequestedAodai,
      totalAodai,
      pendingPhotography,
      approvedPhotography,
      rejectedPhotography,
      changesRequestedPhotography,
      totalPhotography,
    ] = await Promise.all([
      this.productModel.countDocuments({ moderationStatus: ProductModerationStatus.PendingReview }).exec(),
      this.productModel.countDocuments({ moderationStatus: ProductModerationStatus.Approved }).exec(),
      this.productModel.countDocuments({ moderationStatus: ProductModerationStatus.Rejected }).exec(),
      this.productModel.countDocuments({ moderationStatus: ProductModerationStatus.ChangesRequested }).exec(),
      this.productModel.countDocuments().exec(),

      this.packageModel.countDocuments({ moderationStatus: ProductModerationStatus.PendingReview }).exec(),
      this.packageModel.countDocuments({ moderationStatus: ProductModerationStatus.Approved }).exec(),
      this.packageModel.countDocuments({ moderationStatus: ProductModerationStatus.Rejected }).exec(),
      this.packageModel.countDocuments({ moderationStatus: ProductModerationStatus.ChangesRequested }).exec(),
      this.packageModel.countDocuments().exec(),
    ]);

    const totalPending = pendingAodai + pendingPhotography;
    const totalApproved = approvedAodai + approvedPhotography;
    const totalRejected = rejectedAodai + rejectedPhotography;
    const totalChangesRequested = changesRequestedAodai + changesRequestedPhotography;
    const grandTotal = totalAodai + totalPhotography;

    const filter: Record<string, any> = {};

    if (query.status && query.status !== 'ALL' && query.status !== 'Tất cả') {
      filter.moderationStatus = query.status;
    }

    if (query.categoryId && query.categoryId !== 'ALL' && query.categoryId !== 'Tất cả') {
      if (Types.ObjectId.isValid(query.categoryId)) {
        filter.categoryId = new Types.ObjectId(query.categoryId);
      }
    }

    if (query.providerId && query.providerId !== 'ALL' && query.providerId !== 'Tất cả') {
      if (Types.ObjectId.isValid(query.providerId)) {
        filter.providerId = new Types.ObjectId(query.providerId);
      }
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { slug: searchRegex },
      ];
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const includeAodai = query.itemType !== 'PHOTOGRAPHY';
    const includePhoto = query.itemType !== 'AODAI';

    const [aodaiItems, photoItems, aodaiCount, photoCount] = await Promise.all([
      includeAodai
        ? this.productModel
            .find(filter)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('categoryId', 'name slug')
            .populate('providerId', 'businessName contact userId address media')
            .lean()
            .exec()
        : Promise.resolve([]),
      includePhoto
        ? this.packageModel
            .find(filter)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('categoryId', 'name slug')
            .populate('providerId', 'businessName contact userId address media')
            .lean()
            .exec()
        : Promise.resolve([]),
      includeAodai ? this.productModel.countDocuments(filter).exec() : Promise.resolve(0),
      includePhoto ? this.packageModel.countDocuments(filter).exec() : Promise.resolve(0),
    ]);

    const totalCount = aodaiCount + photoCount;

    const formattedAodai = aodaiItems.map((p: any) => {
      const idStr = p._id.toString();
      const code = `SP${idStr.slice(-7).toUpperCase()}`;
      const providerIdStr = p.providerId?._id?.toString() || '';
      const partnerCode = providerIdStr ? `#DT${providerIdStr.slice(-5).toUpperCase()}` : '—';
      return {
        ...p,
        id: idStr,
        itemType: 'AODAI',
        itemTypeLabel: 'Áo dài',
        code,
        partnerCode,
        price: p.basePrice,
        depositAmount: p.depositAmount || 0,
        quantity: p.sizes?.length ? p.sizes.length : 1,
      };
    });

    const formattedPhoto = photoItems.map((pkg: any) => {
      const idStr = pkg._id.toString();
      const code = `SP${idStr.slice(-7).toUpperCase()}`;
      const providerIdStr = pkg.providerId?._id?.toString() || '';
      const partnerCode = providerIdStr ? `#DT${providerIdStr.slice(-5).toUpperCase()}` : '—';
      return {
        ...pkg,
        id: idStr,
        itemType: 'PHOTOGRAPHY',
        itemTypeLabel: 'Chụp ảnh',
        code,
        partnerCode,
        price: pkg.price,
        basePrice: pkg.price,
        depositAmount: Math.round((pkg.price || 0) * 0.3),
        durationHours: pkg.durationHours || 2,
        editedPhotosCount: pkg.editedPhotosCount || 50,
        rawPhotosCount: pkg.rawPhotosCount || 200,
        deliveryDays: pkg.deliveryDays || 3,
        maxPeople: pkg.maxPeople || 2,
        location: pkg.location || 'Đại Nội Huế',
      };
    });

    const combinedItems = [...formattedAodai, ...formattedPhoto].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const paginatedItems = combinedItems.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      metrics: {
        total: grandTotal,
        totalPending,
        totalApproved,
        totalRejected,
        totalChangesRequested,
        pendingAodai,
        pendingPhotography,
        trends: {
          totalPending: `${totalPending} chờ duyệt`,
          totalApproved: `${totalApproved} đã duyệt`,
          totalRejected: `${totalRejected} đã từ chối`,
          totalChangesRequested: `${totalChangesRequested} cần bổ sung`,
          pendingAodai: `${pendingAodai} áo dài`,
          pendingPhotography: `${pendingPhotography} gói chụp`,
        },
      },
    };
  }

  async moderate(
    id: Types.ObjectId,
    data: any,
  ): Promise<any | null> {
    const prod = await this.productModel
      .findByIdAndUpdate(id, data, { new: true })
      .populate('categoryId')
      .populate('providerId')
      .exec();
    if (prod) return prod;

    const pkg = await this.packageModel
      .findByIdAndUpdate(id, data, { new: true })
      .populate('categoryId')
      .populate('providerId')
      .exec();
    return pkg;
  }

  async delete(id: Types.ObjectId): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndDelete(id).exec();
  }
}
