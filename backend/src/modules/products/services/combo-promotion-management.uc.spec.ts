import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ComboPromotionStatus } from '../schemas/combo-promotion.schema';
import { ComboPromotionService } from './combo-promotion.service';

type Row = Record<string, any>;

describe('UC-28 Smart Combo Recommendation - combo management (DaiBLL)', () => {
  const providerId = new Types.ObjectId().toString();
  const otherProviderId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId().toString();
  const packageId = new Types.ObjectId().toString();
  const comboId = new Types.ObjectId().toString();

  function populated(result: unknown) {
    const query: Record<string, jest.Mock> = {};
    query.populate = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockResolvedValue(result);
    query.then = jest.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
    );
    return query;
  }

  function createService(
    options: {
      product?: Row | null;
      pkg?: Row | null;
      combo?: Row | null;
    } = {},
  ) {
    const comboModel = {
      create: jest
        .fn()
        .mockImplementation(async (data: Row) => ({ _id: comboId, ...data })),
      findById: jest
        .fn()
        .mockResolvedValue(
          options.combo === undefined ? { providerId } : options.combo,
        ),
      findByIdAndUpdate: jest
        .fn()
        .mockImplementation((_id: string, data: Row) =>
          populated({ _id: comboId, ...data }),
        ),
      findByIdAndDelete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue(populated([])),
    };
    const productModel = {
      findById: jest
        .fn()
        .mockResolvedValue(
          options.product === undefined ? { providerId } : options.product,
        ),
    };
    const packageModel = {
      findById: jest
        .fn()
        .mockResolvedValue(
          options.pkg === undefined ? { providerId } : options.pkg,
        ),
    };
    const service = new ComboPromotionService(
      comboModel as any,
      productModel as any,
      packageModel as any,
    );
    return { service, comboModel };
  }

  function createDto(overrides: Row = {}): any {
    return {
      name: 'Combo Hue',
      productId,
      photographyPackageId: packageId,
      discountPercent: 15,
      validFrom: '2026-11-01',
      validTo: '2026-12-31',
      maxUsage: 20,
      ...overrides,
    };
  }

  it('UT-28 UTCID06 rejects a combo whose Ao Dai product does not exist', async () => {
    const { service, comboModel } = createService({ product: null });

    await expect(service.create(providerId, createDto())).rejects.toThrow(
      new NotFoundException('Không tìm thấy sản phẩm áo dài'),
    );
    expect(comboModel.create).not.toHaveBeenCalled();
  });

  it('UT-28 UTCID07 rejects a combo that uses another shop Ao Dai product', async () => {
    const { service } = createService({
      product: { providerId: otherProviderId },
    });

    await expect(service.create(providerId, createDto())).rejects.toThrow(
      new BadRequestException('Sản phẩm không thuộc cửa hàng của bạn'),
    );
  });

  it('UT-28 UTCID08 rejects a combo whose photography package does not exist', async () => {
    const { service } = createService({ pkg: null });

    await expect(service.create(providerId, createDto())).rejects.toThrow(
      new NotFoundException('Không tìm thấy gói chụp ảnh'),
    );
  });

  it('UT-28 UTCID09 rejects a combo that uses another shop photography package', async () => {
    const { service } = createService({ pkg: { providerId: otherProviderId } });

    await expect(service.create(providerId, createDto())).rejects.toThrow(
      new BadRequestException('Gói chụp ảnh không thuộc cửa hàng của bạn'),
    );
  });

  it('UT-28 UTCID10 rejects discounts of 0% and 81%', async () => {
    const { service, comboModel } = createService();
    const message = 'Phần trăm giảm giá phải từ 1% đến 80%';

    await expect(
      service.create(providerId, createDto({ discountPercent: 0 })),
    ).rejects.toThrow(message);
    await expect(
      service.create(providerId, createDto({ discountPercent: 81 })),
    ).rejects.toThrow(message);
    expect(comboModel.create).not.toHaveBeenCalled();
  });

  it('UT-28 UTCID11 accepts 1% and 80% discounts and submits the combo for review', async () => {
    const { service, comboModel } = createService();

    await service.create(providerId, createDto({ discountPercent: 1 }));
    await service.create(providerId, createDto({ discountPercent: 80 }));

    expect(comboModel.create).toHaveBeenCalledTimes(2);
    expect(comboModel.create.mock.calls[1][0]).toMatchObject({
      discountPercent: 80,
      status: ComboPromotionStatus.PendingReview,
      usedCount: 0,
      aoDaiQuantity: 1,
      shootPeopleCount: 1,
      validFrom: new Date('2026-11-01'),
      validTo: new Date('2026-12-31'),
    });
  });

  it('UT-28 UTCID12 rejects an update of another shop combo', async () => {
    const { service, comboModel } = createService({
      combo: { providerId: otherProviderId },
    });

    await expect(
      service.update(comboId, providerId, { name: 'New' } as any),
    ).rejects.toThrow(
      new BadRequestException('Combo này không thuộc cửa hàng của bạn'),
    );
    expect(comboModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('UT-28 UTCID13 returns an edited combo to review and ignores a self-activation request', async () => {
    const { service, comboModel } = createService();

    await service.update(comboId, providerId, {
      discountPercent: 20,
      status: ComboPromotionStatus.Active,
    } as any);

    expect(comboModel.findByIdAndUpdate).toHaveBeenCalledWith(
      comboId,
      { discountPercent: 20, status: ComboPromotionStatus.PendingReview },
      { new: true },
    );
  });

  it('UT-28 UTCID14 rejects deletion of another shop combo', async () => {
    const { service, comboModel } = createService({
      combo: { providerId: otherProviderId },
    });

    await expect(service.delete(comboId, providerId)).rejects.toThrow(
      new BadRequestException('Combo này không thuộc cửa hàng của bạn'),
    );
    expect(comboModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('UT-28 UTCID15 lists at most 12 active public combos with the highest discount first', async () => {
    const { service, comboModel } = createService();

    await service.findActivePublic();

    const query = comboModel.find.mock.results[0].value;
    expect(comboModel.find.mock.calls[0][0]).toEqual({
      status: ComboPromotionStatus.Active,
      validFrom: { $lte: expect.any(Date) },
      validTo: { $gte: expect.any(Date) },
    });
    expect(query.sort).toHaveBeenCalledWith({
      discountPercent: -1,
      createdAt: -1,
    });
    expect(query.limit).toHaveBeenCalledWith(12);
  });
});
