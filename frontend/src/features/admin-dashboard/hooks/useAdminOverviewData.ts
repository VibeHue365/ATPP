import { useCallback, useEffect, useState } from 'react';
import { adminStatsApi } from '../api/adminStatsApi';
import type { AdminStats } from '../types';

export interface OverviewChartPoint {
  day: string;
  bookings: number;
  gmvMillions: number;
}

export interface ServiceShareItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface PartnerRanking {
  rank: number;
  name: string;
  bookings: number;
  avatar: string;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  count: number;
  tab: string;
  variant: 'red' | 'amber';
}

export interface ActivityFeedItem {
  id: string;
  type: 'booking' | 'product' | 'refund' | 'verification' | 'dispute';
  actor: string;
  action: string;
  timeAgo: string;
}

export interface SystemAlertItem {
  id: string;
  title: string;
  count: number;
  severity: 'warning' | 'critical';
}

export interface AdminOverviewData {
  lastUpdated: string;
  kpis: {
    totalBookings: { value: number; growth: number };
    gmv: { value: number; growth: number };
    activePartners: { value: number; growth: number };
    pendingApprovals: {
      total: number;
      growth: number;
      partners: number;
      products: number;
      combos: number;
    };
    pendingRefunds: { value: number; growth: number };
    openDisputes: { value: number; growth: number };
  };
  chart: {
    period: 'day' | 'week' | 'month';
    summaryBookings: number;
    summaryGmv: number;
    points: OverviewChartPoint[];
  };
  services: {
    total: number;
    items: ServiceShareItem[];
  };
  tasks: PendingTaskItem[];
  topPartners: PartnerRanking[];
  activities: ActivityFeedItem[];
  alerts: {
    warnings: SystemAlertItem[];
    critical: SystemAlertItem[];
  };
}

const OVERVIEW_CACHE_TTL_MS = 60_000;
const overviewCache = new Map<string, { data: AdminOverviewData; loadedAt: number }>();

export function useAdminOverviewData() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const cached = overviewCache.get('month');
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverviewData | null>(cached?.data ?? null);

  const fetchOverview = useCallback(async (force = false) => {
    const cachedResult = overviewCache.get(period);
    if (!force && cachedResult && Date.now() - cachedResult.loadedAt < OVERVIEW_CACHE_TTL_MS) {
      setData(cachedResult.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const backendStats: AdminStats = await adminStatsApi.get(period);
      const totalBookingsCount = backendStats.bookings?.total ?? 0;
      const totalRevenue = backendStats.revenue?.total ?? 0;
      const totalPartners =
        (backendStats.shops?.total ?? 0) + (backendStats.photographers?.total ?? 0);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      const pendingVerifsCount = backendStats.operational?.pendingVerifications ?? 0;
      const openDisputesCount = backendStats.operational?.openDisputes ?? 0;

      const kpis = backendStats.kpis ?? {
        totalBookings: { value: totalBookingsCount, growth: 0 },
        gmv: { value: totalRevenue, growth: 0 },
        activePartners: { value: totalPartners, growth: 0 },
        pendingApprovals: {
          total: pendingVerifsCount,
          growth: 0,
          partners: pendingVerifsCount,
          products: 0,
          combos: 0,
        },
        pendingRefunds: { value: 0, growth: 0 },
        openDisputes: { value: openDisputesCount, growth: 0 },
      };

      const chartPoints =
        backendStats.chart?.points && backendStats.chart.points.length > 0
          ? backendStats.chart.points
          : [];

      const services = backendStats.services ?? {
        total: totalBookingsCount,
        items: [
          { id: 'rental', name: 'Thuê áo dài', count: 0, percentage: 0, color: '#4A121A' },
          { id: 'photo', name: 'Chụp ảnh', count: 0, percentage: 0, color: '#E06D75' },
          { id: 'combo', name: 'Combo trọn gói', count: 0, percentage: 0, color: '#F4A6AC' },
          { id: 'other', name: 'Dịch vụ khác', count: 0, percentage: 0, color: '#D1D5DB' },
        ],
      };

      const tasks = backendStats.tasks ?? [];
      const topPartners = backendStats.topPartners ?? [];
      const activities = backendStats.activities ?? [];
      const alerts = backendStats.alerts ?? {
        warnings: [],
        critical: [],
      };

      const nextData: AdminOverviewData = {
        lastUpdated: timeStr,
        kpis,
        chart: {
          period,
          summaryBookings: backendStats.chart?.summaryBookings ?? totalBookingsCount,
          summaryGmv: backendStats.chart?.summaryGmv ?? totalRevenue,
          points: chartPoints,
        },
        services,
        tasks,
        topPartners,
        activities,
        alerts,
      };
      overviewCache.set(period, { data: nextData, loadedAt: Date.now() });
      setData(nextData);
    } catch (err: any) {
      console.error('[useAdminOverviewData] Error fetching:', err);
      setError(err?.message || 'Không thể tải số liệu tổng quan');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  return {
    data,
    isLoading,
    error,
    period,
    setPeriod,
    refresh: () => fetchOverview(true),
  };
}
