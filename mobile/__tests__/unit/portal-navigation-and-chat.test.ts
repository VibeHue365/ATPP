describe('portal mode subscription and direct order customer chat', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('notifies subscribers only when active portal mode changes and respects unsubscribe', async () => {
    const storeSet = jest.fn().mockResolvedValue(undefined);
    const events: string[] = [];

    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/utils/storage', () => ({
        appStorage: {
          set: storeSet,
          get: jest.fn().mockResolvedValue(null),
          remove: jest.fn().mockResolvedValue(undefined),
        },
      }));

      const {
        getCurrentPortalMode,
        setActivePortalMode,
        subscribePortalMode,
      } = require('@/utils/navigation');

      const unsub = subscribePortalMode((mode: string) => {
        events.push(mode);
      });

      await setActivePortalMode('provider');
      await setActivePortalMode('provider');
      await setActivePortalMode('customer');
      unsub();
      await setActivePortalMode('provider');

      expect(getCurrentPortalMode()).toBe('provider');
    });

    expect(events).toEqual(['provider', 'customer']);
    expect(storeSet).toHaveBeenCalledWith('vh_active_portal_mode', 'provider');
    expect(storeSet).toHaveBeenCalledWith('vh_active_portal_mode', 'customer');
  });

  it('opens direct room via chatApi.createRoom and falls back cleanly to /chat', async () => {
    const pushMock = jest.fn();
    const createRoomMock = jest
      .fn()
      .mockResolvedValueOnce({ id: 'room-42' })
      .mockRejectedValueOnce(new Error('network error'));

    await jest.isolateModulesAsync(async () => {
      jest.doMock('expo-router', () => ({
        router: { push: pushMock },
      }));
      jest.doMock('@/apis/chatApi', () => ({
        chatApi: { createRoom: createRoomMock },
      }));

      const { openOrderCustomerChat } = require('@/utils/chatNavigation');

      await openOrderCustomerChat({
        _id: 'bk-1',
        customerId: {
          _id: 'cust-99',
          profile: { fullName: 'Nguyễn Minh Anh' },
        },
      });

      expect(createRoomMock).toHaveBeenCalledWith('cust-99');
      expect(pushMock).toHaveBeenCalledWith({
        pathname: '/chat/[id]',
        params: { id: 'room-42', name: 'Nguyễn Minh Anh' },
      });

      // Fallback when room creation fails
      await openOrderCustomerChat({ _id: 'bk-2', customerId: 'cust-100' });
      expect(pushMock).toHaveBeenLastCalledWith('/chat');

      // Fallback when order has no customerId
      await openOrderCustomerChat({ _id: 'bk-3' });
      expect(pushMock).toHaveBeenLastCalledWith('/chat');
    });
  });
});
