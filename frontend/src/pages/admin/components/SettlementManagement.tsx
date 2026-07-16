import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Lock, Unlock, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Modal } from '../../../components/common/Modal';

interface SettlementPolicySnapshot {
  policyCode: string;
  policyVersion: number;
  defaultCommissionRate: number;
  sameProviderComboCommissionRate: number;
  crossProviderComboCommissionRate: number;
  fixedPlatformFee: number;
  minCommissionAmount: number;
  appliedRateType: string;
}

interface SettlementItemSnapshot {
  bookingItemId: string;
  itemType: string;
  itemName?: string;
  serviceAmount: number;
  providerDiscountAmount: number;
  commissionBaseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  allocatedPlatformFee: number;
  netAmount: number;
}

interface SettlementBooking {
  _id: string;
  bookingCode?: string;
  status?: string;
}

interface SettlementProvider {
  _id: string;
  businessName?: string;
  paymentAccounts?: Array<{
    bankName: string;
    accountNumberMasked: string;
    accountHolder: string;
    isDefault: boolean;
  }>;
}

interface Settlement {
  _id: string;
  settlementCode: string;
  bookingId: SettlementBooking | string;
  providerId: SettlementProvider | string;
  grossAmount: number;
  commissionBaseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  fixedPlatformFee: number;
  allocatedPlatformFee: number;
  netAmount: number;
  refundAmount: number;
  penaltyAmount: number;
  payableAmount: number;
  status: 'READY_TO_SETTLE' | 'ON_HOLD' | 'SETTLED' | 'CANCELLED';
  holdReason?: string;
  policySnapshot: SettlementPolicySnapshot;
  itemSnapshots: SettlementItemSnapshot[];
  payoutReference?: string;
  note?: string;
  settledAt?: string;
  createdAt: string;
}

export const SettlementManagement: React.FC = () => {
  const toast = useToast();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingIdDraft, setBookingIdDraft] = useState('');
  const [providerIdDraft, setProviderIdDraft] = useState('');
  const [fromDateDraft, setFromDateDraft] = useState('');
  const [toDateDraft, setToDateDraft] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ bookingId: '', providerId: '', fromDate: '', toDate: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    settled: 0,
    held: 0,
    cancelled: 0
  });

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await httpClient.get<{ items: Settlement[]; pagination: typeof pagination }>(`/admin/settlements?${params.toString()}`);
      const items = res.items || [];
      setSettlements(items);
      setPagination(res.pagination);

      // Calculate stats based on fetched items
      const pendingSum = items.filter((s: any) => s.status === 'READY_TO_SETTLE').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const settledSum = items.filter((s: any) => s.status === 'SETTLED').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const heldSum = items.filter((s: any) => s.status === 'ON_HOLD').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const cancelledSum = items.filter((s: any) => s.status === 'CANCELLED').reduce((sum: number, s: any) => sum + s.payableAmount, 0);

      setStats({
        pending: pendingSum,
        settled: settledSum,
        held: heldSum,
        cancelled: cancelledSum,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách quyết toán';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, pagination.limit, pagination.page, statusFilter, toast]);

  useEffect(() => {
    void fetchSettlements();
  }, [fetchSettlements]);

  const handleHoldSettlement = async (id: string) => {
    const { value: reason } = await Swal.fire({
      title: 'Tạm giữ quyết toán?',
      input: 'textarea',
      inputLabel: 'Lý do tạm giữ tiền ký quỹ *',
      inputPlaceholder: 'Ví dụ: Đang giải quyết tranh chấp hư hỏng đồ / Khách hàng khiếu nại...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Xác nhận giữ quỹ',
      cancelButtonText: 'Quay lại',
      background: 'white'
    });

    if (reason) {
      setActionId(id);
      try {
        await httpClient.patch(`/admin/settlements/${id}/hold`, { reason: reason.trim() });
        toast.success('Đã tạm giữ quyết toán giao dịch này');
        await fetchSettlements();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lỗi tạm giữ quỹ');
      } finally {
        setActionId(null);
      }
    }
  };

  const handleReleaseSettlement = async (id: string) => {
    const { value: reason } = await Swal.fire({
      title: 'Giải phóng quyết toán?',
      input: 'textarea',
      inputLabel: 'Lý do giải phóng quyết toán *',
      inputPlaceholder: 'Ví dụ: Tranh chấp đã được xử lý / Đã đối soát xong...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#706E3B',
      confirmButtonText: 'Xác nhận giải phóng',
      cancelButtonText: 'Quay lại',
      background: 'white'
    });

    if (reason) {
      setActionId(id);
      try {
        await httpClient.patch(`/admin/settlements/${id}/release`, { reason: reason.trim() });
        toast.success('Giao dịch đã được đưa về trạng thái sẵn sàng quyết toán');
        await fetchSettlements();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lỗi giải phóng quỹ');
      } finally {
        setActionId(null);
      }
    }
  };

  const handleMarkSettled = async (id: string, payableAmount: number) => {
    const { value: formValues } = await Swal.fire({
      title: 'Xác nhận Đã quyết toán?',
      html: `
        <div style="text-align: left; font-size: 13.5px; font-family: inherit;">
          <p style="margin-bottom: 12px;">Hệ thống sẽ ghi nhận khoản chuyển khoản <strong>${payableAmount.toLocaleString()}đ</strong> cho đối tác đã hoàn tất.</p>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: 700; display: block; margin-bottom: 4px; color: #7A7A7A;">MÃ THAM CHIẾU NGÂN HÀNG (REF) *</label>
            <input id="swal-ref" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; height: 38px; font-size: 13px;" placeholder="Ví dụ: CTG182938192">
          </div>
          <div>
            <label style="font-weight: 700; display: block; margin-bottom: 4px; color: #7A7A7A;">GHI CHÚ QUYẾT TOÁN</label>
            <textarea id="swal-note" class="swal2-textarea" style="width: 100%; margin: 0; box-sizing: border-box; height: 60px; font-size: 13px; font-family: inherit;" placeholder="Nhập ghi chú chi tiết nếu có..."></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#706E3B',
      confirmButtonText: 'Xác nhận hoàn tất',
      cancelButtonText: 'Hủy bỏ',
      background: 'white',
      preConfirm: () => {
        const ref = (document.getElementById('swal-ref') as HTMLInputElement).value;
        const note = (document.getElementById('swal-note') as HTMLTextAreaElement).value;
        if (!ref || !ref.trim()) {
          Swal.showValidationMessage('Vui lòng nhập mã tham chiếu ngân hàng!');
          return false;
        }
        return { payoutReference: ref.trim(), note: note.trim() };
      }
    });

    if (formValues) {
      setActionId(id);
      try {
        await httpClient.patch(`/admin/settlements/${id}/mark-settled`, formValues);
        toast.success('Đã xác nhận thanh toán quyết toán thành công!');
        await fetchSettlements();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Xác nhận quyết toán thất bại');
      } finally {
        setActionId(null);
      }
    }
  };

  const handleViewSettlement = async (id: string) => {
    setActionId(id);
    try {
      const settlement = await httpClient.get<Settlement>(`/admin/settlements/${id}`);
      setSelectedSettlement(settlement);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải chi tiết quyết toán');
    } finally {
      setActionId(null);
    }
  };

  const handleRegenerateByBooking = async () => {
    const { value } = await Swal.fire({
      title: 'Tạo lại quyết toán theo booking',
      html: '<input id="regenerate-booking-id" class="swal2-input" placeholder="Booking ObjectId"><textarea id="regenerate-reason" class="swal2-textarea" placeholder="Lý do tạo lại"></textarea>',
      showCancelButton: true,
      confirmButtonText: 'Tạo lại',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4A0E17',
      preConfirm: () => {
        const bookingId = (document.getElementById('regenerate-booking-id') as HTMLInputElement).value.trim();
        const reason = (document.getElementById('regenerate-reason') as HTMLTextAreaElement).value.trim();
        if (!/^[a-f\d]{24}$/i.test(bookingId)) {
          Swal.showValidationMessage('Booking ID phải là MongoDB ObjectId hợp lệ');
          return false;
        }
        if (!reason) {
          Swal.showValidationMessage('Vui lòng nhập lý do tạo lại');
          return false;
        }
        return { bookingId, reason };
      },
    });

    if (!value) return;
    setActionId('regenerate');
    try {
      await httpClient.post(`/admin/settlements/booking/${value.bookingId}/regenerate`, { reason: value.reason });
      toast.success('Đã tạo lại quyết toán cho booking');
      await fetchSettlements();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo lại quyết toán');
    } finally {
      setActionId(null);
    }
  };

  const getFilteredSettlements = () => {
    let list = settlements;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.settlementCode.toLowerCase().includes(q) ||
        bookingLabel(s.bookingId).toLowerCase().includes(q)
      );
    }

    return list;
  };

  const applyFilters = () => {
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters({
      bookingId: bookingIdDraft.trim(),
      providerId: providerIdDraft.trim(),
      fromDate: fromDateDraft ? `${fromDateDraft}T00:00:00.000Z` : '',
      toDate: toDateDraft ? `${toDateDraft}T23:59:59.999Z` : '',
    });
  };

  const formatMoney = (value: number) => `${(value || 0).toLocaleString('vi-VN')}đ`;
  const bookingLabel = (booking: Settlement['bookingId']) =>
    typeof booking === 'string' ? `BK-${booking.slice(-6).toUpperCase()}` : booking.bookingCode || `BK-${booking._id.slice(-6).toUpperCase()}`;
  const providerLabel = (provider: Settlement['providerId']) =>
    typeof provider === 'string' ? provider : provider.businessName || provider._id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chờ quyết toán</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#B89047' }}>{stats.pending.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>Tổng trên trang hiện tại</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đã giải ngân</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#166534' }}>{stats.settled.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#706E3B', marginTop: '4px', fontWeight: 600 }}>Tổng trên trang hiện tại</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đang tạm giữ</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#4A0E17' }}>{stats.held.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px', fontWeight: 600 }}>Tổng trên trang hiện tại</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đã hủy quyết toán</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#2B6CB0' }}>{stats.cancelled.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>Tổng trên trang hiện tại</div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        backgroundColor: 'white',
        padding: '16px 20px',
        borderRadius: '8px',
        border: '1px solid #E8E2D5'
      }}>
        <div style={{
          display: 'flex',
          flex: 1,
          maxWidth: '400px',
          alignItems: 'center',
          border: '1px solid #E8E2D5',
          borderRadius: '6px',
          padding: '0 12px',
          backgroundColor: '#FAF6F0'
        }}>
          <Search size={16} color="#7A7A7A" />
          <input
            type="text"
            placeholder="Tìm trong trang theo mã quyết toán, mã booking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['ALL', 'READY_TO_SETTLE', 'ON_HOLD', 'SETTLED', 'CANCELLED'].map(status => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #E8E2D5',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: statusFilter === status ? '#4A0E17' : 'white',
                  color: statusFilter === status ? 'white' : '#2A2A2A',
                  transition: 'all 0.15s'
                }}
              >
                {status === 'ALL' ? 'TẤT CẢ' : status === 'READY_TO_SETTLE' ? 'CHỜ PAYOUT' : status === 'ON_HOLD' ? 'TẠM GIỮ' : status === 'SETTLED' ? 'ĐÃ TRẢ TIỀN' : 'ĐÃ HỦY'}
              </button>
            ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr)) auto', gap: '12px', padding: '16px 20px', backgroundColor: 'white', border: '1px solid #E8E2D5', borderRadius: '8px', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#5F5A52' }}>
          BOOKING ID
          <input value={bookingIdDraft} onChange={(event) => setBookingIdDraft(event.target.value)} placeholder="MongoDB ObjectId" style={{ padding: '9px 10px', border: '1px solid #D9D1C4', borderRadius: '6px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#5F5A52' }}>
          PROVIDER ID
          <input value={providerIdDraft} onChange={(event) => setProviderIdDraft(event.target.value)} placeholder="MongoDB ObjectId" style={{ padding: '9px 10px', border: '1px solid #D9D1C4', borderRadius: '6px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#5F5A52' }}>
          TỪ NGÀY
          <input type="date" value={fromDateDraft} onChange={(event) => setFromDateDraft(event.target.value)} style={{ padding: '8px 10px', border: '1px solid #D9D1C4', borderRadius: '6px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#5F5A52' }}>
          ĐẾN NGÀY
          <input type="date" value={toDateDraft} onChange={(event) => setToDateDraft(event.target.value)} style={{ padding: '8px 10px', border: '1px solid #D9D1C4', borderRadius: '6px' }} />
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={applyFilters} style={{ padding: '9px 18px', border: 'none', borderRadius: '6px', backgroundColor: '#4A0E17', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Lọc dữ liệu</button>
          <button disabled={actionId === 'regenerate'} onClick={() => void handleRegenerateByBooking()} style={{ padding: '9px 14px', border: '1px solid #706E3B', borderRadius: '6px', backgroundColor: 'white', color: '#706E3B', fontWeight: 700, cursor: actionId === 'regenerate' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>Tạo lại</button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>MÃ QUYẾT TOÁN</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>ĐƠN HÀNG</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>NHÀ CUNG CẤP</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TỔNG TIỀN</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>COMMISSION</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SỐ TIỀN QUYẾT TOÁN</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Đang tải danh sách quyết toán...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#991B1B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <span>{error}</span>
                      <button onClick={() => void fetchSettlements()} style={{ padding: '7px 14px', border: '1px solid #4A0E17', borderRadius: '6px', background: 'white', color: '#4A0E17', cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
                    </div>
                  </td>
                </tr>
              ) : getFilteredSettlements().length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không có giao dịch quyết toán nào phù hợp</td>
                </tr>
              ) : (
                getFilteredSettlements().map((s) => {
                  const bCode = bookingLabel(s.bookingId);
                  const provider = typeof s.providerId === 'string' ? null : s.providerId;
                  const defaultAccount = provider?.paymentAccounts?.find((account) => account.isDefault) || provider?.paymentAccounts?.[0];

                  return (
                    <tr key={s._id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{s.settlementCode}</td>
                      <td style={{ padding: '16px 20px', color: '#4A0E17', fontWeight: 600 }}>{bCode}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{providerLabel(s.providerId)}</div>
                        <span style={{ fontSize: '11px', color: '#7A7A7A' }}>STK: {defaultAccount?.accountNumberMasked || 'Chưa cập nhật'}</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600 }}>{s.grossAmount.toLocaleString()}đ</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', color: '#B89047', fontWeight: 600 }}>
                        -{s.commissionAmount.toLocaleString()}đ
                        <span style={{ display: 'block', fontSize: '10px', color: '#7A7A7A' }}>{((s.commissionRate ?? 0) * 100).toLocaleString('vi-VN')}%</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', color: '#166534', fontWeight: 800 }}>{s.payableAmount.toLocaleString()}đ</td>

                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: s.status === 'SETTLED' ? '#F0FDF4' : s.status === 'ON_HOLD' ? '#FEE2E2' : s.status === 'CANCELLED' ? '#F3F4F6' : '#FEF3C7',
                          color: s.status === 'SETTLED' ? '#166534' : s.status === 'ON_HOLD' ? '#991B1B' : s.status === 'CANCELLED' ? '#4B5563' : '#92400E'
                        }}>
                          {s.status === 'SETTLED' ? 'Đã quyết toán' : s.status === 'ON_HOLD' ? 'Tạm giữ' : s.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ quyết toán'}
                        </span>
                      </td>

                       <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                         <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                           <button
                             onClick={() => void handleViewSettlement(s._id)}
                             disabled={actionId === s._id}
                             style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', color: '#4A0E17', cursor: 'pointer' }}
                             title="Xem chi tiết quyết toán"
                           >
                             <Eye size={12} />
                           </button>
                           {s.status === 'READY_TO_SETTLE' && (
                            <>
                              <button
                                onClick={() => handleMarkSettled(s._id, s.payableAmount)}
                                disabled={actionId === s._id}
                                style={{ padding: '6px 10px', border: 'none', borderRadius: '4px', backgroundColor: '#706E3B', color: 'white', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                title="Đã chuyển tiền"
                              >
                                {actionId === s._id ? 'Đang xử lý...' : 'Payout'}
                              </button>
                              <button
                                onClick={() => handleHoldSettlement(s._id)}
                                disabled={actionId === s._id}
                                style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FFF5F5', color: '#E53E3E', cursor: 'pointer' }}
                                title="Tạm giữ quỹ"
                              >
                                <Lock size={12} />
                              </button>
                            </>
                          )}
                          {s.status === 'ON_HOLD' && (
                            <button
                              onClick={() => handleReleaseSettlement(s._id)}
                              disabled={actionId === s._id}
                              style={{ padding: '6px 10px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', color: '#706E3B', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                              title="Giải phóng quỹ"
                            >
                              <Unlock size={12} style={{ display: 'inline-block', marginRight: '4px' }} /> Release
                            </button>
                          )}
                          {s.status === 'SETTLED' && (
                            <span style={{ fontSize: '11px', color: '#7A7A7A', fontStyle: 'italic' }}>
                              Ref: {s.payoutReference || 'Manual'}
                            </span>
                          )}
                           {s.status === 'CANCELLED' && (
                            <span style={{ fontSize: '11px', color: '#7A7A7A', fontStyle: 'italic' }}>Quyết toán đã bị hủy</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {!loading && !error && pagination.totalPages > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #E8E2D5', fontSize: '12px', color: '#5F5A52' }}>
              <span>{pagination.total.toLocaleString('vi-VN')} kết quả · Trang {pagination.page}/{pagination.totalPages}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} style={{ padding: '7px 12px', border: '1px solid #D9D1C4', borderRadius: '6px', background: 'white', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>Trang trước</button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} style={{ padding: '7px 12px', border: '1px solid #D9D1C4', borderRadius: '6px', background: 'white', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>Trang sau</button>
              </div>
            </div>
          )}
        </div>

      <Modal isOpen={Boolean(selectedSettlement)} onClose={() => setSelectedSettlement(null)} title={selectedSettlement ? `Chi tiết ${selectedSettlement.settlementCode}` : ''} maxWidth="860px">
        {selectedSettlement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                ['Đơn hàng', bookingLabel(selectedSettlement.bookingId)],
                ['Nhà cung cấp', providerLabel(selectedSettlement.providerId)],
                ['Trạng thái', selectedSettlement.status],
                ['Tổng dịch vụ', formatMoney(selectedSettlement.grossAmount)],
                [`Commission (${(selectedSettlement.commissionRate * 100).toLocaleString('vi-VN')}%)`, formatMoney(selectedSettlement.commissionAmount)],
                ['Phí nền tảng', formatMoney(selectedSettlement.allocatedPlatformFee)],
                ['Hoàn tiền điều chỉnh', formatMoney(selectedSettlement.refundAmount)],
                ['Phạt vi phạm', formatMoney(selectedSettlement.penaltyAmount)],
                ['Số tiền quyết toán', formatMoney(selectedSettlement.payableAmount)],
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid #E8E2D5', borderRadius: '7px', padding: '12px', background: '#FCFAF7' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A', marginBottom: '5px' }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2A2A2A' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px', border: '1px solid #E8E2D5', borderRadius: '7px' }}>
              <strong style={{ fontSize: '13px' }}>Policy áp dụng</strong>
              <div style={{ marginTop: '8px', color: '#5F5A52', fontSize: '13px' }}>Phiên bản {selectedSettlement.policySnapshot.policyVersion} · Loại rate {selectedSettlement.policySnapshot.appliedRateType} · Phí cố định {formatMoney(selectedSettlement.policySnapshot.fixedPlatformFee)}</div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Chi tiết dịch vụ</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #E8E2D5', borderRadius: '7px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead><tr style={{ background: '#FAF6F0' }}><th style={{ padding: '10px', textAlign: 'left' }}>Dịch vụ</th><th style={{ padding: '10px', textAlign: 'right' }}>Giá</th><th style={{ padding: '10px', textAlign: 'right' }}>Giảm giá</th><th style={{ padding: '10px', textAlign: 'right' }}>Commission</th><th style={{ padding: '10px', textAlign: 'right' }}>Thực nhận</th></tr></thead>
                  <tbody>{selectedSettlement.itemSnapshots.map((item) => <tr key={item.bookingItemId} style={{ borderTop: '1px solid #E8E2D5' }}><td style={{ padding: '10px' }}>{item.itemName || item.itemType}</td><td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(item.serviceAmount)}</td><td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(item.providerDiscountAmount)}</td><td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(item.commissionAmount)}</td><td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(item.netAmount)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            {(selectedSettlement.holdReason || selectedSettlement.payoutReference || selectedSettlement.note) && <div style={{ padding: '14px', borderRadius: '7px', background: '#F8F4EC', fontSize: '13px', lineHeight: 1.7 }}>{selectedSettlement.holdReason && <div><strong>Lý do tạm giữ:</strong> {selectedSettlement.holdReason}</div>}{selectedSettlement.payoutReference && <div><strong>Mã chuyển khoản:</strong> {selectedSettlement.payoutReference}</div>}{selectedSettlement.note && <div><strong>Ghi chú:</strong> {selectedSettlement.note}</div>}</div>}
          </div>
        )}
      </Modal>

    </div>
  );
};
