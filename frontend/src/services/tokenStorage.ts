const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const getPersistentStorage = () => window.localStorage;
const getSessionStorage = () => window.sessionStorage;

export const tokenStorage = {
  getAccessToken(): string | null {
    return (
      getPersistentStorage().getItem(ACCESS_TOKEN_KEY) ??
      getSessionStorage().getItem(ACCESS_TOKEN_KEY)
    );
  },

  getRefreshToken(): string | null {
    return (
      getPersistentStorage().getItem(REFRESH_TOKEN_KEY) ??
      getSessionStorage().getItem(REFRESH_TOKEN_KEY)
    );
  },

  hasPersistentSession(): boolean {
    return Boolean(
      getPersistentStorage().getItem(ACCESS_TOKEN_KEY) ||
        getPersistentStorage().getItem(REFRESH_TOKEN_KEY),
    );
  },

  saveTokens(
    accessToken: string,
    refreshToken: string,
    rememberSession: boolean,
  ): void {
    const target = rememberSession ? getPersistentStorage() : getSessionStorage();
    const fallback = rememberSession ? getSessionStorage() : getPersistentStorage();

    fallback.removeItem(ACCESS_TOKEN_KEY);
    fallback.removeItem(REFRESH_TOKEN_KEY);
    target.setItem(ACCESS_TOKEN_KEY, accessToken);
    target.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  replaceTokens(accessToken: string, refreshToken: string): void {
    this.saveTokens(accessToken, refreshToken, this.hasPersistentSession());
  },

  clearTokens(): void {
    getPersistentStorage().removeItem(ACCESS_TOKEN_KEY);
    getPersistentStorage().removeItem(REFRESH_TOKEN_KEY);
    getSessionStorage().removeItem(ACCESS_TOKEN_KEY);
    getSessionStorage().removeItem(REFRESH_TOKEN_KEY);
  },
};
