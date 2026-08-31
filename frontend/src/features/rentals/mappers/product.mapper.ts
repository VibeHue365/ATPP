import type { ProductFromDb, AoDaiItem } from '../types/rental.types';

export const DEFAULT_PRODUCT_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';

export const translateMaterial = (mat: string): string => {
  switch (mat.toUpperCase()) {
    case 'SILK': return 'Lụa cao cấp';
    case 'BROCADE': return 'Gấm hoàng gia';
    case 'LINEN': return 'Linen tự nhiên';
    default: return mat;
  }
};

export const mapProductToAoDaiItem = (p: ProductFromDb): AoDaiItem => ({
  id: p._id,
  name: p.name,
  material: p.materials?.[0] ? translateMaterial(p.materials[0]) : 'Lụa cao cấp',
  price: p.basePrice,
  status: 'AVAILABLE',
  image: p.images?.[0] || DEFAULT_PRODUCT_IMAGE_FALLBACK,
  badges: p.badges,
});
