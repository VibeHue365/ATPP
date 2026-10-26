import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SmartTagEntityType } from '../../smart-tagging/constants/smart-tag.constants';
import { ProductModerationStatus } from '../../products/schemas/product.schema';
import { ProvidersService } from './providers.service';

type Row = Record<string, any>;

const userId = new Types.ObjectId().toString();
const providerId = new Types.ObjectId();

function exec(result: unknown) {
  return { exec: jest.fn().mockResolvedValue(result) };
}

function createService(
  options: { provider?: Row | null; item?: Row | null } = {},
) {
  const provider =
    options.provider === undefined
      ? {
          _id: providerId,
          address: { addressLine: '12 Le Loi' },
          media: { images: ['a.jpg'] },
          rentalSettings: {},
          photographySettings: {},
        }
      : options.provider;
  const providersRepository = {
    findByUserId: jest.fn().mockResolvedValue(provider),
    update: jest.fn(async (_id: Types.ObjectId, update: Row) => ({
      ...provider,
      ...update,
    })),
    upsertRecurringSchedule: jest.fn(
      async (_id: Types.ObjectId, dayOfWeek: number, workingHours: Row[]) => ({
        dayOfWeek,
        workingHours,
      }),
    ),
    upsertSpecificDateSchedule: jest.fn(async (...args: unknown[]) => ({
      args,
    })),
  };
  const portfolioItemModel = {
    create: jest.fn(async (data: Row) => ({
      _id: new Types.ObjectId(),
      ...data,
    })),
    findOneAndUpdate: jest
      .fn()
      .mockReturnValue(
        exec(
          options.item === undefined
            ? { _id: new Types.ObjectId(), taggingRevision: 3 }
            : options.item,
        ),
      ),
    findOneAndDelete: jest
      .fn()
      .mockReturnValue(
        exec(
          options.item === undefined
            ? { _id: new Types.ObjectId() }
            : options.item,
        ),
      ),
  };
  const smartTaggingService = {
    markAssignmentsStale: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ProvidersService(
    providersRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    portfolioItemModel as any,
    smartTaggingService as any,
  );
  return {
    service,
    providersRepository,
    portfolioItemModel,
    smartTaggingService,
  };
}

describe('UC-14 Manage Portfolio (HoangLVM)', () => {
  it('UT-14 UTCID03 creates a portfolio item that waits for moderation', async () => {
    const { service, portfolioItemModel } = createService();

    await service.createPortfolioItem(userId, {
      title: 'Áo dài Huế',
      images: ['p1.jpg'],
    } as any);

    expect(portfolioItemModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId,
        description: null,
        moderationStatus: ProductModerationStatus.PendingReview,
        taggingRevision: 1,
      }),
    );
  });

  it('UT-14 UTCID04 rejects portfolio changes from a user without a provider profile', async () => {
    const { service, portfolioItemModel } = createService({ provider: null });

    await expect(
      service.createPortfolioItem(userId, { title: 'x', images: [] } as any),
    ).rejects.toThrow(new NotFoundException('Provider profile not found'));
    expect(portfolioItemModel.create).not.toHaveBeenCalled();
  });

  it('UT-14 UTCID05 returns an edited item to review and marks its Smart Tags stale', async () => {
    const item = { _id: new Types.ObjectId(), taggingRevision: 3 };
    const { service, portfolioItemModel, smartTaggingService } = createService({
      item,
    });

    await service.updatePortfolioItem(userId, item._id.toString(), {
      title: 'Mới',
    } as any);

    const [filter, update] = portfolioItemModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: item._id, providerId });
    expect(update.$set.moderationStatus).toBe(
      ProductModerationStatus.PendingReview,
    );
    expect(update.$inc).toEqual({ taggingRevision: 1 });
    expect(smartTaggingService.markAssignmentsStale).toHaveBeenCalledWith(
      SmartTagEntityType.Portfolio,
      item._id,
      3,
    );
  });

  it('UT-14 UTCID06 does not edit a portfolio item owned by another provider', async () => {
    const { service, smartTaggingService } = createService({ item: null });

    await expect(
      service.updatePortfolioItem(userId, new Types.ObjectId().toString(), {
        title: 'x',
      } as any),
    ).rejects.toThrow(new NotFoundException('Portfolio item not found'));
    expect(smartTaggingService.markAssignmentsStale).not.toHaveBeenCalled();
  });

  it('UT-14 UTCID07 deletes only an item owned by the provider', async () => {
    const { service, portfolioItemModel } = createService();
    const itemId = new Types.ObjectId();

    await service.removePortfolioItem(userId, itemId.toString());

    expect(portfolioItemModel.findOneAndDelete).toHaveBeenCalledWith({
      _id: itemId,
      providerId,
    });
  });

  it('UT-14 UTCID08 returns not found when deleting a missing item', async () => {
    const { service } = createService({ item: null });

    await expect(
      service.removePortfolioItem(userId, new Types.ObjectId().toString()),
    ).rejects.toThrow(new NotFoundException('Portfolio item not found'));
  });

  it('UT-14 UTCID09 rejects a malformed portfolio item id', async () => {
    const { service, portfolioItemModel } = createService();

    await expect(service.removePortfolioItem(userId, 'item-1')).rejects.toThrow(
      new BadRequestException('Invalid ID'),
    );
    expect(portfolioItemModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('UT-14 UTCID10 approves a pending item and rejects a stale moderation decision', async () => {
    const { service, portfolioItemModel } = createService();
    const itemId = new Types.ObjectId().toString();

    await service.moderatePortfolioItem(
      new Types.ObjectId().toString(),
      itemId,
      { action: ProductModerationStatus.Approved } as any,
    );
    expect(portfolioItemModel.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      moderationStatus: ProductModerationStatus.PendingReview,
    });

    portfolioItemModel.findOneAndUpdate.mockReturnValue(exec(null));
    await expect(
      service.moderatePortfolioItem(new Types.ObjectId().toString(), itemId, {
        action: ProductModerationStatus.Rejected,
        reason: 'Mờ',
      } as any),
    ).rejects.toThrow(
      new ConflictException('Portfolio moderation state was already changed'),
    );
  });
});

describe('UC-15 Update Service Information (HoangLVM)', () => {
  it('UT-15 UTCID06 merges media changes into the existing provider media', async () => {
    const { service, providersRepository } = createService();

    await service.updateProfile(userId, {
      media: { coverImage: 'cover.jpg' },
    } as any);

    expect(providersRepository.update.mock.calls[0][1].media).toEqual({
      images: ['a.jpg'],
      coverImage: 'cover.jpg',
    });
  });

  it('UT-15 UTCID07 rejects a geo point outside the valid coordinate range', async () => {
    const { service, providersRepository } = createService();

    await expect(
      service.updateProfile(userId, {
        address: {
          addressLine: 'x',
          geo: { type: 'Point', coordinates: [190, 16] },
        },
      } as any),
    ).rejects.toThrow(
      new BadRequestException('address.geo must contain [longitude, latitude]'),
    );
    expect(providersRepository.update).not.toHaveBeenCalled();
  });

  it('UT-15 UTCID08 requires a pickup location when the business address is not used', async () => {
    const { service } = createService();

    await expect(
      service.updateProfile(userId, {
        rentalSettings: { useBusinessAddressForPickup: false },
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'pickupLocation is required when useBusinessAddressForPickup is false',
      ),
    );
  });

  it('UT-15 UTCID09 rejects a separate pickup location when the business address is used', async () => {
    const { service } = createService();

    await expect(
      service.updateProfile(userId, {
        rentalSettings: {
          useBusinessAddressForPickup: true,
          pickupLocation: { addressLine: '1 Tran Hung Dao' },
        },
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'pickupLocation must be empty when useBusinessAddressForPickup is true',
      ),
    );
  });

  it('UT-15 UTCID10 accepts a service radius of 0 and 500 km and rejects 501 km', async () => {
    const located = {
      _id: providerId,
      address: { geo: { type: 'Point', coordinates: [107.59, 16.46] } },
      photographySettings: {},
    };
    const { service } = createService({ provider: located });

    await expect(
      service.updateProfile(userId, {
        photographySettings: { serviceRadiusKm: 0 },
      } as any),
    ).resolves.toBeDefined();
    await expect(
      service.updateProfile(userId, {
        photographySettings: { serviceRadiusKm: 500 },
      } as any),
    ).resolves.toBeDefined();
    await expect(
      service.updateProfile(userId, {
        photographySettings: { serviceRadiusKm: 501 },
      } as any),
    ).rejects.toThrow(
      new BadRequestException('serviceRadiusKm must be between 0 and 500'),
    );
  });

  it('UT-15 UTCID11 requires a base location before configuring a service radius', async () => {
    const { service } = createService();

    await expect(
      service.updateProfile(userId, {
        photographySettings: { serviceRadiusKm: 20 },
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'A provider base location is required before configuring a service radius',
      ),
    );
  });

  it('UT-15 UTCID12 returns not found for a user without a provider profile', async () => {
    const { service } = createService({ provider: null });

    await expect(
      service.updateProfile(userId, { businessName: 'Studio' } as any),
    ).rejects.toThrow(new NotFoundException('Provider profile not found'));
  });
});

describe('UC-62 Manage Schedule (HoangLVM)', () => {
  const shift = [{ start: '08:00', end: '12:00' }];

  it('UT-62 UTCID04 saves the same working hours for several unique weekdays', async () => {
    const { service, providersRepository } = createService();

    await service.updateRecurringSchedules(userId, [3, 1, 3, 9], shift);

    expect(
      providersRepository.upsertRecurringSchedule.mock.calls.map(
        ([, day]) => day,
      ),
    ).toEqual([1, 3]);
  });

  it('UT-62 UTCID05 requires at least one valid weekday', async () => {
    const { service } = createService();

    await expect(
      service.updateRecurringSchedules(userId, [7, -1], shift),
    ).rejects.toThrow(
      new BadRequestException('Hãy chọn ít nhất một ngày làm việc.'),
    );
  });

  it('UT-62 UTCID06 requires at least one working shift', async () => {
    const { service } = createService();

    await expect(
      service.updateRecurringSchedule(userId, 1, []),
    ).rejects.toThrow(
      new BadRequestException('Hãy thêm ít nhất một ca làm việc.'),
    );
  });

  it('UT-62 UTCID07 rejects a shift whose start is not before its end', async () => {
    const { service } = createService();

    await expect(
      service.updateRecurringSchedule(userId, 1, [
        { start: '12:00', end: '12:00' },
      ]),
    ).rejects.toThrow(
      new BadRequestException(
        'Mỗi ca phải có giờ bắt đầu trước giờ kết thúc (định dạng HH:mm).',
      ),
    );
  });

  it('UT-62 UTCID08 rejects an invalid HH:mm time', async () => {
    const { service } = createService();

    await expect(
      service.updateRecurringSchedule(userId, 1, [
        { start: '24:00', end: '25:00' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UT-62 UTCID09 rejects overlapping shifts but accepts adjacent shifts', async () => {
    const { service } = createService();

    await expect(
      service.updateRecurringSchedule(userId, 1, [
        { start: '08:00', end: '12:00' },
        { start: '11:30', end: '14:00' },
      ]),
    ).rejects.toThrow(
      new BadRequestException('Các ca làm việc không được chồng lên nhau.'),
    );
    await expect(
      service.updateRecurringSchedule(userId, 1, [
        { start: '13:00', end: '17:00' },
        { start: '08:00', end: '13:00' },
      ]),
    ).resolves.toMatchObject({
      workingHours: [
        { start: '08:00', end: '13:00' },
        { start: '13:00', end: '17:00' },
      ],
    });
  });

  it('UT-62 UTCID10 stores a trimmed reason only for an off day or custom slots', async () => {
    const { service, providersRepository } = createService();

    await service.updateSpecificDateSchedule(
      userId,
      '2026-11-02',
      true,
      [],
      null,
      '  Nghỉ lễ  ',
    );
    await service.updateSpecificDateSchedule(
      userId,
      '2026-11-03',
      false,
      [],
      null,
      'Ignored',
    );

    expect(
      providersRepository.upsertSpecificDateSchedule.mock.calls[0][5],
    ).toBe('Nghỉ lễ');
    expect(
      providersRepository.upsertSpecificDateSchedule.mock.calls[0][2],
    ).toEqual([new Date('2026-11-02')]);
    expect(
      providersRepository.upsertSpecificDateSchedule.mock.calls[1][5],
    ).toBeNull();
  });

  it('UT-62 UTCID11 returns not found for a user without a provider profile', async () => {
    const { service } = createService({ provider: null });

    await expect(
      service.updateSpecificDateSchedule(userId, '2026-11-02', true, []),
    ).rejects.toThrow(new NotFoundException('Provider profile not found'));
  });
});
