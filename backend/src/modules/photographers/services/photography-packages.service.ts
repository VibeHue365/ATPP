import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CategoriesService } from '../../categories/services/categories.service';
import { ServiceCategoryType } from '../../categories/schemas/category.schema';
import {
  PackageStatus,
  PhotographyPricingUnit,
  PhotographyPackage,
  PhotographyPackageDocument,
} from '../../products/schemas/photography-package.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../../providers/schemas/provider.schema';
import {
  CreatePhotographyPackageDto,
  UpdatePhotographyPackageDto,
} from '../dto/photography-package.dto';

@Injectable()
export class PhotographyPackagesService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(PhotographyPackage.name)
    private readonly packageModel: Model<PhotographyPackage>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async listMine(userId: string): Promise<PhotographyPackage[]> {
    const provider = await this.getProvider(userId);
    return this.packageModel
      .find({ providerId: provider._id })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async create(
    userId: string,
    dto: CreatePhotographyPackageDto,
  ): Promise<PhotographyPackageDocument> {
    const provider = await this.getProvider(userId);
    await this.validateCategoryInputs(dto);
    const serviceGroupId = dto.serviceGroupId?.trim() || randomUUID();
    const pricingUnit = dto.pricingUnit ?? PhotographyPricingUnit.PerSession;
    await this.assertUniquePricingUnit(provider._id, serviceGroupId, pricingUnit);
    const serviceAnchor = await this.findServiceAnchor(provider._id, serviceGroupId);
    const serviceName = String(serviceAnchor?.serviceName || serviceAnchor?.name || dto.serviceName || dto.name).trim();
    const planName = dto.planName?.trim() || this.defaultPlanName(pricingUnit);
    this.assertSchedulingPolicy(dto);
    if (dto.status === PackageStatus.Active) {
      this.assertCanPublish(provider);
      this.assertPackageReady(dto);
    }

    return this.packageModel.create({
      ...dto,
      serviceGroupId,
      serviceName,
      planName,
      name: `${serviceName} · ${planName}`,
      description: serviceAnchor?.description ?? dto.description,
      categoryId: serviceAnchor?.categoryId ?? (dto.categoryId ? new Types.ObjectId(dto.categoryId) : null),
      conceptCategoryIds: serviceAnchor?.conceptCategoryIds ?? this.toObjectIds(dto.conceptCategoryIds),
      styleCategoryIds: serviceAnchor?.styleCategoryIds ?? this.toObjectIds(dto.styleCategoryIds),
      eventCategoryIds: serviceAnchor?.eventCategoryIds ?? this.toObjectIds(dto.eventCategoryIds),
      providerId: provider._id,
      slug: await this.createUniqueSlug(`${serviceName}-${planName}`),
      status: dto.status ?? PackageStatus.Draft,
      images: serviceAnchor?.images ?? dto.images ?? [],
      travelFeeNotes: serviceAnchor?.travelFeeNotes ?? dto.travelFeeNotes,
      rawPhotosCount: dto.rawPhotosCount ?? 0,
      pricingUnit,
      includedDurationMinutes:
        dto.includedDurationMinutes ?? Math.round(dto.durationHours * 60),
      includedSessionCount: dto.includedSessionCount ?? null,
      includedDayCount: dto.includedDayCount ?? null,
      additionalSessionFee: dto.additionalSessionFee ?? 0,
      overtimeFeePerHour: dto.overtimeFeePerHour ?? 0,
      overtimeIncrementMinutes: dto.overtimeIncrementMinutes ?? 30,
      maxOvertimeMinutes: dto.maxOvertimeMinutes ?? 240,
      bufferBeforeMinutes: dto.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: dto.bufferAfterMinutes ?? 0,
    });
  }

  async update(
    userId: string,
    packageId: string,
    dto: UpdatePhotographyPackageDto,
  ): Promise<PhotographyPackageDocument> {
    const provider = await this.getProvider(userId);
    const photographyPackage = await this.findOwnedPackage(provider._id, packageId);
    await this.validateCategoryInputs(dto);
    const update: Record<string, unknown> = { ...dto };
    if (dto.categoryId !== undefined) {
      update.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : null;
    }
    if (dto.conceptCategoryIds !== undefined) {
      update.conceptCategoryIds = this.toObjectIds(dto.conceptCategoryIds);
    }
    if (dto.styleCategoryIds !== undefined) {
      update.styleCategoryIds = this.toObjectIds(dto.styleCategoryIds);
    }
    if (dto.eventCategoryIds !== undefined) {
      update.eventCategoryIds = this.toObjectIds(dto.eventCategoryIds);
    }
    if (
      dto.durationHours !== undefined &&
      dto.includedDurationMinutes === undefined &&
      (!photographyPackage.includedDurationMinutes ||
        photographyPackage.includedDurationMinutes ===
          Math.round(photographyPackage.durationHours * 60))
    ) {
      update.includedDurationMinutes = Math.round(dto.durationHours * 60);
    }
    const nextSchedulingPolicy = {
      ...photographyPackage.toObject(),
      ...update,
    };
    const nextServiceGroupId = String(nextSchedulingPolicy.serviceGroupId || photographyPackage._id).trim();
    const nextPricingUnit = nextSchedulingPolicy.pricingUnit ?? PhotographyPricingUnit.PerSession;
    update.serviceGroupId = nextServiceGroupId;
    update.serviceName = String(nextSchedulingPolicy.serviceName || nextSchedulingPolicy.name).trim();
    update.planName = String(nextSchedulingPolicy.planName || this.defaultPlanName(nextPricingUnit)).trim();
    await this.assertUniquePricingUnit(provider._id, nextServiceGroupId, nextPricingUnit, photographyPackage._id);
    this.assertSchedulingPolicy(nextSchedulingPolicy);
    const nextStatus = (update.status as PackageStatus | undefined) ?? photographyPackage.status;
    if (nextStatus === PackageStatus.Active) {
      this.assertCanPublish(provider);
      this.assertPackageReady({
        ...photographyPackage.toObject(),
        ...update,
        images: (update.images as string[] | undefined) ?? photographyPackage.images,
      });
    }
    if (dto.name && dto.name !== photographyPackage.name) {
      update.slug = await this.createUniqueSlug(dto.name, photographyPackage._id);
    }

    const updated = await this.packageModel.findByIdAndUpdate(
      photographyPackage._id,
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new NotFoundException('Không tìm thấy gói chụp ảnh');
    }
    if (updated.serviceGroupId) {
      await this.packageModel.updateMany(
        { providerId: provider._id, serviceGroupId: updated.serviceGroupId, _id: { $ne: updated._id } },
        {
          $set: {
            serviceName: updated.serviceName,
            description: updated.description,
            categoryId: updated.categoryId,
            conceptCategoryIds: updated.conceptCategoryIds,
            styleCategoryIds: updated.styleCategoryIds,
            eventCategoryIds: updated.eventCategoryIds,
            images: updated.images,
            travelFeeNotes: updated.travelFeeNotes,
          },
        },
      );
    }
    return updated;
  }

  async publish(userId: string, packageId: string): Promise<PhotographyPackageDocument> {
    return this.update(userId, packageId, { status: PackageStatus.Active });
  }

  async unpublish(userId: string, packageId: string): Promise<PhotographyPackageDocument> {
    return this.update(userId, packageId, { status: PackageStatus.Inactive });
  }

  private assertSchedulingPolicy(input: {
    durationHours?: number;
    includedDurationMinutes?: number | null;
    overtimeIncrementMinutes?: number;
    maxOvertimeMinutes?: number;
  }): void {
    const durationHours = Number(input.durationHours);
    const includedDurationMinutes = input.includedDurationMinutes ??
      Math.round(durationHours * 60);
    const overtimeIncrementMinutes = input.overtimeIncrementMinutes ?? 30;
    const maxOvertimeMinutes = input.maxOvertimeMinutes ?? 240;

    if (!Number.isFinite(includedDurationMinutes) || includedDurationMinutes < 30) {
      throw new BadRequestException('Thời lượng bao gồm phải từ 30 phút trở lên.');
    }
    if (!Number.isInteger(overtimeIncrementMinutes) || overtimeIncrementMinutes < 30) {
      throw new BadRequestException('Bước tăng giờ phải là số phút nguyên, từ 30 phút trở lên.');
    }
    if (includedDurationMinutes % overtimeIncrementMinutes !== 0) {
      throw new BadRequestException('Thời lượng bao gồm phải chia hết cho bước tăng giờ.');
    }
    if (!Number.isInteger(maxOvertimeMinutes) || maxOvertimeMinutes < 0) {
      throw new BadRequestException('Giới hạn tăng giờ không hợp lệ.');
    }
    if (maxOvertimeMinutes % overtimeIncrementMinutes !== 0) {
      throw new BadRequestException('Giới hạn tăng giờ phải chia hết cho bước tăng giờ.');
    }
  }
  private async findServiceAnchor(
    providerId: Types.ObjectId,
    serviceGroupId: string,
  ): Promise<PhotographyPackageDocument | null> {
    const groupConditions: Record<string, unknown>[] = [{ serviceGroupId }];
    if (Types.ObjectId.isValid(serviceGroupId)) {
      groupConditions.push({ _id: new Types.ObjectId(serviceGroupId) });
    }
    return this.packageModel.findOne({ providerId, $or: groupConditions });
  }

  private async assertUniquePricingUnit(
    providerId: Types.ObjectId,
    serviceGroupId: string,
    pricingUnit: PhotographyPricingUnit,
    excludeId?: Types.ObjectId,
  ): Promise<void> {
    const groupConditions: Record<string, unknown>[] = [{ serviceGroupId }];
    if (Types.ObjectId.isValid(serviceGroupId)) {
      groupConditions.push({ _id: new Types.ObjectId(serviceGroupId) });
    }
    const existing = await this.packageModel.exists({
      providerId,
      pricingUnit,
      $or: groupConditions,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (existing) {
      throw new BadRequestException('Dịch vụ này đã có một gói với cùng cách tính giá.');
    }
  }

  private defaultPlanName(pricingUnit: PhotographyPricingUnit): string {
    if (pricingUnit === PhotographyPricingUnit.PerDay) return 'Gói theo ngày';
    if (pricingUnit === PhotographyPricingUnit.PerBooking) return 'Gói trọn booking';
    return 'Gói theo buổi';
  }

  private async validateCategoryInputs(input: {
    categoryId?: string | null;
    conceptCategoryIds?: string[];
    styleCategoryIds?: string[];
    eventCategoryIds?: string[];
  }): Promise<void> {
    if (input.categoryId) {
      await this.categoriesService.assertActiveCategory(
        input.categoryId,
        ServiceCategoryType.PhotographyCategory,
      );
    }
    await this.categoriesService.assertActiveCategories(
      input.conceptCategoryIds ?? [],
      ServiceCategoryType.Concept,
    );
    await this.categoriesService.assertActiveCategories(
      input.styleCategoryIds ?? [],
      ServiceCategoryType.Style,
    );
    await this.categoriesService.assertActiveCategories(
      input.eventCategoryIds ?? [],
      ServiceCategoryType.Event,
    );
  }

  private toObjectIds(ids?: string[]): Types.ObjectId[] {
    return (ids ?? []).map((id) => new Types.ObjectId(id));
  }
  private async getProvider(userId: string): Promise<Provider & { _id: Types.ObjectId }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Không tìm thấy hồ sơ đối tác');
    }
    const provider = await this.providerModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy hồ sơ đối tác');
    }
    return provider as Provider & { _id: Types.ObjectId };
  }

  private async findOwnedPackage(
    providerId: Types.ObjectId,
    packageId: string,
  ): Promise<PhotographyPackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new NotFoundException('ID gói chụp ảnh không hợp lệ');
    }
    const photographyPackage = await this.packageModel.findOne({
      _id: new Types.ObjectId(packageId),
      providerId,
    });
    if (!photographyPackage) {
      throw new NotFoundException('Không tìm thấy gói chụp ảnh');
    }
    return photographyPackage;
  }

  private assertPackageReady(photographyPackage: {
    images?: string[];
    price?: number;
    pricingUnit?: PhotographyPricingUnit;
    includedSessionCount?: number | null;
    includedDayCount?: number | null;
  }): void {
    if (!photographyPackage.images?.length) {
      throw new BadRequestException(
        'Thêm ít nhất một ảnh minh họa trước khi đăng bán gói chụp ảnh',
      );
    }
    if (!Number.isFinite(photographyPackage.price) || Number(photographyPackage.price) <= 0) {
      throw new BadRequestException('Giá gói phải lớn hơn 0 trước khi đăng bán.');
    }

    const pricingUnit =
      photographyPackage.pricingUnit ?? PhotographyPricingUnit.PerSession;
    if (pricingUnit === PhotographyPricingUnit.PerBooking) {
      if (
        !Number.isInteger(photographyPackage.includedSessionCount) ||
        Number(photographyPackage.includedSessionCount) < 1
      ) {
        throw new BadRequestException('Gói trọn booking phải bao gồm ít nhất 1 buổi chụp.');
      }
      if (
        !Number.isInteger(photographyPackage.includedDayCount) ||
        Number(photographyPackage.includedDayCount) < 1
      ) {
        throw new BadRequestException('Gói trọn booking phải bao gồm ít nhất 1 ngày chụp.');
      }
      if (
        Number(photographyPackage.includedSessionCount) <
        Number(photographyPackage.includedDayCount)
      ) {
        throw new BadRequestException('Số buổi bao gồm không thể ít hơn số ngày bao gồm.');
      }
    }
  }
  private assertCanPublish(provider: Provider): void {
    if (provider.status !== ProviderStatus.Active) {
      throw new ForbiddenException('Chỉ đối tác đang hoạt động mới có thể đăng bán gói chụp ảnh');
    }
    if (!provider.capabilities.includes(ProviderCapability.Photography)) {
      throw new ForbiddenException('Hồ sơ đối tác chưa được phê duyệt dịch vụ chụp ảnh');
    }
  }

  private async createUniqueSlug(name: string, excludeId?: Types.ObjectId): Promise<string> {
    const base = this.slugify(name) || 'goi-chup-anh';
    let candidate = base;
    let suffix = 2;
    while (
      await this.packageModel.exists({
        slug: candidate,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }
}
