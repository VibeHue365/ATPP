import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import {
  StoreManagementHubModal,
  type StoreHubTab,
} from '@/components/provider/store/StoreManagementHubModal';
import type { ProviderProfile } from '@/types/provider';
import { getPendingStoreHubState } from '@/utils/providerFormBridge';

const VALID_TABS = new Set<StoreHubTab>([
  'SETTINGS',
  'CONTRACTS',
  'VOUCHERS',
  'PACKAGES',
  'ANALYTICS',
]);

export default function ProviderStoreHubScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const pending = useMemo(() => getPendingStoreHubState(), []);

  const initialTab: StoreHubTab = useMemo(() => {
    const raw = typeof params.tab === 'string' ? params.tab.toUpperCase() : '';
    if (VALID_TABS.has(raw as StoreHubTab)) {
      return raw as StoreHubTab;
    }
    return pending.initialTab || 'SETTINGS';
  }, [params.tab, pending.initialTab]);

  const [profile, setProfile] = useState<ProviderProfile | null>(
    pending.profile,
  );

  const reloadProfile = useCallback(async () => {
    try {
      const next = await providerApi.getMe();
      if (next) setProfile(next);
    } catch {
      // keep existing profile fallback
    }
  }, []);

  useEffect(() => {
    if (!profile) {
      void reloadProfile();
    }
  }, [profile, reloadProfile]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/provider/(tabs)/store' as Href);
    }
  }, []);

  return (
    <StoreManagementHubModal
      visible
      asScreen
      initialTab={initialTab}
      profile={profile}
      onClose={handleClose}
      onUpdated={() => {
        pending.onUpdated?.();
        void reloadProfile();
      }}
    />
  );
}
