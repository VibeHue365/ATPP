import { useCallback, useEffect, useState } from 'react';
import { adminDisputesApi } from '../api/adminDisputesApi';
import type { Dispute } from '../types';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải tranh chấp.';

export function useDisputes() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await adminDisputesApi.list());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialDisputes = async () => {
      try {
        const disputes = await adminDisputesApi.list();
        if (active) setItems(disputes);
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialDisputes();
    return () => {
      active = false;
    };
  }, []);

  return { error, items, loading, refresh, setError };
}