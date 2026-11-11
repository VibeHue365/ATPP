import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AxiosError } from 'axios';
import { authApi } from '@/apis/authApi';
import { appStorage, tokenStorage } from '@/utils/storage';
import {
  mapSessionUser,
  type LoginPayload,
  type SessionUser,
  type UserFavorite,
} from '@/types/auth';
import { authEvents } from '@/services/authEvents';
import { userApi } from '@/apis/userApi';

const USER_KEY = 'vh_session_user';

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<SessionUser>;
  loginWithGoogle: (idToken: string) => Promise<SessionUser>;
  loginWithOAuthCode: (code: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  toggleFavorite: (type: 'PRODUCT' | 'PROVIDER', id: string) => Promise<void>;
  isFavorite: (type: 'PRODUCT' | 'PROVIDER', id: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const saveUser = useCallback(async (value: SessionUser | null) => {
    setUser(value);
    if (value) {
      await appStorage.set(USER_KEY, JSON.stringify(value));
    } else {
      await appStorage.remove(USER_KEY);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await authApi.me();
    await saveUser(mapSessionUser(current, current.roles));
  }, [saveUser]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [token, cached] = await Promise.all([
          tokenStorage.getAccessToken(),
          appStorage.get(USER_KEY),
        ]);

        if (!active) return;

        if (!token) {
          if (cached) await appStorage.remove(USER_KEY);
          setUser(null);
          setLoading(false);
          return;
        }

        let cachedUser: SessionUser | null = null;
        if (cached) {
          try {
            cachedUser = JSON.parse(cached) as SessionUser;
          } catch {
            await appStorage.remove(USER_KEY);
          }
        }

        if (cachedUser) {
          // Khôi phục ngay lập tức phiên đăng nhập từ cache để không bị trễ hoặc nháy màn Login
          setUser(cachedUser);
          setLoading(false);

          // Đồng bộ ngầm thông tin mới nhất từ server
          try {
            await refreshUser();
          } catch (error) {
            if (!active) return;
            const status = (error as AxiosError)?.response?.status;
            const remainingToken = await tokenStorage.getAccessToken();
            if (status === 401 || status === 403 || !remainingToken) {
              await tokenStorage.clear();
              await saveUser(null);
            }
          }
          return;
        }

        // Có token nhưng chưa có cache user -> đợi lấy thông tin từ server
        await refreshUser();
      } catch {
        if (!active) return;
        await tokenStorage.clear();
        await saveUser(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshUser, saveUser]);

  useEffect(
    () =>
      authEvents.subscribe(() => {
        void saveUser(null);
      }),
    [saveUser]
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await authApi.login(payload);
      await tokenStorage.replaceTokens(response.accessToken, response.refreshToken);
      const next = mapSessionUser(response.user, response.roles);
      await saveUser(next);
      return next;
    },
    [saveUser]
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const response = await authApi.loginGoogleMobile(idToken);
      await tokenStorage.replaceTokens(response.accessToken, response.refreshToken);
      const next = mapSessionUser(response.user, response.roles);
      await saveUser(next);
      return next;
    },
    [saveUser]
  );

  const loginWithOAuthCode = useCallback(
    async (code: string) => {
      const response = await authApi.exchangeOAuthCode(code);
      await tokenStorage.replaceTokens(response.accessToken, response.refreshToken);
      const next = mapSessionUser(response.user, response.roles);
      await saveUser(next);
      return next;
    },
    [saveUser]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout network errors
    } finally {
      await tokenStorage.clear();
      await saveUser(null);
    }
  }, [saveUser]);

  const toggleFavorite = useCallback(
    async (type: 'PRODUCT' | 'PROVIDER', id: string) => {
      const updated = await userApi.toggleFavorite(type, id);
      await saveUser(mapSessionUser(updated, updated.roles));
    },
    [saveUser]
  );

  const isFavorite = useCallback(
    (type: 'PRODUCT' | 'PROVIDER', id: string) =>
      (user?.favorites as UserFavorite[] | undefined)?.some(
        (item) => item.targetType.toUpperCase() === type && String(item.targetId) === id
      ) ?? false,
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      loginWithOAuthCode,
      logout,
      refreshUser,
      toggleFavorite,
      isFavorite,
    }),
    [
      user,
      loading,
      login,
      loginWithGoogle,
      loginWithOAuthCode,
      logout,
      refreshUser,
      toggleFavorite,
      isFavorite,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
