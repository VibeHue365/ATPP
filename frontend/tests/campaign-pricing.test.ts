import { describe, expect, it } from 'vitest';
import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  formatCampaignPercent,
  isCampaignDay,
  resolveHourlyRate,
  type PricingCampaign,
} from '../src/shared/pricing/campaignPricing';
import { enrichCartItems } from '../src/pages/cart/utils/cartCalculations';

const tetSurcharge: PricingCampaign = {
  occasion: 'Tết',
  type: 'SURCHARGE',
  discountPercent: 20,
  startDate: '2026-12-25T00:00:00.000Z',
  endDate: '2027-01-02T00:00:00.000Z',
};

describe('campaignPricing (VIB-43 seasonal discount & surcharge, web)', () => {
  it('matches the backend formula for a rental straddling the campaign boundary', () => {
    expect(calculateDailyRentalTotal(100000, tetSurcharge, '2026-12-31', '2027-01-03')).toEqual({
      total: 460000,
      days: 4,
    });
  });

  it('applies the campaign to the hourly rate on the rental day only', () => {
    const hourly = resolveHourlyRate(500000, null);
    expect(applyCampaignToRate(hourly, tetSurcharge, '2026-12-30')).toBe(180000);
    expect(applyCampaignToRate(hourly, tetSurcharge, '2027-01-10')).toBe(150000);
  });

  it('treats a campaign without startDate as already running until its end date', () => {
    const legacy: PricingCampaign = { discountPercent: 10, endDate: '2027-01-02T00:00:00.000Z' };
    expect(isCampaignDay(legacy, '2026-11-01')).toBe(true);
    expect(isCampaignDay(legacy, '2027-01-03')).toBe(false);
  });

  it('labels a surcharge with + and a discount with -', () => {
    expect(formatCampaignPercent(tetSurcharge)).toBe('+20%');
    expect(formatCampaignPercent({ ...tetSurcharge, type: 'DISCOUNT' })).toBe('-20%');
  });

  it('prices cart items by their own rental dates', () => {
    const product = {
      _id: '64b000000000000000000001',
      basePrice: 100000,
      depositAmount: 50000,
      activeCampaign: tetSurcharge,
      providerId: { address: { city: 'Huế' } },
    };
    const [inside, outside] = enrichCartItems(
      [
        { id: 'a', itemType: 'PRODUCT', productId: product._id, rentalType: 'DAILY', rentalFrom: '2026-12-30', rentalTo: '2026-12-31', quantity: 1 },
        { id: 'b', itemType: 'PRODUCT', productId: product._id, rentalType: 'DAILY', rentalFrom: '2027-01-10', rentalTo: '2027-01-11', quantity: 1 },
      ] as any,
      [product],
    );
    expect(inside.basePrice).toBe(240000);
    expect(inside.originalPrice).toBe(200000);
    expect(outside.basePrice).toBe(200000);
  });
});
