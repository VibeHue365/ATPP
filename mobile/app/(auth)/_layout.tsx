import { type Href, Redirect, Stack, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { safeReturnTo } from '@/utils/navigation';

export default function AuthLayout() {
  const { user, loading, isAuthenticated } = useAuth();
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();

  if (loading) {
    return null;
  }

  if (isAuthenticated && user) {
    const rolesUpper = (user.roles ?? []).map((r) => String(r).toUpperCase());
    if (rolesUpper.includes('PROVIDER')) {
      return <Redirect href={'/provider' as Href} />;
    }

    const rawReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    const destination = safeReturnTo(rawReturnTo, '/(tabs)' as Href);

    if (user.hasCompletedOnboarding === false) {
      return (
        <Redirect
          href={
            {
              pathname: '/preferences',
              params: { onboarding: '1', returnTo: String(destination) },
            } as unknown as Href
          }
        />
      );
    }

    return <Redirect href={destination} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
