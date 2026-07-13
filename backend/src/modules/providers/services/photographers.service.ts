import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider, ProviderCapability, ProviderDocument, ProviderStatus } from '../schemas/provider.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { PortfolioItem } from '../schemas/portfolio-item.schema';
import { ProductModerationStatus } from '../../products/schemas/product.schema';

@Injectable()
export class PhotographersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name) private readonly packageModel: Model<PhotographyPackage>,
    @InjectModel(PortfolioItem.name) private readonly portfolioItemModel: Model<PortfolioItem>,
  ) {}

  async findAll(): Promise<any[]> {
    // Tìm tất cả các providers có khả năng chụp ảnh (capabilities chứa PHOTOGRAPHY) và được duyệt (APPROVED)
    const photographers = await this.providerModel.find({
      capabilities: ProviderCapability.Photography,
      status: ProviderStatus.Active,
    }).exec();

    // Với mỗi thợ chụp, lấy kèm các gói dịch vụ của họ để tối ưu lượng truy vấn ở FE
    const result = [];
    for (const photographer of photographers) {
      const packages = await this.packageModel.find({
        providerId: photographer._id,
      }).exec();
      result.push(await this.toPublicPhotographer(photographer, packages));
    }
    return result;
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('ID nhiếp ảnh gia không hợp lệ');
    }
    const photographer = await this.providerModel.findById(id).exec();
    if (!photographer) {
      throw new NotFoundException(`Không tìm thấy nhiếp ảnh gia với ID: ${id}`);
    }

    const packages = await this.packageModel.find({
      providerId: photographer._id,
    }).exec();

    return this.toPublicPhotographer(photographer, packages);
  }

  async findPackages(providerId: string): Promise<PhotographyPackage[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw new NotFoundException('ID nhà cung cấp không hợp lệ');
    }
    return this.packageModel.find({
      providerId: new Types.ObjectId(providerId),
    }).exec();
  }

  private async toPublicPhotographer(
    photographer: ProviderDocument,
    packages: PhotographyPackage[],
  ): Promise<Record<string, unknown>> {
    const portfolioItems = await this.portfolioItemModel.find({
      providerId: photographer._id,
      moderationStatus: ProductModerationStatus.Approved,
    }).sort({ updatedAt: -1 }).lean();
    const provider = photographer.toObject();
    const media = { ...provider.media, images: [] };

    return { ...provider, media, portfolioItems, packages };
  }
}
