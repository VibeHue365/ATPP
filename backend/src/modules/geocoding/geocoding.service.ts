import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface CacheEntry { expiresAt: number; results: NominatimResult[]; }
interface PhotonFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
}
interface PhotonResponse { features?: PhotonFeature[]; }

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private lastRequestAt = 0;

  async search(query: string): Promise<NominatimResult[]> {
    const key = query.toLocaleLowerCase('vi');
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.results;

    const waitMs = Math.max(0, this.lastRequestAt + 1_100 - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.lastRequestAt = Date.now();

    const nominatimParams = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'vn',
      'accept-language': 'vi',
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${nominatimParams}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'VibeHue/1.0 (location search)',
          },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const results = await response.json() as NominatimResult[];
      this.cache.set(key, { results, expiresAt: Date.now() + 600_000 });
      return results;
    } catch (nominatimError) {
      this.logger.warn(
        `Nominatim search failed: ${nominatimError instanceof Error ? nominatimError.message : 'unknown error'}; trying Photon fallback`,
      );
    }

    try {
      const photonParams = new URLSearchParams({ q: query, limit: '5' });
      const response = await fetch(
        `https://photon.komoot.io/api/?${photonParams}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'VibeHue/1.0 (location search)',
          },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as PhotonResponse;
      const results = (payload.features ?? []).flatMap((feature, index) => {
        const coordinates = feature.geometry?.coordinates;
        const properties = feature.properties ?? {};
        const longitude = Number(Array.isArray(coordinates) ? coordinates[0] : NaN);
        const latitude = Number(Array.isArray(coordinates) ? coordinates[1] : NaN);
        const address = [
          properties.name,
          properties.street,
          properties.locality,
          properties.district,
          properties.city,
          properties.state,
          properties.country,
        ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address.length) return [];
        return [{
          place_id: typeof properties.osm_id === 'number' ? properties.osm_id : index + 1,
          display_name: [...new Set(address)].join(', '),
          lat: latitude.toString(),
          lon: longitude.toString(),
        }];
      });
      this.cache.set(key, { results, expiresAt: Date.now() + 600_000 });
      return results;
    } catch (photonError) {
      this.logger.warn(
        `Photon fallback failed: ${photonError instanceof Error ? photonError.message : 'unknown error'}`,
      );
      throw new BadGatewayException('Dịch vụ tìm địa chỉ hiện không khả dụng.');
    }
  }
}