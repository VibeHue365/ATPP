import { useCallback, useEffect, useState } from 'react';
import { adminStatsApi } from '../api/adminStatsApi';
import type { AdminStats } from '../types';

const messageFromError = (error: unknown) => error instanceof Error ? error.message : 'Không thể tải số liệu quản trị.';

export function useAdminStats() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await adminStatsApi.get()); }
    catch (requestError) { setError(messageFromError(requestError)); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    const loadInitialStats = async () => {
      try {
        const nextStats = await adminStatsApi.get();
        if (active) setData(nextStats);
      } catch (requestError) {
        if (active) setError(messageFromError(requestError));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadInitialStats();
    return () => { active = false; };
  }, []);

  return { data, isLoading, error, refresh };
}