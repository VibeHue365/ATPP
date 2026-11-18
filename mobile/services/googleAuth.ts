import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import type { SessionUser } from '@/types/auth';
import { getApiErrorMessage } from '@/utils/apiError';

WebBrowser.maybeCompleteAuthSession();

export type GoogleOAuthPreflightReason = 'MISSING_ADB_REVERSE' | 'BACKEND_DOWN';

export class GoogleOAuthPreflightError extends Error {
  readonly reason: GoogleOAuthPreflightReason;

  constructor(reason: GoogleOAuthPreflightReason, message: string) {
    super(message);
    this.name = 'GoogleOAuthPreflightError';
    this.reason = reason;
  }
}

export type GoogleUnifiedSignInResult =
  | { status: 'success'; user: SessionUser }
  | { status: 'cancelled' }
  | { status: 'browser_opened' };

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

export function resolveGoogleBrowserOAuthTarget(): {
  browserApiUrl: string;
  fallbackApiUrl?: string;
} {
  const rawApiUrl = (
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
  )
    .trim()
    .replace(/\/+$/, '');

  if (
    Platform.OS === 'android' &&
    (rawApiUrl.includes('10.0.2.2') || rawApiUrl.includes('127.0.0.1'))
  ) {
    return {
      browserApiUrl: rawApiUrl
        .replace('10.0.2.2', 'localhost')
        .replace('127.0.0.1', 'localhost'),
      fallbackApiUrl: rawApiUrl,
    };
  }

  return { browserApiUrl: rawApiUrl };
}

export async function pingOAuthEndpoint(
  url: string,
  timeoutMs = 1500,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function extractOAuthCallbackParams(url: string): {
  code?: string;
  error?: string;
} {
  try {
    const parsed = Linking.parse(url);
    const code =
      typeof parsed.queryParams?.code === 'string'
        ? parsed.queryParams.code
        : undefined;
    const error =
      typeof parsed.queryParams?.error === 'string'
        ? parsed.queryParams.error
        : undefined;
    return { code, error };
  } catch {
    return {};
  }
}

export async function signInWithGoogleUnified(params: {
  loginWithGoogle: (idToken: string) => Promise<SessionUser>;
  loginWithOAuthCode: (code: string) => Promise<SessionUser>;
}): Promise<GoogleUnifiedSignInResult> {
  const googleModule = getGoogleSigninModule();
  if (googleModule) {
    try {
      const { GoogleSignin } = googleModule;
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error('Không nhận được mã xác thực từ Google.');
      }
      const user = await params.loginWithGoogle(idToken);
      return { status: 'success', user };
    } catch (cause: any) {
      if (cause?.code === 'SIGN_IN_CANCELLED' || cause?.code === 12501) {
        return { status: 'cancelled' };
      }
      throw cause;
    }
  }

  const { browserApiUrl, fallbackApiUrl } = resolveGoogleBrowserOAuthTarget();

  if (Platform.OS === 'android') {
    const reachable = await pingOAuthEndpoint(browserApiUrl);
    if (!reachable) {
      const fallbackReachable = fallbackApiUrl
        ? await pingOAuthEndpoint(fallbackApiUrl)
        : false;

      if (fallbackReachable) {
        throw new GoogleOAuthPreflightError(
          'MISSING_ADB_REVERSE',
          `Máy ảo Android chưa mở cầu nối tới ${browserApiUrl}.\n\nHãy chạy lệnh \`npm run reverse\` (hoặc \`adb reverse tcp:3000 tcp:3000\`) trong thư mục mobile rồi thử lại, hoặc dùng Development Build để đăng nhập Google trực tiếp.`,
        );
      }

      throw new GoogleOAuthPreflightError(
        'BACKEND_DOWN',
        `Không thể kết nối tới Backend (${browserApiUrl}). Hãy kiểm tra server Backend cổng 3000 đang chạy và bật \`npm run reverse\` nếu dùng máy ảo Android.`,
      );
    }
  }

  const redirectUri = Linking.createURL('/oauth/callback');
  const authUrl = `${browserApiUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type === 'success' && result.url) {
    const { code, error } = extractOAuthCallbackParams(result.url);
    if (error) {
      throw new Error('Đăng nhập Google thất bại hoặc bị hủy.');
    }
    if (code) {
      const user = await params.loginWithOAuthCode(code);
      return { status: 'success', user };
    }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { status: 'cancelled' };
  }

  return { status: 'browser_opened' };
}

export function presentGoogleAuthError(
  cause: unknown,
  fallbackMessage: string,
): string {
  if (cause instanceof GoogleOAuthPreflightError) {
    TagoAlert.alert(
      'Chưa kết nối được Google OAuth',
      cause.message,
      [{ text: 'Đã hiểu', style: 'default' }],
      { eyebrow: 'KẾT NỐI GOOGLE OAUTH', icon: 'wifi-outline' },
    );
    return cause.message.replace(/\n+/g, ' ');
  }
  return getApiErrorMessage(cause, fallbackMessage);
}
