import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import {
  ProductDocument,
  ProductModerationStatus,
  ProductStatus,
} from '../schemas/product.schema';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { DiscountCampaignService } from './discount-campaign.service';
import { CategoriesService } from '../../categories/services/categories.service';
import { ServiceCategoryType } from '../../categories/schemas/category.schema';
import { ModerateProductDto } from '../dto/product-moderation.dto';
import { SmartTagPublicProjectionService } from '../../smart-tagging/services/smart-tag-public-projection.service';
import { SmartTaggingService } from '../../smart-tagging/services/smart-tagging.service';
import { SmartTagEntityType } from '../../smart-tagging/constants/smart-tag.constants';
import { PublicMediaService } from '../../storage/services/public-media.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly categoriesService: CategoriesService,
    private readonly smartTagPublicProjectionService: SmartTagPublicProjectionService,
    private readonly smartTaggingService: SmartTaggingService,
    @InjectConnection() private readonly connection: Connection,
    private readonly campaignService: DiscountCampaignService,
    private readonly publicMedia: PublicMediaService,
  ) {}

  async getAllActiveProducts(options?: {
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
    limit?: number;
  }): Promise<any[]> {
    const products = await this.productsRepository.findAllActive(options);
    const productsWithBadges = await this.attachPublicBadges(products);
    // Batch query active campaigns for all providers of retrieved products to prevent N+1 queries
    const providerIds = [...new Set(products.map(p => {
      return typeof p.providerId === 'object' && p.providerId ? (p.providerId as any)._id : p.providerId;
    }))];
    const campaigns = await this.campaignService.getActiveCampaignsForProviders(providerIds);

    return productsWithBadges.map((product: any) => {
      const plain = { ...product } as any;
      const pId = typeof plain.providerId === 'object' && plain.providerId ? plain.providerId._id.toString() : plain.providerId.toString();
      const campaign = campaigns[pId];
      if (campaign) {
        plain.activeCampaign = {
          occasion: campaign.occasion,
          discountPercent: campaign.discountPercent,
          endDate: campaign.endDate,
        };
        plain.discountedPrice = Math.round(plain.basePrice * (1 - campaign.discountPercent / 100));
      } else {
        plain.activeCampaign = null;
        plain.discountedPrice = plain.basePrice;
      }
      return plain;
    });
  }

  async getFeaturedProducts(limit = 8): Promise<any[]> {
    // Engagement metrics are not persisted yet, so newest public listings are
    // the deterministic fallback for the landing featured section.
    return this.getAllActiveProducts({ limit });
  }

  async getCategories(): Promise<any[]> {
    return this.categoriesService.listActiveCategoriesForProducts();
  }

  async getProductById(productId: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(productId)) return null;
    const product = await this.productsRepository.findPublicById(new Types.ObjectId(productId));
    if (!product) return null;
    const plain = product.toObject() as any;
    const pId = typeof plain.providerId === 'object' && plain.providerId ? plain.providerId._id : plain.providerId;
    const campaign = await this.campaignService.getActiveCampaign(pId);
    if (campaign) {
      plain.activeCampaign = {
        occasion: campaign.occasion,
        discountPercent: campaign.discountPercent,
        endDate: campaign.endDate,
      };
      plain.discountedPrice = Math.round(plain.basePrice * (1 - campaign.discountPercent / 100));
    } else {
      plain.activeCampaign = null;
      plain.discountedPrice = plain.basePrice;
    }
    const [withBadges] = await this.attachPublicBadges([product]);
    plain.badges = withBadges.badges;
    return plain;
  }

  async getMyProducts(
    userId: string,
    search?: string,
    sortBy?: string,
    page: number = 1,
    limit: number = 10,
    sizes?: string,
    colors?: string,
  ): Promise<{ items: any[]; total: number }> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException(
        'User is not a provider or lacks provider ID',
      );
    }
    const result = await this.productsRepository.findByProvider(user.provider.providerId, search, sortBy, page, limit, sizes, colors);
    
    const campaign = await this.campaignService.getActiveCampaign(user.provider.providerId);

    const items = result.items.map(product => {
      const plain = product.toObject() as any;
      if (campaign) {
        plain.activeCampaign = {
          occasion: campaign.occasion,
          discountPercent: campaign.discountPercent,
          endDate: campaign.endDate,
        };
        plain.discountedPrice = Math.round(plain.basePrice * (1 - campaign.discountPercent / 100));
      } else {
        plain.activeCampaign = null;
        plain.discountedPrice = plain.basePrice;
      }
      return plain;
    });

    return { items, total: result.total };
  }

  private normalizeColor(colorStr?: string | null): string {
    if (!colorStr) return 'WHITE';
    const norm = colorStr.trim().toUpperCase();
    if (norm === 'ĐỎ' || norm === 'RED') return 'RED';
    if (norm === 'TRẮNG' || norm === 'WHITE') return 'WHITE';
    if (norm === 'VÀNG' || norm === 'GOLD') return 'GOLD';
    if (norm === 'ĐEN' || norm === 'BLACK') return 'BLACK';
    return norm;
  }

  async createProduct(
    userId: string,
    dto: CreateProductDto,
  ): Promise<ProductDocument> {
    const user = await this.usersRepository.findUserById(
      new Types.ObjectId(userId),
    );
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException(
        'User is not a provider or lacks provider ID',
      );
    }

    if (dto.depositAmount >= dto.basePrice) {
      throw new BadRequestException('GiÃ¡ cá»c pháº£i nhá» hÆ¡n giÃ¡ thuÃª');
    }

    await this.categoriesService.assertActiveProductCategory(dto.categoryId);
    await this.categoriesService.assertActiveCategories(
      dto.styleCategoryIds ?? [],
      ServiceCategoryType.Style,
    );
    await this.categoriesService.assertActiveCategories(
      dto.eventCategoryIds ?? [],
      ServiceCategoryType.Event,
    );

    const slug =
      dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Ä‘/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Date.now();

    const variants =
      dto.variants && dto.variants.length > 0 ? dto.variants : null;

    // When variants are provided they are the single source of truth for
    // sizes/colors/materials (used by search filters + smart-tag inputs);
    // otherwise fall back to the explicit arrays.
    const productSizes = variants
      ? Array.from(new Set(variants.map((v) => v.size.trim().toUpperCase())))
      : dto.sizes || [];
    const productColors = variants
      ? Array.from(new Set(variants.map((v) => this.normalizeColor(v.color))))
      : dto.colors || [];
    const productMaterials = variants
      ? Array.from(
          new Set(
            variants
              .map((v) => (v.material ? v.material.trim() : ''))
              .filter((m) => m.length > 0),
          ),
        )
      : dto.materials || [];

    const product = await this.productsRepository.create({
      providerId: user.provider.providerId,
      categoryId: new Types.ObjectId(dto.categoryId),
      styleCategoryIds: (dto.styleCategoryIds ?? []).map((id) => new Types.ObjectId(id)),
      eventCategoryIds: (dto.eventCategoryIds ?? []).map((id) => new Types.ObjectId(id)),
      name: dto.name,
      slug,
      description: dto.description || '',
      images: dto.images || [],
      videos: dto.videos || [],
      basePrice: dto.basePrice,
      depositAmount: dto.depositAmount,
      sizes: productSizes,
      colors: productColors,
      materials: productMaterials,
      status: dto.status || ProductStatus.Draft,
      moderationStatus: ProductModerationStatus.PendingReview,
      moderationReason: null,
      style: dto.style || null,
      occasions: dto.occasions || [],
      taggingRevision: 1,
      taggingDecisionVersion: 0,
      rating: { averageRating: 0, totalReviews: 0 },
    });

    // Create real inventory items only from the provider's declared variants.
    // No variants => no stock is fabricated (the old default-of-2 behaviour is
    // intentionally removed so onboarding never invents phantom inventory).
    if (variants) {
      const inventoryItemModel = this.connection.model('InventoryItem');
      const seqByBucket = new Map<string, number>();
      for (const variant of variants) {
        const sizeVal = variant.size.trim().toUpperCase();
        const colorVal = this.normalizeColor(variant.color);
        const materialVal = variant.material ? variant.material.trim() : null;
        const quantity =
          variant.quantity && variant.quantity > 0 ? variant.quantity : 1;
        const bucket = `${sizeVal}_${colorVal}`;
        let seq = seqByBucket.get(bucket) || 0;
        for (let i = 0; i < quantity; i++) {
          seq += 1;
          const seqStr = seq.toString().padStart(3, '0');
          const sku =
            `AD-${product._id.toString().slice(-6)}-${sizeVal}-${colorVal}-${seqStr}`.toUpperCase();
          await inventoryItemModel.create({
            productId: product._id,
            sku,
            size: sizeVal,
            color: colorVal,
            material: materialVal,
            conditionStatus: variant.conditionStatus || 'GOOD',
            status: 'AVAILABLE',
          });
        }
        seqByBucket.set(bucket, seq);
      }
    }

    return product;
  }

  async updateProduct(
    userId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDocument> {
    const user = await this.usersRepository.findUserById(
      new Types.ObjectId(userId),
    );
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider');
    }

    const product = await this.productsRepository.findById(
      new Types.ObjectId(productId),
    );
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const checkBasePrice =
      dto.basePrice !== undefined ? dto.basePrice : product.basePrice;
    const checkDeposit =
      dto.depositAmount !== undefined
        ? dto.depositAmount
        : product.depositAmount;
    if (checkDeposit >= checkBasePrice) {
      throw new BadRequestException('GiÃ¡ cá»c pháº£i nhá» hÆ¡n giÃ¡ thuÃª');
    }

    const productProviderId =
      product.providerId &&
      typeof product.providerId === 'object' &&
      '_id' in product.providerId
        ? (product.providerId as any)._id
        : product.providerId;

    if (productProviderId.toString() !== user.provider.providerId.toString()) {
      throw new BadRequestException('You do not own this product');
    }

    const updateData: any = {};
    const sameStringArray = (left: string[] = [], right: string[] = []) =>
      left.length === right.length && left.every((value, index) => value === right[index]);

    const taggingInputChanged =
      (dto.name !== undefined && dto.name !== product.name) ||
      (dto.categoryId !== undefined && dto.categoryId !== product.categoryId.toString()) ||
      (dto.description !== undefined && dto.description !== product.description) ||
      (dto.images !== undefined && !sameStringArray(dto.images, product.images)) ||
      (dto.colors !== undefined && !sameStringArray(dto.colors, product.colors)) ||
      (dto.materials !== undefined && !sameStringArray(dto.materials, product.materials)) ||
      (dto.style !== undefined && dto.style !== product.style) ||
      (dto.occasions !== undefined && !sameStringArray(dto.occasions, product.occasions)) ||
      (dto.styleCategoryIds !== undefined && !sameStringArray(dto.styleCategoryIds, (product.styleCategoryIds ?? []).map((id) => id.toString()))) ||
      (dto.eventCategoryIds !== undefined && !sameStringArray(dto.eventCategoryIds, (product.eventCategoryIds ?? []).map((id) => id.toString())));
    const productChanged =
      taggingInputChanged ||
      (dto.basePrice !== undefined && dto.basePrice !== product.basePrice) ||
      (dto.depositAmount !== undefined && dto.depositAmount !== product.depositAmount) ||
      (dto.sizes !== undefined && !sameStringArray(dto.sizes, product.sizes)) ||
      (dto.videos !== undefined && !sameStringArray(dto.videos, product.videos || [])) ||
      (dto.status !== undefined && dto.status !== product.status);

    if (!productChanged) {
      return product;
    }
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      updateData.slug =
        dto.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/Ä‘/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') +
        '-' +
        Date.now();
    }
    if (dto.categoryId !== undefined) {
      await this.categoriesService.assertActiveProductCategory(dto.categoryId);
      updateData.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.styleCategoryIds !== undefined) {
      await this.categoriesService.assertActiveCategories(
        dto.styleCategoryIds,
        ServiceCategoryType.Style,
      );
      updateData.styleCategoryIds = dto.styleCategoryIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (dto.eventCategoryIds !== undefined) {
      await this.categoriesService.assertActiveCategories(
        dto.eventCategoryIds,
        ServiceCategoryType.Event,
      );
      updateData.eventCategoryIds = dto.eventCategoryIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.videos !== undefined) updateData.videos = dto.videos;
    if (dto.basePrice !== undefined) updateData.basePrice = dto.basePrice;
    if (dto.depositAmount !== undefined)
      updateData.depositAmount = dto.depositAmount;
    if (dto.sizes !== undefined) updateData.sizes = dto.sizes;
    if (dto.colors !== undefined) updateData.colors = dto.colors;
    if (dto.materials !== undefined) updateData.materials = dto.materials;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.style !== undefined) updateData.style = dto.style;
    if (dto.occasions !== undefined) updateData.occasions = dto.occasions;

    // Only an actual provider change must be reviewed again.
    updateData.moderationStatus = ProductModerationStatus.PendingReview;
    updateData.moderationReason = null;
    updateData.moderatedAt = null;
    updateData.moderatedBy = null;

    const updated = await this.productsRepository.update(
      new Types.ObjectId(productId),
      updateData,
      { incrementTaggingRevision: taggingInputChanged },
    );
    if (!updated) {
      throw new NotFoundException('Failed to update product');
    }
    if (dto.images !== undefined) {
      const removedImages = product.images.filter((image) => !dto.images!.includes(image));
      await Promise.all(
        removedImages.map((image) => this.publicMedia.deleteByUrl(image).catch(() => undefined)),
      );
    }
    if (dto.videos !== undefined) {
      const removedVideos = (product.videos || []).filter((video) => !dto.videos!.includes(video));
      await Promise.all(
        removedVideos.map((video) => this.publicMedia.deleteByUrl(video).catch(() => undefined)),
      );
    }
    if (taggingInputChanged) {
      await this.smartTaggingService.markAssignmentsStale(
        SmartTagEntityType.Product,
        updated._id,
        updated.taggingRevision,
      );
    }
    return updated;
  }

  async getModerationQueue(
    status = ProductModerationStatus.PendingReview,
  ): Promise<ProductDocument[]> {
    await this.productsRepository.moveLegacyProductsToPendingReview();
    return this.productsRepository.findModerationQueue(status);
  }

  async moderateProduct(
    adminId: string,
    productId: string,
    dto: ModerateProductDto,
  ): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new NotFoundException('Product not found');
    }

    const id = new Types.ObjectId(productId);
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const expectedStatus =
      dto.action === ProductModerationStatus.Hidden
        ? ProductModerationStatus.Approved
        : ProductModerationStatus.PendingReview;
    const allowedAction =
      dto.action === ProductModerationStatus.Approved ||
      dto.action === ProductModerationStatus.Rejected ||
      dto.action === ProductModerationStatus.Hidden;

    if (!allowedAction) {
      throw new BadRequestException('Unsupported moderation action');
    }

    if (product.moderationStatus !== expectedStatus) {
      throw new ConflictException(
        'Product moderation state was already changed',
      );
    }

    const updated = await this.productsRepository.moderate(id, expectedStatus, {
      moderationStatus: dto.action,
      moderationReason:
        dto.action === ProductModerationStatus.Rejected ||
        dto.action === ProductModerationStatus.Hidden
          ? dto.reason!.trim()
          : null,
      moderatedBy: new Types.ObjectId(adminId),
      moderatedAt: new Date(),
    });

    if (!updated) {
      throw new ConflictException(
        'Product moderation state was already changed',
      );
    }

    return updated;
  }

  async deleteProduct(
    userId: string,
    productId: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.usersRepository.findUserById(
      new Types.ObjectId(userId),
    );
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider');
    }

    const product = await this.productsRepository.findById(
      new Types.ObjectId(productId),
    );
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productProviderId =
      product.providerId &&
      typeof product.providerId === 'object' &&
      '_id' in product.providerId
        ? (product.providerId as any)._id
        : product.providerId;

    if (productProviderId.toString() !== user.provider.providerId.toString()) {
      throw new BadRequestException('You do not own this product');
    }

    // Check if product belongs to any active booking
    const activeBookingItems = await this.connection
      .db!.collection('booking_items')
      .find({ productId: new Types.ObjectId(productId) })
      .toArray();

    if (activeBookingItems.length > 0) {
      const bookingIds = activeBookingItems.map((item) => item.bookingId);
      const activeBookings = await this.connection
        .db!.collection('bookings')
        .find({
          _id: { $in: bookingIds },
          status: { $nin: ['CANCELLED', 'RETURNED', 'COMPLETED'] },
        })
        .toArray();

      if (activeBookings.length > 0) {
        throw new BadRequestException(
          'KhÃ´ng thá»ƒ xÃ³a sáº£n pháº©m nÃ y vÃ¬ Ä‘ang náº±m trong má»™t lá»‹ch háº¹n Ä‘áº·t thuÃª Ä‘ang hoáº¡t Ä‘á»™ng.',
        );
      }
    }

    // Cascade: remove this product's inventory items and their reservations so
    // deleting a product (e.g. an abandoned onboarding draft) never leaves
    // orphaned stock behind. Active bookings were already rejected above.
    const inventoryItemModel = this.connection.model('InventoryItem');
    const ownedItems = await inventoryItemModel
      .find({ productId: new Types.ObjectId(productId) })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (ownedItems.length > 0) {
      const itemIds = ownedItems.map((item: any) => item._id);
      await this.connection
        .model('InventoryReservation')
        .deleteMany({ inventoryItemId: { $in: itemIds } });
      await inventoryItemModel.deleteMany({
        productId: new Types.ObjectId(productId),
      });
    }

    await this.productsRepository.delete(new Types.ObjectId(productId));
    await Promise.all(
      [...product.images, ...(product.videos || [])].map((media) =>
        this.publicMedia.deleteByUrl(media).catch(() => undefined),
      ),
    );
    return { message: 'Product deleted successfully' };
  }

  private async attachPublicBadges(
    products: ProductDocument[],
  ): Promise<any[]> {
    const badgesByProductId =
      await this.smartTagPublicProjectionService.projectProductBadges(products);
    return products.map((product) => ({
      ...product.toObject(),
      badges: badgesByProductId.get(product._id.toString()) || [],
    }));
  }
}

