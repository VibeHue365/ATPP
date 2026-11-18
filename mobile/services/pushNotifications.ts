import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import type * as NotificationsModule from "expo-notifications";
import { Platform } from "react-native";
import { notificationApi } from "@/apis/notificationApi";
import { appStorage } from "@/utils/storage";

const TOKEN_STORAGE_KEY = "vh_expo_push_token";
const ANDROID_CHANNEL_ID = "booking-updates";

let cachedNotifications: typeof NotificationsModule | null | undefined;
let handlerConfigured = false;
let channelConfigured = false;

function isExpoGoRuntime(): boolean {
  try {
    if (isRunningInExpoGo()) return true;
  } catch {
    // Fallback to Constants if native ExpoGo probe is unavailable
  }
  return Constants.appOwnership === "expo";
}

function loadRawNotificationsModule(): typeof NotificationsModule | null {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;

  if (cachedNotifications === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedNotifications = require("expo-notifications") as typeof NotificationsModule;
    } catch {
      cachedNotifications = null;
    }
  }

  if (cachedNotifications && !handlerConfigured) {
    cachedNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  }

  return cachedNotifications;
}

/**
 * Local notifications (channel, permissions, scheduleNotificationAsync, tap listeners)
 * remain supported in Expo Go on Android/iOS (SDK 53+ only removed remote push tokens in Expo Go).
 */
export function getLocalNotificationsModule(): typeof NotificationsModule | null {
  return loadRawNotificationsModule();
}

/**
 * Lazy-load `expo-notifications` for remote push only outside Expo Go
 * to avoid unsupported Android remote-push auto-registration in Expo Go.
 */
export function getNotificationsModule(): typeof NotificationsModule | null {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  if (isExpoGoRuntime()) return null;
  return loadRawNotificationsModule();
}

export async function ensureAndroidNotificationChannel(
  Notifications?: typeof NotificationsModule | null,
): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = Notifications ?? getLocalNotificationsModule();
  if (!mod || channelConfigured) return;
  await mod.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Cập nhật thuê đồ & giao dịch",
    description: "Trạng thái bàn giao áo dài, trả đồ, hoàn cọc Escrow và lịch chụp.",
    importance: mod.AndroidImportance?.MAX ?? mod.AndroidImportance?.HIGH ?? 4,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7A2432",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
  channelConfigured = true;
}

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined" | "unavailable"
> {
  const Notifications = getLocalNotificationsModule();
  if (!Notifications) return "unavailable";
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return "granted";
    if (existing.canAskAgain === false) return "denied";
    return (existing.status as "granted" | "denied" | "undetermined") ?? "undetermined";
  } catch {
    return "unavailable";
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = getLocalNotificationsModule();
  if (!Notifications) return false;
  await ensureAndroidNotificationChannel(Notifications);
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(requested.granted);
}

export async function presentLocalNotification(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  const Notifications = getLocalNotificationsModule();
  if (!Notifications) return null;
  try {
    await ensureAndroidNotificationChannel(Notifications);
    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        sound: "default",
        ...(Platform.OS === "android" ? { priority: "high" } : {}),
      },
      trigger: null,
    });
  } catch {
    return null;
  }
}

export async function registerCurrentDeviceForPush(): Promise<string | null> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  await ensureAndroidNotificationChannel(Notifications);
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await notificationApi.registerPushToken({ token, platform: Platform.OS });
  await appStorage.set(TOKEN_STORAGE_KEY, token);
  return token;
}

export async function unregisterCurrentDeviceFromPush(): Promise<void> {
  const token = await appStorage.get(TOKEN_STORAGE_KEY);
  if (!token) return;
  try {
    await notificationApi.unregisterPushToken(token);
  } finally {
    await appStorage.remove(TOKEN_STORAGE_KEY);
  }
}
