import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ProductCustomTagStatus,
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
      assertActiveCategories: jest.fn(),
      listActiveCategoriesForProducts: jest.fn(),
    };
    const smartTagPublicProjectionService = {
      projectProductBadges: jest.fn().mockResolvedValue(new Map()),
    };
    const smartTaggingService = { markAssignmentsStale: jest.fn() };
    const inventoryItemModel = { create: jest.fn().mockResolvedValue({}) };
    const connection = {
      db: { collection: jest.fn() },
      model: jest.fn().mockReturnValue(inventoryItemModel),
    };
    const campaignService = {
      getActiveCampaign: jest.fn(),
      getActiveCampaignsForProviders: jest.fn().mockResolvedValue({}),
    };
    const publicMedia = { deleteByUrl: jest.fn() };
    const priceVersionModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    };

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
        priceVersionModel as any,
      ),
      productsRepository,
      categoriesService,
      priceVersionModel,
    };
  }

  it('creates every provider product in pending review', async () => {
    const product = {
      _id: productId,
      basePrice: 500000,
      depositAmount: 100000,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    const { service, productsRepository, priceVersionModel } = createService({
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
    expect(priceVersionModel.create).toHaveBeenCalledWith({
      targetType: 'PRODUCT',
      targetId: productId,
      price: 500000,
      depositAmount: 100000,
      effectiveFrom: product.createdAt,
      effectiveTo: null,
      note: 'Giá khởi tạo khi tạo sản phẩm',
    });
  });

  it('normalizes provider custom tags and creates them as pending', async () => {
    const product = { _id: productId };
    const { service, productsRepository } = createService({
      create: jest.fn().mockResolvedValue(product),
    });

    await service.createProduct(userId, {
      name: 'Ao dai test',
      categoryId: new Types.ObjectId().toString(),
      basePrice: 500000,
      depositAmount: 100000,
      customTags: ['  Mộng mơ xứ Huế  ', 'MỘNG MƠ XỨ HUẾ', 'Nàng thơ'],
    });

    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customTags: [
          {
            label: 'Mộng mơ xứ Huế',
            normalizedLabel: 'mong mo xu hue',
            status: ProductCustomTagStatus.Pending,
            mappedTagCode: null,
          },
          {
            label: 'Nàng thơ',
            normalizedLabel: 'nang tho',
            status: ProductCustomTagStatus.Pending,
            mappedTagCode: null,
          },
        ],
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
    const { service, productsRepository, priceVersionModel } = createService({
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
    expect(priceVersionModel.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targetType: 'PRODUCT',
        targetId: productId,
        price: 500000,
        depositAmount: 100000,
        effectiveTo: expect.any(Date),
        note: 'Khôi phục giá trước lần cập nhật đầu tiên',
      }),
    );
    expect(priceVersionModel.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        targetType: 'PRODUCT',
        targetId: productId,
        price: 600000,
        depositAmount: 100000,
        effectiveTo: null,
        note: 'Provider cập nhật giá sản phẩm',
      }),
    );
  });

  it('closes a matching current price version before appending the new price', async () => {
    const currentVersion = {
      price: 500000,
      depositAmount: 100000,
      effectiveTo: null as Date | null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existing = {
      _id: productId,
      providerId,
      basePrice: 500000,
      depositAmount: 100000,
      moderationStatus: ProductModerationStatus.Approved,
    };
    const { service, priceVersionModel } = createService({
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({ ...existing, depositAmount: 120000 }),
    });
    priceVersionModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentVersion),
      }),
    });

    await service.updateProduct(userId, productId.toString(), {
      depositAmount: 120000,
    });

    expect(currentVersion.effectiveTo).toBeInstanceOf(Date);
    expect(currentVersion.save).toHaveBeenCalledTimes(1);
    expect(priceVersionModel.create).toHaveBeenCalledTimes(1);
    expect(priceVersionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 500000,
        depositAmount: 120000,
        effectiveTo: null,
      }),
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

  it('approves selected custom tags and rejects the unselected tags with the product', async () => {
    const existing = {
      _id: productId,
      moderationStatus: ProductModerationStatus.PendingReview,
      customTags: [
        {
          label: 'Nàng thơ',
          normalizedLabel: 'nang tho',
          status: ProductCustomTagStatus.Pending,
          mappedTagCode: null,
        },
        {
          label: 'Bên sông Hương',
          normalizedLabel: 'ben song huong',
          status: ProductCustomTagStatus.Pending,
          mappedTagCode: null,
        },
      ],
    };
    const moderated = { ...existing, moderationStatus: ProductModerationStatus.Approved };
    const { service, productsRepository } = createService({
      findById: jest.fn().mockResolvedValue(existing),
      moderate: jest.fn().mockResolvedValue(moderated),
    });

    await service.moderateProduct(userId, productId.toString(), {
      action: ProductModerationStatus.Approved,
      approvedCustomTags: ['NÀNG THƠ'],
    });

    expect(productsRepository.moderate).toHaveBeenCalledWith(
      productId,
      ProductModerationStatus.PendingReview,
      expect.objectContaining({
        moderationStatus: ProductModerationStatus.Approved,
        customTags: [
          expect.objectContaining({
            normalizedLabel: 'nang tho',
            status: ProductCustomTagStatus.Approved,
          }),
          expect.objectContaining({
            normalizedLabel: 'ben song huong',
            status: ProductCustomTagStatus.Rejected,
          }),
        ],
      }),
    );
  });

  it('rejects an approved custom tag that does not belong to the product', async () => {
    const { service } = createService({
      findById: jest.fn().mockResolvedValue({
        _id: productId,
        moderationStatus: ProductModerationStatus.PendingReview,
        customTags: [],
      }),
    });

    await expect(
      service.moderateProduct(userId, productId.toString(), {
        action: ProductModerationStatus.Approved,
        approvedCustomTags: ['Tag không tồn tại'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exposes only approved custom tags through the public product detail', async () => {
    const product = {
      _id: productId,
      providerId,
      basePrice: 500000,
      customTags: [
        {
          label: 'Đã duyệt',
          normalizedLabel: 'da duyet',
          status: ProductCustomTagStatus.Approved,
          mappedTagCode: null,
        },
        {
          label: 'Chờ duyệt',
          normalizedLabel: 'cho duyet',
          status: ProductCustomTagStatus.Pending,
          mappedTagCode: null,
        },
        {
          label: 'Bị từ chối',
          normalizedLabel: 'bi tu choi',
          status: ProductCustomTagStatus.Rejected,
          mappedTagCode: null,
        },
      ],
      toObject() {
        return { ...this, toObject: undefined };
      },
    };
    const { service } = createService({
      findPublicById: jest.fn().mockResolvedValue(product),
    });

    const result = await service.getProductById(productId.toString());

    expect(result.customTags).toEqual([
      {
        label: 'Đã duyệt',
        normalizedLabel: 'da duyet',
        mappedTagCode: null,
      },
    ]);
    expect(result.customTags[0]).not.toHaveProperty('status');
  });

  it('returns the owned product price history newest first with pagination metadata', async () => {
    const versions = [
      {
        _id: new Types.ObjectId(),
        price: 600000,
        depositAmount: 120000,
        effectiveFrom: new Date('2026-09-20T00:00:00.000Z'),
        effectiveTo: null,
        note: 'Provider cập nhật giá sản phẩm',
      },
      {
        _id: new Types.ObjectId(),
        price: 500000,
        depositAmount: 100000,
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-09-20T00:00:00.000Z'),
        note: 'Giá khởi tạo khi tạo sản phẩm',
      },
    ];
    const { service, priceVersionModel } = createService({
      findById: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 600000,
        depositAmount: 120000,
      }),
    });
    priceVersionModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          price: 600000,
          depositAmount: 120000,
        }),
      }),
    });
    const historyQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(versions),
    };
    priceVersionModel.find.mockReturnValue(historyQuery);
    priceVersionModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    const result = await service.getMyProductPriceHistory(
      userId,
      productId.toString(),
      1,
      10,
    );

    expect(historyQuery.sort).toHaveBeenCalledWith({
      effectiveFrom: -1,
      _id: -1,
    });
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        price: 600000,
        depositAmount: 120000,
        isCurrent: true,
      }),
    );
    expect(result.data[1].isCurrent).toBe(false);
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('does not expose another provider product price history', async () => {
    const { service, priceVersionModel } = createService({
      findById: jest.fn().mockResolvedValue({
        _id: productId,
        providerId: new Types.ObjectId(),
      }),
    });

    await expect(
      service.getMyProductPriceHistory(userId, productId.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(priceVersionModel.find).not.toHaveBeenCalled();
  });

  it('repairs a stale legacy current version before returning price history', async () => {
    const staleVersion = {
      price: 400000,
      depositAmount: 100000,
      effectiveTo: null as Date | null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const { service, priceVersionModel } = createService({
      findById: jest.fn().mockResolvedValue({
        _id: productId,
        providerId,
        basePrice: 1999999,
        depositAmount: 1000000,
        updatedAt: new Date('2026-09-21T00:00:00.000Z'),
      }),
    });
    priceVersionModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(staleVersion),
      }),
    });
    priceVersionModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    priceVersionModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.getMyProductPriceHistory(userId, productId.toString());

    expect(staleVersion.effectiveTo).toBeInstanceOf(Date);
    expect(staleVersion.save).toHaveBeenCalledTimes(1);
    expect(priceVersionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 1999999,
        depositAmount: 1000000,
        effectiveTo: null,
        note: 'Đồng bộ giá hiện hành cho dữ liệu cũ',
      }),
    );
  });
});

