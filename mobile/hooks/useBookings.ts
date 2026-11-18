import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { bookingApi } from '@/apis/bookingApi';
import { useNotifications } from '@/contexts/NotificationContext';
import type { Booking } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';

export function useBookings() {
  const { bookingSyncVersion } = useNotifications();
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const mountedSyncRef = useRef(bookingSyncVersion);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      setError(null);
      const data = await bookingApi.list();
      setItems(Array.isArray(data) ? data : []);
      hasLoadedRef.current = true;
    } catch (cause) {
      if (!silent) {
        setError(getApiErrorMessage(cause, 'Không thể tải đơn hàng và lịch'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedRef.current);
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (bookingSyncVersion !== mountedSyncRef.current) {
      mountedSyncRef.current = bookingSyncVersion;
      void load(true);
    }
  }, [bookingSyncVersion, load]);

  return { items, loading, refreshing, error, reload: () => load(true) };
}

export function useBookingDetail(id?: string) {
  const { bookingSyncVersion } = useNotifications();
  const [item, setItem] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const mountedSyncRef = useRef(bookingSyncVersion);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!id) {
        setError('Thiếu mã đơn hàng');
        setLoading(false);
        return;
      }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        setError(null);
        setItem(await bookingApi.detail(id));
        loadedIdRef.current = id;
      } catch (cause) {
        if (mode === 'initial') {
          setError(
            getApiErrorMessage(cause, 'Không thể tải chi tiết đơn hàng'),
          );
        }
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      const alreadyLoadedThisId = Boolean(id && loadedIdRef.current === id);
      void load(alreadyLoadedThisId ? 'silent' : 'initial');
      return undefined;
    }, [load, id]),
  );

  useEffect(() => {
    if (bookingSyncVersion !== mountedSyncRef.current) {
      mountedSyncRef.current = bookingSyncVersion;
      void load('silent');
    }
  }, [bookingSyncVersion, load]);

  return {
    item,
    loading,
    refreshing,
    error,
    reload: () => load('silent'),
    pullRefresh: () => load('refresh'),
  };
}
