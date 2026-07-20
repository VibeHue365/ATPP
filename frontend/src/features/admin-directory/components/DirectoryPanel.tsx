import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, LockKeyhole, Search, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { BookingDetailModal } from '../../../components/common/BookingDetailModal';
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
  const [selectedItem, setSelectedItem] = useState<Customer | Provider | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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
      await Swal.fire({
        title: 'Đã cập nhật',
        text: 'Dữ liệu đã được làm mới theo trạng thái mới nhất.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
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
              if (kind === 'customers') return <CustomerRow key={item.id} item={item as Customer} pending={pendingId === item.id} onChangeStatus={changeCustomerStatus} onView={setSelectedItem} />;
              if (kind === 'providers') return <ProviderRow key={item.id} item={item as Provider} pending={pendingId === item.id} onChangeStatus={changeProviderStatus} onView={setSelectedItem} />;
              return <BookingRow key={item.id} item={item as Booking} onView={setSelectedBookingId} />;
            })}
            {loading && <tr><td className='admin-directory__empty' colSpan={kind === 'customers' || kind === 'providers' ? 8 : 7}>Đang tải dữ liệu…</td></tr>}
            {!loading && !items.length && <tr><td className="admin-directory__empty" colSpan={kind === 'customers' || kind === 'providers' ? 8 : 7}>Không tìm thấy dữ liệu phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>

      <footer className="admin-directory__pagination">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Trước</button>
        <span>Trang {page}/{data?.totalPages ?? 1}</span>
        <button type="button" disabled={page >= (data?.totalPages ?? 1) || loading} onClick={() => setPage(page + 1)}>Sau</button>
      </footer>
      {selectedItem && <DirectoryDetailDrawer item={selectedItem} pending={pendingId === selectedItem.id} onClose={() => setSelectedItem(null)} onChangeStatus={'fullName' in selectedItem ? changeCustomerStatus : changeProviderStatus} />}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          isOpen
          onClose={() => setSelectedBookingId(null)}
          onBookingChanged={() => void refresh()}
          viewerRole='admin'
        />
      )}
    </section>
  );
}

function DirectoryTableHead({ kind }: { kind: DirectoryKind }) {
  if (kind === 'customers') return <thead><tr><th>Khách hàng</th><th>Email</th><th>Điện thoại</th><th>Ngày đăng ký</th><th>Đơn đã đặt</th><th>Chi tiêu tích lũy</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>;
  if (kind === 'providers') return <thead><tr><th>Doanh nghiệp / Cửa hàng</th><th>Chủ sở hữu</th><th>Dịch vụ</th><th>Đánh giá</th><th>Sản phẩm</th><th>Tổng doanh thu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>;
  return <thead><tr><th>Mã đặt lịch</th><th>Khách hàng</th><th>Đối tác</th><th>Dịch vụ</th><th>Ngày thuê</th><th>Phí</th><th>Trạng thái</th></tr></thead>;
}

function CustomerRow({ item, pending, onChangeStatus, onView }: { item: Customer; pending: boolean; onChangeStatus: (customer: Customer) => Promise<void>; onView: (item: Customer) => void }) {
  const isBanned = item.status === 'BANNED';
  return <tr className='admin-directory__clickable-row' onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onView(item); }}>
    <td><div className="admin-directory__identity"><img src={item.avatar || '/avatar_hanna.png'} alt="" /><div><strong>{item.fullName}</strong><small>ID: {item.id}</small></div></div></td>
    <td>{item.email}</td><td>{item.phone || 'Chưa cung cấp'}</td><td>{item.date || '—'}</td><td className="admin-directory__center">{item.bookings ?? 0}</td><td className="admin-directory__amount">{formatCurrency(item.spent ?? 0)}</td>
    <td className="admin-directory__center"><StatusBadge value={item.status} /></td>
    <td className="admin-directory__center"><button className={`admin-directory__icon-button ${isBanned ? 'is-positive' : 'is-danger'}`} type="button" disabled={pending} title={isBanned ? 'Mở khóa khách hàng' : 'Khóa khách hàng'} onClick={() => void onChangeStatus(item)}>{isBanned ? <CheckCircle2 size={15} /> : <Ban size={15} />}</button></td>
  </tr>;
}

function ProviderRow({ item, pending, onChangeStatus, onView }: { item: Provider; pending: boolean; onChangeStatus: (provider: Provider) => Promise<void>; onView: (item: Provider) => void }) {
  const status = item.status || 'UNKNOWN';
  const capabilities = Array.isArray(item.capability) ? item.capability : [];
  const isSuspended = status.toUpperCase() === 'SUSPENDED';
  return <tr className='admin-directory__clickable-row' onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onView(item); }}>
    <td><strong className="admin-directory__business">{item.businessName}</strong><small>{item.phone || '—'} • {item.email || '—'}</small></td><td>{item.ownerName}</td>
    <td><div className="admin-directory__chips">{capabilities.map((capability) => <span key={capability}>{capability === 'PHOTOGRAPHY' ? 'CHỤP ẢNH' : capability === 'RENTAL' || capability === 'AODAI_RENTAL' ? 'CHO THUÊ' : capability}</span>)}{!capabilities.length && '—'}</div></td>
    <td className="admin-directory__center admin-directory__rating">★ {item.rating ?? 0}</td><td className="admin-directory__center">{item.totalProducts ?? 0}</td><td className="admin-directory__amount">{formatCurrency(item.totalEarnings ?? 0)}</td>
    <td className="admin-directory__center"><StatusBadge value={status} /></td>
    <td className="admin-directory__center"><button className={`admin-directory__icon-button ${isSuspended ? 'is-positive' : 'is-danger'}`} type="button" disabled={pending} title={isSuspended ? 'Mở lại đối tác' : 'Tạm ngưng đối tác'} onClick={() => void onChangeStatus(item)}>{isSuspended ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}</button></td>
  </tr>;
}

function BookingRow({ item, onView }: { item: Booking; onView: (bookingId: string) => void }) {
  const bookingId = item.bookingId || item.id;
  return <tr className='admin-directory__clickable-row' onClick={() => onView(bookingId)}><td><strong>{item.id}</strong></td><td>{item.customerName}</td><td>{item.providerName}</td><td>{item.items || '—'}</td><td>{item.rentalDate || '—'}<small>Trả: {item.returnDate || '—'}</small></td><td className='admin-directory__amount'>{formatCurrency(item.price ?? 0)}<small>Đặt cọc: {formatCurrency(item.deposit ?? 0)}</small></td><td className='admin-directory__center'><StatusBadge value={item.status || 'UNKNOWN'} /></td></tr>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`admin-directory__status admin-directory__status--${value.toLowerCase()}`}>{statusLabels[value] || value}</span>;
}

function DirectoryDetailDrawer({
  item,
  pending,
  onClose,
  onChangeStatus,
}: {
  item: Customer | Provider;
  pending: boolean;
  onClose: () => void;
  onChangeStatus: ((customer: Customer) => Promise<void>) | ((provider: Provider) => Promise<void>);
}) {
  const isCustomer = 'fullName' in item;
  const status = isCustomer ? item.status : item.status || 'UNKNOWN';
  const isRestricted = status.toUpperCase() === (isCustomer ? 'BANNED' : 'SUSPENDED');
  const handleStatusChange = async () => {
    if (isCustomer) await (onChangeStatus as (customer: Customer) => Promise<void>)(item);
    else await (onChangeStatus as (provider: Provider) => Promise<void>)(item);
    onClose();
  };

  return (
    <div className='admin-directory__drawer-backdrop' role='presentation' onMouseDown={onClose}>
      <aside className='admin-directory__drawer' role='dialog' aria-modal='true' aria-label={isCustomer ? 'Chi tiết khách hàng' : 'Chi tiết đối tác'} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{isCustomer ? 'KHÁCH HÀNG' : 'ĐỐI TÁC'}</span>
            <h2>{isCustomer ? item.fullName : item.businessName}</h2>
            <small>ID: {item.id}</small>
          </div>
          <button type='button' title='Đóng chi tiết' onClick={onClose}><X size={18} /></button>
        </header>

        {isCustomer ? (
          <>
            <div className='admin-directory__drawer-profile'><img src={item.avatar || '/avatar_hanna.png'} alt='' /><StatusBadge value={item.status} /></div>
            <DetailList rows={[
              ['Email', item.email || 'Chưa cung cấp'],
              ['Số điện thoại', item.phone || 'Chưa cung cấp'],
              ['Ngày đăng ký', item.date || '—'],
              ['Số đơn đã đặt', `${item.bookings ?? 0} đơn`],
              ['Chi tiêu tích lũy', formatCurrency(item.spent ?? 0)],
            ]} />
          </>
        ) : (
          <>
            <div className='admin-directory__drawer-profile'><StatusBadge value={status} /></div>
            <DetailList rows={[
              ['Chủ sở hữu', item.ownerName || 'Chưa cập nhật'],
              ['Email', item.email || 'Chưa cung cấp'],
              ['Số điện thoại', item.phone || 'Chưa cung cấp'],
              ['Đánh giá', `★ ${item.rating ?? 0} / 5`],
              ['Số sản phẩm', `${item.totalProducts ?? 0} tin đăng`],
              ['Tổng doanh thu', formatCurrency(item.totalEarnings ?? 0)],
              ['Dịch vụ', (item.capability ?? []).join(', ') || 'Chưa cập nhật'],
            ]} />
          </>
        )}

        <footer>
          <button type='button' disabled={pending} onClick={() => void handleStatusChange()}>
            {isRestricted ? (isCustomer ? 'Mở khóa khách hàng' : 'Mở lại đối tác') : (isCustomer ? 'Khóa khách hàng' : 'Tạm ngưng đối tác')}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DetailList({ rows }: { rows: Array<[string, string]> }) {
  return <dl className='admin-directory__detail-list'>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
