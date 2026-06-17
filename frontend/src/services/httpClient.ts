import { API_BASE_URL } from '../config/env';
import { tokenStorage } from './tokenStorage';

class HttpClient {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const headers = new Headers(options.headers);

    // Attach access token if present
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    // Default JSON Content-Type unless FormData is passed
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Try refreshing token
        const newAccessToken = await this.handleTokenRefresh();
        if (newAccessToken) {
          // Retry the original request
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          const retryResponse = await fetch(url, { ...config, headers });
          return this.parseResponse<T>(retryResponse);
        }
      }

      return this.parseResponse<T>(response);
    } catch (error) {
      console.error(`API Request failed on ${path}:`, error);
      throw error;
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    let data: any = {};

    if (contentType && contentType.includes('application/json')) {
      data = await response.json().catch(() => ({}));
    } else {
      data = { message: await response.text().catch(() => 'Response parsing failed') };
    }

    if (!response.ok) {
      const errorMessage = data.message || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  }

  private async handleTokenRefresh(): Promise<string | null> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      this.clearSessionAndRedirect();
      return null;
    }

    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeTokenRefresh((token) => {
          resolve(token);
        });
      });
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh token invalid');
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      if (newAccessToken && newRefreshToken) {
        tokenStorage.replaceTokens(newAccessToken, newRefreshToken);
        this.onRefreshed(newAccessToken);
        return newAccessToken;
      }

      throw new Error('Tokens missing in refresh response');
    } catch (error) {
      console.error('Failed to refresh authentication session:', error);
      this.clearSessionAndRedirect();
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  private clearSessionAndRedirect() {
    tokenStorage.clearTokens();
    window.dispatchEvent(new Event('auth-logout'));
  }

  get<T>(path: string, options?: Omit<RequestInit, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: any, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body?: any, options?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T>(path: string, options?: Omit<RequestInit, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const httpClient = new HttpClient();
