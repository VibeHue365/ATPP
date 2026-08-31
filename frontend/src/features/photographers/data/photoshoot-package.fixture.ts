/**
 * UI fixture for Landing Page visual development.
 * Replace with real public Photography Package API later.
 */

export interface PhotoshootPackageItem {
  id: string;
  name: string;
  photographerName: string;
  image: string;
  durationMinutes: number;
  price: number;
  rating: number;
  reviewCount: number;
  badge?: string;
}

export const FEATURED_PHOTOSHOOT_PACKAGES_FIXTURE: PhotoshootPackageItem[] = [
  {
    id: 'pkg-1',
    name: 'Gói chụp studio 60 phút',
    photographerName: 'LUMÉ Studio & Concept',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb',
    durationMinutes: 60,
    price: 790000,
    rating: 4.9,
    reviewCount: 105,
    badge: 'HOT',
  },
  {
    id: 'pkg-2',
    name: 'Gói chụp ngoại cảnh 90 phút',
    photographerName: 'Nhiếp Ảnh Gia Minh Triết',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
    durationMinutes: 90,
    price: 1190000,
    rating: 4.8,
    reviewCount: 84,
  },
  {
    id: 'pkg-3',
    name: 'Gói chụp kỷ yếu nhóm',
    photographerName: 'Heritage Visuals Huế',
    image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
    durationMinutes: 120,
    price: 2400000,
    rating: 5.0,
    reviewCount: 142,
    badge: 'MỚI',
  },
  {
    id: 'pkg-4',
    name: 'Gói chụp chân dung ngoại cảnh',
    photographerName: 'Studio Nghệ Thuật Cố Đô',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    durationMinutes: 60,
    price: 990000,
    rating: 4.9,
    reviewCount: 67,
  },
];
