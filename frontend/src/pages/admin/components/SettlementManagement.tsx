import React, { useState, useEffect } from 'react';
import {
  Search, Lock, Unlock, Eye, RotateCcw
} from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';

interface SettlementPolicySnapshot {
  policyCode: string;
  policyVersion: number;
  defaultCommissionRate: number;
  fixedPlatformFee: number;
}

interface SettlementItemSnapshot {
  bookingItemId: string;
  itemType: string;
  itemName?: string;
  serviceAmount: number;
  netAmount: number;
}

interface Settlement {
  _id: string;
  settlementCode: string;
  bookingId: any;
  providerId: any;
  grossAmount: number;
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

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    settled: 0,
    held: 0,
    cancelled: 0
  });

  const fetchSettlements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get<any>('/admin/settlements');
      // res.items is the array of settlements
      const items = res.items || [];
      setSettlements(items);

      // Calculate stats based on fetched items
      const pendingSum = items.filter((s: any) => s.status === 'READY_TO_SETTLE').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const settledSum = items.filter((s: any) => s.status === 'SETTLED').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const heldSum = items.filter((s: any) => s.status === 'ON_HOLD').reduce((sum: number, s: any) => sum + s.payableAmount, 0);
      const cancelledSum = items.filter((s: any) => s.status === 'CANCELLED').reduce((sum: number, s: any) => sum + s.payableAmount, 0);

      setStats(prev => ({
        ...prev,
        pending: pendingSum,
        settled: settledSum,
        held: heldSum,
        cancelled: cancelledSum,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách quyết toán';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettlements();
  }, []);

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
        <div style="text-align: left; font-size: 13.5px; font-family: sans-serif;">
          <p style="margin-bottom: 12px;">Hệ thống sẽ ghi nhận khoản chuyển khoản <strong>${payableAmount.toLocaleString()}đ</strong> cho đối tác đã hoàn tất.</p>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: 700; display: block; margin-bottom: 4px; color: #7A7A7A;">MÃ THAM CHIẾU NGÂN HÀNG (REF) *</label>
            <input id="swal-ref" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; height: 38px; font-size: 13px;" placeholder="Ví dụ: CTG182938192">
          </div>
          <div>
            <label style="font-weight: 700; display: block; margin-bottom: 4px; color: #7A7A7A;">GHI CHÚ QUYẾT TOÁN</label>
            <textarea id="swal-note" class="swal2-textarea" style="width: 100%; margin: 0; box-sizing: border-box; height: 60px; font-size: 13px; font-family: sans-serif;" placeholder="Nhập ghi chú chi tiết nếu có..."></textarea>
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
      const items = settlement.itemSnapshots?.map((item) => (
        `<li>${item.itemName || item.itemType}: ${item.netAmount.toLocaleString('vi-VN')}d</li>`
      )).join('') || '<li>Khong co chi tiet dich vu</li>';

      await Swal.fire({
        title: settlement.settlementCode,
        html: `
          <div style="text-align:left; font-size:13px; line-height:1.6">
            <p><strong>Tong tien:</strong> ${settlement.grossAmount.toLocaleString('vi-VN')}d</p>
            <p><strong>Commission:</strong> ${settlement.commissionAmount.toLocaleString('vi-VN')}d</p>
            <p><strong>Phi nen tang:</strong> ${(settlement.allocatedPlatformFee || 0).toLocaleString('vi-VN')}d</p>
            <p><strong>So tien quyet toan:</strong> ${settlement.payableAmount.toLocaleString('vi-VN')}d</p>
            ${settlement.holdReason ? `<p><strong>Ly do tam giu:</strong> ${settlement.holdReason}</p>` : ''}
            ${settlement.payoutReference ? `<p><strong>Ma tham chieu:</strong> ${settlement.payoutReference}</p>` : ''}
            <strong>Dich vu:</strong><ul style="margin:4px 0; padding-left:20px">${items}</ul>
          </div>
        `,
        confirmButtonText: 'Dong',
        confirmButtonColor: '#4A0E17',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Khong the tai chi tiet quyet toan');
    } finally {
      setActionId(null);
    }
  };

  const handleRegenerateSettlement = async (settlement: Settlement) => {
    const bookingId = typeof settlement.bookingId === 'string'
      ? settlement.bookingId
      : settlement.bookingId?._id;

    if (!bookingId) {
      toast.error('Khong xac dinh duoc don hang cua quyet toan');
      return;
    }

    const { value: reason } = await Swal.fire({
      title: 'Tao lai quyet toan?',
      input: 'textarea',
      inputLabel: 'Ly do tao lai *',
      inputPlaceholder: 'Vi du: doi soat lai du lieu don hang...',
      inputAttributes: { required: 'true' },
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Tao lai',
      cancelButtonText: 'Quay lai',
      preConfirm: (value) => {
        if (!value?.trim()) {
          Swal.showValidationMessage('Vui long nhap ly do');
          return false;
        }
        return value.trim();
      },
    });

    if (!reason) return;

    setActionId(settlement._id);
    try {
      await httpClient.post(`/admin/settlements/booking/${bookingId}/regenerate`, { reason });
      toast.success('Da tao lai quyet toan cho don hang');
      await fetchSettlements();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Khong the tao lai quyet toan');
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
        (s.bookingId && (s.bookingId.bookingCode || s.bookingId._id || s.bookingId).toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'ALL') {
      list = list.filter(s => s.status === statusFilter);
    }

    return list;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chờ quyết toán</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#B89047' }}>{stats.pending.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>Trạng thái READY_TO_SETTLE</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đã giải ngân</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#166534' }}>{stats.settled.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#706E3B', marginTop: '4px', fontWeight: 600 }}>Thanh toán cho nhà cung cấp</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đang tạm giữ</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#4A0E17' }}>{stats.held.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px', fontWeight: 600 }}>Tạm dừng do sự cố / tranh chấp</div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đã hủy quyết toán</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#2B6CB0' }}>{stats.cancelled.toLocaleString()}đ</div>
          <div style={{ fontSize: '11px', color: '#7A7A7A', marginTop: '4px' }}>Không còn payable do booking bị hủy</div>
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
            placeholder="Tìm theo mã quyết toán, mã booking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['ALL', 'READY_TO_SETTLE', 'ON_HOLD', 'SETTLED', 'CANCELLED'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
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
                  const bCode = s.bookingId?.bookingCode || `BK-${(s.bookingId?._id || s.bookingId)?.slice(-6).toUpperCase()}`;

                  return (
                    <tr key={s._id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{s.settlementCode}</td>
                      <td style={{ padding: '16px 20px', color: '#4A0E17', fontWeight: 600 }}>{bCode}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{s.providerId?.businessName || 'Nhà cung cấp'}</div>
                        <span style={{ fontSize: '11px', color: '#7A7A7A' }}>STK: {s.providerId?.bankInfo?.accountNumber || 'Chưa cập nhật'}</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600 }}>{s.grossAmount.toLocaleString()}đ</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', color: '#B89047', fontWeight: 600 }}>
                        -{s.commissionAmount.toLocaleString()}đ
                        <span style={{ display: 'block', fontSize: '10px', color: '#7A7A7A' }}>{((s.policySnapshot?.defaultCommissionRate ?? 0) * 100).toLocaleString('vi-VN')}%</span>
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
                             title="Xem chi tiet quyet toan"
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
                             <button
                               onClick={() => void handleRegenerateSettlement(s)}
                               disabled={actionId === s._id}
                               style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', color: '#706E3B', cursor: 'pointer' }}
                               title="Tao lai quyet toan"
                             >
                               <RotateCcw size={12} />
                             </button>
                           )}
                           {s.status === 'CANCELLED' && (
                            <span style={{ fontSize: '11px', color: '#7A7A7A', fontStyle: 'italic' }}>Settlement đã bị hủy</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

    </div>
  );
};
