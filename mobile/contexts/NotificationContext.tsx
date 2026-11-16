import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationApi } from '@/apis/notificationApi';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import type { NotificationItem } from '@/types/notification';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  formatNotification,
  type FormattedNotification,
} from '@/utils/notificationFormatter';
import { registerCurrentDeviceForPush } from '@/services/pushNotifications';
import { openNotificationData } from '@/utils/notificationNavigation';

export interface ActiveNotificationBanner {
  rawId: string;
  formatted: FormattedNotification;
}

export interface LocalBannerInput {
  title: string;
  content: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  bookingSyncVersion: number;
  activeBanner: ActiveNotificationBanner | null;
  dismissBanner: () => void;
  pushLocalBanner: (input: LocalBannerInput) => void;
  bumpBookingSync: () => void;
  reload: (silent?: boolean) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Context = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingSyncVersion, setBookingSyncVersion] = useState(0);
  const [activeBanner, setActiveBanner] =
    useState<ActiveNotificationBanner | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBannerForItem = useCallback((item: NotificationItem) => {
    const formatted = formatNotification(item);
    setActiveBanner({ rawId: item._id, formatted });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 4800);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner(null);
  }, []);

  const bumpBookingSync = useCallback(() => {
    setBookingSyncVersion((v) => v + 1);
  }, []);

  const pushLocalBanner = useCallback(
    (input: LocalBannerInput) => {
      const localItem: NotificationItem = {
        _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: input.title,
        content: input.content,
        type: input.type || 'BOOKING',
        isRead: true,
        metadata: input.metadata,
        createdAt: new Date().toISOString(),
      };
      showBannerForItem(localItem);
    },
    [showBannerForItem],
  );

  const reload = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
        setNotifications([]);
        setError(null);
        seenIdsRef.current.clear();
        initializedRef.current = false;
        return;
      }
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await notificationApi.list();
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);

        if (!initializedRef.current) {
          list.forEach((n) => seenIdsRef.current.add(n._id));
          initializedRef.current = true;
        } else {
          // Detect newly added unread notifications (e.g. V2 payment finalization or another device)
          const newestUnseenUnread = list.find(
            (n) => !n.isRead && !seenIdsRef.current.has(n._id),
          );
          list.forEach((n) => seenIdsRef.current.add(n._id));
          if (newestUnseenUnread) {
            showBannerForItem(newestUnseenUnread);
            setBookingSyncVersion((v) => v + 1);
          }
        }
      } catch (cause) {
        if (!silent) {
          setError(getApiErrorMessage(cause, 'Không thể tải thông báo'));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAuthenticated, showBannerForItem],
  );

  // Adaptive background polling (8s) + instant AppState foreground sync
  useEffect(() => {
    void reload(false);
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      void reload(true);
    }, 8000);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void reload(true);
        setBookingSyncVersion((v) => v + 1);
      }
    });

    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [reload, isAuthenticated]);

  // Native OS Push Notifications (Expo Push Token + tap/receive listeners)
  useEffect(() => {
    if (!isAuthenticated || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
      return;
    }

    void registerCurrentDeviceForPush().catch(() => undefined);

    const received = Notifications.addNotificationReceivedListener(() => {
      void reload(true);
    });

    const response = Notifications.addNotificationResponseReceivedListener(
      (event) => {
        openNotificationData(
          (event.notification.request.content.data ?? {}) as Record<
            string,
            unknown
          >,
        );
        void reload(true);
      },
    );

    void Notifications.getLastNotificationResponseAsync()
      .then((event) => {
        if (!event) return;
        openNotificationData(
          (event.notification.request.content.data ?? {}) as Record<
            string,
            unknown
          >,
        );
        void Notifications.clearLastNotificationResponseAsync().catch(
          () => undefined,
        );
      })
      .catch(() => undefined);

    return () => {
      received.remove();
      response.remove();
    };
  }, [isAuthenticated, reload]);

  // Real-time WebSocket listeners for new notifications & booking state changes
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleNewNotification = (payload: NotificationItem) => {
      if (!payload?._id) return;
      const isFresh = !seenIdsRef.current.has(payload._id);
      seenIdsRef.current.add(payload._id);

      setNotifications((prev) => {
        if (prev.some((item) => item._id === payload._id)) return prev;
        return [payload, ...prev];
      });

      if (isFresh) {
        showBannerForItem(payload);
      }
      setBookingSyncVersion((v) => v + 1);
    };

    const handleBookingUpdated = (_payload: {
      bookingId?: string;
      status?: string;
    }) => {
      setBookingSyncVersion((v) => v + 1);
      void reload(true);
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('booking_updated', handleBookingUpdated);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('booking_updated', handleBookingUpdated);
    };
  }, [socket, isAuthenticated, showBannerForItem, reload]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    if (id.startsWith('local-')) return;
    await notificationApi.markRead(id);
    setNotifications((v) =>
      v.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((v) => v.map((n) => ({ ...n, isRead: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    void Notifications.setBadgeCountAsync(unreadCount).catch(() => undefined);
  }, [unreadCount]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      bookingSyncVersion,
      activeBanner,
      dismissBanner,
      pushLocalBanner,
      bumpBookingSync,
      reload,
      markRead,
      markAllRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
      error,
      bookingSyncVersion,
      activeBanner,
      dismissBanner,
      pushLocalBanner,
      bumpBookingSync,
      reload,
      markRead,
      markAllRead,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const value = useContext(Context);
  if (!value) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider',
    );
  }
  return value;
}
