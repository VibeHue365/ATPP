import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscountCampaign, DiscountCampaignDocument } from '../schemas/discount-campaign.schema';
import { UsersRepository } from '../../users/repositories/users.repository';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  getStartOfVnDay,
  resolveHourlyRate,
  toVnDayKey,
} from '../utils/campaign-pricing.util';

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
    const type = dto.type ?? 'DISCOUNT';

    if (type === 'DISCOUNT' && dto.discountPercent > 90) {
      throw new BadRequestException('Phần trăm giảm giá tối đa là 90%.');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    // Ngày bắt đầu và kết thúc đều được tính, nên dịp lễ một ngày (14/2, 8/3, 20/10...) hợp lệ.
    if (toVnDayKey(end) < toVnDayKey(start)) {
      throw new BadRequestException('Ngày kết thúc không được trước ngày bắt đầu.');
    }

    if (toVnDayKey(end) < toVnDayKey(new Date())) {
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
      type,
      discountPercent: dto.discountPercent,
      startDate: start,
      endDate: end,
      isActive: true,
    });
  }

  /**
   * Chiến dịch đang chạy HOẶC sắp diễn ra (chưa qua ngày kết thúc). Chiến dịch áp theo ngày thuê,
   * nên khách đặt trước cần thấy nó ngay từ lúc tạo; ngày nào bị áp giá thì do ngày thuê quyết định.
   */
  async getActiveCampaign(providerId: string | Types.ObjectId): Promise<DiscountCampaign | null> {
    const pId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    return this.campaignModel.findOne({
      providerId: pId,
      isActive: true,
      endDate: { $gte: getStartOfVnDay() },
    }).sort({ createdAt: -1 });
  }

  async getActiveCampaignsForProviders(providerIds: Types.ObjectId[]): Promise<Record<string, DiscountCampaign>> {
    if (!providerIds.length) return {};

    const campaigns = await this.campaignModel.find({
      providerId: { $in: providerIds },
      isActive: true,
      endDate: { $gte: getStartOfVnDay() },
    })
      .select('providerId occasion type discountPercent startDate endDate createdAt')
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

  /** Tổng tiền thuê theo ngày của một sản phẩm, áp chiến dịch cho từng ngày thuê. */
  async calculateDailyRental(
    basePrice: number,
    providerId: string | Types.ObjectId,
    from: Date | string,
    to: Date | string,
  ): Promise<{ total: number; days: number }> {
    const campaign = await this.getActiveCampaign(providerId);
    return calculateDailyRentalTotal(basePrice, campaign, from, to);
  }

  /** Giá một giờ thuê vào ngày `day`: 30% giá ngày, rồi áp chiến dịch nếu ngày đó thuộc chiến dịch. */
  async calculateHourlyRate(
    basePrice: number,
    hourlyPrice: number | null | undefined,
    providerId: string | Types.ObjectId,
    day: Date | string,
  ): Promise<number> {
    const campaign = await this.getActiveCampaign(providerId);
    return applyCampaignToRate(resolveHourlyRate(basePrice, hourlyPrice), campaign, day);
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
