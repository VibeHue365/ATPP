import { useEffect, useState } from 'react';
import { productApi } from '@/apis/productApi';
import type { Product } from '@/types/product';

export function useFeaturedProducts(limit = 4) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    productApi.featured(limit).then(data => { if (active) setProducts(data ?? []); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit]);
  return { products, loading };
}
