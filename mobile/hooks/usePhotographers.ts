import { useCallback, useEffect, useState } from 'react';
import { photographerApi } from '@/apis/photographerApi';
import type { Photographer, PhotographerConcept, PhotographerFilters, PhotographerPackageCategory } from '@/types/photographer';
import { getApiErrorMessage } from '@/utils/apiError';

export function usePhotographers(filters: PhotographerFilters) {
  const [items, setItems] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await photographerApi.list(filters);
      setItems(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
      setTotalPages(response.meta?.totalPages ?? 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể tải danh sách gói chụp'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);
  useEffect(() => { void load(); }, [load]);
  return { items, loading, error, total, totalPages, reload: load };
}

export function usePhotographyFilters() {
  const [concepts, setConcepts] = useState<PhotographerConcept[]>([]);
  const [categories, setCategories] = useState<PhotographerPackageCategory[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([photographerApi.concepts(), photographerApi.categories()])
      .then(([conceptResponse, categoryResponse]) => {
        if (!active) return;
        setConcepts(conceptResponse.data ?? []);
        setCategories((categoryResponse.data ?? []).filter(item => item.status === 'ACTIVE'));
      })
      .catch(() => { if (active) { setConcepts([]); setCategories([]); } });
    return () => { active = false; };
  }, []);
  return { concepts, categories };
}
