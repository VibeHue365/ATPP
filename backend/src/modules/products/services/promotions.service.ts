import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Promotion,
  PromotionDocument,
  PromotionStatus,
  DiscountType,
} from '../schemas/promotion.schema';

export interface CreatePromotionDto {
  code: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<Promotion>,
  ) {}

  async createPromotion(
    providerIdStr: string | null,
    dto: CreatePromotionDto,
  ): Promise<PromotionDocument> {
    const providerId = providerIdStr ? new Types.ObjectId(providerIdStr) : null;
    const existing = await this.promotionModel.findOne({
      code: dto.code.toUpperCase(),
    });
    if (existing) {
      throw new BadRequestException('Voucher code already exists');
    }

    return this.promotionModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
      providerId,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  async getProviderPromotions(
    providerIdStr: string,
  ): Promise<PromotionDocument[]> {
    const providerId = new Types.ObjectId(providerIdStr);
    return this.promotionModel.find({ providerId });
  }

  async deletePromotion(
    promotionIdStr: string,
    providerIdStr?: string,
  ): Promise<void> {
    const promotionId = new Types.ObjectId(promotionIdStr);
    const query: Record<string, any> = { _id: promotionId };
    if (providerIdStr) {
      query.providerId = new Types.ObjectId(providerIdStr);
    }

    const res = await this.promotionModel.deleteOne(query);
    if (res.deletedCount === 0) {
      throw new NotFoundException('Voucher not found or unauthorized');
    }
  }

  async validatePromotion(
    code: string,
    orderValue: number,
    providerIdsStr: string[],
  ): Promise<PromotionDocument> {
    const promotion = await this.promotionModel.findOne({
      code: code.toUpperCase(),
    });
    if (!promotion) {
      throw new NotFoundException('Voucher code not found');
    }

    if (promotion.status !== PromotionStatus.Active) {
      throw new BadRequestException('Voucher is inactive');
    }

    const now = new Date();
    if (now < promotion.startDate) {
      throw new BadRequestException('Voucher is not active yet');
    }
    if (now > promotion.endDate) {
      throw new BadRequestException('Voucher has expired');
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usageLimit !== undefined &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      throw new BadRequestException('Voucher usage limit reached');
    }

    if (orderValue < promotion.minOrderValue) {
      throw new BadRequestException(
        `Order value must be at least ${promotion.minOrderValue.toLocaleString()}đ to use this voucher`,
      );
    }

    // If it's a provider-specific voucher, make sure at least one of the items matches this provider
    if (promotion.providerId) {
      const match = providerIdsStr.some((id) =>
        promotion.providerId?.equals(new Types.ObjectId(id)),
      );
      if (!match) {
        throw new BadRequestException(
          'This voucher is not applicable for these service providers',
        );
      }
    }

    return promotion;
  }

  async incrementUsage(promotionId: Types.ObjectId): Promise<void> {
    await this.promotionModel.updateOne(
      { _id: promotionId },
      { $inc: { usedCount: 1 } },
    );
  }
}
