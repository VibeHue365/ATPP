import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscountCampaign, DiscountCampaignDocument } from '../schemas/discount-campaign.schema';
import { UsersRepository } from '../../users/repositories/users.repository';
import { CreateCampaignDto } from '../dto/create-campaign.dto';

@Injectable()
export class DiscountCampaignService {
  constructor(
    @InjectModel(DiscountCampaign.name)
    private readonly campaignModel: Model<DiscountCampaignDocument>,
    private readonly usersRepository: UsersRepository,
  ) {}

  private async getProviderId(userId: string): Promise<Types.ObjectId> {
    const user = await this.usersRepository.findUserById(new Types.ObjectId(userId));
    if (!user || !user.provider || !user.provider.providerId) {
      throw new ForbiddenException('Tài khoản không phải là đối tác hoặc không có ID đối tác.');
    }
    return new Types.ObjectId(user.provider.providerId.toString());
  }

  async createCampaign(userId: string, dto: CreateCampaignDto): Promise<DiscountCampaign> {
    const providerId = await this.getProviderId(userId);

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const now = new Date();

    if (end <= start) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.');
    }

    if (end <= now) {
      throw new BadRequestException('Ngày kết thúc không được ở quá khứ.');
    }

    // Tắt chiến dịch đang hoạt động cũ của đối tác này
    await this.campaignModel.updateMany(
      { providerId, isActive: true },
      { $set: { isActive: false } },
    );

    // Tạo chiến dịch mới
    return this.campaignModel.create({
      providerId,
      occasion: dto.occasion,
      discountPercent: dto.discountPercent,
      startDate: start,
      endDate: end,
      isActive: true,
    });
  }

  async getActiveCampaign(providerId: string | Types.ObjectId): Promise<DiscountCampaign | null> {
    const now = new Date();
    const pId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    return this.campaignModel.findOne({
      providerId: pId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ createdAt: -1 });
  }

  async getActiveCampaignsForProviders(providerIds: Types.ObjectId[]): Promise<Record<string, DiscountCampaign>> {
    if (!providerIds.length) return {};
    const now = new Date();

    const campaigns = await this.campaignModel.find({
      providerId: { $in: providerIds },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select('providerId occasion discountPercent endDate createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const result: Record<string, DiscountCampaign> = {};
    for (const c of campaigns) {
      const key = c.providerId.toString();
      // Vì đã sort createdAt: -1, chiến dịch đầu tiên tìm thấy sẽ là chiến dịch mới nhất và được ưu tiên
      if (!result[key]) {
        result[key] = c;
      }
    }
    return result;
  }

  async getDiscountedPrice(basePrice: number, providerId: string | Types.ObjectId): Promise<number> {
    const campaign = await this.getActiveCampaign(providerId);
    if (!campaign) return basePrice;
    return Math.round(basePrice * (1 - campaign.discountPercent / 100));
  }

  async getActiveCampaignForProviderUser(userId: string): Promise<DiscountCampaign | null> {
    const providerId = await this.getProviderId(userId);
    return this.getActiveCampaign(providerId);
  }

  async deactivateActiveCampaign(userId: string): Promise<void> {
    const providerId = await this.getProviderId(userId);
    await this.campaignModel.updateMany(
      { providerId, isActive: true },
      { $set: { isActive: false } },
    );
  }
}
