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
import { bookingApi } from '@/apis/bookingApi';
import { notificationApi } from '@/apis/notificationApi';
import { providerApi } from '@/apis/providerApi';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import type { Booking } from '@/types/booking';
import type { NotificationItem } from '@/types/notification';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  formatNotification,
  type FormattedNotification,
} from '@/utils/notificationFormatter';
import {
  ensureNotificationPermission,
  getLocalNotificationsModule,
  getNotificationPermissionStatus,
  presentLocalNotification,
  registerCurrentDeviceForPush,
} from '@/services/pushNotifications';
import { openNotificationData } from '@/utils/notificationNavigation';
import {
  getCurrentPortalMode,
  isPartnerPortalUser,
  subscribePortalMode,
  type PortalMode,
} from '@/utils/navigation';
import {
  getBookingStateSignature,
  resolveBookingDisplayState,
  type RentalStageKey,
} from '@/utils/rentalState';
import { appStorage } from '@/utils/storage';

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

export type OsNotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  bookingSyncVersion: number;
  activeBanner: ActiveNotificationBanner | null;
  osPermissionStatus: OsNotificationPermissionStatus;
  requestOsPermission: () => Promise<boolean>;
  dismissBanner: () => void;
  pushLocalBanner: (input: LocalBannerInput) => void;
  bumpBookingSync: (suppressBookingId?: string) => void;
  reload: (silent?: boolean) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Context = createContext<NotificationContextValue | null>(null);

const MAX_LOCAL_HISTORY = 25;
const localHistoryKey = (userId: string, role: PortalMode) =>
  `vh_local_rental_notifs_${userId}_${role}`;

function mapStageToNotificationType(stage: RentalStageKey): string {
  switch (stage) {
    case 'INCIDENT_PENDING_CUSTOMER':
    case 'DISPUTED':
      return 'DISPUTE';
    case 'CLEANING_AFTER_REFUND':
    case 'COMPLETED':
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'REFUND';
    case 'READY_NEEDS_HANDOVER_PHOTOS':
    case 'HANDOVER_AWAITING_CUSTOMER':
    case 'IN_RENTAL':
      return 'HANDOVER';
    default:
      return 'BOOKING';
  }
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [serverNotifications, setServerNotifications] = useState<NotificationItem[]>([]);
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingSyncVersion, setBookingSyncVersion] = useState(0);
  const [activeBanner, setActiveBanner] =
    useState<ActiveNotificationBanner | null>(null);
  const [osPermissionStatus, setOsPermissionStatus] =
    useState<OsNotificationPermissionStatus>('undetermined');

  const seenIdsRef = useRef<Set<string>>(new Set());
  const osPresentedIdsRef = useRef<Set<string>>(new Set());
  const serverNotifBookingStampRef = useRef<Map<string, number>>(new Map());
  const initializedRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotSigRef = useRef<Map<string, string>>(new Map());
  const snapshotStageRef = useRef<Map<string, RentalStageKey>>(new Map());
  const snapshotSeededPortalRef = useRef<string | null>(null);
  const suppressBookingIdUntilRef = useRef<Map<string, number>>(new Map());
  const deltaSyncRunningRef = useRef(false);

  const resolvePortalRole = useCallback((): PortalMode => {
    const active = getCurrentPortalMode();
    if (active === 'provider' && isPartnerPortalUser(user)) return 'provider';
    if (active === 'customer') return 'customer';
    return isPartnerPortalUser(user) ? 'provider' : 'customer';
  }, [user]);

  const [activePortalRole, setActivePortalRole] = useState<PortalMode>(() =>
    resolvePortalRole(),
  );

  useEffect(() => {
    setActivePortalRole(resolvePortalRole());
    return subscribePortalMode(() => {
      setActivePortalRole(resolvePortalRole());
    });
  }, [resolvePortalRole]);

  const persistLocalHistory = useCallback(
    async (next: NotificationItem[], role: PortalMode = activePortalRole) => {
      if (!user?.id) return;
      try {
        await appStorage.set(
          localHistoryKey(user.id, role),
          JSON.stringify(next.slice(0, MAX_LOCAL_HISTORY)),
        );
      } catch {
        // Non-blocking storage error
      }
    },
    [activePortalRole, user?.id],
  );

  const showBannerForItem = useCallback((item: NotificationItem) => {
    const formatted = formatNotification(item);
    setActiveBanner({ rawId: item._id, formatted });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 5200);
    return formatted;
  }, []);

  const presentOsTrayForItem = useCallback((item: NotificationItem) => {
    if (!item._id || osPresentedIdsRef.current.has(item._id)) return;
    osPresentedIdsRef.current.add(item._id);
    const formatted = formatNotification(item);
    void presentLocalNotification({
      title: formatted.title,
      body: formatted.content,
      data: {
        ...(item.metadata ?? {}),
        bookingId: formatted.bookingId || undefined,
        contractId: formatted.contractId || undefined,
        paymentCode: formatted.paymentCode || undefined,
        targetRole: formatted.targetRole,
        status: formatted.statusCode || undefined,
      },
    });
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner(null);
  }, []);

  const bumpBookingSync = useCallback((suppressBookingId?: string) => {
    if (suppressBookingId) {
      suppressBookingIdUntilRef.current.set(suppressBookingId, Date.now() + 4500);
    }
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

  const refreshPermissionState = useCallback(async () => {
    const status = await getNotificationPermissionStatus();
    setOsPermissionStatus(status);
    return status;
  }, []);

  const requestOsPermission = useCallback(async (): Promise<boolean> => {
    const granted = await ensureNotificationPermission();
    await refreshPermissionState();
    return granted;
  }, [refreshPermissionState]);

  const appendSyntheticRentalNotification = useCallback(
    (booking: Partial<Booking>, portalRole: 'provider' | 'customer') => {
      const bookingId = String(booking._id || '');
      if (!bookingId) return;

      const suppressUntil = suppressBookingIdUntilRef.current.get(bookingId) ?? 0;
      if (Date.now() < suppressUntil) {
        return;
      }

      const lastServerNotif = serverNotifBookingStampRef.current.get(bookingId) ?? 0;
      if (Date.now() - lastServerNotif < 3000) {
        return;
      }

      const display = resolveBookingDisplayState(booking, portalRole);
      const code = booking.bookingCode
        ? `#${String(booking.bookingCode).replace(/^#/, '')}`
        : `#${bookingId.slice(-6).toUpperCase()}`;

      const item: NotificationItem = {
        _id: `local-sync-${bookingId}-${display.stage}-${Date.now()}`,
        title: `${display.label} (${code})`,
        content: `${code}: ${display.nextStepText}`,
        type: mapStageToNotificationType(display.stage),
        isRead: false,
        metadata: {
          bookingId,
          bookingCode: booking.bookingCode,
          status: booking.status,
          stage: display.stage,
          targetRole: portalRole,
          synthetic: true,
        },
        createdAt: new Date().toISOString(),
      };

      setLocalNotifications((prev) => {
        // Avoid duplicating identical stage notification within 20s
        const recentlyAdded = prev.find(
          (n) =>
            n.metadata?.bookingId === bookingId &&
            n.metadata?.stage === display.stage &&
            Date.now() - new Date(n.createdAt).getTime() < 20_000,
        );
        if (recentlyAdded) return prev;
        const next = [item, ...prev].slice(0, MAX_LOCAL_HISTORY);
        void persistLocalHistory(next, portalRole);
        showBannerForItem(item);
        presentOsTrayForItem(item);
        return portalRole === activePortalRole ? next : prev;
      });
    },
    [activePortalRole, persistLocalHistory, presentOsTrayForItem, showBannerForItem],
  );

  const inspectBookingsDelta = useCallback(
    (bookings: Partial<Booking>[], portalRole: 'provider' | 'customer') => {
      const shouldNotify = snapshotSeededPortalRef.current === portalRole;
      let anyChanged = false;

      for (const b of bookings) {
        const id = String(b._id || '');
        if (!id) continue;
        const sig = getBookingStateSignature(b);
        const display = resolveBookingDisplayState(b, portalRole);
        const prevSig = snapshotSigRef.current.get(id);
        const prevStage = snapshotStageRef.current.get(id);

        snapshotSigRef.current.set(id, sig);
        snapshotStageRef.current.set(id, display.stage);

        if (shouldNotify && prevSig && prevSig !== sig) {
          anyChanged = true;
          if (prevStage !== display.stage) {
            appendSyntheticRentalNotification(b, portalRole);
          }
        }
      }

      snapshotSeededPortalRef.current = portalRole;
      if (anyChanged) {
        setBookingSyncVersion((v) => v + 1);
      }
    },
    [appendSyntheticRentalNotification],
  );

  const syncBookingsDelta = useCallback(
    async (targetBookingId?: string) => {
      if (!isAuthenticated || deltaSyncRunningRef.current) return;
      deltaSyncRunningRef.current = true;
      const portalRole = resolvePortalRole();

      try {
        if (targetBookingId && snapshotSeededPortalRef.current === portalRole) {
          try {
            const detail =
              portalRole === 'provider'
                ? await providerApi
                    .getBookingDetail(targetBookingId)
                    .catch(() => bookingApi.detail(targetBookingId))
                : await bookingApi.detail(targetBookingId);
            if (detail?._id) {
              const sig = getBookingStateSignature(detail);
              const display = resolveBookingDisplayState(detail, portalRole);
              const prevSig = snapshotSigRef.current.get(detail._id);
              const prevStage = snapshotStageRef.current.get(detail._id);

              snapshotSigRef.current.set(detail._id, sig);
              snapshotStageRef.current.set(detail._id, display.stage);

              if (!prevSig || prevSig !== sig || prevStage !== display.stage) {
                appendSyntheticRentalNotification(detail, portalRole);
                setBookingSyncVersion((v) => v + 1);
              }
              return;
            }
          } catch {
            // Fall back to full list sync
          }
        }

        const list =
          portalRole === 'provider'
            ? await providerApi.getBookings().catch(() => [])
            : await bookingApi.list().catch(() => []);
        if (Array.isArray(list)) {
          inspectBookingsDelta(list, portalRole);
        }
      } finally {
        deltaSyncRunningRef.current = false;
      }
    },
    [
      appendSyntheticRentalNotification,
      inspectBookingsDelta,
      isAuthenticated,
      resolvePortalRole,
    ],
  );

  const reload = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
        setServerNotifications([]);
        setLocalNotifications([]);
        setError(null);
        seenIdsRef.current.clear();
        osPresentedIdsRef.current.clear();
        snapshotSigRef.current.clear();
        snapshotStageRef.current.clear();
        snapshotSeededPortalRef.current = null;
        initializedRef.current = false;
        return;
      }
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await notificationApi.list();
        const list = Array.isArray(data) ? data : [];
        setServerNotifications(list);

        if (!initializedRef.current) {
          list.forEach((n) => {
            seenIdsRef.current.add(n._id);
            osPresentedIdsRef.current.add(n._id);
          });
          initializedRef.current = true;
        } else {
          const newestUnseenUnread = list.find(
            (n) => !n.isRead && !seenIdsRef.current.has(n._id),
          );
          list.forEach((n) => seenIdsRef.current.add(n._id));
          if (newestUnseenUnread) {
            const bId = String(newestUnseenUnread.metadata?.bookingId ?? '');
            if (bId) serverNotifBookingStampRef.current.set(bId, Date.now());
            showBannerForItem(newestUnseenUnread);
            presentOsTrayForItem(newestUnseenUnread);
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
    [isAuthenticated, presentOsTrayForItem, showBannerForItem],
  );

  // Restore role-scoped locally synthesized rental notifications when user or portal role changes
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setLocalNotifications([]);
      return;
    }
    let active = true;
    setLocalNotifications([]);
    snapshotSeededPortalRef.current = null;
    void appStorage.get(localHistoryKey(user.id, activePortalRole)).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLocalNotifications(parsed);
        }
      } catch {
        // Ignore malformed cache
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, activePortalRole]);

  // Adaptive background polling (8s) + instant AppState foreground sync + portal-switch seed
  useEffect(() => {
    void reload(false);
    if (!isAuthenticated) return;

    void syncBookingsDelta();

    const intervalId = setInterval(() => {
      void reload(true);
      void syncBookingsDelta();
    }, 8000);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void reload(true);
        void syncBookingsDelta();
        void refreshPermissionState();
        setBookingSyncVersion((v) => v + 1);
      }
    });

    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [reload, syncBookingsDelta, refreshPermissionState, isAuthenticated, activePortalRole]);

  // Local OS Notifications (works in Expo Go & Dev Builds) + Remote Push Registration (Dev Builds)
  useEffect(() => {
    if (!isAuthenticated || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
      return;
    }

    void ensureNotificationPermission()
      .then(() => refreshPermissionState())
      .catch(() => refreshPermissionState());

    void registerCurrentDeviceForPush().catch(() => undefined);

    const Notifications = getLocalNotificationsModule();
    if (!Notifications) {
      return;
    }

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
  }, [isAuthenticated, reload, refreshPermissionState]);

  // Real-time WebSocket listeners for new notifications & booking state changes
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleNewNotification = (payload: NotificationItem) => {
      if (!payload?._id) return;
      const isFresh = !seenIdsRef.current.has(payload._id);
      seenIdsRef.current.add(payload._id);

      const bId = String(payload.metadata?.bookingId ?? '');
      if (bId) serverNotifBookingStampRef.current.set(bId, Date.now());

      setServerNotifications((prev) => {
        if (prev.some((item) => item._id === payload._id)) return prev;
        return [payload, ...prev];
      });

      if (isFresh) {
        showBannerForItem(payload);
        presentOsTrayForItem(payload);
      }
      setBookingSyncVersion((v) => v + 1);
    };

    const handleBookingUpdated = (payload: {
      bookingId?: string;
      status?: string;
    }) => {
      setBookingSyncVersion((v) => v + 1);
      void reload(true);
      void syncBookingsDelta(payload?.bookingId);
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('booking_updated', handleBookingUpdated);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('booking_updated', handleBookingUpdated);
    };
  }, [
    socket,
    isAuthenticated,
    showBannerForItem,
    presentOsTrayForItem,
    reload,
    syncBookingsDelta,
  ]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const notifications = useMemo(() => {
    const roleLocal = localNotifications.filter(
      (n) => !n.metadata?.targetRole || n.metadata.targetRole === activePortalRole,
    );
    const merged = [...roleLocal, ...serverNotifications];
    return merged.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activePortalRole, localNotifications, serverNotifications]);

  const markRead = useCallback(
    async (id: string) => {
      if (id.startsWith('local-')) {
        setLocalNotifications((prev) => {
          const next = prev.map((n) => (n._id === id ? { ...n, isRead: true } : n));
          void persistLocalHistory(next);
          return next;
        });
        return;
      }
      await notificationApi.markRead(id);
      setServerNotifications((v) =>
        v.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
    },
    [persistLocalHistory],
  );

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setServerNotifications((v) => v.map((n) => ({ ...n, isRead: true })));
    setLocalNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      void persistLocalHistory(next);
      return next;
    });
  }, [persistLocalHistory]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const Notifications = getLocalNotificationsModule();
    if (!Notifications) return;
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
      osPermissionStatus,
      requestOsPermission,
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
      osPermissionStatus,
      requestOsPermission,
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
