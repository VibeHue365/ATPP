import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'vh_access_token';
const REFRESH_TOKEN_KEY = 'vh_refresh_token';

const tokenStore = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value),
  remove: (key: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key),
};

export const tokenStorage = {
  getAccessToken: () => tokenStore.get(ACCESS_TOKEN_KEY),
  getRefreshToken: () => tokenStore.get(REFRESH_TOKEN_KEY),
  async replaceTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      tokenStore.set(ACCESS_TOKEN_KEY, accessToken),
      tokenStore.set(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      tokenStore.remove(ACCESS_TOKEN_KEY),
      tokenStore.remove(REFRESH_TOKEN_KEY),
    ]);
  },
};

export const appStorage = {
  get: (key: string) => AsyncStorage.getItem(key),
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  remove: (key: string) => AsyncStorage.removeItem(key),
};
