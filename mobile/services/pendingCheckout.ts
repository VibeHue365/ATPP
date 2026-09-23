import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingCheckout } from '@/types/checkout';

const PREFIX = 'vh_pending_checkout_';
const keyOf = (code: string) => `${PREFIX}${code}`;

export const pendingCheckoutStorage = {
  async save(value: PendingCheckout) { await AsyncStorage.setItem(keyOf(value.paymentCode), JSON.stringify(value)); },
  async get(code: string) {
    const raw = await AsyncStorage.getItem(keyOf(code));
    if (!raw) return null;
    try { return JSON.parse(raw) as PendingCheckout; } catch { return null; }
  },
  async remove(code: string) { await AsyncStorage.removeItem(keyOf(code)); },
  async all() {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    return entries.flatMap(([, raw]) => { try { return raw ? [JSON.parse(raw) as PendingCheckout] : []; } catch { return []; } });
  },
  async latest() {
    const entries = await this.all();
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  },
};
