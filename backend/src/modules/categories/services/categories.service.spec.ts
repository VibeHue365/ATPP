import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminAuditAction } from '../../auth/schemas/admin-audit-log.schema';
import {
  CategoryStatus,
  ServiceCategoryType,
} from '../schemas/category.schema';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const categoryId = new Types.ObjectId();
  const actorId = new Types.ObjectId().toString();

  function createService(overrides: Record<string, unknown> = {}) {
    const categoryModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      exists: jest.fn(),
      ...overrides,
    };
    const validationService = {
      assertSlugUniqueGlobally: jest.fn(),
      resolveParent: jest.fn().mockResolvedValue(undefined),
      assertNoActiveChildren: jest.fn(),
      assertParentActiveForActivation: jest.fn(),
    };
    const usageService = {
      assertCategoryNotInUse: jest.fn(),
    };
    const securityLogService = {
      recordAdminAudit: jest.fn(),
    };

    const service = new CategoriesService(
      categoryModel as any,
      validationService as any,
      usageService as any,
      securityLogService as any,
    );

    return {
      service,
      categoryModel,
      validationService,
      usageService,
      securityLogService,
    };
  }

  it('forces public list to active non-deleted categories', async () => {
    const findChain = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const { service, categoryModel } = createService({
      find: jest.fn().mockReturnValue(findChain),
    });

    await service.findPublic({});

    expect(categoryModel.find).toHaveBeenCalledWith({
      deletedAt: { $exists: false },
      status: CategoryStatus.Active,
    });
  });

  it('normalizes slug and checks global uniqueness when creating', async () => {
    const category = {
      _id: categoryId,
      name: 'Ao dai cuoi',
      slug: 'ao-dai-cuoi',
      type: ServiceCategoryType.AodaiCategory,
      parentId: null,
      status: CategoryStatus.Active,
      displayOrder: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service, categoryModel, validationService, securityLogService } =
      createService({
        create: jest.fn().mockResolvedValue(category),
      });

    await service.create(actorId, {
      name: 'Ao dai cuoi',
      type: ServiceCategoryType.AodaiCategory,
    });

    expect(validationService.assertSlugUniqueGlobally).toHaveBeenCalledWith(
      'ao-dai-cuoi',
    );
    expect(categoryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ao dai cuoi',
        slug: 'ao-dai-cuoi',
        type: ServiceCategoryType.AodaiCategory,
      }),
    );
    expect(securityLogService.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AdminAuditAction.CategoryCreated,
        targetCategoryId: categoryId,
      }),
    );
  });

  it('rejects active to inactive status update without reason', async () => {
    const category = {
      _id: categoryId,
      name: 'Ao dai cuoi',
      slug: 'ao-dai-cuoi',
      type: ServiceCategoryType.AodaiCategory,
      parentId: null,
      status: CategoryStatus.Active,
      displayOrder: 0,
      metadata: {},
      save: jest.fn(),
    };
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(category),
    });

    await expect(
      service.updateStatus(actorId, categoryId.toString(), {
        status: CategoryStatus.Inactive,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only exposes active ao dai categories to product forms', async () => {
    const findChain = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const { service, categoryModel } = createService({
      find: jest.fn().mockReturnValue(findChain),
    });

    await service.listActiveCategoriesForProducts();

    expect(categoryModel.find).toHaveBeenCalledWith({
      type: ServiceCategoryType.AodaiCategory,
      status: CategoryStatus.Active,
      deletedAt: { $exists: false },
    });
  });

  it('rejects an unavailable category when assigning a product', async () => {
    const { service } = createService({
      exists: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.assertActiveProductCategory(categoryId.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a duplicate key race to a conflict', async () => {
    const { service } = createService({
      create: jest.fn().mockRejectedValue({ code: 11000 }),
    });

    await expect(
      service.create(actorId, {
        name: 'Ao dai cuoi',
        type: ServiceCategoryType.AodaiCategory,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate category ids when reordering', async () => {
    const { service, categoryModel } = createService();
    const id = new Types.ObjectId().toString();

    await expect(
      service.reorder(actorId, {
        items: [
          { id, displayOrder: 0 },
          { id, displayOrder: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(categoryModel.find).not.toHaveBeenCalled();
  });

  it('rejects a missing category id when reordering', async () => {
    const findChain = Promise.resolve([]);
    const { service } = createService({
      find: jest.fn().mockReturnValue(findChain),
    });

    await expect(
      service.reorder(actorId, {
        items: [{ id: new Types.ObjectId().toString(), displayOrder: 0 }],
      }),
    ).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('checks that the parent is active when reactivating a child', async () => {
    const parentId = new Types.ObjectId();
    const category = {
      _id: categoryId,
      parentId,
      name: 'Ao dai con',
      slug: 'ao-dai-con',
      type: ServiceCategoryType.AodaiCategory,
      status: CategoryStatus.Inactive,
      displayOrder: 0,
      metadata: {},
      save: jest.fn(),
    };
    const { service, validationService } = createService({
      findOne: jest.fn().mockResolvedValue(category),
    });

    await service.updateStatus(actorId, categoryId.toString(), {
      status: CategoryStatus.Active,
    });

    expect(
      validationService.assertParentActiveForActivation,
    ).toHaveBeenCalledWith(parentId);
  });

  it('checks product and package usage before soft deleting', async () => {
    const category = {
      _id: categoryId,
      parentId: null,
      name: 'Ao dai rong',
      slug: 'ao-dai-rong',
      type: ServiceCategoryType.AodaiCategory,
      status: CategoryStatus.Active,
      displayOrder: 0,
      metadata: {},
      save: jest.fn(),
    };
    const { service, validationService, usageService } = createService({
      findOne: jest.fn().mockResolvedValue(category),
    });

    await service.softDelete(actorId, categoryId.toString());

    expect(validationService.assertNoActiveChildren).toHaveBeenCalledWith(
      categoryId,
    );
    expect(usageService.assertCategoryNotInUse).toHaveBeenCalledWith(
      categoryId,
    );
    expect(category.status).toBe(CategoryStatus.Inactive);
    expect(category.save).toHaveBeenCalled();
  });
});
