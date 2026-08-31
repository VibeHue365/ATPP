export interface Banner {
  _id?: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  isActive?: boolean;
}

export const CAROUSEL_AUTOPLAY_INTERVAL_MS = 5000;

export const DEFAULT_BANNERS: Banner[] = [
  {
    imageUrl: '/images/hero-silk-stone-v2.webp',
    title: 'Hành trình Silk & Stone',
    subtitle: 'Khai phóng vẻ đẹp di sản áo dài truyền thống Việt Nam',
    linkUrl: '#rentals',
  },
  {
    imageUrl: '/images/hero-gam-moi-v2.webp',
    title: 'Bộ Sưu Tập Gấm Mới',
    subtitle: 'Gấm hoàng gia thêu tay thủ công tinh xảo',
    linkUrl: '#rentals',
  },
  {
    imageUrl: '/images/hero-hue-heritage-v2.webp',
    title: 'Huế - Heritage Concept',
    subtitle: 'Giảm 15% gói chụp ảnh áo dài ngoại cảnh cổ kính',
    linkUrl: '#photographers',
  },
];
