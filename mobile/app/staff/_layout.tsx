import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isPartnerPortalUser, isStaffPortalUser } from '@/utils/navigation';

export default function StaffLayout() {
  const { user, loading, isAuthenticated } = useAuth();

  const isStaff = isAuthenticated && isStaffPortalUser(user);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login' as Href);
      return;
    }
    if (!isStaff) {
      if (isPartnerPortalUser(user)) {
        router.replace('/provider' as Href);
      } else {
        router.replace('/(tabs)' as Href);
      }
    }
  }, [loading, isAuthenticated, isStaff, user]);

  if (loading || !isAuthenticated || !isStaff) {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
