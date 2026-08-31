import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { photographersApi } from '../api/photographers.api';
import { toPhotographerSummary } from '../mappers/photographer.mapper';
import type {
  PhotographerDiscoveryMeta,
  PhotographerDiscoveryParams,
  PhotographerSummary,
} from '../types/photographer.types';

interface UsePhotographersResult {
  photographers: PhotographerSummary[];
  meta: PhotographerDiscoveryMeta;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const emptyMeta: PhotographerDiscoveryMeta = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1,
};

export const usePhotographers = (
  params: PhotographerDiscoveryParams = { limit: 48 },
): UsePhotographersResult => {
  const [photographers, setPhotographers] = useState<PhotographerSummary[]>([]);
  const [meta, setMeta] = useState<PhotographerDiscoveryMeta>(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryKey = useMemo(() => JSON.stringify(params), [params]);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const response = await photographersApi.getAll(params, { signal: controller.signal });
      setPhotographers(response.data.map(toPhotographerSummary));
      setMeta(response.meta);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = requestError instanceof Error
        ? requestError.message
        : 'Không thể tải danh sách nhiếp ảnh gia.';
      setError(message);
      setPhotographers([]);
      setMeta(emptyMeta);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [queryKey]);

  useEffect(() => {
    void reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  return { photographers, meta, isLoading, error, reload };
};
