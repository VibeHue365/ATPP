import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SettlementQueryService } from './settlement-query.service';

describe('SettlementQueryService', () => {
  const settlementModel = {
    findOne: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  function mockProviderDetail(result: unknown) {
    const lean = jest.fn().mockResolvedValue(result);
    const populate = jest.fn().mockReturnValue({ lean });
    settlementModel.findOne.mockReturnValue({ populate });
    return { populate, lean };
  }

  it('queries provider detail with both settlement and provider ids', async () => {
    const service = new SettlementQueryService(settlementModel as never);
    const settlementId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const settlement = { _id: settlementId, providerId };
    mockProviderDetail(settlement);

    await expect(
      service.findProviderSettlementById(settlementId.toString(), providerId),
    ).resolves.toEqual(settlement);
    expect(settlementModel.findOne).toHaveBeenCalledWith({
      _id: settlementId,
      providerId,
    });
  });

  it('does not expose a settlement that does not belong to the provider', async () => {
    const service = new SettlementQueryService(settlementModel as never);
    mockProviderDetail(null);

    await expect(
      service.findProviderSettlementById(
        new Types.ObjectId().toString(),
        new Types.ObjectId(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
