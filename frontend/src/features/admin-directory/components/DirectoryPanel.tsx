import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, LockKeyhole, Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { adminDirectoryApi } from '../api/adminDirectoryApi';
import { useDirectory } from '../hooks/useDirectory';
import type { Booking, Customer, DirectoryItem, DirectoryKind, Provider } from '../types';
import './directoryPanel.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'BANNED' | 'SUSPENDED' | 'PENDING' | 'PICKED_UP' | 'RETURNED' | 'COMPLETED' | 'CANCELLED';

const searchPlaceholders: Record<DirectoryKind, string> = {
  customers: 'Tìm theo tên, email hoặc số điện thoại…',
  providers: 'Tìm theo tên doanh nghiệp, chủ sở hữu…',
  bookings: 'Tìm theo mã đặt lịch, khách hàng, đối tác…',
};

const filters: Record<DirectoryKind, StatusFilter[]> = {
  customers: ['ALL', 'ACTIVE', 'BANNED'],
  providers: ['ALL', 'ACTIVE', 'SUSPENDED'],
  bookings: ['ALL', 'PENDING', 'PICKED_UP', 'RETURNED', 'COMPLETED', 'CANCELLED'],
};

const statusLabels: Record<string, string> = {
  ALL: 'Tất cả',
  ACTIVE: 'Hoạt động',
  BANNED: 'Đã khóa',
  SUSPENDED: 'Tạm đình chỉ',
  PENDING: 'Chờ xử lý',
  PICKED_UP: 'Đã nhận',
  RETURNED: 'Đã trả',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  UNKNOWN: 'Không rõ',
};

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;
const getStatus = (item: DirectoryItem) => 'status' in item && item.status ? item.status : 'UNKNOWN';

const matchesQuery = (item: DirectoryItem, query: string) => {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  if (!normalizedQuery) return true;

  return Object.values(item).some((value) =>
    String(value).toLocaleLowerCase('vi-VN').includes(normalizedQuery),
  );
};

export function DirectoryPanel({ kind }: { kind: DirectoryKind }) {
  const { data, error, loading, page, refresh, setPage } = useDirectory(kind);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const items = useMemo(() => (
    data?.items.filter((item) =>
      matchesQuery(item, query) && (statusFilter === 'ALL' || getStatus(item) === statusFilter),
    ) ?? []
  ), [data, query, statusFilter]);

  const runAction = async (id: string, operation: () => Promise<void>) => {
    setPendingId(id);
    try {
      await operation();
      await refresh();
    } catch (requestError) {
      await Swal.fire({
        title: 'Không thể thực hiện thao tác',
        text: requestError instanceof Error ? requestError.message : 'Vui lòng thử lại.',
        icon: 'error',
      });
    } finally {
      setPendingId(null);
    }
  };

  const changeCustomerStatus = async (customer: Customer) => {
    const isBanned = customer.status === 'BANNED';
    const result = await Swal.fire({
      title: isBanned ? 'Mở khóa khách hàng?' : 'Khóa khách hàng?',
      text: isBanned ? 'Khách hàng sẽ có thể tiếp tục sử dụng tài khoản.' : 'Khách hàng sẽ bị đăng xuất khỏi hệ thống.',
      icon: isBanned ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isBanned ? 'Mở khóa' : 'Khóa tài khoản',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    await runAction(customer.id, () =>
      isBanned ? adminDirectoryApi.unbanCustomer(customer.id) : adminDirectoryApi.banCustomer(customer.id),
    );
  };

  const changeProviderStatus = async (provider: Provider) => {
    const isSuspended = (provider.status || 'UNKNOWN').toUpperCase() === 'SUSPENDED';
    const result = await Swal.fire({
      title: isSuspended ? 'Mở lại đối tác?' : 'Tạm ngưng đối tác?',
      input: 'textarea',
      inputLabel: 'Ghi chú nội bộ / lý do (không bắt buộc)',
      inputPlaceholder: 'Ví dụ: Đã hoàn tất xác minh hồ sơ.',
      icon: isSuspended ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isSuspended ? 'Mở lại' : 'Tạm ngưng',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    const reason = typeof result.value === 'string' ? result.value.trim() || undefined : undefined;
    await runAction(provider.id, () =>
      isSuspended
        ? adminDirectoryApi.unsuspendProvider(provider.id, reason)
        : adminDirectoryApi.suspendProvider(provider.id, reason),
    );
  };

  return (
    <section className="admin-directory">
      <div className="admin-directory__controls">
        <label className="admin-directory__search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Tìm kiếm</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholders[kind]} />
        </label>
        <div className="admin-directory__filters" aria-label="Lọc trạng thái">
          {filters[kind].map((filter) => (
            <button
              key={filter}
              type="button"
              className={statusFilter === filter ? 'is-active' : ''}
              onClick={() => setStatusFilter(filter)}
            >
              {statusLabels[filter]}
            </button>
          ))}
        </div>
        <button className="admin-directory__refresh" type="button" onClick={() => void refresh()} disabled={loading}>Tải lại</button>
      </div>

      {error && <p className="admin-directory__error" role="alert">{error}</p>}

      <div className="admin-directory__table">
        <table>
          <DirectoryTableHead kind={kind} />
          <tbody>
            {items.map((item) => {
              if (kind === 'customers') return <CustomerRow key={item.id} item={item as Customer} pending={pendingId === item.id} onChangeStatus={changeCustomerStatus} />;
              if (kind === 'providers') return <ProviderRow key={item.id} item={item as Provider} pending={pendingId === item.id} onChangeStatus={changeProviderStatus} />;
              return <BookingRow key={item.id} item={item as Booking} />;
            })}
            {!loading && !items.length && <tr><td className="admin-directory__empty" colSpan={kind === 'customers' || kind === 'providers' ? 8 : 7}>Không tìm thấy dữ liệu phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>

      <footer className="admin-directory__pagination">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Trước</button>
        <span>Trang {page}/{data?.totalPages ?? 1}</span>
        <button type="button" disabled={page >= (data?.totalPages ?? 1) || loading} onClick={() => setPage(page + 1)}>Sau</button>
      </footer>
    </section>
  );
}

function DirectoryTableHead({ kind }: { kind: DirectoryKind }) {
  if (kind === 'customers') return <thead><tr><th>Khách hàng</th><th>Email</th><th>Điện thoại</th><th>Ngày đăng ký</th><th>Đơn đã đặt</th><th>Chi tiêu tích lũy</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>;
  if (kind === 'providers') return <thead><tr><th>Doanh nghiệp / Cửa hàng</th><th>Chủ sở hữu</th><th>Dịch vụ</th><th>Đánh giá</th><th>Sản phẩm</th><th>Tổng doanh thu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>;
  return <thead><tr><th>Mã đặt lịch</th><th>Khách hàng</th><th>Đối tác</th><th>Dịch vụ</th><th>Ngày thuê</th><th>Phí</th><th>Trạng thái</th></tr></thead>;
}

function CustomerRow({ item, pending, onChangeStatus }: { item: Customer; pending: boolean; onChangeStatus: (customer: Customer) => Promise<void> }) {
  const isBanned = item.status === 'BANNED';
  return <tr>
    <td><div className="admin-directory__identity"><img src={item.avatar || '/avatar_hanna.png'} alt="" /><div><strong>{item.fullName}</strong><small>ID: {item.id}</small></div></div></td>
    <td>{item.email}</td><td>{item.phone || 'Chưa cung cấp'}</td><td>{item.date || '—'}</td><td className="admin-directory__center">{item.bookings ?? 0}</td><td className="admin-directory__amount">{formatCurrency(item.spent ?? 0)}</td>
    <td className="admin-directory__center"><StatusBadge value={item.status} /></td>
    <td className="admin-directory__center"><button className={`admin-directory__icon-button ${isBanned ? 'is-positive' : 'is-danger'}`} type="button" disabled={pending} title={isBanned ? 'Mở khóa khách hàng' : 'Khóa khách hàng'} onClick={() => void onChangeStatus(item)}>{isBanned ? <CheckCircle2 size={15} /> : <Ban size={15} />}</button></td>
  </tr>;
}

function ProviderRow({ item, pending, onChangeStatus }: { item: Provider; pending: boolean; onChangeStatus: (provider: Provider) => Promise<void> }) {
  const status = item.status || 'UNKNOWN';
  const capabilities = Array.isArray(item.capability) ? item.capability : [];
  const isSuspended = status.toUpperCase() === 'SUSPENDED';
  return <tr>
    <td><strong className="admin-directory__business">{item.businessName}</strong><small>{item.phone || '—'} • {item.email || '—'}</small></td><td>{item.ownerName}</td>
    <td><div className="admin-directory__chips">{capabilities.map((capability) => <span key={capability}>{capability === 'PHOTOGRAPHY' ? 'CHỤP ẢNH' : capability === 'RENTAL' || capability === 'AODAI_RENTAL' ? 'CHO THUÊ' : capability}</span>)}{!capabilities.length && '—'}</div></td>
    <td className="admin-directory__center admin-directory__rating">★ {item.rating ?? 0}</td><td className="admin-directory__center">{item.totalProducts ?? 0}</td><td className="admin-directory__amount">{formatCurrency(item.totalEarnings ?? 0)}</td>
    <td className="admin-directory__center"><StatusBadge value={status} /></td>
    <td className="admin-directory__center"><button className={`admin-directory__icon-button ${isSuspended ? 'is-positive' : 'is-danger'}`} type="button" disabled={pending} title={isSuspended ? 'Mở lại đối tác' : 'Tạm ngưng đối tác'} onClick={() => void onChangeStatus(item)}>{isSuspended ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}</button></td>
  </tr>;
}

function BookingRow({ item }: { item: Booking }) {
  return <tr><td><strong>{item.id}</strong></td><td>{item.customerName}</td><td>{item.providerName}</td><td>{item.items || '—'}</td><td>{item.rentalDate || '—'}<small>Trả: {item.returnDate || '—'}</small></td><td className="admin-directory__amount">{formatCurrency(item.price ?? 0)}<small>Đặt cọc: {formatCurrency(item.deposit ?? 0)}</small></td><td className="admin-directory__center"><StatusBadge value={item.status || 'UNKNOWN'} /></td></tr>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`admin-directory__status admin-directory__status--${value.toLowerCase()}`}>{statusLabels[value] || value}</span>;
}