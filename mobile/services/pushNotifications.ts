import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationApi } from "@/apis/notificationApi";
import { appStorage } from "@/utils/storage";

const TOKEN_STORAGE_KEY = "vh_expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerCurrentDeviceForPush(): Promise<string | null> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("booking-updates", {
      name: "Cập nhật booking và giao dịch",
      description: "Trạng thái booking, thanh toán, hoàn tiền và lịch chụp.",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7A2432",
      sound: "default",
    });
  }
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
