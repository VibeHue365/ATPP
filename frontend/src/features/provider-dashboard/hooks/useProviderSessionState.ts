
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderSessionState() {
  const [provider, setProvider] = useState<any>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingProvider, setIsLoadingProvider] = useState(false);

  return {
    provider, setProvider, selectedBookingId, setSelectedBookingId, isDetailModalOpen,
    setIsDetailModalOpen, isLoadingProvider, setIsLoadingProvider,
  };
}
