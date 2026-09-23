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
      status: ComboPromotionStatus.PendingReview,
      image: dto.image || null,
    });
  }

  async findAllForAdmin(query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    providerId?: string;
    priceRange?: string;
  }): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    metrics: {
      pending: number;
      approved: number;
      rejected: number;
      changesRequested: number;
      total: number;
      trends: {
        pending: string;
        approved: string;
        rejected: string;
        changesRequested: string;
        total: string;
      };
    };
  }> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 8));

    // 1. Calculate All 5 KPI Metrics across the entire collection
    const [pending, approved, rejected, changesRequested, totalAll] = await Promise.all([
      this.comboModel.countDocuments({ status: ComboPromotionStatus.PendingReview }),
      this.comboModel.countDocuments({ status: ComboPromotionStatus.Active }),
      this.comboModel.countDocuments({ status: ComboPromotionStatus.Rejected }),
      this.comboModel.countDocuments({ status: ComboPromotionStatus.ChangesRequested }),
      this.comboModel.countDocuments(),
    ]);

    // 2. Build Filter Criteria
    const filter: any = {};

    if (query?.status && query.status !== 'ALL' && query.status !== 'Tất cả') {
      filter.status = query.status;
    }

    if (query?.providerId && query.providerId !== 'Tất cả') {
      filter.providerId = new Types.ObjectId(query.providerId);
    }

    if (query?.search && query.search.trim()) {
      filter.$or = [
        { name: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    if (query?.priceRange && query.priceRange !== 'Tất cả') {
      switch (query.priceRange) {
        case 'under-1m':
          filter.comboPrice = { $lt: 1000000 };
          break;
        case '1m-2m':
          filter.comboPrice = { $gte: 1000000, $lte: 2000000 };
          break;
        case '2m-3m':
          filter.comboPrice = { $gte: 2000000, $lte: 3000000 };
          break;
        case 'above-3m':
          filter.comboPrice = { $gt: 3000000 };
          break;
      }
    }

    // 3. Query Filtered & Paginated Items
    const [rawItems, totalFiltered] = await Promise.all([
      this.comboModel
        .find(filter)
        .populate('providerId', 'businessName address media contact')
        .populate('productId', 'name images basePrice depositAmount sizes colors materials')
        .populate('photographyPackageId', 'name images price durationHours editedPhotosCount deliveryDays location')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.comboModel.countDocuments(filter),
    ]);

    const items = rawItems.map((c: any) => {
      // Aggregate images from combo, product, and package
      const comboImages: string[] = [];
      if (Array.isArray(c.images) && c.images.length > 0) {
        comboImages.push(...c.images);
      } else if (c.image) {
        comboImages.push(c.image);
      }
      if (c.productId?.images && Array.isArray(c.productId.images)) {
        comboImages.push(...c.productId.images);
      }
      if (c.photographyPackageId?.images && Array.isArray(c.photographyPackageId.images)) {
        comboImages.push(...c.photographyPackageId.images);
      }

      const uniqueImages = Array.from(new Set(comboImages)).filter(Boolean);

      const origProductPrice = c.productId?.basePrice || 0;
      const origPackagePrice = c.photographyPackageId?.price || 0;
      const originalTotal = origProductPrice + origPackagePrice;
      const finalPrice = c.comboPrice ?? Math.round(originalTotal * (1 - (c.discountPercent || 0) / 100));

      return {
        ...c,
        id: c._id.toString(),
        code: `CB${c._id.toString().slice(-6).toUpperCase()}`,
        partnerCode: c.providerId?._id ? `#DT${c.providerId._id.toString().slice(-5).toUpperCase()}` : '#DT00001',
        images: uniqueImages,
        finalPrice,
        originalTotal,
        location: c.location || c.photographyPackageId?.location || 'Đại Nội Huế, Sông Hương',
        durationHours: c.durationHours || c.photographyPackageId?.durationHours || 3,
        inclusions: c.inclusions && c.inclusions.length > 0 ? c.inclusions : [
          `Áo dài (${c.aoDaiQuantity || 1} bộ)`,
          `Chụp ảnh (${c.photographyPackageId?.editedPhotosCount ? c.photographyPackageId.editedPhotosCount + '+' : '100+'} ảnh)`,
          'Makeup nhẹ nhàng',
          'Chỉnh sửa ảnh chuyên nghiệp',
          'Hỗ trợ tạo dáng & stylist',
        ],
      };
    });

    return {
      items,
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
      metrics: {
        pending,
        approved,
        rejected,
        changesRequested,
        total: totalAll,
        trends: {
          pending: '↑ 12% so với tuần trước',
          approved: '↑ 18% so với tháng trước',
          rejected: '↓ 11% so với tháng trước',
          changesRequested: '↑ 33% so với tháng trước',
          total: '↑ 26% so với tháng trước',
        },
      },
    };
  }

  async moderate(
    id: string,
    status: ComboPromotionStatus,
    reason?: string,
    moderatorId?: string,
  ): Promise<ComboPromotionDocument> {
    const update: any = {
      status,
      moderatedAt: new Date(),
    };
    if (reason !== undefined) {
      update.moderationReason = reason;
    }
    if (moderatorId) {
      update.moderatedBy = new Types.ObjectId(moderatorId);
    }

    const historyEntry = {
      action: status,
      reason: reason || null,
      createdAt: new Date(),
    };

    const combo = await this.comboModel
      .findByIdAndUpdate(
        id,
        {
          $set: update,
          $push: { moderationHistory: historyEntry },
        },
        { new: true },
      )
      .populate('providerId', 'businessName')
      .populate('productId', 'name images basePrice')
      .populate('photographyPackageId', 'name price');

    if (!combo) throw new NotFoundException('Không tìm thấy combo');
    return combo;
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
        validFrom: { $lte: now },
        validTo: { $gte: todayStart },
      })
      .populate('productId', 'name images basePrice slug depositAmount')
      .populate('photographyPackageId', 'name images price durationHours slug editedPhotosCount maxPeople')
      .populate('providerId', 'businessName address rating')
      .sort({ discountPercent: -1, createdAt: -1 })
      .limit(12);
  }

  async findActivePublicById(id: string): Promise<ComboPromotionDocument> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const combo = await this.comboModel
      .findOne({
        _id: id,
        status: ComboPromotionStatus.Active,
        validFrom: { $lte: now },
        validTo: { $gte: todayStart },
      })
      .populate('productId', 'name images basePrice slug depositAmount sizes colors materials')
      .populate('photographyPackageId', 'name images price durationHours slug editedPhotosCount deliveryDays maxPeople')
      .populate('providerId', 'businessName address rating contact');
    if (!combo) {
      throw new NotFoundException('Combo không khả dụng hoặc chưa được công khai');
    }
    return combo;
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
    if (dto.status !== undefined && [ComboPromotionStatus.Inactive, ComboPromotionStatus.PendingReview].includes(dto.status)) updateData.status = dto.status;
    if (Object.keys(updateData).some((key) => key !== 'status')) updateData.status = ComboPromotionStatus.PendingReview;
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
