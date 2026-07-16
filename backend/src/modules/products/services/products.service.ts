import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { ProductDocument, ProductStatus } from '../schemas/product.schema';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { DiscountCampaignService } from './discount-campaign.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly usersRepository: UsersRepository,
    @InjectConnection() private readonly connection: Connection,
    private readonly campaignService: DiscountCampaignService,
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
    
    // Batch query active campaigns for all providers of retrieved products to prevent N+1 queries
    const providerIds = [...new Set(products.map(p => {
      return typeof p.providerId === 'object' && p.providerId ? (p.providerId as any)._id : p.providerId;
    }))];
    const campaigns = await this.campaignService.getActiveCampaignsForProviders(providerIds);

    return products.map(product => {
      const plain = product.toObject() as any;
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
    return this.connection.db!.collection('categories').find({ status: 'ACTIVE' }).toArray();
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
      throw new BadRequestException('User is not a provider or lacks provider ID');
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

  async createProduct(userId: string, dto: CreateProductDto): Promise<ProductDocument> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider or lacks provider ID');
    }

    if (dto.depositAmount >= dto.basePrice) {
      throw new BadRequestException('Giá cọc phải nhỏ hơn giá thuê');
    }


    const slug = dto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + '-' + Date.now();

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
      style: dto.style || null,
      occasions: dto.occasions || [],
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

  async updateProduct(userId: string, productId: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider');
    }

    const product = await this.productsRepository.findById(new Types.ObjectId(productId));
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const checkBasePrice = dto.basePrice !== undefined ? dto.basePrice : product.basePrice;
    const checkDeposit = dto.depositAmount !== undefined ? dto.depositAmount : product.depositAmount;
    if (checkDeposit >= checkBasePrice) {
      throw new BadRequestException('Giá cọc phải nhỏ hơn giá thuê');
    }


    const productProviderId = product.providerId && typeof product.providerId === 'object' && '_id' in product.providerId
      ? (product.providerId as any)._id
      : product.providerId;

    if (productProviderId.toString() !== user.provider.providerId.toString()) {
      throw new BadRequestException('You do not own this product');
    }

    const updateData: any = {};
    if (dto.name !== undefined) {

      updateData.name = dto.name;
      updateData.slug = dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + '-' + Date.now();
    }
    if (dto.categoryId !== undefined) updateData.categoryId = new Types.ObjectId(dto.categoryId);
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.basePrice !== undefined) updateData.basePrice = dto.basePrice;
    if (dto.depositAmount !== undefined) updateData.depositAmount = dto.depositAmount;
    if (dto.sizes !== undefined) updateData.sizes = dto.sizes;
    if (dto.colors !== undefined) updateData.colors = dto.colors;
    if (dto.materials !== undefined) updateData.materials = dto.materials;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.style !== undefined) updateData.style = dto.style;
    if (dto.occasions !== undefined) updateData.occasions = dto.occasions;

    const updated = await this.productsRepository.update(new Types.ObjectId(productId), updateData);
    if (!updated) {
      throw new NotFoundException('Failed to update product');
    }
    return updated;
  }

  async deleteProduct(userId: string, productId: string): Promise<Record<string, unknown>> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider');
    }

    const product = await this.productsRepository.findById(new Types.ObjectId(productId));
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productProviderId = product.providerId && typeof product.providerId === 'object' && '_id' in product.providerId
      ? (product.providerId as any)._id
      : product.providerId;

    if (productProviderId.toString() !== user.provider.providerId.toString()) {
      throw new BadRequestException('You do not own this product');
    }

    // Check if product belongs to any active booking
    const activeBookingItems = await this.connection.db!
      .collection('booking_items')
      .find({ productId: new Types.ObjectId(productId) })
      .toArray();

    if (activeBookingItems.length > 0) {
      const bookingIds = activeBookingItems.map(item => item.bookingId);
      const activeBookings = await this.connection.db!
        .collection('bookings')
        .find({
          _id: { $in: bookingIds },
          status: { $nin: ['CANCELLED', 'RETURNED', 'COMPLETED'] },
        })
        .toArray();

      if (activeBookings.length > 0) {
        throw new BadRequestException(
          'Không thể xóa sản phẩm này vì đang nằm trong một lịch hẹn đặt thuê đang hoạt động.',
        );
      }
    }

    await this.productsRepository.delete(new Types.ObjectId(productId));
    return { message: 'Product deleted successfully' };
  }
}
