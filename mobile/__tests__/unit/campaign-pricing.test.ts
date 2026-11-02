import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  formatCampaignPercent,
  resolveHourlyRate,
  type PricingCampaign,
} from '@/utils/campaignPricing';

const tetSurcharge: PricingCampaign = {
  type: 'SURCHARGE',
  discountPercent: 20,
  startDate: '2026-12-25T00:00:00.000Z',
  endDate: '2027-01-02T00:00:00.000Z',
};

describe('campaignPricing (VIB-43, same numbers as backend and web)', () => {
  it('prices each rental day on its own across the campaign boundary', () => {
    expect(calculateDailyRentalTotal(100000, tetSurcharge, '2026-12-31', '2027-01-03')).toEqual({
      total: 460000,
      days: 4,
    });
  });

  it('applies the campaign to the hourly rate only on campaign days', () => {
    const hourly = resolveHourlyRate(500000, null);
    expect(applyCampaignToRate(hourly, tetSurcharge, '2026-12-30')).toBe(180000);
    expect(applyCampaignToRate(hourly, tetSurcharge, '2027-01-10')).toBe(150000);
  });

  it('labels a surcharge with + and a discount with -', () => {
    expect(formatCampaignPercent(tetSurcharge)).toBe('+20%');
    expect(formatCampaignPercent({ ...tetSurcharge, type: 'DISCOUNT' })).toBe('-20%');
  });
});
