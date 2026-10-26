/**
 * Tính giá thuê áo dài có áp chiến dịch giá toàn shop (giảm giá hoặc phụ thu dịp lễ).
 *
 * Chiến dịch áp theo NGÀY THUÊ, không theo ngày đặt: khách đặt hôm nay cho ngày 30/12 sẽ
 * bị phụ thu Tết nếu 30/12 nằm trong khoảng chiến dịch, dù hôm nay chưa tới dịp đó.
 * Thuê nhiều ngày vắt qua ranh giới chiến dịch thì tính TỪNG NGÀY.
 *
 * Mọi nơi tính giá thuê (đặt trực tiếp, checkout giỏ hàng, hiển thị) phải gọi các hàm ở đây
 * để giá khách thấy và giá bị thu luôn khớp. Frontend có bản sao cùng công thức tại
 * `frontend/src/shared/pricing/campaignPricing.ts` — sửa một bên thì sửa cả bên kia.
 */

export type CampaignType = 'DISCOUNT' | 'SURCHARGE';

export interface CampaignPricingRule {
  type?: CampaignType | null;
  discountPercent: number;
  startDate: Date | string;
  endDate: Date | string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Ngày của chiến dịch và ngày thuê được so theo lịch Việt Nam (UTC+7) để không lệch múi giờ.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Khoá ngày YYYY-MM-DD theo giờ Việt Nam. */
export function toVnDayKey(value: Date | string): string {
  const date = new Date(value);
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Thời điểm 00:00 (giờ Việt Nam) của ngày chứa `value`. */
export function getStartOfVnDay(value: Date | string = new Date()): Date {
  const [year, month, day] = toVnDayKey(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
}

export function isCampaignDay(
  campaign: CampaignPricingRule | null | undefined,
  day: Date | string,
): boolean {
  if (!campaign) return false;
  const key = toVnDayKey(day);
  return key >= toVnDayKey(campaign.startDate) && key <= toVnDayKey(campaign.endDate);
}

/** Dạng chiến dịch trả về cho client (listing, chi tiết sản phẩm, gian hàng, banner). */
export function toPublicCampaign(campaign: CampaignPricingRule & { occasion: string }) {
  return {
    occasion: campaign.occasion,
    type: campaign.type ?? 'DISCOUNT',
    discountPercent: campaign.discountPercent,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
  };
}

/** Áp chiến dịch lên một mức giá (giá ngày hoặc giá giờ) cho đúng một ngày thuê. */
export function applyCampaignToRate(
  rate: number,
  campaign: CampaignPricingRule | null | undefined,
  day: Date | string,
): number {
  if (!campaign || !isCampaignDay(campaign, day)) return rate;
  const ratio = campaign.discountPercent / 100;
  const multiplier = campaign.type === 'SURCHARGE' ? 1 + ratio : 1 - ratio;
  return Math.round(rate * multiplier);
}

/** Giá giờ gốc: 30% giá ngày (quy ước hiện hành), trước khi áp chiến dịch. */
export function resolveHourlyRate(basePrice: number, hourlyPrice?: number | null): number {
  return hourlyPrice || Math.round(basePrice * 0.3) || 80000;
}

/** Số ngày thuê tính tiền, giữ đúng công thức cũ: tính cả ngày đầu và ngày cuối. */
export function countRentalDays(from: Date | string, to: Date | string): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.ceil(Math.abs(end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Tổng tiền thuê theo ngày, áp chiến dịch cho từng ngày nằm trong khoảng chiến dịch. */
export function calculateDailyRentalTotal(
  basePrice: number,
  campaign: CampaignPricingRule | null | undefined,
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
