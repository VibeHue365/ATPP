import React, { useCallback, useMemo } from 'react';
import { router, type Href } from 'expo-router';
import { AddProductModal } from '@/components/provider/store/AddProductModal';
import { getPendingProductFormState } from '@/utils/providerFormBridge';

export default function ProviderProductFormScreen() {
  const pending = useMemo(() => getPendingProductFormState(), []);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/provider/(tabs)/store' as Href);
    }
  }, []);

  return (
    <AddProductModal
      visible
      asScreen
      editingProduct={pending.editingProduct}
      onClose={handleClose}
      onCreated={() => {
        pending.onSaved?.();
      }}
    />
  );
}
