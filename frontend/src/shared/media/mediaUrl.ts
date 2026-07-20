import { API_BASE_URL } from '../../config/env';

const ABSOLUTE_URL_PATTERN = /^(?:https?:|data:|blob:)/i;

/**
 * Converts a media path returned by the API into a browser-safe URL.
 * API responses can contain either a full CDN URL or a relative `/uploads/...` path.
 */
export const getMediaUrl = (value?: string | null): string | undefined => {
  const url = value?.trim();

  if (!url) {
    return undefined;
  }

  if (ABSOLUTE_URL_PATTERN.test(url)) {
    return url;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;

  return `${baseUrl}${normalizedPath}`;
};

export const getMediaUrls = (values?: Array<string | null | undefined>): string[] =>
  (values ?? [])
    .map(getMediaUrl)
    .filter((url): url is string => Boolean(url));

export const getFirstMediaUrl = (...candidates: Array<string | null | undefined>): string | undefined =>
  candidates.map(getMediaUrl).find((url): url is string => Boolean(url));
