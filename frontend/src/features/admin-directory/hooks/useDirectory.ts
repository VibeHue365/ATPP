import { useCallback, useEffect, useRef, useState } from 'react';
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
  const requestId = useRef(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<DirectoryItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const nextData = await loaders[kind](page);
      if (currentRequestId === requestId.current) setData(nextData);
    } catch (requestError) {
      if (currentRequestId === requestId.current) setError(getErrorMessage(requestError));
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [kind, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, page, refresh, setPage };
}
