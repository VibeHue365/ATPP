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

export interface PopularLocationItem {
  id?: string;
  code?: string;
  name: string;
  description: string;
  image: string;
  destination: string;
}

export const DEFAULT_POPULAR_LOCATIONS: PopularLocationItem[] = [
  {
    code: 'hue',
    name: 'Huế',
    description: 'Cổ kính và thơ mộng',
    image: '/images/location-hue-v2.webp',
    destination: '/photographers?location=Hu%E1%BA%BF',
  },
  {
    code: 'da-nang',
    name: 'Đà Nẵng',
    description: 'Biển và không gian hiện đại',
    image: '/images/location-da-nang-v2.webp',
    destination: '/photographers?location=%C4%90%C3%A0+N%E1%BA%B5ng',
  },
  {
    code: 'ha-noi',
    name: 'Hà Nội',
    description: 'Phố cổ và nét văn hóa',
    image: '/images/location-ha-noi-v2.webp',
    destination: '/photographers',
  },
];

