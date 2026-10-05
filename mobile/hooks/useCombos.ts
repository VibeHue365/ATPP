import { useCallback, useEffect, useState } from 'react';
import { comboApi } from '@/apis/comboApi';
import type { ComboDeal } from '@/types/combo';
import { getApiErrorMessage } from '@/utils/apiError';

export function useCombos() {
  const [items, setItems] = useState<ComboDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await comboApi.list()); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể tải danh sách combo')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { items, loading, error, reload: load };
}

export function useComboDetail(id?: string) {
  const [item, setItem] = useState<ComboDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!id) { setError('Thiếu mã combo'); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setItem(await comboApi.detail(id)); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể tải combo')); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  return { item, loading, error, reload: load };
}

