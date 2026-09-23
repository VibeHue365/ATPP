
import { useState } from 'react';
import type { Category } from '../../categories/types';
import type { Product } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderProductsState() {
  const [prodSearch, setProdSearch] = useState('');
  const [prodSortBy, setProdSortBy] = useState('newest');
  const [prodPage, setProdPage] = useState(1);
  const [prodLimit] = useState(6);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodSizeFilter, setProdSizeFilter] = useState('');
  const [prodColorFilter, setProdColorFilter] = useState('');
  const [debouncedProdSearch, setDebouncedProdSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);

  return {
    prodSearch, setProdSearch, prodSortBy, setProdSortBy, prodPage, setProdPage, prodLimit, prodTotal,
    setProdTotal, prodSizeFilter, setProdSizeFilter, prodColorFilter, setProdColorFilter,
    debouncedProdSearch, setDebouncedProdSearch, products, setProducts, categories, setCategories,
    loadingProducts, setLoadingProducts, styleCategories, setStyleCategories, eventCategories,
    setEventCategories,
  };
}
