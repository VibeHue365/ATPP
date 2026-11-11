import { Types } from 'mongoose';
import { ContractReadService } from '../contract-read.service';

describe('ContractReadService erroneous V2 legacy reconciliation', () => {
  const bookingId = new Types.ObjectId();
  const providerId = new Types.ObjectId();

  const createService = (counts?: {
    acceptances?: number;
    contracts?: number;
    payments?: number;
  }) => {
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const countByCollection: Record<string, number> = {
      provider_contract_acceptances: counts?.acceptances ?? 0,
      digital_contracts: counts?.contracts ?? 0,
      payments: counts?.payments ?? 0,
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === 'bookings') return { updateOne };
        return {
          countDocuments: jest
            .fn()
            .mockResolvedValue(countByCollection[name] ?? 0),
        };
      }),
    };
    const booking = {
      _id: bookingId,
      bookingCode: 'B-ERRONEOUS-V2',
      bookingType: 'AODAI_RENTAL' as const,
      status: 'PENDING_PAYMENT',
      contractFlowVersion: 2 as const,
      customerId: new Types.ObjectId(),
      providerIds: [providerId],
      pricingSummary: {},
      holdExpiresAt: new Date(Date.now() + 60_000),
    };
    const access = {
      booking: jest.fn().mockResolvedValue(booking),
      assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER' }),
    };
    const service = new ContractReadService(
      true,
      {} as any,
      {} as any,
      {} as any,
      access as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { db } as any,
    );
    return { service, booking, updateOne };
  };

  it('downgrades only an untouched pending rental booking created as V2 by mistake', async () => {
    const { service, booking, updateOne } = createService();

    const result = await service.readiness(
      { sub: booking.customerId.toString() } as any,
      bookingId.toString(),
    );

    expect(result).toMatchObject({
      requirement: 'NOT_REQUIRED',
      ready: true,
      flow: 'LEGACY',
    });
    expect(booking.contractFlowVersion).toBeNull();
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: bookingId,
        contractFlowVersion: 2,
        status: 'PENDING_PAYMENT',
        paymentExpiryClaim: null,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ contractFlowVersion: null }),
      }),
    );
  });

  it.each([
    ['historical provider acceptance', { acceptances: 1 }],
    ['contract record', { contracts: 1 }],
    ['payment record', { payments: 1 }],
  ])('does not downgrade when the booking has %s', async (_label, counts) => {
    const { service, booking, updateOne } = createService(counts);

    await expect(
      (service as any).reconcileErroneousLegacyBooking(booking),
    ).resolves.toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
    expect(booking.contractFlowVersion).toBe(2);
  });
});
