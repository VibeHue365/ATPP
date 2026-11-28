import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SettlementStatus } from '../constants/settlement-status.enum';
import { SettlementQueryService } from './settlement-query.service';

describe('SettlementQueryService', () => {
  const settlementModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  function mockProviderDetail(result: unknown) {
    const lean = jest.fn().mockResolvedValue(result);
    const populate = jest.fn().mockReturnValue({ lean });
    settlementModel.findOne.mockReturnValue({ populate });
    return { populate, lean };
  }

  function mockAdminList(items: unknown[]) {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(items),
    };
    settlementModel.find.mockReturnValue(chain);
    return chain;
  }

  it('queries provider detail with both settlement and provider ids', async () => {
    const service = new SettlementQueryService(
      settlementModel as never,
      {} as never,
      {} as never,
    );
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
    const service = new SettlementQueryService(
      settlementModel as never,
      {} as never,
      {} as never,
    );
    mockProviderDetail(null);

    await expect(
      service.findProviderSettlementById(
        new Types.ObjectId().toString(),
        new Types.ObjectId(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns global status summary independent of pagination and active status tab', async () => {
    const service = new SettlementQueryService(
      settlementModel as never,
      {} as never,
      {} as never,
    );
    const fromDate = new Date('2026-06-01T00:00:00.000Z');
    const toDate = new Date('2026-11-30T23:59:59.999Z');

    mockAdminList([{ _id: new Types.ObjectId(), status: SettlementStatus.Settled }]);
    settlementModel.countDocuments.mockResolvedValue(5);
    settlementModel.aggregate.mockResolvedValue([
      { _id: SettlementStatus.ReadyToSettle, amount: 12500000, count: 35 },
      { _id: SettlementStatus.Settled, amount: 5985000, count: 5 },
      { _id: SettlementStatus.OnHold, amount: 450000, count: 2 },
      { _id: SettlementStatus.Cancelled, amount: 270000, count: 1 },
    ]);

    const result = await service.findAdminSettlements({
      status: SettlementStatus.Settled,
      fromDate,
      toDate,
      page: 1,
      limit: 20,
    });

    expect(settlementModel.find).toHaveBeenCalledWith({
      status: SettlementStatus.Settled,
      createdAt: { $gte: fromDate, $lte: toDate },
    });
    expect(settlementModel.aggregate).toHaveBeenCalledWith([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: '$status',
          amount: {
            $sum: {
              $cond: [
                { $eq: ['$status', SettlementStatus.Cancelled] },
                {
                  $ifNull: [
                    '$netAmount',
                    { $ifNull: ['$payableAmount', 0] },
                  ],
                },
                { $ifNull: ['$payableAmount', 0] },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    expect(result.summary).toEqual({
      pending: { amount: 12500000, count: 35 },
      settled: { amount: 5985000, count: 5 },
      held: { amount: 450000, count: 2 },
      cancelled: { amount: 270000, count: 1 },
      totalCount: 43,
    });
  });

  it('returns lifetimeSummary and filtered summary for provider settlements', async () => {
    const providerId = new Types.ObjectId();
    const service = new SettlementQueryService(
      settlementModel as never,
      {} as never,
      {} as never,
    );

    mockAdminList([{ _id: new Types.ObjectId(), status: SettlementStatus.ReadyToSettle }]);
    settlementModel.countDocuments.mockResolvedValue(25);
    settlementModel.aggregate.mockResolvedValue([
      {
        _id: SettlementStatus.Settled,
        amount: 4500000,
        gross: 5000000,
        fee: 500000,
        compensation: 0,
        count: 10,
      },
      {
        _id: SettlementStatus.ReadyToSettle,
        amount: 1850000,
        gross: 2000000,
        fee: 200000,
        compensation: 50000,
        count: 5,
      },
      {
        _id: SettlementStatus.OnHold,
        amount: 270000,
        gross: 300000,
        fee: 30000,
        compensation: 0,
        count: 1,
      },
      {
        _id: SettlementStatus.Cancelled,
        amount: 270000,
        gross: 300000,
        fee: 30000,
        compensation: 0,
        count: 1,
      },
    ]);

    const result = await service.findProviderSettlements(providerId, {
      page: 1,
      limit: 20,
    });

    expect(result.lifetimeSummary).toEqual({
      totalGrossRevenue: 7300000,
      totalPlatformFee: 730000,
      totalCompensation: 50000,
      totalNetEarnings: 6620000,
      settled: { amount: 4500000, count: 10 },
      pending: { amount: 1850000, count: 5 },
      held: { amount: 270000, count: 1 },
      cancelled: { amount: 270000, count: 1 },
      activeCount: 16,
      totalCount: 17,
    });
    expect(result.summary).toEqual(result.lifetimeSummary);
  });
});
