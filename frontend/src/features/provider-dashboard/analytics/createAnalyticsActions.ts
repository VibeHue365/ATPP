import { providerApi } from '../api/providerDashboardApi';
import type { useProviderAnalyticsState } from './useProviderAnalyticsState';

type Dependencies = Pick<ReturnType<typeof useProviderAnalyticsState>,
  'setChartTimeRange' | 'setAnalyticsData'
>;

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createAnalyticsActions({ setChartTimeRange, setAnalyticsData }: Dependencies) {
  const handlePeriodChange = async (period: 'week' | 'month' | 'year') => {
    setChartTimeRange(period);
    try {
      const res: any = await providerApi.getAnalyticsPeriod(period);
      if (res && res.revenueGrowth) {
        setAnalyticsData((prev: any) => (prev ? { ...prev, revenueGrowth: res.revenueGrowth } : res));
      }
    } catch (err) {
      console.error('Lỗi khi tải biểu đồ theo thời gian:', err);
    }
  };

  return { handlePeriodChange };
}
