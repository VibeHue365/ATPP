import httpClient from "./httpClient";
import type {
  NotificationItem,
  PushTokenRegistration,
} from "@/types/notification";

export const notificationApi = {
  list: () => httpClient.get<never, NotificationItem[]>("/notifications"),
  markRead: (id: string) => httpClient.patch(`/notifications/${id}/read`),
  markAllRead: () => httpClient.post("/notifications/read-all"),
  registerPushToken: (payload: PushTokenRegistration) =>
    httpClient.post("/notifications/devices", payload),
  unregisterPushToken: (token: string) =>
    httpClient.delete("/notifications/devices", { data: { token } }),
};
