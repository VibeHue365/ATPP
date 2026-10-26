import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SmartTagEntityType } from '../../smart-tagging/constants/smart-tag.constants';
import { ProductModerationStatus } from '../schemas/product.schema';
import { ProductsService } from './products.service';

type Row = Record<string, any>;

describe('Provider Ao Dai catalog use cases (DaiBLL)', () => {
  const providerId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId();
  const categoryId = new Types.ObjectId().toString();

  function existingProduct(overrides: Row = {}): Row {
    return {
      _id: productId,
      providerId,
      categoryId: new Types.ObjectId(categoryId),
      name: 'Ao dai Hue',
      description: 'Lua tron',
      images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
      videos: [],
      colors: ['RED'],
      materials: ['LUA'],
      sizes: ['M'],
      occasions: [],
      basePrice: 500000,
      depositAmount: 100000,
      customTags: [],
      status: 'ACTIVE',
      moderationStatus: ProductModerationStatus.Approved,
      ...overrides,
    };
  }

  function createService(
    options: {
      user?: Row | null;
      product?: Row | null;
      bookingItems?: Row[];
      activeBookings?: Row[];
      inventoryItems?: Row[];
    } = {},
  ) {
    const productsRepository = {
      create: jest
        .fn()
        .mockImplementation(async (data: Row) => ({ _id: productId, ...data })),
      findById: jest
        .fn()
        .mockResolvedValue(
          options.product === undefined ? existingProduct() : options.product,
        ),
      update: jest
        .fn()
        .mockImplementation(async (_id: Types.ObjectId, data: Row) => ({
          ...existingProduct(),
          ...data,
          taggingRevision: 2,
        })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const usersRepository = {
      findUserById: jest
        .fn()
        .mockResolvedValue(
          options.user === undefined
            ? { provider: { providerId } }
            : options.user,
        ),
    };
    const categoriesService = {
      assertActiveProductCategory: jest.fn().mockResolvedValue(undefined),
      assertActiveCategories: jest.fn().mockResolvedValue(undefined),
    };
    const smartTaggingService = {
      markAssignmentsStale: jest.fn().mockResolvedValue(undefined),
    };
    const inventoryItemModel = {
      insertMany: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve(options.inventoryItems ?? []),
          }),
        }),
      }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    const reservationModel = {
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    const productModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const collections: Record<string, { find: jest.Mock }> = {
      booking_items: {
        find: jest
          .fn()
          .mockReturnValue({
            toArray: () => Promise.resolve(options.bookingItems ?? []),
          }),
      },
      bookings: {
        find: jest
          .fn()
          .mockReturnValue({
            toArray: () => Promise.resolve(options.activeBookings ?? []),
          }),
      },
    };
    const connection = {
      db: { collection: jest.fn((name: string) => collections[name]) },
      model: jest.fn((name: string) => {
        if (name === 'InventoryItem') return inventoryItemModel;
        if (name === 'InventoryReservation') return reservationModel;
        return productModel;
      }),
    };
    const publicMedia = { deleteByUrl: jest.fn().mockResolvedValue(undefined) };
    const priceVersionModel = {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    };

    const service = new ProductsService(
      productsRepository as any,
      usersRepository as any,
      categoriesService as any,
      { projectProductBadges: jest.fn().mockResolvedValue(new Map()) } as any,
      smartTaggingService as any,
      connection as any,
      {
        getActiveCampaignsForProviders: jest.fn().mockResolvedValue({}),
      } as any,
      publicMedia as any,
      priceVersionModel as any,
    );
    return {
      service,
      productsRepository,
      categoriesService,
      smartTaggingService,
      inventoryItemModel,
      reservationModel,
      productModel,
      collections,
      publicMedia,
      priceVersionModel,
    };
  }

  function createDto(overrides: Row = {}): any {
    return {
      name: 'Ao dai Hue',
      categoryId,
      basePrice: 500000,
      depositAmount: 100000,
      ...overrides,
    };
  }

  describe('UC-16 Add AoDai', () => {
    it('UT-16 UTCID03 rejects a user without a provider profile', async () => {
      const { service, productsRepository } = createService({
        user: { provider: null },
      });

      await expect(service.createProduct(userId, createDto())).rejects.toThrow(
        new BadRequestException('User is not a provider or lacks provider ID'),
      );
      expect(productsRepository.create).not.toHaveBeenCalled();
    });

    it('UT-16 UTCID04 rejects a deposit equal to the rental price', async () => {
      const { service, productsRepository } = createService();

      await expect(
        service.createProduct(
          userId,
          createDto({ basePrice: 500000, depositAmount: 500000 }),
        ),
      ).rejects.toThrow(
        new BadRequestException('Giá cọc phải nhỏ hơn giá thuê'),
      );
      expect(productsRepository.create).not.toHaveBeenCalled();
    });

    it('UT-16 UTCID05 rejects a deposit greater than the rental price', async () => {
      const { service } = createService();

      await expect(
        service.createProduct(
          userId,
          createDto({ basePrice: 500000, depositAmount: 700000 }),
        ),
      ).rejects.toThrow(
        new BadRequestException('Giá cọc phải nhỏ hơn giá thuê'),
      );
    });

    it('UT-16 UTCID06 accepts a deposit one unit below the rental price', async () => {
      const { service, productsRepository } = createService();

      await service.createProduct(
        userId,
        createDto({ basePrice: 500000, depositAmount: 499999 }),
      );

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          basePrice: 500000,
          depositAmount: 499999,
          providerId,
        }),
      );
    });

    it('UT-16 UTCID07 stops creation when the product category is inactive', async () => {
      const { service, productsRepository, categoriesService } =
        createService();
      categoriesService.assertActiveProductCategory.mockRejectedValue(
        new BadRequestException('Danh mục sản phẩm không hoạt động'),
      );

      await expect(service.createProduct(userId, createDto())).rejects.toThrow(
        'Danh mục sản phẩm không hoạt động',
      );
      expect(productsRepository.create).not.toHaveBeenCalled();
    });

    it('UT-16 UTCID08 derives attributes from variants and creates one inventory item per unit', async () => {
      const { service, productsRepository, inventoryItemModel, productModel } =
        createService();

      await service.createProduct(
        userId,
        createDto({
          variants: [
            { size: ' m ', color: 'Đỏ', material: ' Lụa ', quantity: 2 },
            { size: 'L', color: 'red', quantity: 1 },
          ],
        }),
      );

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sizes: ['M', 'L'],
          colors: ['RED'],
          materials: ['Lụa'],
        }),
      );
      const items = inventoryItemModel.insertMany.mock.calls[0][0];
      expect(items).toHaveLength(3);
      expect(items.map((item: Row) => item.sku)).toEqual([
        expect.stringMatching(/-M-RED-001$/),
        expect.stringMatching(/-M-RED-002$/),
        expect.stringMatching(/-L-RED-001$/),
      ]);
      expect(productModel.updateOne).toHaveBeenCalledWith(
        { _id: productId },
        { $set: { skuCounters: { M_RED: 2, L_RED: 1 } } },
      );
    });

    it('UT-16 UTCID09 does not fabricate inventory when no variant is declared', async () => {
      const { service, inventoryItemModel } = createService();

      await service.createProduct(
        userId,
        createDto({ sizes: ['M'], colors: ['RED'] }),
      );

      expect(inventoryItemModel.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('UC-17 Edit AoDai', () => {
    it('UT-17 UTCID05 rejects an edit from a user without a provider profile', async () => {
      const { service, productsRepository } = createService({ user: null });

      await expect(
        service.updateProduct(userId, productId.toString(), { name: 'New' }),
      ).rejects.toThrow(new BadRequestException('User is not a provider'));
      expect(productsRepository.findById).not.toHaveBeenCalled();
    });

    it('UT-17 UTCID06 returns not found for a missing product', async () => {
      const { service } = createService({ product: null });

      await expect(
        service.updateProduct(userId, productId.toString(), { name: 'New' }),
      ).rejects.toThrow(new NotFoundException('Product not found'));
    });

    it('UT-17 UTCID07 rejects an edit of another provider product', async () => {
      const { service, productsRepository } = createService({
        product: existingProduct({ providerId: new Types.ObjectId() }),
      });

      await expect(
        service.updateProduct(userId, productId.toString(), { name: 'New' }),
      ).rejects.toThrow(new BadRequestException('You do not own this product'));
      expect(productsRepository.update).not.toHaveBeenCalled();
    });

    it('UT-17 UTCID08 regenerates the slug and marks Smart Tags stale after a name change', async () => {
      const { service, productsRepository, smartTaggingService } =
        createService();

      await service.updateProduct(userId, productId.toString(), {
        name: 'Áo dài Đỏ Huế',
      });

      const [, updateData, options] = productsRepository.update.mock.calls[0];
      expect(updateData.slug).toMatch(/^ao-dai-do-hue-\d+$/);
      expect(updateData.moderationStatus).toBe(
        ProductModerationStatus.PendingReview,
      );
      expect(options).toEqual({ incrementTaggingRevision: true });
      expect(smartTaggingService.markAssignmentsStale).toHaveBeenCalledWith(
        SmartTagEntityType.Product,
        productId,
        2,
      );
    });

    it('UT-17 UTCID09 deletes only the images removed by the provider', async () => {
      const { service, publicMedia } = createService();

      await service.updateProduct(userId, productId.toString(), {
        images: ['https://cdn.test/a.jpg', 'https://cdn.test/c.jpg'],
      });

      expect(publicMedia.deleteByUrl).toHaveBeenCalledTimes(1);
      expect(publicMedia.deleteByUrl).toHaveBeenCalledWith(
        'https://cdn.test/b.jpg',
      );
    });

    it('UT-17 UTCID10 rejects an edit that selects an inactive category', async () => {
      const { service, productsRepository, categoriesService } =
        createService();
      categoriesService.assertActiveProductCategory.mockRejectedValue(
        new BadRequestException('Danh mục sản phẩm không hoạt động'),
      );

      await expect(
        service.updateProduct(userId, productId.toString(), {
          categoryId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow('Danh mục sản phẩm không hoạt động');
      expect(productsRepository.update).not.toHaveBeenCalled();
    });

    it('UT-17 UTCID11 reports a failed update when the product disappears during saving', async () => {
      const { service, productsRepository } = createService();
      productsRepository.update.mockResolvedValue(null);

      await expect(
        service.updateProduct(userId, productId.toString(), {
          description: 'Moi',
        }),
      ).rejects.toThrow(new NotFoundException('Failed to update product'));
    });
  });

  describe('UC-18 Delete AoDai', () => {
    it('UT-18 UTCID01 deletes an owned product and its stored media', async () => {
      const { service, productsRepository, publicMedia } = createService({
        product: existingProduct({ videos: ['https://cdn.test/v.mp4'] }),
      });

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).resolves.toEqual({
        message: 'Product deleted successfully',
      });
      expect(productsRepository.delete).toHaveBeenCalledWith(productId);
      expect(publicMedia.deleteByUrl.mock.calls.map(([url]) => url)).toEqual([
        'https://cdn.test/a.jpg',
        'https://cdn.test/b.jpg',
        'https://cdn.test/v.mp4',
      ]);
    });

    it('UT-18 UTCID02 removes inventory items and their reservations together with the product', async () => {
      const itemIds = [new Types.ObjectId(), new Types.ObjectId()];
      const { service, inventoryItemModel, reservationModel } = createService({
        inventoryItems: itemIds.map((_id) => ({ _id })),
      });

      await service.deleteProduct(userId, productId.toString());

      expect(reservationModel.deleteMany).toHaveBeenCalledWith({
        inventoryItemId: { $in: itemIds },
      });
      expect(inventoryItemModel.deleteMany).toHaveBeenCalledWith({ productId });
    });

    it('UT-18 UTCID03 blocks deletion while the product belongs to an active booking', async () => {
      const bookingId = new Types.ObjectId();
      const { service, productsRepository } = createService({
        bookingItems: [{ bookingId, productId }],
        activeBookings: [{ _id: bookingId, status: 'CONFIRMED' }],
      });

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).rejects.toThrow(
        new BadRequestException(
          'Không thể xóa sản phẩm này vì đang nằm trong một lịch hẹn đặt thuê đang hoạt động.',
        ),
      );
      expect(productsRepository.delete).not.toHaveBeenCalled();
    });

    it('UT-18 UTCID04 allows deletion when related bookings are already finished', async () => {
      const bookingId = new Types.ObjectId();
      const { service, collections, productsRepository } = createService({
        bookingItems: [{ bookingId, productId }],
        activeBookings: [],
      });

      await service.deleteProduct(userId, productId.toString());

      expect(collections.bookings.find).toHaveBeenCalledWith({
        _id: { $in: [bookingId] },
        status: { $nin: ['CANCELLED', 'RETURNED', 'COMPLETED'] },
      });
      expect(productsRepository.delete).toHaveBeenCalledTimes(1);
    });

    it('UT-18 UTCID05 rejects deletion by a user without a provider profile', async () => {
      const { service } = createService({ user: { provider: {} } });

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).rejects.toThrow(new BadRequestException('User is not a provider'));
    });

    it('UT-18 UTCID06 returns not found when the product does not exist', async () => {
      const { service } = createService({ product: null });

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).rejects.toThrow(new NotFoundException('Product not found'));
    });

    it('UT-18 UTCID07 rejects deletion of another provider product', async () => {
      const { service, productsRepository } = createService({
        product: existingProduct({ providerId: { _id: new Types.ObjectId() } }),
      });

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).rejects.toThrow(new BadRequestException('You do not own this product'));
      expect(productsRepository.delete).not.toHaveBeenCalled();
    });

    it('UT-18 UTCID08 still completes deletion when removing a media file fails', async () => {
      const { service, publicMedia } = createService();
      publicMedia.deleteByUrl.mockRejectedValue(
        new Error('Storage unavailable'),
      );

      await expect(
        service.deleteProduct(userId, productId.toString()),
      ).resolves.toEqual({
        message: 'Product deleted successfully',
      });
    });

    it('UT-18 UTCID09 skips reservation cleanup when the product has no inventory', async () => {
      const { service, reservationModel, inventoryItemModel } = createService({
        inventoryItems: [],
      });

      await service.deleteProduct(userId, productId.toString());

      expect(reservationModel.deleteMany).not.toHaveBeenCalled();
      expect(inventoryItemModel.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('UC-19 Set Costume Deposit', () => {
    it('UT-19 UTCID01 stores a deposit lower than the rental price on a new product', async () => {
      const { service, productsRepository, priceVersionModel } =
        createService();

      await service.createProduct(
        userId,
        createDto({ basePrice: 600000, depositAmount: 200000 }),
      );

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ depositAmount: 200000 }),
      );
      expect(priceVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 600000,
          depositAmount: 200000,
          note: 'Giá khởi tạo khi tạo sản phẩm',
        }),
      );
    });

    it('UT-19 UTCID02 rejects an updated deposit equal to the current rental price', async () => {
      const { service, productsRepository } = createService();

      await expect(
        service.updateProduct(userId, productId.toString(), {
          depositAmount: 500000,
        }),
      ).rejects.toThrow(
        new BadRequestException('Giá cọc phải nhỏ hơn giá thuê'),
      );
      expect(productsRepository.update).not.toHaveBeenCalled();
    });

    it('UT-19 UTCID03 rejects an updated deposit greater than the current rental price', async () => {
      const { service } = createService();

      await expect(
        service.updateProduct(userId, productId.toString(), {
          depositAmount: 650000,
        }),
      ).rejects.toThrow(
        new BadRequestException('Giá cọc phải nhỏ hơn giá thuê'),
      );
    });

    it('UT-19 UTCID04 accepts a zero deposit', async () => {
      const { service, productsRepository } = createService();

      await service.createProduct(userId, createDto({ depositAmount: 0 }));

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ depositAmount: 0 }),
      );
    });

    it('UT-19 UTCID06 records a deposit-only change against the current rental price', async () => {
      const {
        service,
        productsRepository,
        priceVersionModel,
        smartTaggingService,
      } = createService();

      await service.updateProduct(userId, productId.toString(), {
        depositAmount: 150000,
      });

      expect(productsRepository.update).toHaveBeenCalledWith(
        productId,
        expect.objectContaining({ depositAmount: 150000 }),
        { incrementTaggingRevision: false },
      );
      expect(priceVersionModel.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          price: 500000,
          depositAmount: 150000,
          effectiveTo: null,
        }),
      );
      expect(smartTaggingService.markAssignmentsStale).not.toHaveBeenCalled();
    });

    it('UT-19 UTCID07 rejects lowering the rental price below the existing deposit', async () => {
      const { service, productsRepository } = createService({
        product: existingProduct({ basePrice: 500000, depositAmount: 300000 }),
      });

      await expect(
        service.updateProduct(userId, productId.toString(), {
          basePrice: 300000,
        }),
      ).rejects.toThrow(
        new BadRequestException('Giá cọc phải nhỏ hơn giá thuê'),
      );
      expect(productsRepository.update).not.toHaveBeenCalled();
    });
  });
});
