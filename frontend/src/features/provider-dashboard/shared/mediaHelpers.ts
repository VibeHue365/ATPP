
import { API_BASE_URL } from '../../../config/env';

export const getImageUrl = (url?: string | null) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  const cleanUrl = url.trim();
  if (
    cleanUrl.startsWith('http://') ||
    cleanUrl.startsWith('https://') ||
    cleanUrl.startsWith('data:') ||
    cleanUrl.startsWith('blob:')
  ) {
    return cleanUrl;
  }

  // Frontend public static assets (e.g., /avatar_hanna.webp, .webp, .svg, etc.)
  if (
    cleanUrl.startsWith('/avatar_') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.svg') ||
    cleanUrl.startsWith('/figma') ||
    cleanUrl.startsWith('/images/') ||
    cleanUrl.startsWith('/icons.svg')
  ) {
    return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const path = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  return `${base}${path}`;
};

