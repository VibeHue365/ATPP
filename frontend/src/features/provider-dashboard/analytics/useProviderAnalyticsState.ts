
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderAnalyticsState() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [chartTimeRange, setChartTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<'shop' | 'photo'>('shop');

  return {
    analyticsData, setAnalyticsData, chartTimeRange, setChartTimeRange, hoveredPointIdx,
    setHoveredPointIdx, subTab, setSubTab,
  };
}
