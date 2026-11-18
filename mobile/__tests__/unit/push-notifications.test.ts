describe('pushNotifications Expo Go guard', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('skips loading expo-notifications for remote push when running inside Expo Go', async () => {
    const notificationsFactory = jest.fn(() => ({
      setNotificationHandler: jest.fn(),
    }));

    let result: unknown = 'unset';
    let registerResult: string | null = 'unset';

    await jest.isolateModulesAsync(async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { appOwnership: 'expo' },
      }));
      jest.doMock('expo-notifications', notificationsFactory);

      const {
        getNotificationsModule,
        registerCurrentDeviceForPush,
      } = require('@/services/pushNotifications');

      result = getNotificationsModule();
      registerResult = await registerCurrentDeviceForPush();
    });

    expect(result).toBeNull();
    expect(registerResult).toBeNull();
    expect(notificationsFactory).not.toHaveBeenCalled();
  });

  it('loads expo-notifications and configures handler once outside Expo Go', async () => {
    const setNotificationHandler = jest.fn();
    const notificationsFactory = jest.fn(() => ({
      setNotificationHandler,
      AndroidImportance: { HIGH: 4, MAX: 5 },
    }));

    let first: unknown = null;
    let second: unknown = null;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { appOwnership: null },
      }));
      jest.doMock('expo-notifications', notificationsFactory);

      const { getNotificationsModule } = require('@/services/pushNotifications');
      first = getNotificationsModule();
      second = getNotificationsModule();
    });

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(notificationsFactory).toHaveBeenCalledTimes(1);
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('loads expo-notifications for local OS notifications even in Expo Go', async () => {
    const setNotificationHandler = jest.fn();
    const scheduleNotificationAsync = jest.fn(async () => 'local-notif-1');
    const setNotificationChannelAsync = jest.fn(async () => null);
    const getPermissionsAsync = jest.fn(async () => ({ granted: true }));
    const notificationsFactory = jest.fn(() => ({
      setNotificationHandler,
      scheduleNotificationAsync,
      setNotificationChannelAsync,
      getPermissionsAsync,
      AndroidImportance: { HIGH: 4, MAX: 5 },
    }));

    let localMod: unknown = null;
    let scheduledId: string | null = null;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { appOwnership: 'expo' },
      }));
      jest.doMock('expo-notifications', notificationsFactory);

      const {
        getLocalNotificationsModule,
        presentLocalNotification,
      } = require('@/services/pushNotifications');

      localMod = getLocalNotificationsModule();
      scheduledId = await presentLocalNotification({
        title: 'Đơn thuê mới',
        body: 'Khách hàng đã gửi yêu cầu trả áo dài.',
        data: { bookingId: 'bk-1' },
      });
    });

    expect(localMod).not.toBeNull();
    expect(scheduledId).toBe('local-notif-1');
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});
