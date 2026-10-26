import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { DiscountType, PromotionStatus } from '../schemas/promotion.schema';
import { PromotionsService } from './promotions.service';

type Row = Record<string, any>;

const providerId = new Types.ObjectId();
const dto = {
  code: 'he2026',
  name: 'Hè 2026',
  discountType: DiscountType.Percentage,
  discountValue: 10,
  minOrderValue: 300000,
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-08-31T23:59:59.000Z',
  usageLimit: 50,
};

function createService() {
  const promotionModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (data: Row) => data),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
  };
  const redemptionModel = {
    create: jest.fn(async (docs: Row[]) => docs),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
  };
  const service = new PromotionsService(
    promotionModel as never,
    redemptionModel as never,
    {} as never,
  );
  return { service, promotionModel, redemptionModel };
}

describe('UC-20 Create Discount Code (HoangLVM)', () => {
  it('UT-20 UTCID06 rejects a 0% discount', async () => {
    const { service, promotionModel } = createService();

    await expect(
      service.createPromotion(providerId.toString(), {
        ...dto,
        discountValue: 0,
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'Phần trăm giảm giá phải lớn hơn 0 và không quá 100%.',
      ),
    );
    expect(promotionModel.create).not.toHaveBeenCalled();
  });

  it('UT-20 UTCID07 accepts 100% and rejects 101%', async () => {
    const { service } = createService();

    await expect(
      service.createPromotion(providerId.toString(), {
        ...dto,
        discountValue: 100,
      } as any),
    ).resolves.toMatchObject({
      discountValue: 100,
    });
    await expect(
      service.createPromotion(providerId.toString(), {
        ...dto,
        discountValue: 101,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UT-20 UTCID08 requires the end date to be after the start date', async () => {
    const { service } = createService();

    await expect(
      service.createPromotion(providerId.toString(), {
        ...dto,
        endDate: dto.startDate,
      } as any),
    ).rejects.toThrow(
      new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.'),
    );
  });

  it('UT-20 UTCID09 does not lower the usage limit below the used count', async () => {
    const { service, promotionModel } = createService();
    promotionModel.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      providerId,
      usedCount: 12,
    });

    await expect(
      service.updatePromotion(
        new Types.ObjectId().toString(),
        providerId.toString(),
        { usageLimit: 11 } as any,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Giới hạn sử dụng (11) không được nhỏ hơn số lượt đã dùng (12).',
      ),
    );
    expect(promotionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('UT-20 UTCID10 returns not found when updating a missing voucher', async () => {
    const { service, promotionModel } = createService();
    promotionModel.findById.mockResolvedValue(null);

    await expect(
      service.updatePromotion(
        new Types.ObjectId().toString(),
        providerId.toString(),
        { name: 'x' } as any,
      ),
    ).rejects.toThrow(new NotFoundException('Voucher not found'));
  });

  it('UT-20 UTCID11 lists at most 10 public vouchers available for the customer tier', async () => {
    const { service, promotionModel } = createService();
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    promotionModel.find.mockReturnValue(query);

    await service.getPublicPromotions('gold');

    const filter = promotionModel.find.mock.calls[0][0];
    expect(filter.status).toBe(PromotionStatus.Active);
    expect(filter.$or).toContainEqual({ requiredTiers: 'GOLD' });
    expect(query.sort).toHaveBeenCalledWith({
      discountValue: -1,
      createdAt: -1,
    });
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('UT-20 UTCID12 creates a platform voucher without a provider owner', async () => {
    const { service, promotionModel } = createService();

    await service.createPromotion(null, dto as any);

    expect(promotionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HE2026', providerId: null }),
    );
  });
});

describe('UC-50 Apply Voucher (HoangLVM)', () => {
  const reserveParams = () => ({
    bookingId: new Types.ObjectId(),
    promotionId: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    discountAmount: 50000,
  });

  it('UT-50 UTCID17 reserves a voucher atomically for 15 minutes', async () => {
    const { service, promotionModel, redemptionModel } = createService();
    const params = reserveParams();
    promotionModel.findOneAndUpdate.mockResolvedValue({
      _id: params.promotionId,
      usageLimitPerUser: 1,
    });

    await service.reserveVoucher(params);

    expect(promotionModel.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $inc: { usedCount: 1 },
    });
    const [redemption] = redemptionModel.create.mock.calls[0][0];
    expect(redemption).toMatchObject({
      status: 'RESERVED',
      discountAmount: 50000,
      singleUseKey: `${params.promotionId.toString()}:${params.customerId.toString()}`,
    });
    expect((redemption.expiresAt.getTime() - Date.now()) / 60_000).toBeCloseTo(
      15,
      0,
    );
  });

  it('UT-50 UTCID18 rejects a reservation when no usage is left', async () => {
    const { service, redemptionModel } = createService();

    await expect(service.reserveVoucher(reserveParams())).rejects.toThrow(
      new ConflictException(
        'Mã khuyến mãi đã hết lượt sử dụng hoặc không còn hiệu lực.',
      ),
    );
    expect(redemptionModel.create).not.toHaveBeenCalled();
  });

  it('UT-50 UTCID19 rolls back the usage count when a single-use voucher is already held', async () => {
    const { service, promotionModel, redemptionModel } = createService();
    const params = reserveParams();
    promotionModel.findOneAndUpdate.mockResolvedValue({
      _id: params.promotionId,
      usageLimitPerUser: 1,
    });
    redemptionModel.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: 11000 }),
    );

    await expect(service.reserveVoucher(params)).rejects.toThrow(
      new ConflictException(
        'Bạn đã sử dụng hoặc đang giữ chỗ mã khuyến mãi này ở một đơn hàng khác.',
      ),
    );
    expect(promotionModel.updateOne).toHaveBeenCalledWith(
      { _id: params.promotionId },
      { $inc: { usedCount: -1 } },
      { session: undefined },
    );
  });

  it('UT-50 UTCID20 releases a reserved voucher and restores one usage', async () => {
    const { service, promotionModel, redemptionModel } = createService();
    const promotionId = new Types.ObjectId();
    redemptionModel.findOneAndUpdate.mockResolvedValueOnce({
      promotionId,
      status: 'RELEASED',
    });

    await expect(
      service.releaseVoucher(new Types.ObjectId()),
    ).resolves.toMatchObject({ status: 'RELEASED' });
    expect(promotionModel.updateOne).toHaveBeenCalledWith(
      { _id: promotionId },
      { $inc: { usedCount: -1 } },
      { session: undefined },
    );
  });

  it('UT-50 UTCID21 keeps a redeemed voucher consumed when the cancellation is not fully refunded', async () => {
    const { service, promotionModel, redemptionModel } = createService();

    await expect(
      service.releaseVoucher(new Types.ObjectId(), { fullRefund: false }),
    ).resolves.toBeNull();
    expect(redemptionModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(promotionModel.updateOne).not.toHaveBeenCalled();
  });
});
