import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  isCampaignDay,
  resolveHourlyRate,
  toVnDayKey,
  type CampaignPricingRule,
} from './campaign-pricing.util';

// Dịp Tết: 25/12 - 02/01, ngày được gửi từ form dạng YYYY-MM-DDT00:00:00Z.
const tetSurcharge: CampaignPricingRule = {
  type: 'SURCHARGE',
  discountPercent: 20,
  startDate: '2026-12-25T00:00:00.000Z',
  endDate: '2027-01-02T00:00:00.000Z',
};

const tetDiscount: CampaignPricingRule = { ...tetSurcharge, type: 'DISCOUNT' };

describe('campaign-pricing.util (VIB-43 seasonal discount & surcharge)', () => {
  it('applies a +20% surcharge when the rental day falls inside the campaign', () => {
    expect(applyCampaignToRate(100000, tetSurcharge, '2026-12-30')).toBe(120000);
  });

  it('keeps the base rate when the rental day is outside the campaign', () => {
    expect(applyCampaignToRate(100000, tetSurcharge, '2027-01-10')).toBe(100000);
  });

  it('applies a discount campaign by rental day as well', () => {
    expect(applyCampaignToRate(100000, tetDiscount, '2026-12-30')).toBe(80000);
  });

  it('treats a campaign saved before the type field existed as a discount', () => {
    const legacy = { ...tetSurcharge, type: undefined };
    expect(applyCampaignToRate(100000, legacy, '2026-12-30')).toBe(80000);
  });

  it('counts both the first and the last campaign day', () => {
    expect(isCampaignDay(tetSurcharge, '2026-12-25')).toBe(true);
    expect(isCampaignDay(tetSurcharge, '2027-01-02')).toBe(true);
    expect(isCampaignDay(tetSurcharge, '2026-12-24')).toBe(false);
    expect(isCampaignDay(tetSurcharge, '2027-01-03')).toBe(false);
  });

  it('supports a one-day occasion such as 14/02', () => {
    const valentine: CampaignPricingRule = {
      type: 'SURCHARGE',
      discountPercent: 10,
      startDate: '2027-02-14T00:00:00.000Z',
      endDate: '2027-02-14T00:00:00.000Z',
    };
    expect(applyCampaignToRate(200000, valentine, '2027-02-14')).toBe(220000);
    expect(applyCampaignToRate(200000, valentine, '2027-02-15')).toBe(200000);
  });

  it('prices each day separately when a rental straddles the campaign boundary', () => {
    // 31/12, 01/01, 02/01 bị phụ thu; 03/01 giá gốc.
    expect(calculateDailyRentalTotal(100000, tetSurcharge, '2026-12-31', '2027-01-03')).toEqual({
      total: 460000,
      days: 4,
    });
  });

  it('charges the plain base price per day without a campaign', () => {
    expect(calculateDailyRentalTotal(150000, null, '2027-03-01', '2027-03-03')).toEqual({
      total: 450000,
      days: 3,
    });
  });

  it('derives the hourly rate from 30% of the daily price, then applies the campaign', () => {
    const hourly = resolveHourlyRate(500000, null);
    expect(hourly).toBe(150000);
    expect(applyCampaignToRate(hourly, tetSurcharge, '2026-12-30')).toBe(180000);
  });

  it('compares days on the Vietnam calendar regardless of the stored time of day', () => {
    // 17:00 UTC ngày 24/12 là 00:00 ngày 25/12 giờ Việt Nam.
    expect(toVnDayKey('2026-12-24T17:00:00.000Z')).toBe('2026-12-25');
    expect(toVnDayKey('2026-12-24T16:59:00.000Z')).toBe('2026-12-24');
  });
});
