import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/apis/httpClient';
import { useAuth } from '@/contexts/AuthContext';
import { tokenStorage } from '@/utils/storage';

interface SocketValue {
  socket: Socket | null;
  isConnected: boolean;
  authenticatedUserId: string | null;
}

const SocketContext = createContext<SocketValue>({
  socket: null,
  isConnected: false,
  authenticatedUserId: null,
});

const socketUrl = (process.env.EXPO_PUBLIC_SOCKET_URL ?? API_BASE_URL).replace(/\/api\/?$/, '');

export function SocketProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, loading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      setConnected(false);
      setAuthenticatedUserId(null);
      setSocket(null);
      return;
    }

    let active = true;
    let instance: Socket | null = null;
    void tokenStorage.getAccessToken().then((token) => {
      if (!active || !token) return;
      instance = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 10_000,
        timeout: 10_000,
      });
      instance.on('connect', () => setConnected(true));
      instance.on('disconnect', () => {
        setConnected(false);
        setAuthenticatedUserId(null);
      });
      instance.on('connect_error', () => setConnected(false));
      instance.on('authenticated', (payload: { userId?: string }) => {
        setAuthenticatedUserId(payload.userId ? String(payload.userId) : null);
      });
      setSocket(instance);
    });

    return () => {
      active = false;
      instance?.removeAllListeners();
      instance?.disconnect();
      setConnected(false);
      setAuthenticatedUserId(null);
      setSocket(null);
    };
  }, [isAuthenticated, loading]);

  const value = useMemo(() => ({ socket, isConnected, authenticatedUserId }), [socket, isConnected, authenticatedUserId]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
