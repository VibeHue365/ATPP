import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';

type Refund = {
  _id: string;
  code: string;
  amount: number;
  status: string;
  type: string;
  version: number;
  bookingId?: { bookingCode?: string };
};

type RefundAction = 'approve' | 'reject' | 'process' | 'retry';

const refundStatusLabels: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PROCESSING: 'Đang xử lý',
  PROCESSED: 'Đã hoàn tiền',
  COMPLETED: 'Đã hoàn tiền',
  REJECTED: 'Đã từ chối',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
};

const refundTypeLabels: Record<string, string> = {
  CANCELLATION: 'Hủy đơn',
  DISPUTE: 'Tranh chấp',
  DEPOSIT: 'Hoàn tiền cọc',
  OTHER: 'Khác',
};

const refundStatusLabel = (status: string) => refundStatusLabels[status] ?? status;
const refundTypeLabel = (type: string) => refundTypeLabels[type] ?? type;
const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

const actionTitles: Record<RefundAction, string> = {
  approve: 'Duyệt hoàn tiền',
  reject: 'Từ chối hoàn tiền',
  process: 'Xử lý hoàn tiền',
  retry: 'Thử lại hoàn tiền',
};

export const RefundManagement: React.FC = () => {
  const [items, setItems] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await httpClient.get<Refund[]>('/refunds/admin'));
    } catch {
      await Swal.fire('Không thể tải hoàn tiền', 'Kiểm tra quyền refund:read.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const action = async (item: Refund, name: RefundAction) => {
    const result = await Swal.fire({
      title: actionTitles[name],
      input: name === 'approve' ? 'number' : 'text',
      inputLabel: name === 'approve' ? 'Số tiền hoàn' : name === 'reject' ? 'Lý do từ chối' : 'Mã tham chiếu (nếu có)',
      inputValue: name === 'approve' ? String(item.amount) : '',
      inputValidator: (value: unknown) => name === 'reject' && !String(value).trim() ? 'Vui lòng nhập lý do từ chối.' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    const body: Record<string, string | number | undefined> = { expectedVersion: item.version };
    if (name === 'approve') body.amount = Number(result.value);
    if (name === 'reject') body.reason = String(result.value).trim();
    if (name === 'process' || name === 'retry') body.reference = String(result.value || '').trim() || undefined;

    setPendingId(item._id);
    try {
      await httpClient.post(`/refunds/admin/${item._id}/${name}`, body);
      await load();
      await Swal.fire({ title: 'Đã cập nhật', icon: 'success', timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire('Thao tác không thành công', 'Yêu cầu có thể đã thay đổi. Danh sách đã được tải lại.', 'error');
      await load();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h2>Quản lý hoàn tiền</h2>
        <button type='button' onClick={() => void load()} disabled={loading}>Tải lại</button>
      </div>
      {loading ? <p>Đang tải...</p> : (
        <table style={{ width: '100%', background: 'white', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>Mã</th><th>Booking</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>{item.code}</td>
                <td>{item.bookingId?.bookingCode || '-'}</td>
                <td>{refundTypeLabel(item.type)}</td>
                <td>{formatCurrency(item.amount)}</td>
                <td>{refundStatusLabel(item.status)}</td>
                <td>
                  {item.status === 'PENDING' && <><button type='button' disabled={pendingId === item._id} onClick={() => void action(item, 'approve')}>Duyệt</button><button type='button' disabled={pendingId === item._id} onClick={() => void action(item, 'reject')}>Từ chối</button></>}
                  {item.status === 'APPROVED' && <button type='button' disabled={pendingId === item._id} onClick={() => void action(item, 'process')}>Xử lý</button>}
                  {item.status === 'FAILED' && <button type='button' disabled={pendingId === item._id} onClick={() => void action(item, 'retry')}>Thử lại</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
