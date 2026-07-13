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
    const connection = { db: { collection: jest.fn() } };

    return {
      service: new ProductsService(
        productsRepository as any,
        usersRepository as any,
        categoriesService as any,
        connection as any,
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
    );
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
