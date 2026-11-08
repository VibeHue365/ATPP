import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

/**
 * Kiểm tra xem module native RNGoogleSignin có thực sự tồn tại trong binary hiện tại không.
 * Giúp tránh triệt để lỗi Invariant Violation / TurboModuleRegistry.getEnforcing() khi chạy trên Expo Go.
 */
export function isGoogleSignInAvailable(): boolean {
  try {
    if (Platform.OS === 'web') return false;

    // Kiểm tra trong TurboModule registry (New Architecture)
    const hasTurbo =
      typeof (globalThis as any)?.__turboModuleProxy === 'function' &&
      Boolean((globalThis as any).__turboModuleProxy('RNGoogleSignin'));

    // Kiểm tra trong NativeModules truyền thống (Old Architecture / Paper)
    const hasLegacy = Boolean(NativeModules?.RNGoogleSignin);

    return hasTurbo || hasLegacy;
  } catch {
    return false;
  }
}

/**
 * Lấy module GoogleSignin và statusCodes theo cơ chế Dynamic Loading (chỉ nạp khi có binary).
 */
export function getGoogleSigninModule(): {
  GoogleSignin: any;
  statusCodes: any;
} | null {
  if (!isGoogleSignInAvailable()) {
    return null;
  }

  try {
    // Dynamic require để Metro không bundle ép buộc thư viện native khi module chưa được liên kết
    const googleModule = require('@react-native-google-signin/google-signin');
    return {
      GoogleSignin: googleModule.GoogleSignin,
      statusCodes: googleModule.statusCodes,
    };
  } catch (err) {
    console.warn('[GoogleAuth] Không thể nạp module GoogleSignin:', err);
    return null;
  }
}

/**
 * Khởi tạo cấu hình Google Sign-In an toàn.
 * Đọc 100% từ biến môi trường, tuyệt đối không hardcode Client ID vào mã nguồn.
 */
export function configureGoogleSignIn(): void {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!webClientId) {
    console.warn(
      '[GoogleAuth] Cảnh báo: Biến EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID chưa được định nghĩa trong .env',
    );
    return;
  }

  const module = getGoogleSigninModule();
  if (!module) {
    // Chế độ an toàn cho Expo Go hoặc dev client chưa compile native code
    console.info(
      '[GoogleAuth] Môi trường hiện tại không có Native Binary (ví dụ: Expo Go). Safe mode được kích hoạt.',
    );
    return;
  }

  try {
    module.GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });
  } catch (err) {
    console.warn('[GoogleAuth] Lỗi khi cấu hình Google Sign-In:', err);
  }
}
