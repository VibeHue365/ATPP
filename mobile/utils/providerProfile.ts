import type { ProviderProfile } from '@/types/provider';
import { isRenderableImageUrl } from '@/utils/media';

export interface ProviderSettingsPayloadInput {
  profile: ProviderProfile | null;
  businessName: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  storeLat: number;
  storeLng: number;
  serviceRadiusKm: number;
  logoUrl?: string | null;
  coverUrl?: string | null;
  rentalPolicy?: string | null;
  fallbackEmail?: string | null;
}

function cleanMediaArray(images?: unknown): string[] | undefined {
  if (!Array.isArray(images)) return undefined;
  const cleaned = images.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Resolves a stored media candidate: keeps explicitly supplied values or falls back
 * only to renderable URLs so dead SVG/Web paths do not keep overriding updates.
 */
function pickMediaUrl(
  explicitValue?: string | null,
  existingMediaValue?: string | null,
  fallbackTopLevel?: string | null,
): string | null | undefined {
  const trimmedExplicit = explicitValue?.trim();
  if (trimmedExplicit) return trimmedExplicit;
  if (isRenderableImageUrl(existingMediaValue)) return existingMediaValue!.trim();
  if (isRenderableImageUrl(fallbackTopLevel)) return fallbackTopLevel!.trim();
  return existingMediaValue ?? undefined;
}

export function buildCleanProviderMediaUpdate(
  profile: ProviderProfile | null,
  nextLogoUrl?: string | null,
  nextCoverUrl?: string | null,
): {
  media: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    images?: string[];
  };
} {
  const existing = profile?.media;
  const logoUrl = pickMediaUrl(nextLogoUrl, existing?.logoUrl, profile?.logoUrl);
  const coverUrl = pickMediaUrl(nextCoverUrl, existing?.coverUrl, profile?.coverUrl);
  const images = cleanMediaArray(existing?.images);

  return {
    media: {
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(coverUrl !== undefined ? { coverUrl } : {}),
      ...(images ? { images } : {}),
    },
  };
}

/**
 * Builds a strictly whitelisted payload for `PATCH /providers/me`
 * matching `UpdateProviderProfileDto` under NestJS `forbidNonWhitelisted`.
 */
export function buildCleanProviderUpdatePayload(
  input: ProviderSettingsPayloadInput,
): Record<string, any> {
  const {
    profile,
    businessName,
    contactPhone,
    addressLine,
    city,
    storeLat,
    storeLng,
    serviceRadiusKm,
    logoUrl,
    coverUrl,
    rentalPolicy,
    fallbackEmail,
  } = input;

  const existingEmail =
    profile?.contact?.email?.trim() || fallbackEmail?.trim() || '';
  const cleanPhone =
    contactPhone.trim() || profile?.contact?.phone?.trim() || '';
  const cleanWebsite = profile?.contact?.website?.trim();

  const payload: Record<string, any> = {
    businessName: businessName.trim(),
    address: {
      addressLine: addressLine.trim(),
      ...(profile?.address?.ward ? { ward: profile.address.ward } : {}),
      ...(profile?.address?.district ? { district: profile.address.district } : {}),
      city: profile?.address?.city?.trim() || city.trim() || 'Thừa Thiên Huế',
      geo: {
        type: 'Point' as const,
        coordinates: [storeLng, storeLat] as [number, number],
      },
    },
    photographySettings: {
      serviceRadiusKm,
    },
    ...buildCleanProviderMediaUpdate(profile, logoUrl, coverUrl),
  };

  if (existingEmail && cleanPhone) {
    payload.contact = {
      email: existingEmail,
      phone: cleanPhone,
      ...(cleanWebsite ? { website: cleanWebsite } : {}),
    };
  }

  const trimmedPolicy = rentalPolicy?.trim();
  if (trimmedPolicy !== undefined && (trimmedPolicy || profile?.policies?.rentalPolicy || profile?.policies?.cancellationPolicy)) {
    payload.policies = {
      ...(profile?.policies?.cancellationPolicy !== undefined
        ? { cancellationPolicy: profile.policies.cancellationPolicy }
        : {}),
      rentalPolicy: trimmedPolicy || null,
    };
  }

  return payload;
}
