import { API_BASE_URL } from '@/apis/httpClient';

const ABSOLUTE_URL = /^(?:https?:|data:|blob:)/i;

export function getMediaUrl(value?: string | null): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  if (ABSOLUTE_URL.test(url)) return url;
  return `${API_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}
