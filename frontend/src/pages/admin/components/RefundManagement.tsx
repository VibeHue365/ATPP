import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';

type Refund = { _id: string; code: string; amount: number; status: string; type: string; version: number; bookingId?: { bookingCode?: string } };

export const RefundManagement: React.FC = () => {
  const [items, setItems] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setItems(await httpClient.get<Refund[]>('/refunds/admin')); } catch { await Swal.fire('Không thể tải hoàn tiền', 'Kiểm tra quyền refund:read.', 'error'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const action = async (item: Refund, name: 'approve' | 'reject' | 'process' | 'retry') => {
    const result = await Swal.fire({ title: name === 'approve' ? 'Duyệt hoàn tiền' : name === 'reject' ? 'Từ chối hoàn tiền' : 'Xử lý hoàn tiền', input: name === 'approve' ? 'number' : 'text', inputValue: name === 'approve' ? String(item.amount) : '', showCancelButton: true, confirmButtonText: 'Xác nhận', cancelButtonText: 'Hủy' });
    if (!result.isConfirmed) return;
    const body: any = { expectedVersion: item.version };
    if (name === 'approve') body.amount = Number(result.value);
    if (name === 'reject') body.reason = String(result.value || '').trim();
    if (name === 'process' || name === 'retry') body.reference = String(result.value || '').trim() || undefined;
    try { await httpClient.post(`/refunds/admin/${item._id}/${name}`, body); await load(); } catch { await Swal.fire('Thao tác không thành công', 'Yêu cầu có thể đã thay đổi. Danh sách đã được tải lại.', 'error'); await load(); }
  };
  return <section><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h2>Quản lý hoàn tiền</h2><button onClick={() => void load()}>Tải lại</button></div>{loading ? <p>Đang tải...</p> : <table style={{ width: '100%', background: 'white', borderCollapse: 'collapse' }}><thead><tr><th>Mã</th><th>Booking</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.code}</td><td>{item.bookingId?.bookingCode || '-'}</td><td>{item.type}</td><td>{item.amount.toLocaleString('vi-VN')}đ</td><td>{item.status}</td><td>{item.status === 'PENDING' && <><button onClick={() => void action(item, 'approve')}>Duyệt</button><button onClick={() => void action(item, 'reject')}>Từ chối</button></>}{item.status === 'APPROVED' && <button onClick={() => void action(item, 'process')}>Xử lý</button>}{item.status === 'FAILED' && <button onClick={() => void action(item, 'retry')}>Thử lại</button>}</td></tr>)}</tbody></table>}</section>;
};
