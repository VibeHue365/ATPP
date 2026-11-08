import httpClient from '@/apis/httpClient';

export interface GeocodingPlaceResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const geocodingApi = {
  /**
   * Search addresses across all 63 provinces/cities in Vietnam
   * via Backend GET /geocoding/search (OpenStreetMap Nominatim + Photon fallback)
   */
  search: (query: string) =>
    httpClient.get<never, GeocodingPlaceResult[]>(
      `/geocoding/search?q=${encodeURIComponent(query.trim())}`,
    ),

  /**
   * Smart search for Vietnamese addresses:
   * - Strips trailing punctuation (commas, dots)
   * - Separates house numbers (OpenStreetMap often lacks building numbers in VN)
   * - Adds smart "Đường" prefix and active city context (Đà Nẵng, Huế, TP.HCM...)
   * - Reattaches original house number to the display label
   */
  smartSearch: async (query: string, cityHint?: string): Promise<GeocodingPlaceResult[]> => {
    const cleaned = query.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
    if (cleaned.length < 2) return [];

    const houseMatch = cleaned.match(/^(\d+[\w\/\-]*\s+)/);
    const houseNumber = houseMatch ? houseMatch[1].trim() : '';
    const streetPart = houseMatch ? cleaned.slice(houseMatch[0].length).trim() : cleaned;
    const hasExplicitCity = /(đà nẵng|đà lạt|huế|hà nội|hồ chí minh|sài gòn|hội an|quảng nam|hải phòng|cần thơ)/i.test(cleaned);

    const candidates: string[] = [];

    // Candidate 1: streetPart + city (highest hit rate on OSM Vietnam)
    if (streetPart) {
      const streetClean = streetPart.replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim();
      const streetWithPrefix = streetClean.toLowerCase().startsWith('đường')
        ? streetClean
        : `Đường ${streetClean}`;
      if (!hasExplicitCity && cityHint) {
        candidates.push(`${streetWithPrefix} ${cityHint}`);
      }
      candidates.push(streetWithPrefix);

      // If user provided commas e.g. "Nguyễn Hành, Hoà Cường"
      if (streetPart !== streetClean) {
        if (!hasExplicitCity && cityHint) {
          candidates.push(`Đường ${streetPart} ${cityHint}`);
        }
        candidates.push(`Đường ${streetPart}`);
      }
    }

    // Candidate 2: cleaned + city
    if (!hasExplicitCity && cityHint) {
      candidates.push(`${cleaned} ${cityHint}`);
    }

    // Candidate 3: raw cleaned
    candidates.push(cleaned);

    const uniqueCandidates = Array.from(new Set(candidates));

    for (const cand of uniqueCandidates) {
      try {
        const data = await geocodingApi.search(cand);
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item) => {
            let displayName = item.display_name;
            if (houseNumber && !displayName.startsWith(houseNumber)) {
              displayName = `${houseNumber} ${displayName}`;
            }
            return {
              ...item,
              display_name: displayName,
            };
          });
        }
      } catch {
        // Continue to fallback candidates
      }
    }
    return [];
  },
};
