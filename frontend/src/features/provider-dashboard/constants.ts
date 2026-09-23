

export const PHOTO_START_EARLY_MINUTES = 30;

export const daysOfWeekVn = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const sizesOptions = ['S', 'M', 'L', 'XL', 'XXL'];

export const colorsOptions = ['RED', 'WHITE', 'GOLD', 'BLACK', 'PINK', 'BLUE', 'GREEN', 'BROWN'];

export const materialsOptions = ['SILK', 'VELVET', 'BROCADE', 'ORGANZA', 'LINEN'];

export const colorLabels: Record<string, string> = {
  RED: 'Đỏ', WHITE: 'Trắng', GOLD: 'Vàng', BLACK: 'Đen', PINK: 'Hồng', BLUE: 'Xanh dương',
  GREEN: 'Xanh lá', BROWN: 'Nâu',
};

export const materialLabels: Record<string, string> = { SILK: 'Lụa', VELVET: 'Nhung', BROCADE: 'Gấm', ORGANZA: 'Organza', LINEN: 'Linen' };

export const conditionOptions = [{ value: 'NEW', label: 'Mới (New)' }, { value: 'GOOD', label: 'Tốt (Good)' }, { value: 'MINOR_DAMAGE', label: 'Hỏng nhẹ' }];

export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';

export const colorSwatches: Record<string, string> = {
  RED: '#C0392B', WHITE: '#FFFFFF', GOLD: '#D4AC0D', BLACK: '#1B1B1B', PINK: '#E5739C', BLUE: '#2E86C1',
  GREEN: '#27AE60', BROWN: '#8B5A2B',
};

export const TAG_TO_STYLE: Record<string, string> = { TRUYEN_THONG: 'traditional', CACH_TAN: 'modern', PHA_CACH: 'edgy' };

export const TAG_TO_OCCASION: Record<string, string> = { PHU_HOP_LE_CUOI: 'wedding', CHUP_ANH_KY_YEU: 'graduation', LE_HOI_TRUYEN_THONG: 'festival', BIEU_DIEN_SU_KIEN: 'event' };

export const TAG_TO_STYLE_SLUG: Record<string, string> = { TRUYEN_THONG: 'truyen-thong', CACH_TAN: 'cach-tan', PHA_CACH: 'pha-cach' };

export const TAG_TO_EVENT_SLUG: Record<string, string> = { PHU_HOP_LE_CUOI: 'dam-cuoi', CHUP_ANH_KY_YEU: 'ky-yeu', LE_HOI_TRUYEN_THONG: 'le-hoi-truyen-thong', BIEU_DIEN_SU_KIEN: 'bieu-dien-va-su-kien' };

export const statusDisplayMap: Record<string, string> = {
  PENDING: 'CHỜ XỬ LÝ',
  PENDING_PAYMENT: 'CHỜ THANH TOÁN',
  DEPOSIT_PAID: 'ĐÃ ĐẶT CỌC',
  CONFIRMED: 'ĐANG THỰC HIỆN',
  IN_PROGRESS: 'ĐANG CHỤP',
  AWAITING_REVIEW: 'CHỜ KHÁCH XÁC NHẬN ẢNH',
  PICKUP_PENDING: 'CHỜ NHẬN ĐỒ',
  PICKED_UP: 'ĐANG THUÊ',
  COMBO_PHOTOS_APPROVED: 'ĐÃ DUYỆT ẢNH • CHỜ TRẢ ĐỒ',
  RETURN_PENDING: 'CHỜ KHÁCH DUYỆT SỰ CỐ',
  RETURNED: 'ĐÃ TRẢ ĐỒ',
  COMPLETED: 'HOÀN THÀNH',
  CANCELLED: 'ĐÃ HỦY',
  DISPUTED: 'ĐANG TRANH CHẤP',
  PARTIALLY_REFUNDED: 'ĐÃ HOÀN TIỀN MỘT PHẦN',
  REFUNDED: 'ĐÃ HOÀN TIỀN',
};
