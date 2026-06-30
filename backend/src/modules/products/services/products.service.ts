import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { ProductDocument, ProductStatus } from '../schemas/product.schema';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly usersRepository: UsersRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getAllActiveProducts(options?: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    colors?: string[];
    sizes?: string[];
    materials?: string[];
  }): Promise<ProductDocument[]> {
    return this.productsRepository.findAllActive(options);
  }

  async getCategories(): Promise<any[]> {
    return this.connection.db!.collection('categories').find({ status: 'ACTIVE' }).toArray();
  }

  async getProductById(productId: string): Promise<ProductDocument | null> {
    return this.productsRepository.findById(new Types.ObjectId(productId));
  }

  async getMyProducts(userId: string): Promise<ProductDocument[]> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider or lacks provider ID');
    }
    return this.productsRepository.findByProvider(user.provider.providerId);
  }

  async createProduct(userId: string, dto: CreateProductDto): Promise<ProductDocument> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new BadRequestException('User is not a provider or lacks provider ID');
    }

    const slug = dto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + '-' + Date.now();

    return this.productsRepository.create({
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
