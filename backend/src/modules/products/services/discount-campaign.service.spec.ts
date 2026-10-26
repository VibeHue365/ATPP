import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DiscountCampaignService } from './discount-campaign.service';

const dayFromNow = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
};

describe('DiscountCampaignService.createCampaign (VIB-43 seasonal discount & surcharge)', () => {
  const providerId = new Types.ObjectId();
  let campaignModel: { updateMany: jest.Mock; create: jest.Mock };
  let service: DiscountCampaignService;

  beforeEach(() => {
    campaignModel = {
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(async (doc) => doc),
    };
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue({ provider: { providerId } }),
    };
    service = new DiscountCampaignService(campaignModel as any, usersRepository as any);
  });

  const dto = (overrides: Record<string, unknown> = {}) => ({
    occasion: 'Tết Nguyên Đán',
    discountPercent: 20,
    startDate: dayFromNow(10),
    endDate: dayFromNow(18),
    ...overrides,
  });

  it('stores a surcharge campaign with its type', async () => {
    await service.createCampaign(new Types.ObjectId().toString(), dto({ type: 'SURCHARGE' }) as any);
    expect(campaignModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SURCHARGE', discountPercent: 20, isActive: true }),
    );
  });

  it('defaults to a discount campaign when no type is sent (old clients)', async () => {
    await service.createCampaign(new Types.ObjectId().toString(), dto() as any);
    expect(campaignModel.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'DISCOUNT' }));
  });

  it('allows a surcharge of up to 100%', async () => {
    await expect(
      service.createCampaign(new Types.ObjectId().toString(), dto({ type: 'SURCHARGE', discountPercent: 100 }) as any),
    ).resolves.toEqual(expect.objectContaining({ discountPercent: 100 }));
  });

  it('rejects a discount above 90%', async () => {
    await expect(
      service.createCampaign(new Types.ObjectId().toString(), dto({ type: 'DISCOUNT', discountPercent: 95 }) as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(campaignModel.create).not.toHaveBeenCalled();
  });

  it('accepts a one-day occasion where start and end are the same day', async () => {
    const day = dayFromNow(5);
    await service.createCampaign(new Types.ObjectId().toString(), dto({ startDate: day, endDate: day }) as any);
    expect(campaignModel.create).toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      service.createCampaign(
        new Types.ObjectId().toString(),
        dto({ startDate: dayFromNow(10), endDate: dayFromNow(8) }) as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivates the previous campaign so each shop keeps a single active one', async () => {
    await service.createCampaign(new Types.ObjectId().toString(), dto() as any);
    expect(campaignModel.updateMany).toHaveBeenCalledWith(
      { providerId, isActive: true },
      { $set: { isActive: false } },
    );
  });
});
