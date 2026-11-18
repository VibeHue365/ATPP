function setupAndroidMocks(overrides?: {
  openAuthSessionAsync?: jest.Mock;
  parseResult?: Record<string, unknown>;
  tagoAlertMock?: jest.Mock;
}) {
  jest.doMock('react-native', () => ({
    Platform: {
      OS: 'android',
      select: (spec: Record<string, unknown>) => spec.android ?? spec.default,
    },
    NativeModules: {},
  }));
  jest.doMock('@/components/ui/TagoAlertModal', () => ({
    TagoAlert: { alert: overrides?.tagoAlertMock ?? jest.fn() },
  }));
  jest.doMock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
    openAuthSessionAsync: overrides?.openAuthSessionAsync ?? jest.fn(),
  }));
  jest.doMock('expo-linking', () => ({
    createURL: jest.fn((p: string) => `exp://127.0.0.1:8081/--${p}`),
    parse: jest.fn(() => ({ queryParams: overrides?.parseResult ?? {} })),
  }));
}

describe('googleAuth OAuth helpers', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:3000';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    globalThis.fetch = originalFetch;
  });

  it('resolves Android emulator 10.0.2.2 to localhost with fallbackApiUrl', async () => {
    let target: { browserApiUrl: string; fallbackApiUrl?: string } = {
      browserApiUrl: '',
    };

    await jest.isolateModulesAsync(async () => {
      setupAndroidMocks();
      const { resolveGoogleBrowserOAuthTarget } = require('@/services/googleAuth');
      target = resolveGoogleBrowserOAuthTarget();
    });

    expect(target).toEqual({
      browserApiUrl: 'http://localhost:3000',
      fallbackApiUrl: 'http://10.0.2.2:3000',
    });
  });

  it('throws MISSING_ADB_REVERSE before opening Chrome and surfaces TagoAlert via presentGoogleAuthError', async () => {
    const openAuthSessionAsync = jest.fn();
    const tagoAlertMock = jest.fn();
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('10.0.2.2')) {
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.reject(new Error('ERR_CONNECTION_REFUSED'));
    });

    let caughtError: any = null;
    let inlineMessage = '';

    await jest.isolateModulesAsync(async () => {
      setupAndroidMocks({ openAuthSessionAsync, tagoAlertMock });
      const {
        signInWithGoogleUnified,
        presentGoogleAuthError,
      } = require('@/services/googleAuth');
      try {
        await signInWithGoogleUnified({
          loginWithGoogle: jest.fn(),
          loginWithOAuthCode: jest.fn(),
        });
      } catch (err) {
        caughtError = err;
        inlineMessage = presentGoogleAuthError(err, 'Fallback error');
      }
    });

    expect(caughtError?.reason).toBe('MISSING_ADB_REVERSE');
    expect(inlineMessage).toContain('npm run reverse');
    expect(tagoAlertMock).toHaveBeenCalledTimes(1);
    expect(openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('opens WebBrowser auth session when localhost preflight succeeds and exchanges code', async () => {
    const openAuthSessionAsync = jest.fn().mockResolvedValue({
      type: 'success',
      url: 'exp://127.0.0.1:8081/--/oauth/callback?code=oauth-code-123',
    });
    const loginWithOAuthCode = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'guest@tago.vn',
      roles: ['CUSTOMER'],
    });
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response));

    let outcome: any = null;

    await jest.isolateModulesAsync(async () => {
      setupAndroidMocks({
        openAuthSessionAsync,
        parseResult: { code: 'oauth-code-123' },
      });
      const { signInWithGoogleUnified } = require('@/services/googleAuth');
      outcome = await signInWithGoogleUnified({
        loginWithGoogle: jest.fn(),
        loginWithOAuthCode,
      });
    });

    expect(openAuthSessionAsync).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/auth/google?redirect_uri='),
      'exp://127.0.0.1:8081/--/oauth/callback',
    );
    expect(loginWithOAuthCode).toHaveBeenCalledWith('oauth-code-123');
    expect(outcome?.status).toBe('success');
  });
});
