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

  async getCategories(): Promise<any[]> {
    return this.categoriesService.listActiveCategoriesForProducts();
  }

  async getProductById(productId: string): Promise<any | null> {
    const product = await this.productsRepository.findById(new Types.ObjectId(productId));
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

    const product = await this.productsRepository.create({
      providerId: user.provider.providerId,
      categoryId: new Types.ObjectId(dto.categoryId),
      name: dto.name,
      slug,
      description: dto.description || '',
      images: dto.images || [],
      basePrice: dto.basePrice,
      depositAmount: dto.depositAmount,
      sizes: dto.sizes || [],
      colors: dto.colors || [],
      materials: dto.materials || [],
      status: dto.status || ProductStatus.Draft,
      moderationStatus: ProductModerationStatus.PendingReview,
      moderationReason: null,
      style: dto.style || null,
      occasions: dto.occasions || [],
      taggingRevision: 1,
      taggingDecisionVersion: 0,
      rating: { averageRating: 0, totalReviews: 0 },
    });

    const sizes = dto.sizes && dto.sizes.length > 0 ? dto.sizes : ['M'];
    const colors = dto.colors && dto.colors.length > 0 ? dto.colors : ['WHITE'];
    const initialQuantity = dto.initialQuantity !== undefined ? dto.initialQuantity : 2;

    const inventoryItemModel = this.connection.model('InventoryItem');
    for (const size of sizes) {
      const sizeVal = size.trim().toUpperCase();
      for (const color of colors) {
        const colorVal = this.normalizeColor(color);
        for (let i = 0; i < initialQuantity; i++) {
          const sku = `AD-${product._id.toString().slice(-6)}-${sizeVal}-${colorVal}-${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
          await inventoryItemModel.create({
            productId: product._id,
            sku,
            size: sizeVal,
            color: colorVal,
            conditionStatus: 'GOOD',
            status: 'AVAILABLE',
          });
        }
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
      (dto.occasions !== undefined && !sameStringArray(dto.occasions, product.occasions));
    const productChanged =
      taggingInputChanged ||
      (dto.basePrice !== undefined && dto.basePrice !== product.basePrice) ||
      (dto.depositAmount !== undefined && dto.depositAmount !== product.depositAmount) ||
      (dto.sizes !== undefined && !sameStringArray(dto.sizes, product.sizes)) ||
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
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.images !== undefined) updateData.images = dto.images;
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
    }    if (taggingInputChanged) {
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

    await this.productsRepository.delete(new Types.ObjectId(productId));
    await Promise.all(
      product.images.map((image) => this.publicMedia.deleteByUrl(image).catch(() => undefined)),
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

