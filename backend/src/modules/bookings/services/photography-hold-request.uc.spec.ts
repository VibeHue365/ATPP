import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PhotographyHoldService } from './photography-hold.service';

type Row = Record<string, any>;

const customerId = new Types.ObjectId().toString();
const packageId = new Types.ObjectId().toString();

function createService(
  options: { existing?: Row | null; pkg?: Row | null; quote?: Row } = {},
) {
  const bookingModel = {
    findOne: jest
      .fn()
      .mockReturnValue({
        exec: () => Promise.resolve(options.existing ?? null),
      }),
  };
  const packageModel = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.pkg === undefined
          ? {
              _id: new Types.ObjectId(packageId),
              providerId: new Types.ObjectId(),
            }
          : options.pkg,
      ),
  };
  const quoteService = {
    quote: jest
      .fn()
      .mockResolvedValue(options.quote ?? { valid: true, errors: [] }),
  };
  const service = new PhotographyHoldService(
    bookingModel as any,
    {} as any,
    {} as any,
    {} as any,
    packageModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    quoteService as any,
    {} as any,
    {} as any,
  );
  const transaction = jest
    .spyOn(service as any, 'withTransactionRetry')
    .mockResolvedValue({ holdId: 'new-hold' });
  jest.spyOn(service as any, 'toHoldSessions').mockReturnValue([]);
  const toHoldResponse = jest
    .spyOn(service as any, 'toHoldResponse')
    .mockReturnValue({ holdId: 'existing-hold' });
  return {
    service,
    bookingModel,
    packageModel,
    quoteService,
    transaction,
    toHoldResponse,
  };
}

const dto = {
  packageId,
  sessions: [{ date: '2026-11-20', startTime: '08:00' }],
} as any;

afterEach(() => jest.restoreAllMocks());

describe('UC-42 Booking Photographer - hold request (NgocL)', () => {
  it('UT-42 UTCID08 rejects a malformed customer account id', async () => {
    const { service, bookingModel } = createService();

    await expect(
      service.createHold('customer-1', dto, 'key-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingModel.findOne).not.toHaveBeenCalled();
  });

  it('UT-42 UTCID09 rejects a malformed photography package id', async () => {
    const { service } = createService();

    await expect(
      service.createHold(
        customerId,
        { ...dto, packageId: 'package-1' },
        'key-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UT-42 UTCID10 accepts a 160-character idempotency key and rejects 161 characters', async () => {
    const { service, transaction } = createService();

    await expect(
      service.createHold(customerId, dto, 'k'.repeat(160)),
    ).resolves.toEqual({ holdId: 'new-hold' });
    await expect(
      service.createHold(customerId, dto, 'k'.repeat(161)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('UT-42 UTCID11 returns the existing hold for a repeated idempotency key', async () => {
    const existing = { _id: new Types.ObjectId() };
    const { service, transaction, toHoldResponse } = createService({
      existing,
    });

    await expect(service.createHold(customerId, dto, 'key-1')).resolves.toEqual(
      { holdId: 'existing-hold' },
    );
    expect(toHoldResponse).toHaveBeenCalledWith(existing);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('UT-42 UTCID12 returns not found for an inactive photography package', async () => {
    const { service, quoteService } = createService({ pkg: null });

    await expect(
      service.createHold(customerId, dto, 'key-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(quoteService.quote).not.toHaveBeenCalled();
  });

  it('UT-42 UTCID13 rejects sessions that fail the schedule preflight with their errors', async () => {
    const errors = [{ sessionIndex: 0, code: 'OUTSIDE_WORKING_HOURS' }];
    const { service, transaction } = createService({
      quote: { valid: false, errors },
    });

    const error = await service
      .createHold(customerId, dto, 'key-1')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      errors,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  // Known defect UT-DEF-42-01: user-facing messages in photography-hold.service.ts are mis-encoded.
  it.failing(
    'UT-42 UTCID14 returns a readable Vietnamese message for an invalid package',
    async () => {
      const { service } = createService();

      await expect(
        service.createHold(
          customerId,
          { ...dto, packageId: 'package-1' },
          'key-1',
        ),
      ).rejects.toThrow('Gói chụp không hợp lệ.');
    },
  );
});
