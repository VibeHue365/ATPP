import type { BannerPlacement } from './types';

export const DEFAULT_BANNERS: Record<BannerPlacement, {
  imageUrl: string;
  defaultTitle: string;
  defaultSubtitle: string;
}> = {
  AODAI: {
    imageUrl: '/images/hero-silk-stone-v2.webp',
    defaultTitle: 'Thuê áo dài tại miền Trung',
    defaultSubtitle: 'Chọn mẫu, size, hình thức thuê và thời gian nhận trả phù hợp.',
  },
  PHOTOGRAPHER: {
    imageUrl: '/images/hero-hue-heritage-v2.webp',
    defaultTitle: 'Đặt lịch chụp ảnh theo cách của bạn',
    defaultSubtitle: 'Khám phá photographer, studio và concept phù hợp cho khoảnh khắc đáng nhớ.',
  },
  COMBO: {
    imageUrl: '/images/hero-gam-moi-v2.webp',
    defaultTitle: 'Gói combo Áo dài & Chụp ảnh',
    defaultSubtitle: 'Trải nghiệm trọn gói tiện lợi, đồng bộ phong cách với mức giá ưu đãi nhất.',
  },
  HOME: {
    imageUrl: '/images/location-hue-v2.webp',
    defaultTitle: 'VibeHue - Di sản & Văn hóa Miền Trung',
    defaultSubtitle: 'Trải nghiệm thuê áo dài, chụp ảnh nghệ thuật và khám phá danh thắng.',
  },
};
