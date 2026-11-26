import { calculateItemizedContractCancellation } from './itemized-contract-cancellation';

describe('calculateItemizedContractCancellation', () => {
  it('applies cancellation windows independently to garments with different rental dates', () => {
    const rules = [
      { daysBeforeRental: 3, refundPercentage: 100 },
      { daysBeforeRental: 1, refundPercentage: 50 },
      { daysBeforeRental: 0, refundPercentage: 0 },
    ];
    const result = calculateItemizedContractCancellation({
      now: new Date('2026-12-09T00:00:00.000Z'),
      rulesByProvider: new Map([['shop-a', rules]]),
      items: [
        {
          id: 'early-item',
          providerId: 'shop-a',
          rentalFrom: '2026-12-10T12:00:00.000Z',
          unitPrice: 800000,
          depositAmount: 20000,
          quantity: 1,
        },
        {
          id: 'later-item',
          providerId: 'shop-a',
          rentalFrom: '2026-12-15T00:00:00.000Z',
          unitPrice: 810000,
          depositAmount: 20000,
          quantity: 1,
        },
      ],
    });

    expect(result.breakdown.map((row) => row.refundPercentage)).toEqual([
      50, 100,
    ]);
    expect(result.breakdown.map((row) => row.depositRefund)).toEqual([
      20000, 20000,
    ]);
    expect(result.refundAmount).toBe(1250000);
    expect(result.penaltyAmount).toBe(400000);
  });
});
