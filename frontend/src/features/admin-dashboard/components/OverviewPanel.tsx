import { useState } from 'react';
import { useAdminTransactions } from '../hooks/useAdminTransactions';
import { useAdminStats } from '../hooks/useAdminStats';
import { BookingDistribution, MetricCard, GroupedBarChart } from './AdminAnalyticsShared';
import { formatCurrency } from '../utils/adminAnalyticsUtils';

import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';

export function OverviewPanel() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const stats = useAdminStats(period);
  const transactions = useAdminTransactions();
  const data = stats.data;

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__toolbar">
        <AdminReloadButton
          onClick={() => { void stats.refresh(); void transactions.refresh(); }}
          isLoading={stats.isLoading || transactions.loading}
        />
      </div>
      {(stats.error || transactions.error) && <p className="admin-dashboard-panel__error" role="alert">{stats.error || transactions.error}</p>}

      {stats.isLoading && !data ? <p className='admin-dashboard-panel__loading'>Đang tải số liệu tổng quan…</p> : <>

      <div className="admin-analytics-metrics admin-analytics-metrics--four">
        <MetricCard label="Tổng doanh thu" value={formatCurrency(data?.revenue?.total ?? 0)} detail="Cập nhật tự động từ PayOS" tone="burgundy" />
        <MetricCard label="Khách hàng đăng ký" value={data?.customers?.total ?? 0} detail={`Hoạt động: ${data?.customers?.active ?? 0} khách`} tone="charcoal" />
        <MetricCard label="Cửa hàng áo dài" value={data?.shops?.total ?? 0} detail={`Sản phẩm hoạt động: ${data?.shops?.activeProducts ?? 0}`} tone="olive" />
        <MetricCard label="Nhiếp ảnh gia" value={data?.photographers?.total ?? 0} detail={`Tổng Photo Bookings: ${data?.photographers?.bookings ?? 0}`} tone="gold" />
      </div>

      <div className="admin-analytics-split">
        <GroupedBarChart
          title="THỐNG KÊ ĐƠN ĐẶT LỊCH & DOANH THU"
          period={period}
          onPeriodChange={setPeriod}
          bookingsGrowth={data?.bookings?.growth}
          customersGrowth={data?.customers?.growth}
          revenueGrowth={data?.revenue?.growth}
        />
        <BookingDistribution items={data?.userBehavior?.popularBookings ?? []} />
      </div>
      </>}
    </section>
  );
}
