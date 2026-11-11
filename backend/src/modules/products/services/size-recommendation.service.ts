import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductsRepository } from '../repositories/products.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { SizeRecommendationDto } from '../dto/size-recommendation.dto';
import { Measurements, recommendSize } from './size-recommendation.engine';

@Injectable()
export class SizeRecommendationService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly users: UsersRepository,
  ) {}
  async recommend(
    productId: string,
    overrides: SizeRecommendationDto,
    userId?: string,
  ) {
    if (!Types.ObjectId.isValid(productId))
      throw new NotFoundException('Product not found');
    const product = await this.products.findPublicById(
      new Types.ObjectId(productId),
    );
    if (!product) throw new NotFoundException('Product not found');
    const user = userId
      ? await this.users.findUserById(new Types.ObjectId(userId))
      : null;
    const body: Measurements = { ...user?.preferences?.sizeInfo };
    for (const key of [
      'height',
      'weight',
      'chest',
      'waist',
      'hip',
      'shoulder',
      'bicep',
      'fitPreference',
    ] as const) {
      if (overrides[key] !== undefined)
        (body as Record<string, unknown>)[key] = overrides[key];
    }
    return recommendSize(product.sizeChart, product.sizes, body);
  }
}
