import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Provider,
  ProviderCapability,
  ProviderDocument,
  ProviderStatus,
} from '../schemas/provider.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import {
  ProviderSchedule,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';
import { PortfolioItem } from '../schemas/portfolio-item.schema';
import { ProductModerationStatus } from '../../products/schemas/product.schema';
import { SmartTagPublicProjectionService } from '../../smart-tagging/services/smart-tag-public-projection.service';

@Injectable()
export class PhotographersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(PortfolioItem.name)
    private readonly portfolioItemModel: Model<PortfolioItem>,
    @InjectModel(ProviderSchedule.name)
    private readonly providerScheduleModel: Model<ProviderSchedule>,
    private readonly smartTagPublicProjectionService: SmartTagPublicProjectionService,
  ) {}

  async findAll(): Promise<any[]> {
    // TÃ¬m táº¥t cáº£ cÃ¡c providers cÃ³ kháº£ nÄƒng chá»¥p áº£nh (capabilities chá»©a PHOTOGRAPHY) vÃ  Ä‘Æ°á»£c duyá»‡t (APPROVED)
    const photographers = await this.providerModel
      .find({
        capabilities: ProviderCapability.Photography,
        status: ProviderStatus.Active,
      })
      .exec();

    // Vá»›i má»—i thá»£ chá»¥p, láº¥y kÃ¨m cÃ¡c gÃ³i dá»‹ch vá»¥ cá»§a há» Ä‘á»ƒ tá»‘i Æ°u lÆ°á»£ng truy váº¥n á»Ÿ FE
    const result = [];
    for (const photographer of photographers) {
      const packages = await this.packageModel
        .find({
          providerId: photographer._id,
        })
        .exec();
      result.push(await this.toPublicPhotographer(photographer, packages));
    }
    return result;
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('ID nhiáº¿p áº£nh gia khÃ´ng há»£p lá»‡');
    }
    const photographer = await this.providerModel.findById(id).exec();
    if (!photographer) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y nhiáº¿p áº£nh gia vá»›i ID: ${id}`);
    }

    const packages = await this.packageModel
      .find({
        providerId: photographer._id,
      })
      .exec();

    return this.toPublicPhotographer(photographer, packages);
  }

  async findPackages(providerId: string): Promise<PhotographyPackage[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw new NotFoundException('ID nhÃ  cung cáº¥p khÃ´ng há»£p lá»‡');
    }
    return this.packageModel
      .find({
        providerId: new Types.ObjectId(providerId),
      })
      .exec();
  }

  async findAvailability(providerId: string, date: string): Promise<{
    date: string;
    timeRanges: Array<{ start: string; end: string }>;
  }> {
    if (!Types.ObjectId.isValid(providerId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new NotFoundException('Thông tin lịch làm việc không hợp lệ');
    }

    const photographer = await this.providerModel.findOne({
      _id: new Types.ObjectId(providerId),
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    });
    if (!photographer) {
      throw new NotFoundException('Không tìm thấy nhiếp ảnh gia đang hoạt động');
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      throw new NotFoundException('Thông tin lịch làm việc không hợp lệ');
    }

    const specificSchedule = await this.providerScheduleModel.findOne({
      providerId: photographer._id,
      scheduleType: ScheduleType.SpecificDate,
      specificDate: selectedDate,
    });
    const isOffDay = specificSchedule?.offDays.some(
      (offDay: Date) => offDay.toISOString().slice(0, 10) === date,
    );
    if (isOffDay) {
      return { date, timeRanges: [] };
    }

    if (specificSchedule?.customSlots.length) {
      return {
        date,
        timeRanges: specificSchedule.customSlots
          .filter((slot: { timeSlot: string; status: string }) => slot.status === 'AVAILABLE')
          .map((slot: { timeSlot: string; status: string }) => {
            const [start, end] = slot.timeSlot.split('-').map((value: string) => value.trim());
            return { start, end };
          })
          .filter((slot: { start: string; end: string }) => slot.start && slot.end),
      };
    }

    const recurringSchedule = await this.providerScheduleModel.findOne({
      providerId: photographer._id,
      scheduleType: ScheduleType.Recurring,
      dayOfWeek: selectedDate.getDay(),
    });

    return {
      date,
      timeRanges: recurringSchedule?.workingHours || [],
    };
  }
  private async toPublicPhotographer(
    photographer: ProviderDocument,
    packages: PhotographyPackage[],
  ): Promise<Record<string, unknown>> {
    const portfolioItems = await this.portfolioItemModel
      .find({
        providerId: photographer._id,
        moderationStatus: ProductModerationStatus.Approved,
      })
      .sort({ updatedAt: -1 })
      .lean();
    const provider = photographer.toObject();
    const media = { ...provider.media, images: provider.media?.images || [] };
    const badgeMap =
      await this.smartTagPublicProjectionService.projectPortfolioBadges(
        portfolioItems,
      );
    const publicPortfolioItems = portfolioItems.map((item) => ({
      ...item,
      badges: badgeMap.get(item._id.toString()) || [],
    }));

    return {
      ...provider,
      media,
      portfolioItems: publicPortfolioItems,
      packages,
    };
  }
}
