import type { ReactNode } from 'react';
import { type Href, Redirect, useGlobalSearchParams, usePathname } from 'expo-router';
import { LoadingState } from '@/components/ui/ScreenState';
import { useAuth } from '@/contexts/AuthContext';
import { buildLoginHref } from '@/utils/navigation';

export function RequireAuth({
  children,
  preserveReturnTo = true,
}: {
  children: ReactNode;
  preserveReturnTo?: boolean;
}) {
  const { loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();

  if (loading) {
    return <LoadingState label="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!isAuthenticated) {
    if (!preserveReturnTo) {
      return <Redirect href={'/(auth)/login' as Href} />;
    }

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'returnTo' && value !== undefined) {
        query.set(key, Array.isArray(value) ? value[0] : value);
      }
    });
    const returnTo = `${pathname}${query.size ? `?${query.toString()}` : ''}`;
    return <Redirect href={buildLoginHref(returnTo)} />;
  }

  return children;
}
