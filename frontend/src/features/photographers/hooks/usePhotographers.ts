import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const queryKey = useMemo(() => JSON.stringify(params), [params]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await photographersApi.getAll(params);
      setPhotographers(response.data.map(toPhotographerSummary));
      setMeta(response.meta);
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : 'Không thể tải danh sách nhiếp ảnh gia.';
      setError(message);
      setPhotographers([]);
      setMeta(emptyMeta);
    } finally {
      setIsLoading(false);
    }
  }, [queryKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { photographers, meta, isLoading, error, reload };
};