import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Promotion,
  PromotionDocument,
  PromotionStatus,
  DiscountType,
} from '../schemas/promotion.schema';
import {
  PromotionRedemption,
  PromotionRedemptionDocument,
  RedemptionStatus,
} from '../schemas/promotion-redemption.schema';
import { VoucherPricingService } from './voucher-pricing.service';
import { GetApplicablePromotionsDto } from '../dto/get-applicable-promotions.dto';

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
    @InjectModel(PromotionRedemption.name)
    private readonly redemptionModel: Model<PromotionRedemption>,
    private readonly voucherPricingService: VoucherPricingService,
  ) {}

  private validatePromotionRules(dto: Partial<CreatePromotionDto>): void {
    if (
      dto.discountType === DiscountType.Percentage ||
      dto.discountType === ('PERCENTAGE' as any)
    ) {
      if (dto.discountValue !== undefined) {
        if (dto.discountValue <= 0 || dto.discountValue > 100) {
          throw new BadRequestException(
            'Phần trăm giảm giá phải lớn hơn 0 và không quá 100%.',
          );
        }
      }
    }
    if (dto.startDate && dto.endDate) {
      if (new Date(dto.endDate) <= new Date(dto.startDate)) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.');
      }
    }
  }

  async createPromotion(
    providerIdStr: string | null,
    dto: CreatePromotionDto,
  ): Promise<PromotionDocument> {
    this.validatePromotionRules(dto);

    const providerId = providerIdStr ? new Types.ObjectId(providerIdStr) : null;
    const existing = await this.promotionModel.findOne({
      code: dto.code.toUpperCase().trim(),
    });
    if (existing) {
      throw new BadRequestException('Mã voucher đã tồn tại.');
    }

    return this.promotionModel.create({
      ...dto,
      code: dto.code.toUpperCase().trim(),
      providerId,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  async getAllPromotions(): Promise<PromotionDocument[]> {
    return this.promotionModel.find().sort({ createdAt: -1 });
  }

  async getProviderPromotions(
    providerIdStr: string,
  ): Promise<PromotionDocument[]> {
    const providerId = new Types.ObjectId(providerIdStr);
    return this.promotionModel.find({ providerId }).sort({ createdAt: -1 });
  }

  async findByCode(code: string): Promise<PromotionDocument | null> {
    return this.promotionModel.findOne({ code: code.toUpperCase().trim() });
  }

  async getPublicPromotions(tier?: string): Promise<any[]> {
    const now = new Date();
    const query: any = {
      status: PromotionStatus.Active,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };
    if (tier) {
      const upperTier = tier.toUpperCase();
      query.$or = [
        { requiredTiers: { $exists: false } },
        { requiredTiers: { $size: 0 } },
        { requiredTiers: upperTier },
      ];
    }
    return this.promotionModel
      .find(query)
      .sort({ discountValue: -1, createdAt: -1 })
      .limit(10)
      .lean();
  }

  async deletePromotion(
    promotionIdStr: string,
    providerIdStr?: string,
  ): Promise<void> {
    const promotionId = new Types.ObjectId(promotionIdStr);
    const existing = await this.promotionModel.findById(promotionId);
    if (!existing) {
      throw new NotFoundException('Voucher not found');
    }

    if (
      providerIdStr &&
      existing.providerId &&
      existing.providerId.toString() !== providerIdStr
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa voucher của đối tác khác.',
      );
    }

    await this.promotionModel.deleteOne({ _id: promotionId });
  }

  async updatePromotion(
    promotionIdStr: string,
    providerIdStr: string | undefined,
    dto: Partial<CreatePromotionDto>,
  ): Promise<PromotionDocument> {
    const promotionId = new Types.ObjectId(promotionIdStr);
    const existing = await this.promotionModel.findById(promotionId);
    if (!existing) {
      throw new NotFoundException('Voucher not found');
    }

    if (
      providerIdStr &&
      existing.providerId &&
      existing.providerId.toString() !== providerIdStr
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa voucher của đối tác khác.',
      );
    }

    this.validatePromotionRules(dto);

    if (dto.usageLimit !== undefined && dto.usageLimit !== null) {
      if (dto.usageLimit < (existing.usedCount || 0)) {
        throw new BadRequestException(
          `Giới hạn sử dụng (${dto.usageLimit}) không được nhỏ hơn số lượt đã dùng (${existing.usedCount}).`,
        );
      }
    }

    const updateData: Record<string, any> = { ...dto };
    delete updateData.providerId;

    if (dto.code) {
      updateData.code = dto.code.toUpperCase().trim();
    }
    if (dto.startDate) {
      updateData.startDate = new Date(dto.startDate);
    }
    if (dto.endDate) {
      updateData.endDate = new Date(dto.endDate);
    }

    const updated = await this.promotionModel.findByIdAndUpdate(
      promotionId,
      { $set: updateData },
      { new: true },
    );

    return updated!;
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

  async reserveVoucher(
    params: {
      bookingId: Types.ObjectId;
      promotionId: Types.ObjectId;
      customerId: Types.ObjectId;
      discountAmount: number;
      holdDurationMinutes?: number;
    },
    session?: ClientSession,
  ): Promise<PromotionRedemptionDocument> {
    const now = new Date();
    // 1. Atomic conditional increment of usedCount
    const promo = await this.promotionModel.findOneAndUpdate(
      {
        _id: params.promotionId,
        status: PromotionStatus.Active,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
          { usageLimit: null },
          { usageLimit: { $exists: false } },
          { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { new: true, session },
    );

    if (!promo) {
      throw new ConflictException(
        'Mã khuyến mãi đã hết lượt sử dụng hoặc không còn hiệu lực.',
      );
    }

    const singleUseKey =
      promo.usageLimitPerUser === 1
        ? `${promo._id.toString()}:${params.customerId.toString()}`
        : null;

    const expiresAt = new Date(
      Date.now() + (params.holdDurationMinutes || 15) * 60 * 1000,
    );

    try {
      const [redemption] = await this.redemptionModel.create(
        [
          {
            bookingId: params.bookingId,
            promotionId: promo._id,
            customerId: params.customerId,
            singleUseKey,
            status: RedemptionStatus.Reserved,
            discountAmount: params.discountAmount,
            expiresAt,
            reservedAt: now,
          },
        ],
        { session },
      );
      return redemption;
    } catch (err: any) {
      // Rollback usedCount if duplicate key (e.g. singleUseKey race condition)
      await this.promotionModel.updateOne(
        { _id: promo._id },
        { $inc: { usedCount: -1 } },
        { session },
      );
      if (err.code === 11000) {
        throw new ConflictException(
          'Bạn đã sử dụng hoặc đang giữ chỗ mã khuyến mãi này ở một đơn hàng khác.',
        );
      }
      throw err;
    }
  }

  async releaseVoucher(
    bookingId: Types.ObjectId | string,
    optionsOrSession?: { fullRefund?: boolean } | ClientSession,
    maybeSession?: ClientSession,
  ): Promise<PromotionRedemptionDocument | null> {
    const bookingObjId =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;

    let isFullRefund = true;
    let session: ClientSession | undefined = maybeSession;

    if (
      optionsOrSession &&
      typeof (optionsOrSession as any).startTransaction === 'function'
    ) {
      session = optionsOrSession as ClientSession;
    } else if (optionsOrSession && typeof optionsOrSession === 'object') {
      const opts = optionsOrSession as { fullRefund?: boolean };
      if (opts.fullRefund !== undefined) {
        isFullRefund = opts.fullRefund;
      }
    }

    // 1. Nếu đang ở trạng thái Reserved: luôn nhả voucher và giảm usedCount
    const reservedRedemption = await this.redemptionModel.findOneAndUpdate(
      { bookingId: bookingObjId, status: RedemptionStatus.Reserved },
      {
        $set: { status: RedemptionStatus.Released, releasedAt: new Date() },
        $unset: { singleUseKey: 1 },
      },
      { new: true, session },
    );

    if (reservedRedemption) {
      await this.promotionModel.updateOne(
        { _id: reservedRedemption.promotionId },
        { $inc: { usedCount: -1 } },
        { session },
      );
      return reservedRedemption;
    }

    // 2. Nếu đã Redeemed (đã thanh toán rồi hủy đơn):
    if (isFullRefund) {
      // Khách được hoàn tiền 100% -> Nhả lại voucher (chuyển sang Refunded, xóa singleUseKey để dùng lại, giảm usedCount)
      const redeemedRedemption = await this.redemptionModel.findOneAndUpdate(
        { bookingId: bookingObjId, status: RedemptionStatus.Redeemed },
        {
          $set: { status: RedemptionStatus.Refunded, refundedAt: new Date() },
          $unset: { singleUseKey: 1 },
        },
        { new: true, session },
      );

      if (redeemedRedemption) {
        await this.promotionModel.updateOne(
          { _id: redeemedRedemption.promotionId },
          { $inc: { usedCount: -1 } },
          { session },
        );
        return redeemedRedemption;
      }
    }

    return null;
  }

  async redeemVoucher(
    bookingId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<PromotionRedemptionDocument | null> {
    const bookingObjId =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;
    return this.redemptionModel.findOneAndUpdate(
      { bookingId: bookingObjId, status: RedemptionStatus.Reserved },
      {
        $set: { status: RedemptionStatus.Redeemed, redeemedAt: new Date() },
      },
      { new: true, session },
    );
  }

  async findRedemptionByBooking(
    bookingId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<PromotionRedemptionDocument | null> {
    const bookingObjId =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;
    return this.redemptionModel
      .findOne({ bookingId: bookingObjId })
      .session(session || null);
  }

  async getApplicablePromotions(
    dto: GetApplicablePromotionsDto,
    userContext?: { customerId?: Types.ObjectId; isNewCustomer?: boolean },
  ): Promise<{
    applicable: Array<{
      promotion: PromotionDocument;
      discountAmount: number;
      platformSubsidyAmount: number;
      finalGrandTotal: number;
      isBestDeal: boolean;
    }>;
    ineligible: Array<{
      promotion: PromotionDocument;
      reason: string;
    }>;
  }> {
    const now = new Date();
    const activePromotions = await this.promotionModel
      .find({
        status: PromotionStatus.Active,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .exec();

    const applicableList: Array<{
      promotion: PromotionDocument;
      discountAmount: number;
      platformSubsidyAmount: number;
      finalGrandTotal: number;
      isBestDeal: boolean;
    }> = [];

    const ineligibleList: Array<{
      promotion: PromotionDocument;
      reason: string;
    }> = [];

    for (const promo of activePromotions) {
      if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
        ineligibleList.push({
          promotion: promo,
          reason: 'Mã khuyến mãi đã hết lượt sử dụng',
        });
        continue;
      }

      const pricingResult = this.voucherPricingService.calculatePricing({
        bookingType:
          (dto.bookingType as 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO') ||
          'AODAI_RENTAL',
        items: dto.items.map((item, idx) => ({
          id: item.id || `item_${idx}`,
          productId: item.productId,
          photographyPackageId: item.photographyPackageId,
          providerId: item.providerId ?? '',
          itemType: item.itemType,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          depositAmount: item.depositAmount || 0,
          comboDiscountAmount: item.comboDiscountAmount || 0,
        })),
        promotion: promo,
        userContext,
        travelFee: dto.travelFee || 0,
        serviceFee: dto.serviceFee || 0,
      });

      if (pricingResult.isValid && pricingResult.voucherDiscountTotal > 0) {
        applicableList.push({
          promotion: promo,
          discountAmount: pricingResult.voucherDiscountTotal,
          platformSubsidyAmount: pricingResult.platformSubsidyAmount,
          finalGrandTotal: pricingResult.grandTotal,
          isBestDeal: false,
        });
      } else {
        ineligibleList.push({
          promotion: promo,
          reason:
            pricingResult.errorMessage ||
            'Không đủ điều kiện áp dụng cho đơn hàng này',
        });
      }
    }

    // Sort applicable promotions descending by discountAmount
    applicableList.sort((a, b) => b.discountAmount - a.discountAmount);
    if (applicableList.length > 0) {
      applicableList[0].isBestDeal = true;
    }

    return {
      applicable: applicableList,
      ineligible: ineligibleList,
    };
  }
}
