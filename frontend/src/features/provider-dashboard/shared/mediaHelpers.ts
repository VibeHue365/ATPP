
import { API_BASE_URL } from '../../../config/env';

export const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};
