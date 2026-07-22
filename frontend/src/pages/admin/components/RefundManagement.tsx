import React, { useCallback, useEffect, useState } from 'react';
import { AdminReloadButton } from './AdminReloadButton';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { RefreshCw, CheckCircle2, XCircle, Clock, Search, AlertTriangle } from 'lucide-react';

type Refund = {
  _id: string;
  code: string;
  amount: number;
  status: string;
  type: string;
  version: number;
  reason?: string;
  adminNotes?: string;
  bookingId?: { _id?: string; bookingCode?: string };
  createdAt?: string;
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
const formatCurrency = (amount: number) => `${(amount || 0).toLocaleString('vi-VN')}đ`;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED_FAILED'>('PENDING');

  const load = async () => {
    setLoading(true);
    try {
      const res = await httpClient.get<Refund[]>('/refunds/admin');
      setItems(Array.isArray(res) ? res : []);
    } catch {
      await Swal.fire('Không thể tải hoàn tiền', 'Vui lòng kiểm tra lại kết nối máy chủ.', 'error');
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
      confirmButtonColor: name === 'reject' ? '#EF4444' : '#4A0E17',
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
      await Swal.fire({ title: 'Đã cập nhật thành công!', icon: 'success', timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire('Thao tác không thành công', 'Yêu cầu có thể đã thay đổi. Danh sách đã được tải lại.', 'error');
      await load();
    } finally {
      setPendingId(null);
    }
  };

  // Stats
  const pendingCount = items.filter(i => i.status === 'PENDING').length;
  const approvedCount = items.filter(i => i.status === 'APPROVED').length;
  const processedCount = items.filter(i => ['PROCESSED', 'COMPLETED'].includes(i.status)).length;
  const totalProcessedAmount = items.filter(i => ['PROCESSED', 'COMPLETED'].includes(i.status)).reduce((sum, i) => sum + (i.amount || 0), 0);

  const filteredItems = items.filter(i => {
    const codeMatch = (i.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (i.bookingId?.bookingCode || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!codeMatch) return false;

    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return i.status === 'PENDING';
    if (activeTab === 'APPROVED') return i.status === 'APPROVED';
    if (activeTab === 'PROCESSED') return ['PROCESSED', 'COMPLETED'].includes(i.status);
    if (activeTab === 'REJECTED_FAILED') return ['REJECTED', 'FAILED', 'CANCELLED'].includes(i.status);
    return true;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Chờ duyệt</span>;
      case 'APPROVED':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#EFF6FF', color: '#1D4ED8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Đã duyệt</span>;
      case 'PROCESSING':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#F3E8FF', color: '#7E22CE' }}>Đang xử lý</span>;
      case 'PROCESSED':
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#D1FAE5', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Đã hoàn tiền</span>;
      case 'REJECTED':
      case 'FAILED':
      case 'CANCELLED':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> {refundStatusLabel(status)}</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#F3F4F6', color: '#6B7280' }}>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '24px', fontWeight: 800, color: '#4A0E17', margin: 0 }}>
            Quản Lý Hoàn Tiền (Refunds)
          </h2>
          <p style={{ fontSize: '13.5px', color: '#7A7A7A', marginTop: '6px', margin: 0 }}>
            Theo dõi, phê duyệt và thực thi yêu cầu hoàn tiền cọc & hủy đơn hàng cho khách hàng qua cổng PayOS.
          </p>
        </div>
        <AdminReloadButton onClick={() => void load()} isLoading={loading} label="Tải lại danh sách" />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '16px 20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase' }}>Tổng yêu cầu</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#4A0E17', marginTop: '4px' }}>{items.length}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #FEF3C7', padding: '16px 20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>⏳ Đang chờ duyệt</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EFF6FF', padding: '16px 20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>✓ Đã duyệt (Chờ hoàn)</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}>{approvedCount}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #D1FAE5', padding: '16px 20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>💰 Đã hoàn thành</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{formatCurrency(totalProcessedAmount)}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'PENDING', label: `Chờ duyệt (${pendingCount})` },
            { key: 'APPROVED', label: `Đã duyệt (${approvedCount})` },
            { key: 'PROCESSED', label: `Đã hoàn (${processedCount})` },
            { key: 'REJECTED_FAILED', label: `Từ chối / Lỗi` },
            { key: 'ALL', label: `Tất cả (${items.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none',
                backgroundColor: activeTab === tab.key ? '#4A0E17' : '#FAF6F0',
                color: activeTab === tab.key ? 'white' : '#7A7A7A', cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Tìm theo Mã hoàn tiền / Mã đơn..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #E8E2D5',
              borderRadius: '8px', fontSize: '13px', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Đang tải danh sách hoàn tiền...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A' }}>
            <AlertTriangle size={36} style={{ color: '#D1D5DB', marginBottom: '12px' }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Không có yêu cầu hoàn tiền nào phù hợp.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>MÃ HOÀN TIỀN</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>MÃ ĐƠN HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>LOẠI HOÀN TIỀN</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>SỐ TIỀN</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>TRẠNG THÁI</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', textTransform: 'uppercase' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item._id} style={{ borderBottom: '1px solid #E8E2D5', transition: 'background-color 0.15s' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: '#4A0E17' }}>{item.code}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#2A2A2A' }}>
                    {item.bookingId?.bookingCode || '—'}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FAF6F0', color: '#706E3B' }}>
                      {refundTypeLabel(item.type)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#B91C1C' }}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    {renderStatusBadge(item.status)}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={pendingId === item._id}
                            onClick={() => void action(item, 'approve')}
                            style={{ padding: '6px 12px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === item._id}
                            onClick={() => void action(item, 'reject')}
                            style={{ padding: '6px 12px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {item.status === 'APPROVED' && (
                        <button
                          type="button"
                          disabled={pendingId === item._id}
                          onClick={() => void action(item, 'process')}
                          style={{ padding: '6px 12px', backgroundColor: '#1D4ED8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Xử lý hoàn
                        </button>
                      )}
                      {item.status === 'FAILED' && (
                        <button
                          type="button"
                          disabled={pendingId === item._id}
                          onClick={() => void action(item, 'retry')}
                          style={{ padding: '6px 12px', backgroundColor: '#D97706', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Thử lại
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
