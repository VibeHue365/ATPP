import { useCallback, useEffect, useState } from 'react';
import { photographyPackagesApi } from '../api/photographyPackages.api';
import type { PhotographyPackage, PhotographyPackagePayload } from '../types/photographyPackage.types';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function usePhotographyPackages(enabled = true) {
  const [packages, setPackages] = useState<PhotographyPackage[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setPackages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await photographyPackagesApi.listMine();
      setPackages(Array.isArray(response) ? response : []);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Không thể tải danh sách gói chụp ảnh.'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const create = useCallback(async (payload: PhotographyPackagePayload) => {
    const created = await photographyPackagesApi.create(payload);
    setPackages((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, payload: Partial<PhotographyPackagePayload>) => {
    const updated = await photographyPackagesApi.update(id, payload);
    setPackages((current) => current.map((item) => (item._id === id ? updated : item)));
    return updated;
  }, []);

  const publish = useCallback(async (id: string) => {
    const updated = await photographyPackagesApi.publish(id);
    setPackages((current) => current.map((item) => (item._id === id ? updated : item)));
    return updated;
  }, []);

  const unpublish = useCallback(async (id: string) => {
    const updated = await photographyPackagesApi.unpublish(id);
    setPackages((current) => current.map((item) => (item._id === id ? updated : item)));
    return updated;
  }, []);

  return { packages, isLoading, error, refresh, create, update, publish, unpublish };
}
