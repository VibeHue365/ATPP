import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import * as Notifications from "expo-notifications";
import { notificationApi } from "@/apis/notificationApi";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import type { NotificationItem } from "@/types/notification";
import { getApiErrorMessage } from "@/utils/apiError";
import { registerCurrentDeviceForPush } from "@/services/pushNotifications";
import { openNotificationData } from "@/utils/notificationNavigation";

interface Value {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Context = createContext<Value | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await notificationApi.list();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể tải thông báo"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
    if (!isAuthenticated) return;
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerCurrentDeviceForPush().catch(() => undefined);
    const received = Notifications.addNotificationReceivedListener(
      () => void reload(),
    );
    const response = Notifications.addNotificationResponseReceivedListener(
      (event) => {
        openNotificationData(event.notification.request.content.data);
        void reload();
      },
    );
    void Notifications.getLastNotificationResponseAsync().then((event) => {
      if (!event) return;
      openNotificationData(event.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [isAuthenticated, reload]);

  useEffect(() => {
    if (!socket) return;
    const receive = (item: NotificationItem) => {
      setNotifications((current) =>
        current.some((entry) => entry._id === item._id)
          ? current
          : [item, ...current],
      );
    };
    socket.on("new_notification", receive);
    return () => {
      socket.off("new_notification", receive);
    };
  }, [socket]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((value) =>
      value.map((item) => (item._id === id ? { ...item, isRead: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((value) =>
      value.map((item) => ({ ...item, isRead: true })),
    );
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  useEffect(() => {
    void Notifications.setBadgeCountAsync(unreadCount).catch(() => undefined);
  }, [unreadCount]);
  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      reload,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, loading, error, reload, markRead, markAllRead],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const value = useContext(Context);
  if (!value)
    throw new Error(
      "useNotifications must be used inside NotificationProvider",
    );
  return value;
}
