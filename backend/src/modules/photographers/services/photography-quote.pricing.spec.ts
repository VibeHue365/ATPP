import {
  calculatePhotographyQuote,
  PhotographyPricingPolicyError,
} from './photography-quote.pricing';

describe('calculatePhotographyQuote', () => {
  const basePolicy = {
    name: 'Gói chụp Áo dài',
    price: 1_000_000,
    includedDurationMinutes: 120,
    overtimeFeePerHour: 200_000,
    overtimeIncrementMinutes: 30,
    maxOvertimeMinutes: 240,
  };

  it('charges each session independently for PER_SESSION', () => {
    const quote = calculatePhotographyQuote(
      { ...basePolicy, pricingUnit: 'PER_SESSION' },
      [
        {
          clientId: 's1',
          providerLocalDate: '2026-07-20',
          durationMinutes: 150,
        },
        {
          clientId: 's2',
          providerLocalDate: '2026-07-21',
          durationMinutes: 120,
        },
      ],
    );

    expect(quote.baseAmount).toBe(2_000_000);
    expect(quote.overtimeAmount).toBe(100_000);
    expect(quote.totalAmount).toBe(2_100_000);
    expect(quote.overtimeMinutesByClientId).toEqual({ s1: 30, s2: 0 });
  });

  it('shares one package duration between all sessions on the same day for PER_DAY', () => {
    const quote = calculatePhotographyQuote(
      { ...basePolicy, pricingUnit: 'PER_DAY' },
      [
        {
          clientId: 'morning',
          providerLocalDate: '2026-07-20',
          durationMinutes: 90,
        },
        {
          clientId: 'afternoon',
          providerLocalDate: '2026-07-20',
          durationMinutes: 90,
        },
      ],
    );

    expect(quote.baseAmount).toBe(1_000_000);
    expect(quote.overtimeAmount).toBe(200_000);
    expect(quote.totalAmount).toBe(1_200_000);
  });

  it('requires explicit session and day entitlements for PER_BOOKING', () => {
    expect(() =>
      calculatePhotographyQuote(
        { ...basePolicy, pricingUnit: 'PER_BOOKING' },
        [
          {
            clientId: 's1',
            providerLocalDate: '2026-07-20',
            durationMinutes: 120,
          },
        ],
      ),
    ).toThrow(PhotographyPricingPolicyError);
  });
});
