import { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { type Href, Stack, router, usePathname } from 'expo-router';
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
import { InAppNotificationBanner } from '@/components/ui/InAppNotificationBanner';
import { ToastProvider } from '@/contexts/ToastContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { configureGoogleSignIn } from '@/services/googleAuth';
import {
  isPartnerPortalUser,
  isStaffPortalUser,
  setActivePortalMode,
} from '@/utils/navigation';

LogBox.ignoreLogs([
  '`expo-notifications` functionality is not fully supported in Expo Go',
  '[expo-notifications] Push notifications (remote notifications) are unavailable in Expo Go on Android',
]);

const CUSTOMER_TAB_ENTRY_PATHS = new Set([
  '/',
  '/rentals',
  '/photography',
  '/bookings',
  '/profile',
]);

function isStaffAllowedPath(pathname?: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/chat' ||
    pathname.startsWith('/chat/') ||
    pathname === '/notifications' ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/auth')
  );
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const hasAppliedInitialPartnerEntryRef = useRef(false);
  const isAppReady = fontsReady && !authLoading;

  useEffect(() => {
    if (isAppReady) {
      void SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/staff')) {
      void setActivePortalMode('staff');
    } else if (pathname.startsWith('/provider')) {
      void setActivePortalMode('provider');
    } else if (
      CUSTOMER_TAB_ENTRY_PATHS.has(pathname) ||
      pathname.startsWith('/booking/') ||
      pathname === '/cart' ||
      pathname === '/checkout'
    ) {
      void setActivePortalMode('customer');
    }
  }, [pathname]);

  useEffect(() => {
    if (!isAppReady) return;
    if (!isAuthenticated || !user) {
      hasAppliedInitialPartnerEntryRef.current = false;
      return;
    }

    // Strictly lock isolated STAFF sessions to /staff (plus /chat and /notifications).
    if (isStaffPortalUser(user)) {
      if (!isStaffAllowedPath(pathname)) {
        router.replace('/staff' as Href);
      }
      return;
    }

    if (hasAppliedInitialPartnerEntryRef.current) return;
    hasAppliedInitialPartnerEntryRef.current = true;

    // Route restored Partner sessions to /provider once on app startup without blocking manual customer switch.
    if (isPartnerPortalUser(user) && CUSTOMER_TAB_ENTRY_PATHS.has(pathname)) {
      router.replace('/provider' as Href);
    }
  }, [isAppReady, isAuthenticated, user, pathname]);

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
      <Stack.Screen name="staff" options={{ headerShown: false }} />
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
                <InAppNotificationBanner />
              </DestinationProvider>
            </NotificationProvider>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
