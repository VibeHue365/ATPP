import { BadRequestException } from '@nestjs/common';
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
});
