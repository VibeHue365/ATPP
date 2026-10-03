import { API_BASE_URL } from '../../../../config/env';
import type { ProductDetail } from '../types';

export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';

export const getImageUrl = (url?: string): string => {
  if (!url) {
    return DEFAULT_PRODUCT_IMAGE;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

export const translateColorHex = (colorName: string): string => {
  const catalog: Record<string, string> = {
    RED: '#A11E22',
    WHITE: '#FFFFFF',
    GOLD: '#E6C280',
    GREEN: '#2E5A44',
    GREY: '#8E8E93',
    BLACK: '#1A1A1A',
    BLUE: '#2980B9',
    PINK: '#F1948A',
    YELLOW: '#F4D03F',
  };
  return catalog[colorName.toUpperCase()] || '#CCCCCC';
};

export const normalizeCol = (col: string): string => {
  const u = col.trim().toUpperCase();
  if (u === 'ĐỎ' || u === 'RED') return 'RED';
  if (u === 'TRẮNG' || u === 'WHITE') return 'WHITE';
  if (u === 'VÀNG' || u === 'GOLD') return 'GOLD';
  if (u === 'ĐEN' || u === 'BLACK') return 'BLACK';
  return u;
};

export const imagesForColor = (product: ProductDetail | null, color: string): string[] => {
  const tagged = product?.colorImages?.find(
    (entry) => (entry.color || '').toUpperCase() === (color || '').toUpperCase(),
  )?.images;
  return tagged && tagged.length > 0 ? tagged : (product?.images ?? []);
};
