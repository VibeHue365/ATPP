import { useAdminTransactions } from '../hooks/useAdminTransactions';
import { useAdminStats } from '../hooks/useAdminStats';
import { MetricCard, TransactionTable, TrendChart } from './AdminAnalyticsShared';
import { formatCurrency } from '../utils/adminAnalyticsUtils';

export function RevenuePanel() {
  const stats = useAdminStats();
  const transactions = useAdminTransactions();
  const total = stats.data?.revenue?.total ?? 0;
  const commission = stats.data?.revenue?.commission ?? 0;

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__toolbar">
        <button type="button" onClick={() => { void stats.refresh(); void transactions.refresh(); }} disabled={stats.isLoading || transactions.loading}>Tải lại</button>
      </div>
      {(stats.error || transactions.error) && <p className="admin-dashboard-panel__error" role="alert">{stats.error || transactions.error}</p>}

      <div className="admin-analytics-metrics admin-analytics-metrics--three">
        <MetricCard label="Tổng doanh số giao dịch" value={formatCurrency(total)} detail="Cập nhật tự động từ PayOS" tone="burgundy" />
        <MetricCard label="Doanh thu hệ thống (10%)" value={formatCurrency(commission)} detail="Khấu trừ trực tiếp trên mỗi đơn thành công" tone="gold" />
        <MetricCard label="Đối tác thực nhận (90%)" value={formatCurrency(Math.max(0, total - commission))} detail="Doanh thu chi trả đối tác" tone="olive" />
      </div>

      <TrendChart title="Biểu đồ tăng trưởng doanh thu hệ thống" legend="Đơn vị: VNĐ" points={stats.data?.revenue?.growth ?? []} />
      <TransactionTable
        title="Lịch sử giao dịch thanh toán"
        items={transactions.data?.items ?? []}
        footer={
          <footer className="admin-analytics-pagination">
            <button type="button" disabled={transactions.page <= 1 || transactions.loading} onClick={() => transactions.setPage(transactions.page - 1)}>Trước</button>
            <span>Trang {transactions.page}/{transactions.data?.totalPages ?? 1}</span>
            <button type="button" disabled={transactions.page >= (transactions.data?.totalPages ?? 1) || transactions.loading} onClick={() => transactions.setPage(transactions.page + 1)}>Sau</button>
          </footer>
        }
      />
    </section>
  );
}