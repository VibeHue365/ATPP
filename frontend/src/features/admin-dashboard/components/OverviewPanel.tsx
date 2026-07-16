import { useAdminTransactions } from '../hooks/useAdminTransactions';
import { useAdminStats } from '../hooks/useAdminStats';
import { MetricCard, TransactionTable, TrendChart } from './AdminAnalyticsShared';
import { formatCurrency } from '../utils/adminAnalyticsUtils';

export function OverviewPanel() {
  const stats = useAdminStats();
  const transactions = useAdminTransactions();
  const data = stats.data;

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__toolbar">
        <button type="button" onClick={() => { void stats.refresh(); void transactions.refresh(); }} disabled={stats.isLoading || transactions.loading}>Tải lại</button>
      </div>
      {(stats.error || transactions.error) && <p className="admin-dashboard-panel__error" role="alert">{stats.error || transactions.error}</p>}

      <div className="admin-analytics-metrics admin-analytics-metrics--four">
        <MetricCard label="Tổng doanh thu" value={formatCurrency(data?.revenue?.total ?? 0)} detail="Cập nhật tự động từ PayOS" tone="burgundy" />
        <MetricCard label="Khách hàng đăng ký" value={data?.customers?.total ?? 0} detail={`Hoạt động: ${data?.customers?.active ?? 0} khách`} tone="charcoal" />
        <MetricCard label="Cửa hàng áo dài" value={data?.shops?.total ?? 0} detail={`Sản phẩm hoạt động: ${data?.shops?.activeProducts ?? 0}`} tone="olive" />
        <MetricCard label="Nhiếp ảnh gia" value={data?.photographers?.total ?? 0} detail={`Tổng Photo Bookings: ${data?.photographers?.bookings ?? 0}`} tone="gold" />
      </div>

      <div className="admin-analytics-split">
        <TrendChart title="Thống kê đơn đặt lịch" legend="Đơn đặt lịch theo kỳ" points={data?.bookings?.growth ?? []} />
        <TrendChart title="Tăng trưởng doanh thu" legend="Doanh thu theo kỳ" points={data?.revenue?.growth ?? []} />
      </div>

      <TransactionTable title="Lịch sử giao dịch thanh toán gần đây" items={(transactions.data?.items ?? []).slice(0, 3)} />
    </section>
  );
}