import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../features/auth/hooks/useAuth';
import { tokenStorage } from '../services/tokenStorage';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Wait until auth initialization is done
    if (isLoading) return;

    let socketInstance: Socket | null = null;

    if (isAuthenticated) {
      const token = tokenStorage.getAccessToken();
      if (token) {
        const socketUrl =
          import.meta.env.VITE_SOCKET_URL ||
          import.meta.env.VITE_API_BASE_URL ||
          'http://localhost:3000';

        console.log(`[Socket] Initiating connection to ${socketUrl}...`);

        socketInstance = io(socketUrl, {
          auth: {
            token,
          },
          transports: ['websocket'],
          autoConnect: true,
        });

        socketInstance.on('connect', () => {
          console.log('[Socket] Connected to server successfully. Socket ID:', socketInstance?.id);
          setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason: string) => {
          console.log('[Socket] Disconnected from server. Reason:', reason);
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error: any) => {
          console.error('[Socket] Connection error:', error.message);
          setIsConnected(false);
        });

        socketInstance.on('authenticated', (data: any) => {
          console.log('[Socket] Handshake authenticated successfully. Payload:', data);
        });

        setSocket(socketInstance);
      } else {
        console.warn('[Socket] User is authenticated but token is missing in storage.');
      }
    } else {
      console.log('[Socket] User is not authenticated. Ensuring socket is disconnected.');
      setIsConnected(false);
      setSocket(null);
    }

    // Clean up connections on unmount or when auth state changes
    return () => {
      if (socketInstance) {
        console.log('[Socket] Disconnecting socket during cleanup...');
        socketInstance.disconnect();
      }
    };
  }, [isAuthenticated, isLoading]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
