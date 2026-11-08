import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { DestinationProvider } from '@/contexts/DestinationContext';
import { DestinationPickerModal } from '@/components/destination/DestinationPickerModal';
import { ToastProvider } from '@/contexts/ToastContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { configureGoogleSignIn } from '@/services/googleAuth';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { loading: authLoading } = useAuth();
  const isAppReady = fontsReady && !authLoading;

  useEffect(() => {
    if (isAppReady) {
      void SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  if (!isAppReady) {
    return null;
  }

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  if (!fontsReady) return null;

  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <NotificationProvider>
              <DestinationProvider>
                <RootNavigator fontsReady={fontsReady} />
                <DestinationPickerModal />
              </DestinationProvider>
            </NotificationProvider>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
