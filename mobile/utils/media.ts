import { API_BASE_URL } from '@/apis/httpClient';

const ABSOLUTE_URL = /^(?:https?:|data:|blob:)/i;
const LOCAL_BACKEND_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=\/|$)/i;
const SVG_PATH_RE = /\.svg(?:[?#].*)?$/i;
const DATA_SVG_RE = /^data:image\/svg\+xml/i;
const BACKEND_UPLOAD_PATH_RE = /^\/?uploads\//i;

export interface ProviderMediaLike {
  avatarUrl?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  media?: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    images?: string[] | null;
  } | null;
}

export function getMediaUrl(value?: string | null): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  if (LOCAL_BACKEND_ORIGIN.test(url)) {
    return url.replace(LOCAL_BACKEND_ORIGIN, baseUrl);
  }
  if (ABSOLUTE_URL.test(url)) return url;
  return `${baseUrl}/${url.replace(/^\//, '')}`;
}

/**
 * Returns true only when `value` points to a raster image URL or a served
 * backend `/uploads/...` path. Skips SVGs (which React Native `<Image>` cannot
 * decode) and legacy Web-frontend root-relative static paths (e.g.
 * `/partner_cover.jpg`, `/avatar_co_phong.svg`) that 404 against the API server.
 */
export function isRenderableImageUrl(value?: string | null): boolean {
  const url = value?.trim();
  if (!url) return false;
  if (SVG_PATH_RE.test(url) || DATA_SVG_RE.test(url)) return false;
  if (ABSOLUTE_URL.test(url)) return true;
  return BACKEND_UPLOAD_PATH_RE.test(url);
}

export function resolveRenderableMediaUrl(value?: string | null): string | undefined {
  if (!isRenderableImageUrl(value)) return undefined;
  return getMediaUrl(value);
}

export function resolveFirstRenderableMediaUrl(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const resolved = resolveRenderableMediaUrl(candidate);
    if (resolved) return resolved;
  }
  return undefined;
}

export function resolveProviderLogoUri(
  profile?: ProviderMediaLike | null,
): string | undefined {
  return resolveFirstRenderableMediaUrl(
    profile?.media?.logoUrl,
    profile?.avatarUrl,
    profile?.logoUrl,
  );
}

export function resolveProviderCoverUri(
  profile?: ProviderMediaLike | null,
): string | undefined {
  return resolveFirstRenderableMediaUrl(
    profile?.media?.coverUrl,
    profile?.coverUrl,
  );
}

export function resolveProviderAvatarUri(
  profile?: ProviderMediaLike | null,
): string | undefined {
  return resolveProviderLogoUri(profile) ?? resolveProviderCoverUri(profile);
}
