import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminAuditAction } from '../../auth/schemas/admin-audit-log.schema';
import {
  SecurityLogService,
  SecurityRequestContext,
} from '../../auth/services/security-log.service';
import {
  CreateCategoryDto,
  QueryCategoriesDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
} from '../dto/category.dto';
import {
  Category,
  CategoryDocument,
  CategoryStatus,
  ServiceCategoryType,
} from '../schemas/category.schema';
import { CategoryUsageService } from './category-usage.service';
import { CategoryValidationService } from './category-validation.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
    private readonly validationService: CategoryValidationService,
    private readonly usageService: CategoryUsageService,
    private readonly securityLogService: SecurityLogService,
  ) {}

  private publicCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  clearPublicCache(): void {
    this.publicCache.clear();
  }

  async findPublic(query: QueryCategoriesDto): Promise<Record<string, unknown>> {
    const cacheKey = `public:${JSON.stringify(query)}`;
    const now = Date.now();
    const cached = this.publicCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const filter = this.buildFilter({
      ...query,
      status: CategoryStatus.Active,
      includeDeleted: false,
    });
    const categories = await this.categoryModel
      .find(filter)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    const items = categories.map((category) => this.toResponse(category));

    const result = {
      data: query.includeTree ? this.toTree(items) : items,
    };
    this.publicCache.set(cacheKey, { data: result, expiresAt: now + this.CACHE_TTL_MS });
    return result;
  }

  async findPublicByIdentifier(
    identifier: string,
  ): Promise<Record<string, unknown>> {
    const cacheKey = `identifier:${identifier}`;
    const now = Date.now();
    const cached = this.publicCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const normalizedIdentifier = this.normalizeSlug(identifier);
    const filter = Types.ObjectId.isValid(identifier)
      ? { _id: new Types.ObjectId(identifier) }
      : { slug: normalizedIdentifier };
    const category = await this.categoryModel
      .findOne({
        ...filter,
        status: CategoryStatus.Active,
        deletedAt: { $exists: false },
      })
      .lean();

    if (!category) {
      throw new NotFoundException('CATEGORY_NOT_FOUND');
    }

    const result = this.toResponse(category);
    this.publicCache.set(cacheKey, { data: result, expiresAt: now + this.CACHE_TTL_MS });
    return result;
  }

  async findAdmin(query: QueryCategoriesDto): Promise<Record<string, unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);
    const [items, total] = await Promise.all([
      this.categoryModel
        .find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.categoryModel.countDocuments(filter),
    ]);

    const data = items.map((category) => this.toResponse(category));

    return {
      data: query.includeTree ? this.toTree(data) : data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAdminById(id: string): Promise<Record<string, unknown>> {
    const category = await this.loadCategory(id, true);
    return this.toResponse(category);
  }

  async create(
    actorId: string,
    dto: CreateCategoryDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const name = this.normalizeName(dto.name);
    const slug = this.normalizeSlug(dto.slug ?? name);
    await this.validationService.assertSlugUniqueGlobally(slug);
    const parentId = await this.validationService.resolveParent(
      dto.parentId,
      dto.type,
    );

    let category: CategoryDocument;
    try {
      category = await this.categoryModel.create({
        name,
        slug,
        type: dto.type,
        parentId: parentId ?? null,
        description: this.nullableTrim(dto.description),
        iconUrl: this.nullableTrim(dto.iconUrl),
        coverImageUrl: this.nullableTrim(dto.coverImageUrl),
        displayOrder: dto.displayOrder ?? 0,
        metadata: dto.metadata ?? {},
        status: CategoryStatus.Active,
        createdBy: actorObjectId,
        updatedBy: actorObjectId,
      });
    } catch (error) {
      this.rethrowDuplicateSlug(error);
    }

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.CategoryCreated,
      targetCategoryId: category._id,
      after: this.toAuditState(category),
      reason: 'Create category',
      context,
    });

    this.clearPublicCache();
    return this.toResponse(category);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateCategoryDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const category = await this.loadCategory(id);
    const before = this.toAuditState(category);

    if (dto.name !== undefined) {
      category.name = this.normalizeName(dto.name);
    }

    if (dto.slug !== undefined || dto.name !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug ?? category.name);
      await this.validationService.assertSlugUniqueGlobally(
        nextSlug,
        category._id,
      );
      category.slug = nextSlug;
    }

    if (dto.parentId !== undefined) {
      category.parentId =
        (await this.validationService.resolveParent(
          dto.parentId,
          category.type,
          category._id,
        )) ?? null;
    }

    if (dto.description !== undefined) {
      category.description = this.nullableTrim(dto.description);
    }
    if (dto.iconUrl !== undefined) {
      category.iconUrl = this.nullableTrim(dto.iconUrl);
    }
    if (dto.coverImageUrl !== undefined) {
      category.coverImageUrl = this.nullableTrim(dto.coverImageUrl);
    }
    if (dto.displayOrder !== undefined) {
      category.displayOrder = dto.displayOrder;
    }
    if (dto.metadata !== undefined) {
      category.metadata = dto.metadata;
    }

    category.updatedBy = actorObjectId;
    try {
      await category.save();
    } catch (error) {
      this.rethrowDuplicateSlug(error);
    }

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.CategoryUpdated,
      targetCategoryId: category._id,
      before,
      after: this.toAuditState(category),
      reason: 'Update category',
      context,
    });

    this.clearPublicCache();
    return this.toResponse(category);
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateCategoryStatusDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const category = await this.loadCategory(id);
    const before = this.toAuditState(category);

    if (
      category.status === CategoryStatus.Active &&
      dto.status === CategoryStatus.Inactive &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException('CATEGORY_STATUS_REASON_REQUIRED');
    }

    if (dto.status === CategoryStatus.Inactive) {
      await this.validationService.assertNoActiveChildren(category._id);
    } else if (category.status !== CategoryStatus.Active) {
      await this.validationService.assertParentActiveForActivation(
        category.parentId,
      );
    }

    category.status = dto.status;
    category.updatedBy = actorObjectId;
    await category.save();

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.CategoryStatusUpdated,
      targetCategoryId: category._id,
      before,
      after: this.toAuditState(category),
      reason: dto.reason ?? null,
      context,
    });

    this.clearPublicCache();
    return this.toResponse(category);
  }

  async reorder(
    actorId: string,
    dto: ReorderCategoriesDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const ids = dto.items.map((item) => this.toObjectId(item.id));
    const uniqueIds = new Set(ids.map((id) => id.toString()));

    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException('INVALID_CATEGORY_ORDER');
    }

    const categories = await this.categoryModel.find({
      _id: { $in: ids },
      deletedAt: { $exists: false },
    });

    if (categories.length !== ids.length) {
      throw new NotFoundException('CATEGORY_NOT_FOUND');
    }

    if (dto.type && categories.some((category) => category.type !== dto.type)) {
      throw new BadRequestException('CATEGORY_REORDER_TYPE_MISMATCH');
    }

    const before = categories.map((category) => this.toAuditState(category));
    const orderById = new Map(
      dto.items.map((item) => [item.id, item.displayOrder]),
    );

    await Promise.all(
      categories.map((category) =>
        this.categoryModel.updateOne(
          { _id: category._id },
          {
            $set: {
              displayOrder: orderById.get(category._id.toString()) ?? 0,
              updatedBy: actorObjectId,
            },
          },
        ),
      ),
    );

    const updated = await this.categoryModel
      .find({ _id: { $in: ids } })
      .sort({ displayOrder: 1, createdAt: -1 });

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.CategoryReordered,
      before: { items: before },
      after: { items: updated.map((category) => this.toAuditState(category)) },
      reason: dto.reason ?? null,
      context,
    });

    this.clearPublicCache();
    return {
      data: updated.map((category) => this.toResponse(category)),
    };
  }

  async softDelete(
    actorId: string,
    id: string,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId, 'INVALID_ACTOR_ID');
    const category = await this.loadCategory(id);
    const before = this.toAuditState(category);

    await this.validationService.assertNoActiveChildren(category._id);
    await this.usageService.assertCategoryNotInUse(category._id);

    category.deletedAt = new Date();
    category.status = CategoryStatus.Inactive;
    category.updatedBy = actorObjectId;
    await category.save();

    await this.recordAudit({
      actorId: actorObjectId,
      action: AdminAuditAction.CategoryDeleted,
      targetCategoryId: category._id,
      before,
      after: this.toAuditState(category),
      reason: 'Soft delete category',
      context,
    });

    this.clearPublicCache();
    return { success: true };
  }

  async listActiveCategoriesForProducts(): Promise<Record<string, unknown>[]> {
    const cacheKey = 'active_product_categories';
    const now = Date.now();
    const cached = this.publicCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const categories = await this.categoryModel
      .find({
        type: ServiceCategoryType.AodaiCategory,
        status: CategoryStatus.Active,
        deletedAt: { $exists: false },
      })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    const result = categories.map((category) => this.toResponse(category));
    this.publicCache.set(cacheKey, { data: result, expiresAt: now + this.CACHE_TTL_MS });
    return result;
  }

  async assertActiveProductCategory(categoryId: string): Promise<void> {
    await this.assertActiveCategory(categoryId, ServiceCategoryType.AodaiCategory);
  }

  async assertActiveCategory(
    categoryId: string,
    type: ServiceCategoryType,
  ): Promise<void> {
    await this.assertActiveCategories([categoryId], type);
  }

  async assertActiveCategories(
    categoryIds: string[],
    type: ServiceCategoryType,
  ): Promise<void> {
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length === 0) return;

    const objectIds = uniqueIds.map((categoryId) => this.toObjectId(categoryId));
    const validCount = await this.categoryModel.countDocuments({
      _id: { $in: objectIds },
      type,
      status: CategoryStatus.Active,
      deletedAt: { $exists: false },
    });

    if (validCount !== uniqueIds.length) {
      throw new BadRequestException('CATEGORY_NOT_ACTIVE_OR_TYPE_MISMATCH');
    }
  }
  private buildFilter(query: QueryCategoriesDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (!query.includeDeleted) {
      filter.deletedAt = { $exists: false };
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.parentId) {
      filter.parentId = new Types.ObjectId(query.parentId);
    }
    if (query.keyword?.trim()) {
      const keyword = this.escapeRegex(query.keyword.trim());
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { slug: { $regex: keyword, $options: 'i' } },
      ];
    }

    return filter;
  }

  private async loadCategory(
    id: string,
    includeDeleted = false,
  ): Promise<CategoryDocument> {
    const objectId = this.toObjectId(id);
    const filter: Record<string, unknown> = { _id: objectId };

    if (!includeDeleted) {
      filter.deletedAt = { $exists: false };
    }

    const category = await this.categoryModel.findOne(filter);
    if (!category) {
      throw new NotFoundException('CATEGORY_NOT_FOUND');
    }

    return category;
  }

  private toObjectId(
    value: string,
    errorMessage = 'INVALID_CATEGORY_ID',
  ): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(errorMessage);
    }

    return new Types.ObjectId(value);
  }

  private normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new BadRequestException('CATEGORY_NAME_REQUIRED');
    }

    return normalized;
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException('CATEGORY_SLUG_REQUIRED');
    }

    return slug;
  }

  private nullableTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private rethrowDuplicateSlug(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new ConflictException('CATEGORY_SLUG_ALREADY_EXISTS');
    }

    throw error;
  }

  private toResponse(category: Category | Record<string, any>) {
    const value = category as Record<string, any>;
    const id = value._id?.toString?.() ?? value.id;
    const parentId = value.parentId?.toString?.() ?? value.parentId ?? null;

    return {
      id,
      name: value.name,
      slug: value.slug,
      type: value.type,
      parentId,
      description: value.description ?? null,
      iconUrl: value.iconUrl ?? null,
      coverImageUrl: value.coverImageUrl ?? null,
      status: value.status,
      displayOrder: value.displayOrder ?? 0,
      metadata: value.metadata ?? {},
      deletedAt: value.deletedAt ?? null,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private toTree(items: Record<string, any>[]): Record<string, any>[] {
    const byId = new Map<string, Record<string, any>>();
    const roots: Record<string, any>[] = [];

    items.forEach((item) => byId.set(item.id, { ...item, children: [] }));
    byId.forEach((item) => {
      if (item.parentId && byId.has(item.parentId)) {
        byId.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  }

  private toAuditState(category: Category | CategoryDocument) {
    return this.toResponse(category);
  }

  private async recordAudit(input: {
    actorId: Types.ObjectId;
    action: AdminAuditAction;
    targetCategoryId?: Types.ObjectId | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
    context?: SecurityRequestContext;
  }): Promise<void> {
    await this.securityLogService.recordAdminAudit(input);
  }
}
