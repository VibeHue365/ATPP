import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function ProviderLayout() {
  const { user, loading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const isRegisterRoute = segments.includes('register' as never);

  const isPartner =
    isAuthenticated &&
    Boolean(
      user?.roles?.some((r) =>
        ['PROVIDER', 'PHOTOGRAPHER', 'ADMIN'].includes(r.toUpperCase()),
      ),
    );

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      } else if (!isPartner && !isRegisterRoute) {
        router.replace('/provider/register');
      }
    }
  }, [loading, isAuthenticated, isPartner, isRegisterRoute]);

  if (loading || !isAuthenticated || (!isPartner && !isRegisterRoute)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color="#BA0049" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen
        name="qr-scanner"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
