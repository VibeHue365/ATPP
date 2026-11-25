import { useEffect } from 'react';
import { Redirect, Stack, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearPendingOAuthReturnTo,
  resolvePostAuthDestination,
} from '@/utils/navigation';

export default function AuthLayout() {
  const { user, loading, isAuthenticated } = useAuth();
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();

  useEffect(() => {
    if (isAuthenticated && user) {
      void clearPendingOAuthReturnTo();
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return null;
  }

  if (isAuthenticated && user) {
    return <Redirect href={resolvePostAuthDestination(user, returnTo)} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
