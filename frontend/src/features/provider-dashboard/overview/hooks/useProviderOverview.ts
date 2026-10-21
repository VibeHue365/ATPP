import { useCallback, useEffect, useRef, useState } from 'react';
import { overviewApi } from '../api/overviewApi';
import type { ProviderOverviewResponse } from '../types';
import { useSocket } from '../../../../context/SocketContext';

export interface UseProviderOverviewResult {
  data: ProviderOverviewResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  period: 'week' | 'month' | 'year';
  setPeriod: (period: 'week' | 'month' | 'year') => void;
  service: string;
  setService: (service: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  isCurrentMonth: boolean;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

function getCurrentMonthStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function useProviderOverview(): UseProviderOverviewResult {
  const [data, setData] = useState<ProviderOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [service, setService] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr);

  const currentMonthStr = getCurrentMonthStr();
  const isCurrentMonth = selectedMonth === currentMonthStr;

  const goToPrevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      return `${prevY}-${String(prevM).padStart(2, '0')}`;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    const cur = getCurrentMonthStr();
    setSelectedMonth((prev) => {
      if (prev >= cur) return prev;
      const [y, m] = prev.split('-').map(Number);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const nextStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
      return nextStr > cur ? cur : nextStr;
    });
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(getCurrentMonthStr());
  }, []);

  const { socket, isConnected } = useSocket();
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const fetchOverview = useCallback(
    async (silent = false) => {
      // Cancel previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!silent) {
        if (!data) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const res = await overviewApi.getOverview({
          period,
          service,
          month: selectedMonth,
          signal: controller.signal,
        });
        if (res) {
          setData(res);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Lỗi khi tải dữ liệu tổng quan đối tác:', err);
        setError(err.message || 'Không thể tải dữ liệu tổng quan');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [period, service, selectedMonth, data],
  );

  // Fetch when period, service, or selectedMonth changes
  useEffect(() => {
    fetchOverview(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [period, service, selectedMonth]);

  // Realtime updates via WebSocket (debounced 1.2s to prevent thundering herd)
  useEffect(() => {
    if (!socket) return;
    const handleBookingUpdated = () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        fetchOverview(true);
      }, 1200);
    };

    socket.on('booking_updated', handleBookingUpdated);
    return () => {
      socket.off('booking_updated', handleBookingUpdated);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [socket, fetchOverview]);

  // Polling every 60 seconds (only if document is visible)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOverview(true);
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOverview(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchOverview]);

  const refresh = useCallback(async () => {
    await fetchOverview(false);
  }, [fetchOverview]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    period,
    setPeriod,
    service,
    setService,
    selectedMonth,
    setSelectedMonth,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
    refresh,
    isConnected,
  };
}
