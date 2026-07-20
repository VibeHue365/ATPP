import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ComboPromotion,
  ComboPromotionDocument,
  ComboPromotionStatus,
} from '../schemas/combo-promotion.schema';
import { Product } from '../schemas/product.schema';
import { PhotographyPackage } from '../schemas/photography-package.schema';

export class CreateComboPromotionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  photographyPackageId: string;

  @IsNumber()
  @Type(() => Number)
  discountPercent: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  comboPrice?: number;

  @IsString()
  @IsNotEmpty()
  validFrom: string;

  @IsString()
  @IsNotEmpty()
  validTo: string;

  @IsString()
  @IsOptional()
  shootDate?: string;

  @IsString()
  @IsOptional()
  shootTimeSlot?: string;

  @IsNumber()
  @Type(() => Number)
  maxUsage: number;

  @IsNumber()
  @Type(() => Number)
  aoDaiQuantity: number;

  @IsNumber()
  @Type(() => Number)
  shootPeopleCount: number;

  @IsString()
  @IsOptional()
  image?: string;
}

export class UpdateComboPromotionDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  photographyPackageId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discountPercent?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  comboPrice?: number;

  @IsString()
  @IsOptional()
  validFrom?: string;

  @IsString()
  @IsOptional()
  validTo?: string;

  @IsString()
  @IsOptional()
  shootDate?: string;

  @IsString()
  @IsOptional()
  shootTimeSlot?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxUsage?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  aoDaiQuantity?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  shootPeopleCount?: number;

  @IsString()
  @IsOptional()
  status?: ComboPromotionStatus;

  @IsString()
  @IsOptional()
  image?: string;
}

@Injectable()
export class ComboPromotionService {
  constructor(
    @InjectModel(ComboPromotion.name)
    private readonly comboModel: Model<ComboPromotion>,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
  ) {}

  async create(
    providerIdStr: string,
    dto: CreateComboPromotionDto,
  ): Promise<ComboPromotionDocument> {
    const providerId = new Types.ObjectId(providerIdStr);

    // Validate product belongs to provider
    const product = await this.productModel.findById(dto.productId);
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm áo dài');
    }
    if (product.providerId.toString() !== providerIdStr) {
      throw new BadRequestException('Sản phẩm không thuộc cửa hàng của bạn');
    }

    // Validate package belongs to provider
    const pkg = await this.packageModel.findById(dto.photographyPackageId);
    if (!pkg) {
      throw new NotFoundException('Không tìm thấy gói chụp ảnh');
    }
    if (pkg.providerId.toString() !== providerIdStr) {
      throw new BadRequestException('Gói chụp ảnh không thuộc cửa hàng của bạn');
    }

    if (dto.discountPercent < 1 || dto.discountPercent > 80) {
      throw new BadRequestException('Phần trăm giảm giá phải từ 1% đến 80%');
    }

    const validFromDate = new Date(dto.validFrom);
    const validToDate = new Date(dto.validTo);
    const shootDateObj = dto.shootDate ? new Date(dto.shootDate) : null;

    return this.comboModel.create({
      providerId,
      name: dto.name,
      description: dto.description || null,
      productId: new Types.ObjectId(dto.productId),
      photographyPackageId: new Types.ObjectId(dto.photographyPackageId),
      discountPercent: dto.discountPercent,
      comboPrice: dto.comboPrice || null,
      validFrom: validFromDate,
      validTo: validToDate,
      shootDate: shootDateObj,
      shootTimeSlot: dto.shootTimeSlot || null,
      maxUsage: dto.maxUsage,
      aoDaiQuantity: dto.aoDaiQuantity || 1,
      shootPeopleCount: dto.shootPeopleCount || 1,
      usedCount: 0,
      status: ComboPromotionStatus.Active,
      image: dto.image || null,
    });
  }

  async findByProvider(providerIdStr: string): Promise<ComboPromotionDocument[]> {
    const providerId = new Types.ObjectId(providerIdStr);
    return this.comboModel
      .find({ providerId })
      .populate('productId', 'name images basePrice slug')
      .populate('photographyPackageId', 'name images price durationHours slug')
      .sort({ createdAt: -1 });
  }

  async findActivePublic(): Promise<ComboPromotionDocument[]> {
    const now = new Date();
    // Bắt đầu từ 00:00 của ngày hôm nay để không bị ẩn quá sớm trong ngày
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.comboModel
      .find({
        status: ComboPromotionStatus.Active,
        validTo: { $gte: todayStart },
      })
      .populate('productId', 'name images basePrice slug depositAmount')
      .populate('photographyPackageId', 'name images price durationHours slug editedPhotosCount maxPeople')
      .populate('providerId', 'businessName address rating')
      .sort({ discountPercent: -1, createdAt: -1 })
      .limit(12);
  }

  async findById(id: string): Promise<ComboPromotionDocument> {
    const combo = await this.comboModel
      .findById(id)
      .populate('productId', 'name images basePrice slug depositAmount sizes colors materials')
      .populate('photographyPackageId', 'name images price durationHours slug editedPhotosCount deliveryDays maxPeople')
      .populate('providerId', 'businessName address rating contact');
    if (!combo) {
      throw new NotFoundException('Không tìm thấy combo');
    }
    return combo;
  }

  async update(
    id: string,
    providerIdStr: string,
    dto: UpdateComboPromotionDto,
  ): Promise<ComboPromotionDocument> {
    const combo = await this.comboModel.findById(id);
    if (!combo) {
      throw new NotFoundException('Không tìm thấy combo');
    }
    if (combo.providerId.toString() !== providerIdStr) {
      throw new BadRequestException('Combo này không thuộc cửa hàng của bạn');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.discountPercent !== undefined) {
      if (dto.discountPercent < 1 || dto.discountPercent > 80) {
        throw new BadRequestException('Phần trăm giảm giá phải từ 1% đến 80%');
      }
      updateData.discountPercent = dto.discountPercent;
    }
    if (dto.comboPrice !== undefined) updateData.comboPrice = dto.comboPrice;
    if (dto.validFrom !== undefined) updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) updateData.validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (dto.shootDate !== undefined) updateData.shootDate = dto.shootDate ? new Date(dto.shootDate) : null;
    if (dto.shootTimeSlot !== undefined) updateData.shootTimeSlot = dto.shootTimeSlot;
    if (dto.maxUsage !== undefined) updateData.maxUsage = dto.maxUsage;
    if (dto.aoDaiQuantity !== undefined) updateData.aoDaiQuantity = dto.aoDaiQuantity;
    if (dto.shootPeopleCount !== undefined) updateData.shootPeopleCount = dto.shootPeopleCount;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.image !== undefined) updateData.image = dto.image;

    const updated = await this.comboModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('productId', 'name images basePrice slug')
      .populate('photographyPackageId', 'name images price durationHours slug');
    if (!updated) {
      throw new NotFoundException('Không tìm thấy combo');
    }
    return updated;
  }

  async delete(id: string, providerIdStr: string): Promise<void> {
    const combo = await this.comboModel.findById(id);
    if (!combo) {
      throw new NotFoundException('Không tìm thấy combo');
    }
    if (combo.providerId.toString() !== providerIdStr) {
      throw new BadRequestException('Combo này không thuộc cửa hàng của bạn');
    }
    await this.comboModel.findByIdAndDelete(id);
  }
}
