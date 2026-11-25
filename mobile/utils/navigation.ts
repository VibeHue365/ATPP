import type { Href } from 'expo-router';
import type { SessionUser } from '@/types/auth';
import { appStorage } from '@/utils/storage';

const PARTNER_AUTO_ENTRY_ROLES = new Set(['PROVIDER', 'PHOTOGRAPHER']);
const PENDING_OAUTH_RETURN_TO_KEY = 'vh_pending_oauth_return_to';
const PENDING_OAUTH_TTL_MS = 5 * 60 * 1000;

function unwrapRouteParam(value?: string | string[] | null): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function stripQueryAndHash(path: string): string {
  return path.split(/[?#]/)[0] || '';
}

export function isPartnerPortalUser(
  user?: Pick<SessionUser, 'roles'> | null,
): boolean {
  return Boolean(
    user?.roles?.some((role) =>
      PARTNER_AUTO_ENTRY_ROLES.has(String(role).toUpperCase()),
    ),
  );
}

/**
 * Isolated Studio Staff Photographer account (`role: STAFF`, not a Studio Owner or Admin).
 * Staff accounts are strictly confined to the `/staff` operational portal + `/chat` + `/notifications`.
 */
export function isStaffPortalUser(
  user?: Pick<SessionUser, 'roles'> | null,
): boolean {
  const normalized = (user?.roles ?? []).map((role) =>
    String(role).toUpperCase(),
  );
  return (
    normalized.includes('STAFF') &&
    !normalized.includes('PROVIDER') &&
    !normalized.includes('PHOTOGRAPHER') &&
    !normalized.includes('ADMIN')
  );
}

export function isProfileEntryPath(path?: string | null): boolean {
  if (!path) return false;
  const clean = stripQueryAndHash(path.trim()).replace(/\/+$/, '') || '/';
  return clean === '/profile' || clean === '/(tabs)/profile';
}

export function safeReturnTo(
  value?: string | string[] | null,
  fallback: Href = '/(tabs)' as Href,
): Href {
  const normalized = unwrapRouteParam(value);
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return fallback;
  }
  if (normalized.startsWith('/(auth)') || normalized.startsWith('/auth')) {
    return fallback;
  }
  return normalized as Href;
}

export function normalizePostLoginReturnTo(
  value?: string | string[] | null,
): string | undefined {
  const normalized = unwrapRouteParam(value);
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return undefined;
  }
  if (normalized.startsWith('/(auth)') || normalized.startsWith('/auth')) {
    return undefined;
  }
  // Account tab / profile logout triggers auth without an action target; return home instead.
  if (isProfileEntryPath(normalized)) {
    return undefined;
  }
  return normalized;
}

/** Resolves the single post-login / post-OAuth destination by role and safe returnTo. */
export function resolvePostAuthDestination(
  user: Pick<SessionUser, 'roles' | 'hasCompletedOnboarding'>,
  returnTo?: string | string[] | null,
): Href {
  if (isStaffPortalUser(user)) {
    return '/staff' as Href;
  }

  if (isPartnerPortalUser(user)) {
    return '/provider' as Href;
  }

  const cleanReturnTo = normalizePostLoginReturnTo(returnTo);
  const destination = safeReturnTo(cleanReturnTo, '/(tabs)' as Href);

  if (user.hasCompletedOnboarding === false) {
    return {
      pathname: '/preferences',
      params: { onboarding: '1', returnTo: String(destination) },
    } as unknown as Href;
  }

  return destination;
}

export function buildLoginHref(returnTo?: string | null): Href {
  const cleanReturnTo = normalizePostLoginReturnTo(returnTo);
  if (!cleanReturnTo) {
    return '/(auth)/login' as Href;
  }
  return {
    pathname: '/(auth)/login',
    params: { returnTo: cleanReturnTo },
  } as unknown as Href;
}

export async function savePendingOAuthReturnTo(
  returnTo?: string | string[] | null,
): Promise<void> {
  const cleanReturnTo = normalizePostLoginReturnTo(returnTo);
  if (!cleanReturnTo) {
    await appStorage.remove(PENDING_OAUTH_RETURN_TO_KEY);
    return;
  }
  await appStorage.set(
    PENDING_OAUTH_RETURN_TO_KEY,
    JSON.stringify({ returnTo: cleanReturnTo, savedAt: Date.now() }),
  );
}

export async function peekPendingOAuthReturnTo(): Promise<string | undefined> {
  try {
    const raw = await appStorage.get(PENDING_OAUTH_RETURN_TO_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { returnTo?: string; savedAt?: number };
    if (
      typeof parsed?.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > PENDING_OAUTH_TTL_MS
    ) {
      await appStorage.remove(PENDING_OAUTH_RETURN_TO_KEY);
      return undefined;
    }
    return normalizePostLoginReturnTo(parsed.returnTo);
  } catch {
    return undefined;
  }
}

export async function clearPendingOAuthReturnTo(): Promise<void> {
  await appStorage.remove(PENDING_OAUTH_RETURN_TO_KEY);
}

const ACTIVE_PORTAL_MODE_KEY = 'vh_active_portal_mode';
export type PortalMode = 'provider' | 'customer' | 'staff';
let currentPortalModeCache: PortalMode | null = null;
const portalModeListeners = new Set<(mode: PortalMode) => void>();

export function getCurrentPortalMode(): PortalMode | null {
  return currentPortalModeCache;
}

export function subscribePortalMode(
  listener: (mode: PortalMode) => void,
): () => void {
  portalModeListeners.add(listener);
  return () => {
    portalModeListeners.delete(listener);
  };
}

export async function setActivePortalMode(mode: PortalMode): Promise<void> {
  const changed = currentPortalModeCache !== mode;
  currentPortalModeCache = mode;
  if (changed) {
    portalModeListeners.forEach((listener) => listener(mode));
  }
  await appStorage.set(ACTIVE_PORTAL_MODE_KEY, mode);
}

export async function getActivePortalMode(): Promise<PortalMode | null> {
  if (currentPortalModeCache) return currentPortalModeCache;
  try {
    const raw = await appStorage.get(ACTIVE_PORTAL_MODE_KEY);
    if (raw === 'provider' || raw === 'customer' || raw === 'staff') {
      currentPortalModeCache = raw;
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
