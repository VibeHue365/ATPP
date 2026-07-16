import { useCallback, useEffect, useState } from 'react';
import { adminDirectoryApi } from '../api/adminDirectoryApi';
import type { DirectoryItem, DirectoryKind, Page } from '../types';

const loaders = {
  customers: adminDirectoryApi.customers,
  providers: adminDirectoryApi.providers,
  bookings: adminDirectoryApi.bookings,
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải danh sách.';

export function useDirectory(kind: DirectoryKind) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<DirectoryItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await loaders[kind](page));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [kind, page]);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      try {
        const nextData = await loaders[kind](page);
        if (active) setData(nextData);
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [kind, page]);

  return { data, error, loading, page, refresh, setPage };
}