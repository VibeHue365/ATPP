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

// Sample points for the month (01 to 30) reflecting realistic Lumé trends matching Figma visual curve
const DEFAULT_CHART_POINTS: OverviewChartPoint[] = [
  { day: '01', bookings: 140, gmvMillions: 28 },
  { day: '03', bookings: 190, gmvMillions: 36 },
  { day: '05', bookings: 230, gmvMillions: 42 },
  { day: '07', bookings: 310, gmvMillions: 55 },
  { day: '09', bookings: 280, gmvMillions: 48 },
  { day: '11', bookings: 340, gmvMillions: 62 },
  { day: '13', bookings: 420, gmvMillions: 74 },
  { day: '15', bookings: 390, gmvMillions: 68 },
  { day: '17', bookings: 460, gmvMillions: 82 },
  { day: '19', bookings: 380, gmvMillions: 64 },
  { day: '21', bookings: 410, gmvMillions: 71 },
  { day: '23', bookings: 490, gmvMillions: 88 },
  { day: '25', bookings: 530, gmvMillions: 95 },
  { day: '27', bookings: 470, gmvMillions: 84 },
  { day: '29', bookings: 510, gmvMillions: 91 },
  { day: '30', bookings: 560, gmvMillions: 99 },
];

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
      const pendingVerifsCount = backendStats.operational?.pendingVerifications ?? 0;
      const openDisputesCount = backendStats.operational?.openDisputes ?? 0;

      const totalBookingsCount = backendStats?.bookings?.total || 8124;
      const totalRevenue = backendStats?.revenue?.total || 1250680000;
      const totalPartners =
        (backendStats?.shops?.total ?? 0) + (backendStats?.photographers?.total ?? 0) || 412;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      const nextData: AdminOverviewData = {
        lastUpdated: timeStr,
        kpis: {
          totalBookings: {
            value: totalBookingsCount,
            growth: 12.3,
          },
          gmv: {
            value: totalRevenue,
            growth: 18.6,
          },
          activePartners: {
            value: totalPartners,
            growth: 8.1,
          },
          pendingApprovals: {
            total: pendingVerifsCount + 12 + 7,
            growth: 33.3,
            partners: pendingVerifsCount,
            products: 12,
            combos: 7,
          },
          pendingRefunds: {
            value: 12,
            growth: 20.0,
          },
          openDisputes: {
            value: openDisputesCount,
            growth: 14.3,
          },
        },
        chart: {
          period,
          summaryBookings: totalBookingsCount,
          summaryGmv: totalRevenue,
          points: DEFAULT_CHART_POINTS,
        },
        services: {
          total: totalBookingsCount,
          items: [
            { id: 'rental', name: 'Thuê áo dài', count: 3562, percentage: 43.8, color: '#4A121A' },
            { id: 'photo', name: 'Chụp ảnh', count: 2481, percentage: 30.5, color: '#E06D75' },
            { id: 'combo', name: 'Combo trọn gói', count: 1624, percentage: 20.0, color: '#F4A6AC' },
            { id: 'other', name: 'Dịch vụ khác', count: 457, percentage: 5.6, color: '#D1D5DB' },
          ],
        },
        tasks: [
          { id: 'task-1', title: 'Booking chờ xác nhận > 24h', count: 18, tab: 'bookings', variant: 'red' },
          { id: 'task-2', title: 'Hồ sơ đối tác chờ duyệt', count: pendingVerifsCount, tab: 'verifications', variant: 'red' },
          { id: 'task-3', title: 'Sản phẩm chờ duyệt', count: 12, tab: 'product-moderation', variant: 'red' },
          { id: 'task-4', title: 'Combo chờ duyệt', count: 7, tab: 'combo-moderation', variant: 'amber' },
          { id: 'task-5', title: 'Yêu cầu hoàn tiền mới', count: 6, tab: 'refunds', variant: 'red' },
          { id: 'task-6', title: 'Tranh chấp cần xử lý', count: openDisputesCount, tab: 'disputes', variant: 'red' },
        ],
        topPartners: [
          { rank: 1, name: 'Áo Dài Cổ Đồ', bookings: 324, avatar: '/avatar_hanna.webp' },
          { rank: 2, name: 'Studio Huế', bookings: 286, avatar: '/avatar_hanna.webp' },
          { rank: 3, name: 'Áo Dài Gấm', bookings: 251, avatar: '/avatar_hanna.webp' },
          { rank: 4, name: 'Nhiếp ảnh Trí', bookings: 198, avatar: '/avatar_hanna.webp' },
          { rank: 5, name: 'Heritage Stu', bookings: 176, avatar: '/avatar_hanna.webp' },
        ],
        activities: [
          {
            id: 'act-1',
            type: 'booking',
            actor: 'Nguyễn Minh Anh',
            action: 'đã đặt lịch thuê áo dài',
            timeAgo: '2 phút trước',
          },
          {
            id: 'act-2',
            type: 'product',
            actor: 'Đối tác Áo Dài Huế Xưa',
            action: 'đã cập nhật sản phẩm mới',
            timeAgo: '15 phút trước',
          },
          {
            id: 'act-3',
            type: 'refund',
            actor: 'Yêu cầu hoàn tiền #HT1023',
            action: 'được tạo và chờ phê duyệt',
            timeAgo: '28 phút trước',
          },
          {
            id: 'act-4',
            type: 'verification',
            actor: 'Hồ sơ đối tác Studio Ánh Dương',
            action: 'đã được phê duyệt thành công!',
            timeAgo: '1 giờ trước',
          },
          {
            id: 'act-5',
            type: 'dispute',
            actor: 'Tranh chấp #TC0045',
            action: 'vừa có phản hồi mới từ khách hàng',
            timeAgo: '2 giờ trước',
          },
        ],
        alerts: {
          warnings: [
            { id: 'w-1', title: 'Booking chờ xác nhận > 24h', count: 18, severity: 'warning' },
            { id: 'w-2', title: 'Hoàn tiền quá hạn xử lý', count: 4, severity: 'warning' },
            { id: 'w-3', title: 'Đối tác có nhiều đánh giá xấu', count: 3, severity: 'warning' },
            { id: 'w-4', title: 'Sản phẩm bị báo cáo', count: 5, severity: 'warning' },
          ],
          critical: [
            { id: 'c-1', title: 'Tranh chấp mới phát sinh', count: 2, severity: 'critical' },
            { id: 'c-2', title: 'Hoạt động đăng nhập bất thường', count: 1, severity: 'critical' },
          ],
        },
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
