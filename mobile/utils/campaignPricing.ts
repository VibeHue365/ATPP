/**
 * Giá thuê áo dài có áp chiến dịch giá toàn shop (giảm giá hoặc phụ thu dịp lễ).
 *
 * Bản sao công thức của backend `backend/src/modules/products/utils/campaign-pricing.util.ts`
 * (web: `frontend/src/shared/pricing/campaignPricing.ts`)
 * — backend là nơi tính tiền thật, file này chỉ để khách thấy đúng số sẽ bị thu. Sửa một bên
 * thì sửa cả bên kia.
 *
 * Chiến dịch áp theo NGÀY THUÊ (không theo ngày đặt), thuê nhiều ngày thì tính từng ngày.
 */

export type CampaignType = 'DISCOUNT' | 'SURCHARGE';

export interface PricingCampaign {
  occasion?: string;
  type?: CampaignType | null;
  discountPercent: number;
  startDate?: string | Date | null;
  endDate: string | Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// So ngày theo lịch Việt Nam (UTC+7) giống backend, không phụ thuộc múi giờ của điện thoại.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toVnDayKey(value: Date | string): string {
  const date = new Date(value);
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function isSurchargeCampaign(campaign?: PricingCampaign | null): boolean {
  return campaign?.type === 'SURCHARGE';
}

export function isCampaignDay(campaign: PricingCampaign | null | undefined, day: Date | string): boolean {
  if (!campaign) return false;
  const key = toVnDayKey(day);
  // Chiến dịch cũ không trả startDate: coi như đang chạy từ trước.
  const startKey = campaign.startDate ? toVnDayKey(campaign.startDate) : '0000-00-00';
  return key >= startKey && key <= toVnDayKey(campaign.endDate);
}

/** Áp chiến dịch lên một mức giá (giá ngày hoặc giá giờ) cho đúng một ngày thuê. */
export function applyCampaignToRate(
  rate: number,
  campaign: PricingCampaign | null | undefined,
  day: Date | string,
): number {
  if (!campaign || !isCampaignDay(campaign, day)) return rate;
  const ratio = campaign.discountPercent / 100;
  const multiplier = isSurchargeCampaign(campaign) ? 1 + ratio : 1 - ratio;
  return Math.round(rate * multiplier);
}

/** Giá giờ gốc: 30% giá ngày (quy ước hiện hành), trước khi áp chiến dịch. */
export function resolveHourlyRate(basePrice: number, hourlyPrice?: number | null): number {
  return hourlyPrice || Math.round(basePrice * 0.3) || 80000;
}

export function countRentalDays(from: Date | string, to: Date | string): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.ceil(Math.abs(end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Tổng tiền thuê theo ngày, áp chiến dịch cho từng ngày nằm trong khoảng chiến dịch. */
export function calculateDailyRentalTotal(
  basePrice: number,
  campaign: PricingCampaign | null | undefined,
  from: Date | string,
  to: Date | string,
): { total: number; days: number } {
  const days = countRentalDays(from, to);
  const start = new Date(from).getTime();
  let total = 0;
  for (let i = 0; i < days; i += 1) {
    total += applyCampaignToRate(basePrice, campaign, new Date(start + i * DAY_MS));
  }
  return { total, days };
}

/** Nhãn ngắn trên thẻ sản phẩm: "-20%" hoặc "+20%". */
export function formatCampaignPercent(campaign: PricingCampaign): string {
  return `${isSurchargeCampaign(campaign) ? '+' : '-'}${campaign.discountPercent}%`;
}

/** Khoảng ngày áp dụng, ví dụ "25/12 - 02/01". */
export function formatCampaignRange(campaign: PricingCampaign): string {
  const format = (value: Date | string) =>
    new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  return campaign.startDate
    ? `${format(campaign.startDate)} - ${format(campaign.endDate)}`
    : `đến ${format(campaign.endDate)}`;
}
