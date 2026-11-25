const providerAvailabilityVersions = new Map<string, number>();
let discoveryCacheVersion = 0;

export function getProviderAvailabilityVersion(providerId: string): number {
  return providerAvailabilityVersions.get(providerId) ?? 0;
}

export function bumpProviderAvailabilityVersion(
  providerId?: string | null,
): void {
  discoveryCacheVersion += 1;
  if (!providerId) return;
  const key = String(providerId);
  providerAvailabilityVersions.set(
    key,
    (providerAvailabilityVersions.get(key) ?? 0) + 1,
  );
}

export function getDiscoveryCacheVersion(): number {
  return discoveryCacheVersion;
}
