import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authEvents } from '@/services/authEvents';
import { pendingCheckoutStorage } from '@/services/pendingCheckout';
import type { PendingCheckout } from '@/types/checkout';
import { appStorage, tokenStorage } from '@/utils/storage';

const checkout = (paymentCode: string, createdAt: string): PendingCheckout => ({
  paymentCode,
  bookingId: `booking-${paymentCode}`,
  cartItemIds: [`item-${paymentCode}`],
  checkoutUrl: `https://pay.example.test/${paymentCode}`,
  createdAt,
});

describe('mobile storage services', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('saves, reads and removes ordinary application values', async () => {
    await appStorage.set('preference', 'enabled');
    await expect(appStorage.get('preference')).resolves.toBe('enabled');
    await appStorage.remove('preference');
    await expect(appStorage.get('preference')).resolves.toBeNull();
  });

  it('uses secure storage for native authentication tokens', async () => {
    await tokenStorage.replaceTokens('access-token', 'refresh-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vh_access_token', 'access-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vh_refresh_token', 'refresh-token');
  });

  it('clears both native authentication tokens', async () => {
    await tokenStorage.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('vh_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('vh_refresh_token');
  });

  it('persists and restores a pending checkout', async () => {
    const value = checkout('PAY-001', '2026-09-29T08:00:00.000Z');
    await pendingCheckoutStorage.save(value);
    await expect(pendingCheckoutStorage.get('PAY-001')).resolves.toEqual(value);
  });

  it('returns null for missing or corrupted checkout data', async () => {
    await expect(pendingCheckoutStorage.get('missing')).resolves.toBeNull();
    await AsyncStorage.setItem('vh_pending_checkout_BROKEN', '{invalid-json');
    await expect(pendingCheckoutStorage.get('BROKEN')).resolves.toBeNull();
  });

  it('lists only valid checkout entries and selects the latest one', async () => {
    const older = checkout('PAY-OLD', '2026-09-28T08:00:00.000Z');
    const latest = checkout('PAY-NEW', '2026-09-29T08:00:00.000Z');
    await pendingCheckoutStorage.save(older);
    await pendingCheckoutStorage.save(latest);
    await AsyncStorage.setItem('unrelated', 'ignored');
    await AsyncStorage.setItem('vh_pending_checkout_INVALID', 'invalid');
    await expect(pendingCheckoutStorage.all()).resolves.toEqual(expect.arrayContaining([older, latest]));
    await expect(pendingCheckoutStorage.latest()).resolves.toEqual(latest);
  });

  it('removes a pending checkout', async () => {
    await pendingCheckoutStorage.save(checkout('PAY-REMOVE', '2026-09-29T08:00:00.000Z'));
    await pendingCheckoutStorage.remove('PAY-REMOVE');
    await expect(pendingCheckoutStorage.get('PAY-REMOVE')).resolves.toBeNull();
  });
});

describe('authentication event bus', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = authEvents.subscribe(listener);
    authEvents.expired();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    authEvents.expired();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple independent listeners', () => {
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = authEvents.subscribe(first);
    const stopSecond = authEvents.subscribe(second);
    authEvents.expired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    stopSecond();
  });
});
