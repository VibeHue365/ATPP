import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DiscountType, PromotionStatus } from '../schemas/promotion.schema';
import { PromotionsService } from './promotions.service';

describe('PromotionsService', () => {
  const providerId = new Types.ObjectId();
  const promotionId = new Types.ObjectId();
  const dto = {
    code: 'tet2026',
    name: 'Tết 2026',
    discountType: DiscountType.Percentage,
    discountValue: 10,
    minOrderValue: 500000,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
    usageLimit: 20,
  };

  function create() {
    const model = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      deleteOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn(),
    };
    return {
      service: new PromotionsService(model as never, {} as never, {} as never),
      model,
    };
  }

  it('creates an uppercase active provider voucher', async () => {
    const { service, model } = create();
    model.findOne.mockResolvedValue(null);
    model.create.mockResolvedValue({ _id: promotionId });
    await service.createPromotion(providerId.toString(), dto);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TET2026',
        providerId,
        status: PromotionStatus.Active,
        usedCount: 0,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      }),
    );
  });

  it('rejects duplicate voucher codes case-insensitively', async () => {
    const { service, model } = create();
    model.findOne.mockResolvedValue({ _id: promotionId });
    await expect(service.createPromotion(null, dto)).rejects.toThrow(
      'Mã voucher đã tồn tại.',
    );
    expect(model.findOne).toHaveBeenCalledWith({ code: 'TET2026' });
  });

  it('updates normalized code and date fields only for the owner', async () => {
    const { service, model } = create();
    const updated = { _id: promotionId, code: 'NEWCODE' };
    model.findById.mockResolvedValue({ _id: promotionId, providerId, usedCount: 0 });
    model.findByIdAndUpdate.mockResolvedValue(updated);
    await expect(
      service.updatePromotion(promotionId.toString(), providerId.toString(), {
        code: 'newcode',
        startDate: '2026-02-01T00:00:00.000Z',
      }),
    ).resolves.toBe(updated);
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      promotionId,
      {
        $set: {
          code: 'NEWCODE',
          startDate: new Date('2026-02-01T00:00:00.000Z'),
        },
      },
      { new: true },
    );
  });

  it('rejects update or deletion outside provider ownership', async () => {
    const { service, model } = create();
    model.findById.mockResolvedValue({
      _id: promotionId,
      providerId: new Types.ObjectId(),
      usedCount: 0,
    });
    await expect(
      service.updatePromotion(promotionId.toString(), providerId.toString(), {
        name: 'No',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deletePromotion(promotionId.toString(), providerId.toString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(model.deleteOne).not.toHaveBeenCalled();

    model.findById.mockResolvedValue(null);
    await expect(
      service.deletePromotion(promotionId.toString(), providerId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  function validPromotion(overrides: Record<string, unknown> = {}) {
    return {
      _id: promotionId,
      status: PromotionStatus.Active,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      usageLimit: 10,
      usedCount: 0,
      minOrderValue: 100000,
      providerId: null,
      ...overrides,
    };
  }

  it('returns a valid platform voucher', async () => {
    const { service, model } = create();
    const promotion = validPromotion();
    model.findOne.mockResolvedValue(promotion);
    await expect(
      service.validatePromotion('tet2026', 200000, []),
    ).resolves.toBe(promotion);
  });

  it.each([
    [null, 'Voucher code not found'],
    [
      validPromotion({ status: PromotionStatus.Inactive }),
      'Voucher is inactive',
    ],
    [
      validPromotion({ startDate: new Date(Date.now() + 60_000) }),
      'Voucher is not active yet',
    ],
    [
      validPromotion({ endDate: new Date(Date.now() - 60_000) }),
      'Voucher has expired',
    ],
    [validPromotion({ usedCount: 10 }), 'Voucher usage limit reached'],
    [validPromotion({ minOrderValue: 300000 }), 'Order value must be at least'],
  ])('rejects invalid promotion state', async (promotion, message) => {
    const { service, model } = create();
    model.findOne.mockResolvedValue(promotion);
    await expect(service.validatePromotion('code', 200000, [])).rejects.toThrow(
      message,
    );
  });

  it('enforces provider-specific voucher scope', async () => {
    const { service, model } = create();
    model.findOne.mockResolvedValue(validPromotion({ providerId }));
    await expect(
      service.validatePromotion('code', 200000, [
        new Types.ObjectId().toString(),
      ]),
    ).rejects.toThrow('not applicable');
    await expect(
      service.validatePromotion('code', 200000, [providerId.toString()]),
    ).resolves.toBeDefined();
  });

  it('increments usage atomically', async () => {
    const { service, model } = create();
    model.updateOne.mockResolvedValue(undefined);
    await service.incrementUsage(promotionId);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: promotionId },
      { $inc: { usedCount: 1 } },
    );
  });
});
