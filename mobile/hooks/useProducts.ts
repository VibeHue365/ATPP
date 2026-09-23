import { useCallback, useEffect, useState } from 'react';
import { productApi } from '@/apis/productApi';
import type { Product, ProductFilters } from '@/types/product';
import { getApiErrorMessage } from '@/utils/apiError';

export function useProducts(filters: ProductFilters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const response = await productApi.list(filters);
      setProducts(response.data ?? []); setTotal(response.meta?.total ?? 0); setTotalPages(response.meta?.totalPages ?? 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể tải danh sách áo dài'));
    } finally { setLoading(false); }
  }, [JSON.stringify(filters)]);

  useEffect(() => { void load(); }, [load]);
  return { products, loading, error, total, totalPages, reload: load };
}
