import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Nguồn của vị trí người dùng, xếp theo độ tin cậy giảm dần:
 * - gps:     GPS / định vị thiết bị (chính xác 3–50m)
 * - manual:  người dùng tự tìm địa chỉ hoặc kéo ghim trên bản đồ
 * - ip:      ước lượng theo địa chỉ IP mạng (thường lệch vài km, rơi về trung tâm thành phố)
 * - default: không xác định được, dùng trung tâm thành phố mặc định
 */
export type UserLocationSource = 'gps' | 'manual' | 'ip' | 'default';

export interface StoredUserLocation {
  lat: number;
  lng: number;
  label: string;
  source: UserLocationSource;
  accuracyM?: number;
  updatedAt: number;
}

export type DeviceGpsFailureReason =
  | 'denied'
  | 'services_off'
  | 'outside_vietnam'
  | 'timeout'
  | 'unavailable';

export type DeviceGpsResult =
  | { ok: true; lat: number; lng: number; accuracyM?: number }
  | { ok: false; reason: DeviceGpsFailureReason; canAskAgain?: boolean };

const STORAGE_KEY = 'tago.userLocation.v1';

/** Vị trí tự chọn còn "mới" trong khoảng này thì được ưu tiên hơn GPS */
export const MANUAL_LOCATION_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Khung bao lãnh thổ Việt Nam (có nới rộng một chút).
 * Emulator Android mặc định đặt GPS ở Mountain View (Mỹ) — vị trí ngoài khung này bị coi là không hợp lệ.
 */
export function isInsideVietnam(lat: number, lng: number): boolean {
  return lat >= 8.0 && lat <= 23.6 && lng >= 102.0 && lng <= 110.0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * Lấy vị trí GPS thật của thiết bị qua expo-location.
 * @param requestPermission  true: hiện hộp thoại xin quyền nếu chưa được cấp.
 *                           false: chỉ dùng GPS khi quyền đã được cấp trước đó (không làm phiền người dùng).
 */
export async function getDeviceGpsLocation(options?: {
  requestPermission?: boolean;
  timeoutMs?: number;
}): Promise<DeviceGpsResult> {
  const requestPermission = options?.requestPermission ?? false;
  const timeoutMs = options?.timeoutMs ?? 8000;

  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && requestPermission && perm.canAskAgain !== false) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) {
      return { ok: false, reason: 'denied', canAskAgain: perm.canAskAgain };
    }

    if (Platform.OS !== 'web') {
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        return { ok: false, reason: 'services_off' };
      }
    }

    // 1. Vị trí chính xác cao (GPS)
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeoutMs,
    );
    // 2. Dự phòng: vị trí gần nhất mà máy đã biết (trong 10 phút)
    const position =
      current ??
      (await withTimeout(
        Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }),
        1500,
      ));

    if (!position) {
      return { ok: false, reason: 'timeout' };
    }

    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: 'unavailable' };
    }
    if (!isInsideVietnam(lat, lng)) {
      return { ok: false, reason: 'outside_vietnam' };
    }

    const accuracy = position.coords.accuracy;
    return {
      ok: true,
      lat,
      lng,
      accuracyM: typeof accuracy === 'number' && accuracy > 0 ? Math.round(accuracy) : undefined,
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Thông báo tiếng Việt cho từng lý do GPS thất bại */
export function describeGpsFailure(reason: DeviceGpsFailureReason): {
  title: string;
  message: string;
} {
  switch (reason) {
    case 'denied':
      return {
        title: 'Chưa có quyền vị trí',
        message:
          'Bạn chưa cho phép ứng dụng dùng vị trí. Hãy mở Cài đặt và cấp quyền Vị trí để tìm tiệm gần bạn chính xác hơn.',
      };
    case 'services_off':
      return {
        title: 'Định vị đang tắt',
        message: 'Hãy bật Vị trí (GPS) trên thiết bị rồi thử lại.',
      };
    case 'outside_vietnam':
      return {
        title: 'Vị trí GPS nằm ngoài Việt Nam',
        message:
          'Thiết bị đang báo vị trí ở ngoài Việt Nam. Nếu bạn dùng máy ảo (emulator), hãy đặt vị trí trong Extended Controls → Location, hoặc nhập địa chỉ bằng ô "Đặt vị trí".',
      };
    case 'timeout':
      return {
        title: 'Chưa bắt được tín hiệu GPS',
        message:
          'Không lấy được vị trí trong thời gian cho phép. Hãy ra chỗ thoáng hoặc thử lại, hoặc nhập địa chỉ bằng ô "Đặt vị trí".',
      };
    default:
      return {
        title: 'Không lấy được vị trí',
        message: 'Thiết bị không trả về vị trí. Bạn có thể nhập địa chỉ bằng ô "Đặt vị trí".',
      };
  }
}

// ---------------------------------------------------------------------------
// Đổi tọa độ ra tên đường (reverse geocoding)
// ---------------------------------------------------------------------------

const reverseCache = new Map<string, string>();

function joinUnique(parts: Array<string | null | undefined>): string {
  const result: string[] = [];
  for (const raw of parts) {
    const part = (raw || '').trim();
    if (!part) continue;
    if (result.some((p) => p.toLowerCase() === part.toLowerCase())) continue;
    result.push(part);
  }
  return result.join(', ');
}

async function reverseViaNominatim(lat: number, lng: number): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    '&format=jsonv2&zoom=18&addressdetails=1&accept-language=vi';
  const res = await withTimeout(
    fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VibeHue/1.0 (https://tago.vn; reverse geocoding)',
      },
    }),
    5000,
  );
  if (!res || !res.ok) return null;
  const data = await res.json();
  const a = data?.address ?? {};
  const street = a.road || a.pedestrian || a.footway || a.residential || a.neighbourhood;
  const area = a.quarter || a.suburb || a.city_district || a.village || a.town;
  const label = joinUnique([
    a.house_number && street ? `${a.house_number} ${street}` : street,
    area,
  ]);
  return label || null;
}

async function reverseViaDevice(lat: number, lng: number): Promise<string | null> {
  const list = await withTimeout(
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
    4000,
  );
  const first = list?.[0];
  if (!first) return null;
  const street = first.street
    ? first.streetNumber
      ? `${first.streetNumber} ${first.street}`
      : first.street
    : first.name;
  const label = joinUnique([street, first.district || first.subregion]);
  return label || null;
}

/**
 * Trả về nhãn dạng "Đường Nguyễn Hành, Phường Hòa Cường".
 * Thử OpenStreetMap trước (tên tiếng Việt chuẩn), sau đó tới bộ geocoder của thiết bị.
 */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  let label: string | null = null;
  try {
    label = await reverseViaNominatim(lat, lng);
  } catch {
    label = null;
  }
  if (!label && Platform.OS !== 'web') {
    try {
      label = await reverseViaDevice(lat, lng);
    } catch {
      label = null;
    }
  }
  if (label) reverseCache.set(key, label);
  return label;
}

// ---------------------------------------------------------------------------
// Lưu vị trí để lần sau mở app không bị quay về vị trí ước lượng theo IP
// ---------------------------------------------------------------------------

export async function loadSavedUserLocation(): Promise<StoredUserLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserLocation;
    if (
      typeof parsed?.lat === 'number' &&
      typeof parsed?.lng === 'number' &&
      isInsideVietnam(parsed.lat, parsed.lng)
    ) {
      return parsed;
    }
  } catch {
    // dữ liệu hỏng -> bỏ qua
  }
  return null;
}

export async function saveUserLocation(loc: Omit<StoredUserLocation, 'updatedAt'>): Promise<void> {
  // Chỉ lưu vị trí đáng tin (GPS hoặc người dùng tự chọn)
  if (loc.source !== 'gps' && loc.source !== 'manual') return;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loc, updatedAt: Date.now() } satisfies StoredUserLocation),
    );
  } catch {
    // ignore
  }
}

export async function clearSavedUserLocation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
