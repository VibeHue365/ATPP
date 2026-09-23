import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '@/utils/storage';
import { authEvents } from '@/services/authEvents';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

httpClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !request || request._retry) {
      return Promise.reject(error);
    }
    request._retry = true;
    refreshPromise ??= (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) throw error;
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken },
      );
      await tokenStorage.replaceTokens(response.data.accessToken, response.data.refreshToken);
      return response.data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });

    try {
      request.headers.Authorization = `Bearer ${await refreshPromise}`;
      return httpClient(request);
    } catch (refreshError) {
      await tokenStorage.clear();
      authEvents.expired();
      return Promise.reject(refreshError);
    }
  },
);

export default httpClient;
