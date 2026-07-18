import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ProductModerationStatus,
  ProductStatus,
} from '../schemas/product.schema';
import { ProductsService } from './products.service';

describe('ProductsService moderation', () => {
  const providerId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId();

  function createService(overrides: Record<string, unknown> = {}) {
    const productsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findPublicById: jest.fn(),
      findByProvider: jest.fn(),
      findAllActive: jest.fn(),
      update: jest.fn(),
      moderate: jest.fn(),
      findModerationQueue: jest.fn(),
      moveLegacyProductsToPendingReview: jest.fn(),
      ...overrides,
    };
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue({
        provider: { providerId },
      }),
    };
    const categoriesService = {
      assertActiveProductCategory: jest.fn(),
      listActiveCategoriesForProducts: jest.fn(),
    };
    const smartTagPublicProjectionService = {
      projectProductBadges: jest.fn().mockResolvedValue(new Map()),
    };
    const smartTaggingService = { markAssignmentsStale: jest.fn() };
    const connection = { db: { collection: jest.fn() }, model: jest.fn() };
    const campaignService = {
      getActiveCampaign: jest.fn(),
      getActiveCampaignsForProviders: jest.fn(),
    };
    const publicMedia = { deleteByUrl: jest.fn() };

    return {
      service: new ProductsService(
        productsRepository as any,
        usersRepository as any,
        categoriesService as any,
        smartTagPublicProjectionService as any,
        smartTaggingService as any,
        connection as any,
        campaignService as any,
        publicMedia as any,
      ),
      productsRepository,
      categoriesService,
    };
  }

  it('creates every provider product in pending review', async () => {
    const product = { _id: productId };
    const { service, productsRepository } = createService({
      create: jest.fn().mockResolvedValue(product),
    });

    await service.createProduct(userId, {
      name: 'Ao dai test',
      categoryId: new Types.ObjectId().toString(),
      basePrice: 500000,
      depositAmount: 100000,
      status: ProductStatus.Active,
    });

    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ProductStatus.Active,
        moderationStatus: ProductModerationStatus.PendingReview,
        taggingRevision: 1,
        taggingDecisionVersion: 0,
      }),
    );
  });

  it('returns a rejected product to pending review after provider edits it', async () => {
    const existing = {
      _id: productId,
      providerId,
      basePrice: 500000,
      depositAmount: 100000,
      moderationStatus: ProductModerationStatus.Rejected,
    };
    const { service, productsRepository } = createService({
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(existing),
    });

    await service.updateProduct(userId, productId.toString(), {
      description: 'Noi dung da chinh sua',
    });

    expect(productsRepository.update).toHaveBeenCalledWith(
      productId,
      expect.objectContaining({
        moderationStatus: ProductModerationStatus.PendingReview,
        moderationReason: null,
      }),
      { incrementTaggingRevision: true },
    );
  });

  it('does not increment the tagging revision for a price-only edit', async () => {
    const existing = {
      _id: productId,
      providerId,
      basePrice: 500000,
      depositAmount: 100000,
      moderationStatus: ProductModerationStatus.Approved,
    };
    const { service, productsRepository } = createService({
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(existing),
    });

    await service.updateProduct(userId, productId.toString(), {
      basePrice: 600000,
    });

    expect(productsRepository.update).toHaveBeenCalledWith(
      productId,
      expect.objectContaining({ basePrice: 600000 }),
      { incrementTaggingRevision: false },
    );
  });

  it('does not reset moderation or stale tags when the submitted product is unchanged', async () => {
    const categoryId = new Types.ObjectId();
    const existing = {
      _id: productId,
      providerId,
      categoryId,
      name: 'Ao dai test',
      description: 'Mo ta',
      images: ['/uploads/aodai.jpg'],
      basePrice: 500000,
      depositAmount: 100000,
      sizes: ['M'],
      colors: ['RED'],
      materials: ['SILK'],
      status: ProductStatus.Active,
      style: 'traditional',
      occasions: ['wedding'],
      moderationStatus: ProductModerationStatus.Approved,
    };
    const { service, productsRepository } = createService({
      findById: jest.fn().mockResolvedValue(existing),
    });

    const result = await service.updateProduct(userId, productId.toString(), {
      name: existing.name,
      categoryId: categoryId.toString(),
      description: existing.description,
      images: existing.images,
      basePrice: existing.basePrice,
      depositAmount: existing.depositAmount,
      sizes: existing.sizes,
      colors: existing.colors,
      materials: existing.materials,
      status: existing.status,
      style: existing.style,
      occasions: existing.occasions,
    });

    expect(result).toBe(existing);
    expect(productsRepository.update).not.toHaveBeenCalled();
  });
  it('returns conflict when another admin already processed the item', async () => {
    const existing = {
      _id: productId,
      moderationStatus: ProductModerationStatus.Approved,
    };
    const { service } = createService({
      findById: jest.fn().mockResolvedValue(existing),
    });

    await expect(
      service.moderateProduct(userId, productId.toString(), {
        action: ProductModerationStatus.Approved,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

