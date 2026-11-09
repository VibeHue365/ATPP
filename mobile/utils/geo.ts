import { Linking, Platform } from 'react-native';

export interface GeoCoord {
  lat: number;
  lng: number;
}

export type LatLng = GeoCoord;

export interface CityPreset {
  code: string;
  name: string;
  lat: number;
  lng: number;
  spots: Array<{
    id: string;
    label: string;
    address: string;
    lat: number;
    lng: number;
    indoor?: boolean;
  }>;
}

export const VIETNAM_CITIES: CityPreset[] = [
  {
    code: 'hue',
    name: 'Huế',
    lat: 16.4637,
    lng: 107.5909,
    spots: [
      {
        id: 'hue-dai-noi',
        label: 'Đại Nội Huế',
        address: 'Đại Nội Huế (Hoàng Thành), Phú Hậu, TP. Huế',
        lat: 16.4698,
        lng: 107.5786,
      },
      {
        id: 'hue-an-dinh',
        label: 'Cung An Định',
        address: 'Cung An Định, 179B Phan Đình Phùng, TP. Huế',
        lat: 16.4581,
        lng: 107.6001,
        indoor: true,
      },
      {
        id: 'hue-tu-duc',
        label: 'Lăng Tự Đức',
        address: 'Lăng Tự Đức (Khiêm Lăng), Thủy Xuân, TP. Huế',
        lat: 16.4331,
        lng: 107.5658,
      },
      {
        id: 'hue-minh-mang',
        label: 'Lăng Minh Mạng',
        address: 'Lăng Minh Mạng, Hương Thọ, TP. Huế',
        lat: 16.3879,
        lng: 107.5714,
      },
      {
        id: 'hue-khai-dinh',
        label: 'Lăng Khải Định',
        address: 'Lăng Khải Định, Thủy Bằng, TP. Huế',
        lat: 16.3991,
        lng: 107.5904,
        indoor: true,
      },
      {
        id: 'hue-thien-mu',
        label: 'Chùa Thiên Mụ',
        address: 'Chùa Thiên Mụ, Kim Long, TP. Huế',
        lat: 16.4534,
        lng: 107.5451,
      },
      {
        id: 'hue-truong-tien',
        label: 'Cầu Trường Tiền',
        address: 'Cầu Trường Tiền & Bờ sông Hương, Phú Hội, TP. Huế',
        lat: 16.4689,
        lng: 107.5889,
      },
    ],
  },
  {
    code: 'da-nang',
    name: 'Đà Nẵng',
    lat: 16.0544,
    lng: 108.2022,
    spots: [
      {
        id: 'dn-linh-ung',
        label: 'Chùa Linh Ứng Sơn Trà',
        address: 'Chùa Linh Ứng, Bán đảo Sơn Trà, Sơn Trà, Đà Nẵng',
        lat: 16.1003,
        lng: 108.2778,
      },
      {
        id: 'dn-cau-rong',
        label: 'Cầu Rồng & Bờ Đông Sông Hàn',
        address: 'Cầu Rồng, Phước Ninh, Hải Châu, Đà Nẵng',
        lat: 16.0611,
        lng: 108.2275,
      },
      {
        id: 'dn-bao-tang',
        label: 'Bảo tàng Điêu khắc Chăm',
        address: 'Số 02 Đường 2 Tháng 9, Hải Châu, Đà Nẵng',
        lat: 16.0604,
        lng: 108.2235,
        indoor: true,
      },
      {
        id: 'dn-my-khe',
        label: 'Biển Mỹ Khê',
        address: 'Bãi biển Mỹ Khê, Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',
        lat: 16.0638,
        lng: 108.2458,
      },
    ],
  },
  {
    code: 'hoi-an',
    name: 'Hội An',
    lat: 15.8801,
    lng: 108.338,
    spots: [
      {
        id: 'ha-chua-cau',
        label: 'Chùa Cầu Phố Cổ',
        address: 'Chùa Cầu, Nguyễn Thị Minh Khai, Minh An, TP. Hội An',
        lat: 15.8771,
        lng: 108.3261,
      },
      {
        id: 'ha-hoi-quan',
        label: 'Hội quán Phúc Kiến',
        address: '46 Trần Phú, Minh An, TP. Hội An',
        lat: 15.8775,
        lng: 108.3305,
        indoor: true,
      },
      {
        id: 'ha-song-hoai',
        label: 'Bờ sông Hoài & Đường Bạch Đằng',
        address: 'Đường Bạch Đằng, Phố cổ Hội An, Quảng Nam',
        lat: 15.8764,
        lng: 108.3282,
      },
    ],
  },
  {
    code: 'ha-noi',
    name: 'Hà Nội',
    lat: 21.0285,
    lng: 105.8542,
    spots: [
      {
        id: 'hn-hoang-thanh',
        label: 'Hoàng thành Thăng Long',
        address: '19C Hoàng Diệu, Điện Biên, Ba Đình, Hà Nội',
        lat: 21.0352,
        lng: 105.8403,
      },
      {
        id: 'hn-van-mieu',
        label: 'Văn Miếu Quốc Tử Giám',
        address: '58 Quốc Tử Giám, Đống Đa, Hà Nội',
        lat: 21.0278,
        lng: 105.8355,
      },
      {
        id: 'hn-ho-guom',
        label: 'Hồ Hoàn Kiếm & Đền Ngọc Sơn',
        address: 'Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
        lat: 21.0288,
        lng: 105.8525,
      },
      {
        id: 'hn-phan-dinh-phung',
        label: 'Phố Phan Đình Phùng',
        address: 'Phố Phan Đình Phùng, Quán Thánh, Ba Đình, Hà Nội',
        lat: 21.0402,
        lng: 105.8432,
      },
    ],
  },
  {
    code: 'hcm',
    name: 'TP.HCM',
    lat: 10.7769,
    lng: 106.7009,
    spots: [
      {
        id: 'hcm-dinh-doc-lap',
        label: 'Dinh Độc Lập',
        address: '135 Nam Kỳ Khởi Nghĩa, Quận 1, TP. Hồ Chí Minh',
        lat: 10.777,
        lng: 106.6953,
        indoor: true,
      },
      {
        id: 'hcm-bao-tang-ao-dai',
        label: 'Bảo tàng Áo Dài TP.HCM',
        address: '206/19/30 Long Thuận, Long Phước, TP. Thủ Đức, TP.HCM',
        lat: 10.8108,
        lng: 106.8543,
        indoor: true,
      },
      {
        id: 'hcm-buu-dien',
        label: 'Bưu điện Trung tâm Sài Gòn',
        address: '02 Công xã Paris, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        lat: 10.7798,
        lng: 106.6999,
      },
      {
        id: 'hcm-lang-ong',
        label: 'Lăng Ông Bà Chiểu',
        address: '01 Vũ Tùng, Phường 1, Bình Thạnh, TP. Hồ Chí Minh',
        lat: 10.8021,
        lng: 106.697,
      },
    ],
  },
  {
    code: 'da-lat',
    name: 'Đà Lạt',
    lat: 11.9404,
    lng: 108.4583,
    spots: [
      {
        id: 'dl-dinh-1',
        label: 'Dinh I Bảo Đại (King Palace)',
        address: 'Trần Quang Diệu, Phường 10, TP. Đà Lạt',
        lat: 11.9355,
        lng: 108.4748,
        indoor: true,
      },
      {
        id: 'dl-ga-da-lat',
        label: 'Ga Cổ Đà Lạt',
        address: 'Quang Trung, Phường 10, TP. Đà Lạt',
        lat: 11.9419,
        lng: 108.4547,
      },
      {
        id: 'dl-ho-xuan-huong',
        label: 'Hồ Xuân Hương',
        address: 'Trần Quốc Toản, Phường 1, TP. Đà Lạt',
        lat: 11.9422,
        lng: 108.4426,
      },
    ],
  },
];

export const ALL_PRESET_SPOTS = VIETNAM_CITIES.flatMap((c) =>
  c.spots.map((s) => ({ ...s, cityName: c.name, cityCode: c.code })),
);

export interface CanonicalCity {
  code: string;
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const CANONICAL_CITIES: CanonicalCity[] = [
  {
    code: 'hue',
    name: 'Huế',
    lat: 16.4637,
    lng: 107.5909,
    aliases: [
      'huế',
      'thừa thiên huế',
      'thành phố huế',
      'thừa thiên - huế',
      'thừa thiên',
      'tt huế',
      'tp huế',
      'tp. huế',
      'tp.huế',
      'phú hội',
      'thuận hóa',
      'hương thủy',
      'hương trà',
      'phong điền',
    ],
  },
  {
    code: 'da-nang',
    name: 'Đà Nẵng',
    lat: 16.0544,
    lng: 108.2022,
    aliases: [
      'đà nẵng',
      'thành phố đà nẵng',
      'tp đà nẵng',
      'tp. đà nẵng',
      'tp.đà nẵng',
      'da nang',
      'hải châu',
      'sơn trà',
      'ngũ hành sơn',
      'thanh khê',
      'cẩm lệ',
      'liên chiểu',
      'hòa vang',
    ],
  },
  {
    code: 'hoi-an',
    name: 'Hội An',
    lat: 15.8801,
    lng: 108.338,
    aliases: [
      'hội an',
      'thành phố hội an',
      'tp hội an',
      'tp. hội an',
      'tp.hội an',
      'hoi an',
      'quảng nam',
      'phố cổ hội an',
      'cẩm an',
      'cẩm châu',
    ],
  },
  {
    code: 'ha-noi',
    name: 'Hà Nội',
    lat: 21.0285,
    lng: 105.8542,
    aliases: [
      'hà nội',
      'thành phố hà nội',
      'tp hà nội',
      'tp. hà nội',
      'tp.hà nội',
      'ha noi',
      'hanoi',
      'hoàn kiếm',
      'ba đình',
      'đống đa',
      'hai bà trưng',
      'cầu giấy',
      'tây hồ',
      'thanh xuân',
      'hà đông',
    ],
  },
  {
    code: 'hcm',
    name: 'TP.HCM',
    lat: 10.7769,
    lng: 106.7009,
    aliases: [
      'hồ chí minh',
      'thành phố hồ chí minh',
      'tp.hcm',
      'tp hcm',
      'tphcm',
      'tp. hồ chí minh',
      'tp.hồ chí minh',
      'ho chi minh',
      'saigon',
      'sài gòn',
      'quận 1',
      'quận 3',
      'quận 5',
      'quận 7',
      'quận 10',
      'thủ đức',
      'bình thạnh',
      'phú nhuận',
    ],
  },
  {
    code: 'da-lat',
    name: 'Đà Lạt',
    lat: 11.9404,
    lng: 108.4583,
    aliases: [
      'đà lạt',
      'thành phố đà lạt',
      'tp đà lạt',
      'tp. đà lạt',
      'tp.đà lạt',
      'da lat',
      'lâm đồng',
    ],
  },
];

export function getCanonicalCityByCode(code: string): CanonicalCity | undefined {
  return CANONICAL_CITIES.find((c) => c.code.toLowerCase() === code.toLowerCase());
}

export function detectCanonicalCityFromText(text?: string | null): CanonicalCity {
  const normalized = (text || '').toLowerCase().trim();
  if (!normalized) return CANONICAL_CITIES[0];

  for (const city of CANONICAL_CITIES) {
    for (const alias of city.aliases) {
      if (normalized.includes(alias)) {
        return city;
      }
    }
  }
  return CANONICAL_CITIES[0];
}

export function detectNearestCanonicalCity(lat: number, lng: number): CanonicalCity {
  let best = CANONICAL_CITIES[0];
  let minKm = Infinity;
  for (const city of CANONICAL_CITIES) {
    const dist = haversineKm(lat, lng, city.lat, city.lng);
    if (dist < minKm) {
      minKm = dist;
      best = city;
    }
  }
  return best;
}

export function matchStoreToCity(store: any, cityCode: string): boolean {
  if (!store || !cityCode || cityCode === 'ALL') return true;
  const targetCity = getCanonicalCityByCode(cityCode);
  if (!targetCity) return true;

  // 1. Check address text against target city's aliases
  const addrParts = [
    store.address?.city,
    store.address?.district,
    store.address?.ward,
    store.address?.addressLine,
    typeof store.address === 'string' ? store.address : '',
    store.businessName,
    store.locationAddress,
  ].filter(Boolean);
  const fullText = addrParts.join(' ').toLowerCase();

  for (const alias of targetCity.aliases) {
    if (fullText.includes(alias)) {
      return true;
    }
  }

  // 2. Check store coordinates: if within 45km of target city center
  const coords = resolveEntityCoords(store);
  if (isValidLatLng(coords.lat, coords.lng)) {
    const distKm = haversineKm(coords.lat, coords.lng, targetCity.lat, targetCity.lng);
    if (distKm <= 45) {
      return true;
    }
  }

  return false;
}

let cachedUserPosition: {
  lat: number;
  lng: number;
  label: string;
  cityCode: string;
  isGps?: boolean;
} | null = null;

export function setCachedUserPosition(pos: {
  lat: number;
  lng: number;
  label: string;
  cityCode: string;
  isGps?: boolean;
}) {
  cachedUserPosition = pos;
}

export async function fetchAutoUserPosition(): Promise<{
  lat: number;
  lng: number;
  label: string;
  cityCode: string;
}> {
  if (cachedUserPosition) {
    return cachedUserPosition;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (isValidLatLng(lat, lng)) {
        const nearestCity = detectNearestCanonicalCity(lat, lng);
        const cityName = data.city || nearestCity.name;
        const result = {
          lat,
          lng,
          label: `${cityName} (Vị trí hiện tại)`,
          cityCode: nearestCity.code,
        };
        cachedUserPosition = result;
        return result;
      }
    }
  } catch {
    // network failure or offline
  }

  return {
    lat: 16.0685,
    lng: 108.2215,
    label: 'Đà Nẵng (Vị trí mạng)',
    cityCode: 'da-nang',
  };
}

export function isValidLatLng(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Detect which city preset matches a free-text address or city name
 */
export function detectCityPreset(text?: string | null): CityPreset {
  const normalized = (text || '').toLowerCase();
  if (normalized.includes('đà nẵng') || normalized.includes('da nang') || normalized.includes('sơn trà') || normalized.includes('hải châu')) {
    return VIETNAM_CITIES[1];
  }
  if (normalized.includes('hội an') || normalized.includes('hoi an') || normalized.includes('quảng nam')) {
    return VIETNAM_CITIES[2];
  }
  if (normalized.includes('hà nội') || normalized.includes('ha noi') || normalized.includes('hoàn kiếm') || normalized.includes('ba đình') || normalized.includes('đống đa')) {
    return VIETNAM_CITIES[3];
  }
  if (
    normalized.includes('hồ chí minh') ||
    normalized.includes('ho chi minh') ||
    normalized.includes('tp.hcm') ||
    normalized.includes('tphcm') ||
    normalized.includes('sài gòn') ||
    normalized.includes('quận 1') ||
    normalized.includes('thủ đức')
  ) {
    return VIETNAM_CITIES[4];
  }
  if (normalized.includes('đà lạt') || normalized.includes('da lat') || normalized.includes('lâm đồng')) {
    return VIETNAM_CITIES[5];
  }
  return VIETNAM_CITIES[0]; // Default Hue
}

export const detectCityFromText = detectCityPreset;

/**
 * Deterministic small offset from an ID string so stores in the same city without exact DB geo coordinates don't stack on top of each other
 */
function deterministicOffset(seed: string): { dLat: number; dLng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const radius = 0.003 + ((Math.abs(hash >> 4) % 12) * 0.0012); // ~300m to 1.7km
  return {
    dLat: Number((Math.sin(angle) * radius).toFixed(6)),
    dLng: Number((Math.cos(angle) * radius).toFixed(6)),
  };
}

export const VIETNAM_DISTRICT_PRESETS: Array<{
  keywords: string[];
  lat: number;
  lng: number;
}> = [
  // Đà Nẵng
  {
    keywords: ['hòa hiệp', 'hoa hiep', 'liên chiểu', 'lien chieu', 'hòa khánh', 'hoa khanh'],
    lat: 16.1084,
    lng: 108.1322,
  },
  {
    keywords: ['hải châu', 'hai chau', 'phước ninh', 'thạch thang', 'hòa thuận', 'bạch đằng', 'nguyễn văn linh'],
    lat: 16.0544,
    lng: 108.22,
  },
  {
    keywords: ['thanh khê', 'thanh khe', 'tam thuận', 'chính gián', 'vĩnh trung', 'xuân hà', 'điện biên phủ'],
    lat: 16.065,
    lng: 108.19,
  },
  {
    keywords: ['sơn trà', 'son tra', 'an hải', 'an đồn', 'thọ quang', 'mạn thái', 'phước mỹ', 'võ nguyên giáp'],
    lat: 16.075,
    lng: 108.235,
  },
  {
    keywords: ['ngũ hành sơn', 'ngu hanh son', 'bắc mỹ an', 'mỹ an', 'hòa hải', 'hòa quý'],
    lat: 16.035,
    lng: 108.245,
  },
  {
    keywords: ['cẩm lệ', 'cam le', 'hòa cường', 'hoa cuong', 'hòa xuân', 'khuê trung', 'nguyễn hành'],
    lat: 16.02,
    lng: 108.205,
  },
  {
    keywords: ['hòa vang', 'hoa vang', 'bà nà', 'hòa vương'],
    lat: 16.002,
    lng: 108.085,
  },

  // Huế
  {
    keywords: ['thuận hòa', 'thuan hoa', 'lê huân', 'thạch hãn', 'cửa hữu', 'nguyễn trãi'],
    lat: 16.471,
    lng: 107.575,
  },
  {
    keywords: ['phú xuân', 'phu xuan', 'kinh thành'],
    lat: 16.468,
    lng: 107.578,
  },
  {
    keywords: ['thuận hoá', 'vĩnh ninh', 'lê lợi', 'nguyễn huệ', 'đại học huế'],
    lat: 16.462,
    lng: 107.59,
  },
  {
    keywords: ['phú hội', 'phu hoi', 'hùng vương', 'phố tây huế', 'bến nghé'],
    lat: 16.466,
    lng: 107.595,
  },
  {
    keywords: ['vỹ dạ', 'vy da', 'cồn hến'],
    lat: 16.475,
    lng: 107.61,
  },
  {
    keywords: ['hương thủy', 'huong thuy'],
    lat: 16.415,
    lng: 107.65,
  },
  {
    keywords: ['hương trà', 'huong tra', 'kim long'],
    lat: 16.46,
    lng: 107.55,
  },

  // Hà Nội
  {
    keywords: ['hai bà trưng', 'hai ba trung', 'phố huế', 'bạch mai'],
    lat: 21.0125,
    lng: 105.852,
  },
  {
    keywords: ['hoàn kiếm', 'hoan kiem', 'tràng tiền', 'hàng bài', 'hàng bông', 'hồ gươm'],
    lat: 21.0285,
    lng: 105.8542,
  },
  {
    keywords: ['ba đình', 'ba dinh', 'quán thánh', 'liễu giai', 'đội cấn'],
    lat: 21.035,
    lng: 105.828,
  },
  {
    keywords: ['đống đa', 'dong da', 'tôn đức thắng', 'xã đàn', 'chùa bộc'],
    lat: 21.018,
    lng: 105.826,
  },
  {
    keywords: ['tây hồ', 'tay ho', 'quảng an', 'xuân diệu'],
    lat: 21.065,
    lng: 105.825,
  },
  {
    keywords: ['cầu giấy', 'cau giay', 'duy tân', 'xuân thủy'],
    lat: 21.035,
    lng: 105.792,
  },

  // TP. Hồ Chí Minh
  {
    keywords: ['quận 1', 'quan 1', 'bến nghé', 'bến thành', 'nguyễn huệ', 'đồng khởi'],
    lat: 10.7769,
    lng: 106.7009,
  },
  {
    keywords: ['quận 3', 'quan 3', 'võ văn tần', 'nguyễn đình chiểu'],
    lat: 10.782,
    lng: 106.685,
  },
  {
    keywords: ['quận 5', 'quan 5', 'chợ lớn', 'hải thượng lãn ông'],
    lat: 10.755,
    lng: 106.662,
  },
  {
    keywords: ['bình thạnh', 'binh thanh', 'hàng xanh'],
    lat: 10.803,
    lng: 106.708,
  },
  {
    keywords: ['thủ đức', 'thu duc', 'thảo điền', 'an phú', 'song hành'],
    lat: 10.805,
    lng: 106.745,
  },
  {
    keywords: ['tân bình', 'tan binh', 'sân bay tân sơn nhất'],
    lat: 10.801,
    lng: 106.655,
  },

  // Hội An
  {
    keywords: ['phố cổ', 'pho co', 'minh an', 'cẩm phô', 'trần phú', 'nguyễn thái học'],
    lat: 15.8794,
    lng: 108.3283,
  },
  {
    keywords: ['an hội', 'an hoi', 'nguyễn hoàng'],
    lat: 15.876,
    lng: 108.324,
  },
  {
    keywords: ['cẩm châu', 'cam chau', 'cửa đại'],
    lat: 15.885,
    lng: 108.345,
  },
  {
    keywords: ['an bàng', 'an bang', 'cẩm an'],
    lat: 15.912,
    lng: 108.338,
  },
];

/**
 * Extract coordinates from any TàGo entity (Store, Photographer, Booking, Schedule)
 * Falls back intelligently based on address/landmark/city across Vietnam.
 */
export function resolveEntityCoords(entity: any): GeoCoord {
  if (!entity) return { lat: 16.4637, lng: 107.5909 };

  // 1. Direct lat/lng fields
  if (isValidLatLng(Number(entity.latitude), Number(entity.longitude))) {
    return { lat: Number(entity.latitude), lng: Number(entity.longitude) };
  }
  if (isValidLatLng(Number(entity.lat), Number(entity.lng))) {
    return { lat: Number(entity.lat), lng: Number(entity.lng) };
  }
  if (isValidLatLng(Number(entity.locationLatitude), Number(entity.locationLongitude))) {
    return { lat: Number(entity.locationLatitude), lng: Number(entity.locationLongitude) };
  }

  // 2. GeoJSON coordinates: [longitude, latitude]
  const geoCandidates = [
    entity.geo?.coordinates,
    entity.address?.geo?.coordinates,
    entity.rentalSettings?.pickupLocation?.geo?.coordinates,
    entity.locationSnapshot?.geo?.coordinates,
    entity.shootLocationSnapshot?.geo?.coordinates,
    entity.pickupReturnLocationSnapshot?.geo?.coordinates,
    entity._discoveryLocation?.coordinates,
  ];
  for (const coords of geoCandidates) {
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (isValidLatLng(lat, lng)) {
        // If multiple seeded stores share the exact default Hue center (16.4637, 107.5909),
        // spread them slightly by their ID/address so they don't all sit on 1 pixel
        const isGenericHueCenter =
          Math.abs(lat - 16.4637) < 0.0005 && Math.abs(lng - 107.5909) < 0.0005;
        if (isGenericHueCenter && (entity._id || entity.businessName)) {
          const { dLat, dLng } = deterministicOffset(
            String(entity._id || entity.businessName),
          );
          return {
            lat: Number((lat + dLat).toFixed(6)),
            lng: Number((lng + dLng).toFixed(6)),
          };
        }
        return { lat, lng };
      }
    }
  }

  // 3. Match against known heritage/photoshoot landmarks across Vietnam
  const fullText = [
    entity.address?.addressLine,
    entity.address?.ward,
    entity.address?.district,
    entity.address?.city,
    typeof entity.address === 'string' ? entity.address : '',
    entity.locationAddress,
    entity.shootLocation,
    entity.locationSnapshot?.address,
    entity.shootLocationSnapshot?.address,
    entity.pickupReturnLocationSnapshot?.address,
    entity.businessName,
  ]
    .filter(Boolean)
    .join(', ');

  const lower = fullText.toLowerCase();
  for (const spot of ALL_PRESET_SPOTS) {
    if (lower.includes(spot.label.toLowerCase())) {
      return { lat: spot.lat, lng: spot.lng };
    }
  }

  // 3.5. Match against Vietnamese district/ward presets across major regions
  for (const preset of VIETNAM_DISTRICT_PRESETS) {
    if (preset.keywords.some((k) => lower.includes(k))) {
      const seed = String(entity._id || entity.id || entity.businessName || fullText);
      const { dLat, dLng } = deterministicOffset(seed);
      return {
        lat: Number((preset.lat + dLat * 0.35).toFixed(6)),
        lng: Number((preset.lng + dLng * 0.35).toFixed(6)),
      };
    }
  }

  // 4. City-aware fallback with deterministic offset
  const city = detectCityPreset(fullText);
  const seed = String(entity._id || entity.id || entity.businessName || fullText || 'tago');
  const { dLat, dLng } = deterministicOffset(seed);
  return {
    lat: Number((city.lat + dLat).toFixed(6)),
    lng: Number((city.lng + dLng).toFixed(6)),
  };
}

/**
 * Calculate Haversine distance in kilometers between two coordinates
 */
export function haversineKm(from: GeoCoord, to: GeoCoord): number;
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number;
export function haversineKm(
  a: number | GeoCoord,
  b: number | GeoCoord,
  c?: number,
  d?: number,
): number {
  const lat1 = typeof a === 'object' ? a.lat : a;
  const lng1 = typeof a === 'object' ? a.lng : (b as number);
  const lat2 = typeof a === 'object' ? (b as GeoCoord).lat : (c as number);
  const lng2 = typeof a === 'object' ? (b as GeoCoord).lng : (d as number);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinCalc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const cAngle = 2 * Math.atan2(Math.sqrt(sinCalc), Math.sqrt(1 - sinCalc));
  return Number((R * cAngle).toFixed(2));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function estimateDriveMinutes(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 2;
  // Average urban speed in Vietnam ~24 km/h (2.5 mins per km) + 2 mins buffer
  return Math.max(2, Math.round(km * 2.5 + 1));
}

export interface RoadRouteResult {
  points: Array<[number, number]>; // [lat, lng]
  distanceKm: number;
  durationMinutes: number;
}

const routeCache = new Map<string, RoadRouteResult>();

/**
 * Fetch real road route geometry from OSRM public router across Vietnam,
 * falling back to Haversine straight path if offline.
 */
export async function fetchRoadRoute(
  from: GeoCoord,
  to: GeoCoord,
): Promise<RoadRouteResult> {
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const fallback: RoadRouteResult = {
    points: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceKm: Number((straightKm * 1.25).toFixed(2)),
    durationMinutes: estimateDriveMinutes(straightKm * 1.25),
  };

  if (!isValidLatLng(from.lat, from.lng) || !isValidLatLng(to.lat, to.lng)) {
    return fallback;
  }

  // If very far (> 250km, e.g. user in Hanoi looking at Hue store), don't draw cross-country road line
  if (straightKm > 250) {
    return {
      points: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      distanceKm: straightKm,
      durationMinutes: estimateDriveMinutes(straightKm),
    };
  }

  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'VibeHue/1.0 (https://tago.vn; location route search)',
        },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const points: Array<[number, number]> = coords.map((c: [number, number]) => [
          Number(c[1]),
          Number(c[0]),
        ]);
        const distanceKm = Number(((route.distance || straightKm * 1000) / 1000).toFixed(2));
        const durationMinutes = Math.max(
          2,
          Math.round((route.duration || distanceKm * 150) / 60),
        );
        const result: RoadRouteResult = { points, distanceKm, durationMinutes };
        routeCache.set(key, result);
        return result;
      }
    } catch {
      // Try next routing endpoint
    }
  }

  return fallback;
}

/**
 * Open turn-by-turn directions in Google Maps / Apple Maps
 */
export async function openExternalDirections(params: {
  destLat?: number;
  destLng?: number;
  destLabel?: string;
  lat?: number;
  lng?: number;
  label?: string;
  originLat?: number;
  originLng?: number;
}): Promise<void> {
  const destLat = params.destLat ?? params.lat ?? 0;
  const destLng = params.destLng ?? params.lng ?? 0;
  const destLabel = params.destLabel ?? params.label;
  const { originLat, originLng } = params;
  if (isValidLatLng(destLat, destLng)) {
    const originParam =
      isValidLatLng(originLat, originLng) ? `&origin=${originLat},${originLng}` : '';
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${originParam}&travelmode=driving`;
    if (Platform.OS === 'ios') {
      const appleUrl = `http://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
      const canOpen = await Linking.canOpenURL(googleUrl).catch(() => false);
      await Linking.openURL(canOpen ? googleUrl : appleUrl);
      return;
    }
    await Linking.openURL(googleUrl);
    return;
  }

  if (destLabel) {
    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destLabel)}`;
    await Linking.openURL(searchUrl);
  }
}
