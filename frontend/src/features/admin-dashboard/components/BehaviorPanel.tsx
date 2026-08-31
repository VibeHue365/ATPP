import { useAdminStats } from '../hooks/useAdminStats';
import './adminDashboardPanels.css';

const pages = [
  { key: 'homepage', label: 'Trang chủ (Discovery)', color: '#4A0E17' },
  { key: 'rentals', label: 'Danh sách cho thuê áo dài', color: '#706E3B' },
  { key: 'productDetails', label: 'Chi tiết sản phẩm / Áo dài', color: '#B89047' },
  { key: 'photographers', label: 'Danh sách nhiếp ảnh gia', color: '#2A2A2A' },
] as const;

import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';

export function BehaviorPanel() {
  const { data, error, isLoading, refresh } = useAdminStats();
  const searches = data?.userBehavior?.topSearches ?? [];
  const views = data?.userBehavior?.pageViews ?? {};
  const maxViews = Math.max(1, ...Object.values(views));
  const products = data?.userBehavior?.popularProducts ?? [];

  return (
    <section className="admin-dashboard-panel">
      <div className="admin-dashboard-panel__toolbar">
        <AdminReloadButton onClick={() => void refresh()} isLoading={isLoading} />
      </div>
      {error && <p className="admin-dashboard-panel__error" role="alert">{error}</p>}
      {isLoading && !data ? <p className="admin-dashboard-panel__loading">Đang tải số liệu…</p> : (
        <>
          <div className="admin-analytics-split">
            <article className="admin-analytics-card">
              <h3>Từ khóa tìm kiếm phổ biến</h3>
              <table className="admin-behavior-searches"><thead><tr><th>Từ khóa</th><th>Lượt tìm kiếm</th></tr></thead><tbody>
                {searches.map((search, index) => <tr key={search.keyword}><td><span>{index + 1}</span>{search.keyword}</td><td>{search.count.toLocaleString('vi-VN')}</td></tr>)}
                {!searches.length && <tr><td colSpan={2} className='admin-behavior-searches__empty'>Chưa có dữ liệu tìm kiếm.</td></tr>}
              </tbody></table>
            </article>
            <article className="admin-analytics-card">
              <h3>Lượt xem trang chi tiết</h3>
              <div className="admin-behavior-views">
                {pages.map((page) => { const value = views[page.key] ?? 0; return <div key={page.key}><div><span>{page.label}</span><strong style={{ color: page.color }}>{value.toLocaleString('vi-VN')} views</strong></div><i><b style={{ width: `${(value / maxViews) * 100}%`, backgroundColor: page.color }} /></i></div>; })}
              </div>
            </article>
          </div>

          <article className="admin-analytics-table">
            <header><h3>Danh sách sản phẩm được xem & đặt nhiều nhất</h3></header>
            <div className="admin-analytics-table__scroll"><table><thead><tr><th>Sản phẩm / Áo dài</th><th>Giá thuê</th><th>Lượt xem</th><th>Lượt đặt thuê</th><th>Trạng thái</th></tr></thead><tbody>
              {products.map((product) => <tr key={product._id ?? product.name}><td><strong>{product.name}</strong></td><td>{product.basePrice.toLocaleString('vi-VN')}đ</td><td>{(product.viewCount ?? 0).toLocaleString('vi-VN')}</td><td>{(product.rentCount ?? 0).toLocaleString('vi-VN')} lượt</td><td><span className="admin-analytics-status admin-analytics-status--paid">Hoạt động</span></td></tr>)}
              {!products.length && <tr><td colSpan={5} className="admin-analytics-table__empty">Chưa có dữ liệu sản phẩm.</td></tr>}
            </tbody></table></div>
          </article>
        </>
      )}
    </section>
  );
}
