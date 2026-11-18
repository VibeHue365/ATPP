import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import {
  PackageAndComboFormModal,
  type PackageComboModalMode,
} from '@/components/provider/store/PackageAndComboFormModal';
import { getPendingPkgComboFormState } from '@/utils/providerFormBridge';

export default function ProviderPackageComboFormScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const pending = useMemo(() => getPendingPkgComboFormState(), []);

  const mode: Exclude<PackageComboModalMode, null> = useMemo(() => {
    const raw = typeof params.mode === 'string' ? params.mode.toUpperCase() : '';
    if (raw === 'COMBO' || raw === 'PACKAGE') return raw;
    return pending.mode === 'COMBO' ? 'COMBO' : 'PACKAGE';
  }, [params.mode, pending.mode]);

  const [products, setProducts] = useState<any[]>(pending.products);
  const [packages, setPackages] = useState<any[]>(pending.packages);

  useEffect(() => {
    if (mode !== 'COMBO') return;
    if (products.length > 0 && packages.length > 0) return;

    let active = true;
    void Promise.allSettled([
      products.length > 0 ? Promise.resolve(null) : providerApi.getMyProducts({ limit: 50 }),
      packages.length > 0 ? Promise.resolve(null) : providerApi.listPhotographyPackages(),
    ]).then(([prodRes, pkgRes]) => {
      if (!active) return;
      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const list = Array.isArray((prodRes.value as any).items)
          ? (prodRes.value as any).items
          : Array.isArray(prodRes.value)
            ? prodRes.value
            : [];
        if (list.length > 0) setProducts(list);
      }
      if (pkgRes.status === 'fulfilled' && Array.isArray(pkgRes.value)) {
        if (pkgRes.value.length > 0) setPackages(pkgRes.value);
      }
    });

    return () => {
      active = false;
    };
  }, [mode, products.length, packages.length]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/provider/(tabs)/store' as Href);
    }
  }, []);

  return (
    <PackageAndComboFormModal
      visible
      asScreen
      mode={mode}
      editingItem={pending.editingItem}
      products={products}
      packages={packages}
      onClose={handleClose}
      onSaved={() => {
        pending.onSaved?.();
      }}
    />
  );
}
