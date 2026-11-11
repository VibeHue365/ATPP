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
   * - Local fallback for famous districts/wards if network search is empty
   */
  smartSearch: async (query: string, cityHint?: string): Promise<GeocodingPlaceResult[]> => {
    const cleaned = query.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
    if (cleaned.length < 2) return [];

    const houseMatch = cleaned.match(/^(\d+[\w\/\-]*\s+)/);
    const houseNumber = houseMatch ? houseMatch[1].trim() : '';
    const streetPart = (houseMatch ? cleaned.slice(houseMatch[0].length).trim() : cleaned).replace(/^[,.\s]+|[,.\s]+$/g, '');
    const hasExplicitCity = /(đà nẵng|đà lạt|huế|hà nội|hồ chí minh|sài gòn|hội an|quảng nam|hải phòng|cần thơ)/i.test(cleaned);

    const candidates: string[] = [];

    // Extract first segment if user typed commas: "Nguyễn Hành, Hoà Cường" -> "Nguyễn Hành"
    const segments = streetPart.split(',').map((s) => s.trim()).filter(Boolean);
    const primaryStreet = segments[0] || streetPart;

    // 1. Street with prefix + City Hint (Highest accuracy in OSM Vietnam)
    if (primaryStreet) {
      const cleanStreet = primaryStreet.replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim();
      const withPrefix = cleanStreet.toLowerCase().startsWith('đường')
        ? cleanStreet
        : `Đường ${cleanStreet}`;

      if (!hasExplicitCity && cityHint) {
        candidates.push(`${withPrefix}, ${cityHint}`);
        candidates.push(`${cleanStreet}, ${cityHint}`);
      }
      candidates.push(withPrefix);
      candidates.push(cleanStreet);
    }

    // 2. Full Street part with City Hint
    if (streetPart && streetPart !== primaryStreet) {
      if (!hasExplicitCity && cityHint) {
        candidates.push(`${streetPart}, ${cityHint}`);
      }
      candidates.push(streetPart);
    }

    // 3. Full original cleaned query with City Hint
    if (!hasExplicitCity && cityHint) {
      candidates.push(`${cleaned}, ${cityHint}`);
    }
    candidates.push(cleaned);

    const uniqueCandidates = Array.from(new Set(candidates)).slice(0, 4);

    for (const cand of uniqueCandidates) {
      try {
        const data = await geocodingApi.search(cand);
        if (Array.isArray(data) && data.length > 0) {
          // Deduplicate by place_id and format display_name
          const seen = new Set<string>();
          const formatted: GeocodingPlaceResult[] = [];

          for (const item of data) {
            const key = `${Number(item.lat).toFixed(4)},${Number(item.lon).toFixed(4)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            let displayName = item.display_name;
            if (houseNumber && !displayName.startsWith(houseNumber)) {
              displayName = `${houseNumber} ${displayName}`;
            }
            formatted.push({
              ...item,
              display_name: displayName,
            });
          }

          if (formatted.length > 0) {
            // If cityHint is known, prioritize results that include cityHint
            if (cityHint) {
              const hintLower = cityHint.toLowerCase();
              formatted.sort((a, b) => {
                const aHas = a.display_name.toLowerCase().includes(hintLower) ? 1 : 0;
                const bHas = b.display_name.toLowerCase().includes(hintLower) ? 1 : 0;
                return bHas - aHas;
              });
            }
            return formatted;
          }
        }
      } catch {
        // Continue to fallback candidates
      }
    }

    // 4. Instant district / ward fallback for common Vietnamese areas
    const lowerQuery = cleaned.toLowerCase();
    const fallbackDistricts: Array<{ name: string; lat: number; lng: number; city: string }> = [
      { name: 'Phường Hòa Hiệp Nam, Quận Liên Chiểu', lat: 16.1084, lng: 108.1322, city: 'Đà Nẵng' },
      { name: 'Phường Hòa Cường Bắc, Quận Hải Châu', lat: 16.038, lng: 108.215, city: 'Đà Nẵng' },
      { name: 'Phường Hòa Cường Nam, Quận Hải Châu', lat: 16.028, lng: 108.216, city: 'Đà Nẵng' },
      { name: 'Đường Nguyễn Hành, Phường Cẩm Lệ', lat: 16.021, lng: 108.204, city: 'Đà Nẵng' },
      { name: 'Quận Liên Chiểu', lat: 16.0767, lng: 108.1392, city: 'Đà Nẵng' },
      { name: 'Quận Sơn Trà', lat: 16.075, lng: 108.235, city: 'Đà Nẵng' },
      { name: 'Quận Ngũ Hành Sơn', lat: 16.035, lng: 108.245, city: 'Đà Nẵng' },
      { name: 'Quận Hải Châu', lat: 16.0544, lng: 108.22, city: 'Đà Nẵng' },
      { name: 'Quận Thanh Khê', lat: 16.065, lng: 108.19, city: 'Đà Nẵng' },
      { name: 'Phường Thuận Hòa, Phú Xuân', lat: 16.471, lng: 107.575, city: 'Huế' },
      { name: 'Phường Phú Xuân, TP. Huế', lat: 16.468, lng: 107.578, city: 'Huế' },
      { name: 'Phường Thuận Hóa, TP. Huế', lat: 16.462, lng: 107.59, city: 'Huế' },
      { name: 'Phường Vỹ Dạ, TP. Huế', lat: 16.475, lng: 107.61, city: 'Huế' },
      { name: 'Quận Hai Bà Trưng', lat: 21.0125, lng: 105.852, city: 'Hà Nội' },
      { name: 'Quận Hoàn Kiếm', lat: 21.0285, lng: 105.8542, city: 'Hà Nội' },
      { name: 'Quận 1, Bến Nghé', lat: 10.7769, lng: 106.7009, city: 'Hồ Chí Minh' },
    ];

    const matchedFallbacks = fallbackDistricts.filter(
      (d) =>
        lowerQuery.includes(d.name.toLowerCase()) ||
        d.name.toLowerCase().includes(lowerQuery) ||
        (lowerQuery.includes('nguyễn hành') && d.name.includes('Nguyễn Hành')) ||
        (lowerQuery.includes('hoà cường') && d.name.includes('Hòa Cường')) ||
        (lowerQuery.includes('hòa hiệp') && d.name.includes('Hòa Hiệp')),
    );

    if (matchedFallbacks.length > 0) {
      return matchedFallbacks.map((f, idx) => ({
        place_id: 999000 + idx,
        display_name: houseNumber ? `${houseNumber} ${f.name}, Thành phố ${f.city}` : `${f.name}, Thành phố ${f.city}`,
        lat: String(f.lat),
        lon: String(f.lng),
      }));
    }

    return [];
  },
};
