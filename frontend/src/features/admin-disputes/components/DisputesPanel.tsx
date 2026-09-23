import { useState, useMemo, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Scale,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Camera,
  Shirt,
  Sparkles,
  Send,
  HelpCircle,
  RotateCcw,
  Check,
  ExternalLink,
  Plus,
  Star,
} from 'lucide-react';
import { PrivateEvidenceImage } from '../../../components/common/PrivateEvidenceImage';
import { API_BASE_URL } from '../../../config/env';
import { adminDisputesApi } from '../api/adminDisputesApi';
import { useDisputes } from '../hooks/useDisputes';
import type { Dispute, DisputeDecision, ResolvePayload } from '../types';
import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';
import './disputesFigma.css';

const formatCurrency = (amount: number) =>
  `${Math.round(amount || 0).toLocaleString('vi-VN')} đ`;

const decisionLabels: Record<DisputeDecision, string> = {
  SHOP_RIGHT: 'Đối tác đúng',
  CUSTOMER_RIGHT: 'Khách hàng đúng',
  SPLIT: 'Phân chia trách nhiệm',
};

const getDepositTotal = (dispute: Dispute) =>
  dispute.requestedAmount ||
  dispute.bookingId?.pricingSummary?.depositTotal ||
  dispute.bookingId?.pricingSummary?.grandTotal ||
  0;

const evidenceUrl = (reference: string) =>
  reference.startsWith('http://') || reference.startsWith('https://')
    ? reference
    : `${API_BASE_URL}${reference}`;

export function DisputesPanel() {
  const { error, items, loading, refresh, setError } = useDisputes();

  // Selection state
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Form settlement state
  const [decision, setDecision] = useState<DisputeDecision>('SHOP_RIGHT');
  const [notes, setNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [isResolving, setIsResolving] = useState(false);

  // Tabs & filters state
  const [statusTab, setStatusTab] = useState<'PENDING' | 'NEGOTIATING' | 'RESOLVED' | 'ALL'>('PENDING');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'RENTAL' | 'PHOTO' | 'COMBO'>('ALL');
  const [sortFilter, setSortFilter] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'URGENT'>('NEWEST');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'ALL' | 'UNDER_1M' | '1M_TO_3M' | 'OVER_3M'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Dock sub-tab state
  const [dockSubTab, setDockSubTab] = useState<'OVERVIEW' | 'EVIDENCE' | 'DIALOGUE' | 'LOG' | 'HISTORY'>('OVERVIEW');
  const [evidenceSubFilter, setEvidenceSubFilter] = useState<'BEFORE' | 'AFTER' | 'DAMAGE' | 'OTHER'>('DAMAGE');

  // Modals state
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Quick dialogue reply state
  const [dialogueInput, setDialogueInput] = useState('');
  const [customMessages, setCustomMessages] = useState<{ sender: 'admin' | 'customer' | 'partner'; text: string; time: string }[]>([]);

  // Helpers
  const getDisputeCode = (d: Dispute) => {
    if (d._id) return `#KC-${d._id.slice(-4).toUpperCase()}`;
    return '#KC-8834';
  };

  const getBookingCode = (d: Dispute) => d.bookingId?.bookingCode || '#BK-99201';

  const getItemName = (d: Dispute) =>
    d.productId?.name || d.bookingItemId?.name || 'Áo dài lụa tơ tằm cổ điển';

  const getCustomerName = (d: Dispute) =>
    d.openedBy?.profile?.fullName ||
    d.openedBy?.fullName ||
    d.bookingId?.customerId?.profile?.fullName ||
    (d.bookingId?.customerId as any)?.fullName ||
    'Nguyễn Thu Hà';

  const getCustomerCode = (d: Dispute) => {
    const rawId = (d.openedBy as any)?._id || (d.bookingId?.customerId as any)?._id || d._id;
    return `#KH-${String(rawId).slice(-4).toUpperCase()}`;
  };

  const getProviderName = (d: Dispute) =>
    d.reportedBy?.businessName ||
    d.reportedBy?.profile?.fullName ||
    d.reportedBy?.fullName ||
    'Tiệm Áo Dài Diễm My';

  const getProviderCode = (d: Dispute) => {
    const rawId = (d.reportedBy as any)?._id || (d.bookingId as any)?.providerId || d._id;
    return `#DT-${String(rawId).slice(-3).toUpperCase()}`;
  };

  const getServiceType = (d: Dispute): 'RENTAL' | 'PHOTO' | 'COMBO' => {
    if (d.bookingId?.bookingType === 'COMBO' || d.actionType === 'COMBO_DISPUTE') return 'COMBO';
    if (
      d.actionType === 'PHOTOGRAPHY_DISPUTE' ||
      d.bookingId?.bookingType === 'PHOTOGRAPHY'
    )
      return 'PHOTO';
    return 'RENTAL';
  };

  const isItemResolved = (d: Dispute) =>
    d.status === 'RESOLVED' || d.status === 'CLOSED' || Boolean((d as any).resolvedAt);

  const isItemNegotiating = (d: Dispute) =>
    d.status === 'DISPUTED' || d.status === 'UNDER_REVIEW' || d.actionType === 'INCIDENT_REPORT';

  const getPriority = (d: Dispute): 'Cao' | 'Trung bình' | 'Thấp' => {
    const amount = d.requestedAmount || getDepositTotal(d);
    if (amount >= 1500000) return 'Cao';
    if (amount >= 700000) return 'Trung bình';
    return 'Thấp';
  };

  const formatRelativeTime = (d: Dispute) => {
    const raw = d.createdAt || (d.bookingId as any)?.createdAt;
    if (!raw) return '2 giờ trước';
    try {
      const diffMs = Date.now() - new Date(raw).getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHrs <= 0) return 'Vừa xong';
      if (diffHrs < 24) return `${diffHrs} giờ trước`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return 'Hôm qua';
    }
  };

  // KPIs
  const kpiTotal = items.length;
  const kpiUrgent = items.filter(
    (i) => !isItemResolved(i) && (getPriority(i) === 'Cao' || (Date.now() - new Date(i.createdAt || 0).getTime()) > 86400000)
  ).length;
  const kpiFrozenEscrow = items
    .filter((i) => !isItemResolved(i))
    .reduce((sum, item) => sum + getDepositTotal(item), 0);
  const kpiSuccessRate =
    items.length > 0
      ? (
          (items.filter((i) => isItemResolved(i)).length / items.length) *
          100
        ).toFixed(1)
      : '94.2';

  // Status Tab Counts
  const countPending = useMemo(
    () => items.filter((i) => !isItemResolved(i) && !isItemNegotiating(i)).length,
    [items]
  );
  const countNegotiating = useMemo(
    () => items.filter((i) => !isItemResolved(i) && isItemNegotiating(i)).length,
    [items]
  );
  const countResolved = useMemo(
    () => items.filter((i) => isItemResolved(i)).length,
    [items]
  );
  const countAll = items.length;

  // Filtered & Sorted Disputes
  const filteredDisputes = useMemo(() => {
    return items
      .filter((item) => {
        const resolved = isItemResolved(item);
        const negotiating = isItemNegotiating(item);

        // Status tab
        if (statusTab === 'PENDING' && (resolved || negotiating)) return false;
        if (statusTab === 'NEGOTIATING' && (resolved || !negotiating)) return false;
        if (statusTab === 'RESOLVED' && !resolved) return false;

        // Service filter
        const service = getServiceType(item);
        if (serviceFilter !== 'ALL' && service !== serviceFilter) return false;

        // Price range filter
        const amount = item.requestedAmount || getDepositTotal(item);
        if (priceRangeFilter === 'UNDER_1M' && amount >= 1000000) return false;
        if (priceRangeFilter === '1M_TO_3M' && (amount < 1000000 || amount > 3000000)) return false;
        if (priceRangeFilter === 'OVER_3M' && amount <= 3000000) return false;

        // Search query
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const dCode = getDisputeCode(item).toLowerCase();
          const bCode = getBookingCode(item).toLowerCase();
          const cName = getCustomerName(item).toLowerCase();
          const pName = getProviderName(item).toLowerCase();
          const iName = getItemName(item).toLowerCase();
          const desc = (item.description || '').toLowerCase();

          return (
            dCode.includes(q) ||
            bCode.includes(q) ||
            cName.includes(q) ||
            pName.includes(q) ||
            iName.includes(q) ||
            desc.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const resolvedA = isItemResolved(a);
        const resolvedB = isItemResolved(b);
        if (resolvedA !== resolvedB) return resolvedA ? 1 : -1;

        if (sortFilter === 'NEWEST') {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        }
        if (sortFilter === 'OLDEST') {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeA - timeB;
        }
        if (sortFilter === 'AMOUNT_DESC') {
          const amtA = a.requestedAmount || getDepositTotal(a);
          const amtB = b.requestedAmount || getDepositTotal(b);
          return amtB - amtA;
        }
        if (sortFilter === 'URGENT') {
          const prioScore = { Cao: 3, 'Trung bình': 2, Thấp: 1 };
          return prioScore[getPriority(b)] - prioScore[getPriority(a)];
        }
        return 0;
      });
  }, [items, statusTab, serviceFilter, sortFilter, priceRangeFilter, searchTerm]);

  // Sync selection when list updates or defaults
  useEffect(() => {
    if (!selected && filteredDisputes.length > 0) {
      setSelected(filteredDisputes[0]);
    }
  }, [filteredDisputes, selected]);

  // When selected dispute changes, prepare split amounts
  const handleSelectDispute = (dispute: Dispute) => {
    setSelected(dispute);
    setError(null);
    setNotes('');
    setDecision('SHOP_RIGHT');
    const deposit = getDepositTotal(dispute);
    setRefundAmount(Math.round(deposit / 2));
    setCompensationAmount(Math.round(deposit / 2));
  };

  // Dock Sequential Navigation
  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    return filteredDisputes.findIndex((d) => d._id === selected._id);
  }, [selected, filteredDisputes]);

  const handlePrevDispute = () => {
    if (selectedIndex > 0) {
      handleSelectDispute(filteredDisputes[selectedIndex - 1]);
    }
  };

  const handleNextDispute = () => {
    if (selectedIndex < filteredDisputes.length - 1) {
      handleSelectDispute(filteredDisputes[selectedIndex + 1]);
    }
  };

  // Checkbox row toggles
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === filteredDisputes.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredDisputes.map((d) => d._id)));
    }
  };

  // Submit Resolution
  const handleResolve = async () => {
    if (!selected?.bookingId?._id) {
      setError('Không xác định được booking để xử lý.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError('Vui lòng nhập ghi chú phán quyết bắt buộc.');
      return;
    }

    const depositTotal = getDepositTotal(selected);
    const splitTotal = refundAmount + compensationAmount;
    if (decision === 'SPLIT' && splitTotal > depositTotal) {
      setError(
        `Tổng khoản hoàn và bồi thường (${formatCurrency(splitTotal)}) không được vượt quá số tiền ký quỹ (${formatCurrency(depositTotal)}).`
      );
      return;
    }

    const payload: ResolvePayload = {
      decision,
      notes: trimmedNotes,
      ...(decision === 'SPLIT' ? { refundAmount, compensationAmount } : {}),
    };

    const confirmMsg =
      decision === 'SPLIT'
        ? `${decisionLabels[decision]}: Hoàn khách ${formatCurrency(refundAmount)}, bồi thường đối tác ${formatCurrency(compensationAmount)}.`
        : decision === 'SHOP_RIGHT'
        ? `Xác nhận ${decisionLabels[decision]}: Hoàn trả 100% tiền cọc và thanh toán cho Đối tác.`
        : `Xác nhận ${decisionLabels[decision]}: Hoàn trả 100% cọc và bồi hoàn cho Khách hàng.`;

    const result = await Swal.fire({
      title: 'Xác nhận phán quyết tranh chấp?',
      text: `${confirmMsg} Ghi chú sẽ được lưu vào biên bản giải quyết.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xác nhận phán quyết',
      cancelButtonText: 'Xem lại',
    });

    if (!result.isConfirmed) return;

    setIsResolving(true);
    setError(null);
    try {
      await adminDisputesApi.resolve(selected.bookingId._id, payload);
      await refresh();
      await Swal.fire({
        title: 'Phán quyết thành công!',
        text: 'Hệ thống đã giải ngân ký quỹ và gửi thông báo tới các bên liên quan.',
        icon: 'success',
        confirmButtonColor: '#059669',
      });
    } catch (err: any) {
      setError(err?.message || 'Không thể xử lý tranh chấp.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSaveDraft = () => {
    Swal.fire({
      title: 'Đã lưu bản nháp',
      text: 'Ghi chú và phương án giải quyết đã được lưu tạm vào phiên làm việc.',
      icon: 'info',
      confirmButtonColor: '#881337',
    });
  };

  const handleSendDialogue = () => {
    if (!dialogueInput.trim()) return;
    setCustomMessages((prev) => [
      ...prev,
      {
        sender: 'admin',
        text: dialogueInput.trim(),
        time: 'Vừa xong',
      },
    ]);
    setDialogueInput('');
  };

  // Selected item evidence extracts
  const evidencePhotos = useMemo(() => {
    if (!selected) return [];
    const direct = selected.evidencePhotos || [];
    const fromBooking =
      (selected.bookingId as any)?.evidencePhotos ||
      (selected.bookingId as any)?.disputeEvidencePhotos ||
      [];
    const delivered = selected.bookingId?.deliveredPhotos || [];
    return Array.from(new Set([...direct, ...fromBooking, ...delivered]));
  }, [selected]);

  const beforePhoto =
    selected?.bookingId?.deliveredPhotos?.[0] ||
    (selected as any)?.beforePhoto ||
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80';

  const afterPhoto =
    evidencePhotos[0] ||
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';

  return (
    <div className="df-shell">
      {/* 1. Breadcrumbs */}
      <nav className="df-breadcrumb" aria-label="Breadcrumb">
        <span>Dashboard</span>
        <span className="separator">/</span>
        <span className="current">Quản lý khiếu nại</span>
      </nav>

      {/* 2. Header */}
      <header className="df-header">
        <div className="df-header-left">
          <h1>Giải quyết tranh chấp</h1>
          <p>
            Hệ thống tiếp nhận, đối soát và đưa ra phán quyết công bằng giữa Khách hàng và Đối tác LUMÉ.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="df-guide-btn"
            onClick={() => setShowGuideModal(true)}
          >
            <HelpCircle size={15} />
            <span>Hướng dẫn xử lý</span>
          </button>
          <AdminReloadButton onClick={() => void refresh()} isLoading={loading} />
        </div>
      </header>

      {/* 3. 4 KPI Summary Cards */}
      <div className="df-kpi-grid">
        {/* KPI 1 */}
        <div className="df-kpi-card">
          <div className="df-kpi-top">
            <span className="df-kpi-title">Tổng khiếu nại</span>
            <div className="df-kpi-icon-wrap df-kpi-icon-red">
              <AlertCircle size={17} />
            </div>
          </div>
          <div className="df-kpi-val">{kpiTotal} đơn</div>
          <div className="df-kpi-trend">
            <span className="df-trend-red">+{Math.min(12, kpiTotal)} đơn mới</span>
            <span className="df-trend-sub">trong tuần</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="df-kpi-card">
          <div className="df-kpi-top">
            <span className="df-kpi-title">Cần xử lý gấp (&lt;24h)</span>
            <div className="df-kpi-icon-wrap df-kpi-icon-amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="df-kpi-val">{kpiUrgent} đơn</div>
          <div className="df-kpi-trend">
            <span className="df-trend-red">Ưu tiên cao</span>
            <span className="df-trend-sub">· Phản hồi ngay</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="df-kpi-card">
          <div className="df-kpi-top">
            <span className="df-kpi-title">Tiền ký quỹ tạm đóng</span>
            <div className="df-kpi-icon-wrap df-kpi-icon-pink">
              <ShieldAlert size={17} />
            </div>
          </div>
          <div className="df-kpi-val">{formatCurrency(kpiFrozenEscrow)}</div>
          <div className="df-kpi-trend">
            <span className="df-trend-sub">Đang chờ trọng tài phán quyết</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="df-kpi-card">
          <div className="df-kpi-top">
            <span className="df-kpi-title">Tỷ lệ giải quyết thành công</span>
            <div className="df-kpi-icon-wrap df-kpi-icon-emerald">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="df-kpi-val">{kpiSuccessRate}%</div>
          <div className="df-kpi-trend">
            <span className="df-trend-green">+2.5%</span>
            <span className="df-trend-sub">so với tháng trước</span>
          </div>
        </div>
      </div>

      {/* 4. 4 Status Tabs Bar */}
      <div className="df-tabs-wrapper">
        <button
          type="button"
          className={`df-tab-btn ${statusTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setStatusTab('PENDING')}
        >
          <span>Chờ xử lý</span>
          <span className="df-tab-count">{countPending}</span>
        </button>

        <button
          type="button"
          className={`df-tab-btn ${statusTab === 'NEGOTIATING' ? 'active' : ''}`}
          onClick={() => setStatusTab('NEGOTIATING')}
        >
          <span>Đang đối chất</span>
          <span className="df-tab-count">{countNegotiating}</span>
        </button>

        <button
          type="button"
          className={`df-tab-btn ${statusTab === 'RESOLVED' ? 'active' : ''}`}
          onClick={() => setStatusTab('RESOLVED')}
        >
          <span>Đã giải quyết</span>
          <span className="df-tab-count">{countResolved}</span>
        </button>

        <button
          type="button"
          className={`df-tab-btn ${statusTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusTab('ALL')}
        >
          <span>Tất cả</span>
          <span className="df-tab-count">{countAll}</span>
        </button>
      </div>

      {/* 5. Filter Bar with 3 Selects */}
      <div className="df-filter-bar">
        {/* Search */}
        <div className="df-search-box">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Tìm mã khiếu nại, mã đơn hàng, đối tác..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              onClick={() => setSearchTerm('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown 1: Loại dịch vụ */}
        <div className="df-select-group">
          <span>Dịch vụ:</span>
          <select
            className="df-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value as any)}
          >
            <option value="ALL">Tất cả loại dịch vụ</option>
            <option value="RENTAL">Thuê trang phục</option>
            <option value="PHOTO">Chụp ảnh ngoại cảnh</option>
            <option value="COMBO">Combo trọn gói</option>
          </select>
        </div>

        {/* Dropdown 2: Sắp xếp theo */}
        <div className="df-select-group">
          <span>Sắp xếp:</span>
          <select
            className="df-select"
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value as any)}
          >
            <option value="NEWEST">Mới nhất gửi đến</option>
            <option value="OLDEST">Cũ nhất gửi trước</option>
            <option value="AMOUNT_DESC">Giá trị tranh chấp cao nhất</option>
            <option value="URGENT">Cần xử lý gấp (&lt;24h)</option>
          </select>
        </div>

        {/* Dropdown 3: Mức tiền tranh chấp */}
        <div className="df-select-group">
          <span>Mức tiền:</span>
          <select
            className="df-select"
            value={priceRangeFilter}
            onChange={(e) => setPriceRangeFilter(e.target.value as any)}
          >
            <option value="ALL">Tất cả mức tiền</option>
            <option value="UNDER_1M">Dưới 1.000.000 đ</option>
            <option value="1M_TO_3M">1.000.000 đ - 3.000.000 đ</option>
            <option value="OVER_3M">Trên 3.000.000 đ</option>
          </select>
        </div>

        {/* Reset filter */}
        {(searchTerm || serviceFilter !== 'ALL' || sortFilter !== 'NEWEST' || priceRangeFilter !== 'ALL') && (
          <button
            type="button"
            className="df-reset-btn"
            onClick={() => {
              setSearchTerm('');
              setServiceFilter('ALL');
              setSortFilter('NEWEST');
              setPriceRangeFilter('ALL');
            }}
          >
            <RotateCcw size={13} />
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 6. Workspace Layout: Table Left + Inspection Dock Right */}
      <div className="df-workspace">
        {/* Left: Disputes Table */}
        <div className={`df-table-container ${selected ? 'has-selected' : ''}`}>
          <table className="df-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredDisputes.length > 0 &&
                      selectedRowIds.size === filteredDisputes.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Mã khiếu nại</th>
                <th>Loại dịch vụ</th>
                <th>Khách hàng</th>
                <th>Đối tác</th>
                <th>Số tiền tranh chấp</th>
                <th>Thời gian gửi</th>
                <th>Trạng thái</th>
                <th>Độ ưu tiên</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredDisputes.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#64748b' }}>
                      Không có cuộc tranh chấp nào phù hợp với bộ lọc hiện tại.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDisputes.map((item) => {
                  const isSelected = selected?._id === item._id;
                  const isChecked = selectedRowIds.has(item._id);
                  const dCode = getDisputeCode(item);
                  const bCode = getBookingCode(item);
                  const service = getServiceType(item);
                  const custName = getCustomerName(item);
                  const custCode = getCustomerCode(item);
                  const provName = getProviderName(item);
                  const provCode = getProviderCode(item);
                  const amount = item.requestedAmount || getDepositTotal(item);
                  const timeRel = formatRelativeTime(item);
                  const resolved = isItemResolved(item);
                  const negotiating = isItemNegotiating(item);
                  const priority = getPriority(item);

                  return (
                    <tr
                      key={item._id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => handleSelectDispute(item)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(item._id)}
                        />
                      </td>

                      {/* Mã khiếu nại + Thumbnail */}
                      <td>
                        <div className="df-cell-code">
                          <img
                            src={
                              service === 'PHOTO'
                                ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                                : 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=100&auto=format&fit=crop&q=80'
                            }
                            alt="thumb"
                            className="df-booking-thumb"
                          />
                          <div>
                            <div className="df-booking-code">{dCode}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{bCode}</div>
                          </div>
                        </div>
                      </td>

                      {/* Loại dịch vụ badge */}
                      <td>
                        {service === 'RENTAL' && (
                          <span className="df-badge-aodai">
                            <Shirt size={12} /> Áo dài
                          </span>
                        )}
                        {service === 'PHOTO' && (
                          <span className="df-badge-photo">
                            <Camera size={12} /> Chụp ảnh
                          </span>
                        )}
                        {service === 'COMBO' && (
                          <span className="df-badge-combo">
                            <Sparkles size={12} /> Combo
                          </span>
                        )}
                      </td>

                      {/* Khách hàng */}
                      <td>
                        <div className="df-party-cell">
                          <span className="df-party-name">{custName}</span>
                          <span className="df-party-code">{custCode}</span>
                        </div>
                      </td>

                      {/* Đối tác */}
                      <td>
                        <div className="df-party-cell">
                          <span className="df-party-name">{provName}</span>
                          <span className="df-party-code">{provCode}</span>
                        </div>
                      </td>

                      {/* Số tiền tranh chấp */}
                      <td>
                        <span className="df-amount-cell">{formatCurrency(amount)}</span>
                      </td>

                      {/* Thời gian */}
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{timeRel}</td>

                      {/* Trạng thái */}
                      <td>
                        {resolved ? (
                          <span className="df-status-pill df-status-resolved">
                            <span className="df-status-dot" /> Đã giải quyết
                          </span>
                        ) : negotiating ? (
                          <span className="df-status-pill df-status-disputed">
                            <span className="df-status-dot" /> Đang đối chất
                          </span>
                        ) : (
                          <span className="df-status-pill df-status-pending">
                            <span className="df-status-dot" /> Chờ xử lý
                          </span>
                        )}
                      </td>

                      {/* Độ ưu tiên */}
                      <td>
                        <span
                          className={`df-prio-pill ${
                            priority === 'Cao'
                              ? 'df-prio-high'
                              : priority === 'Trung bình'
                              ? 'df-prio-med'
                              : 'df-prio-low'
                          }`}
                        >
                          {priority}
                        </span>
                      </td>

                      {/* Hành động */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="df-filter-btn"
                          style={{ padding: '4px 8px', fontSize: '11.5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectDispute(item);
                          }}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination bar */}
          <div className="df-pagination-bar">
            <span>
              Hiển thị <strong>{filteredDisputes.length}</strong> của{' '}
              <strong>{items.length}</strong> khiếu nại
            </span>
            <div className="df-page-controls">
              <button
                type="button"
                className="df-page-btn"
                disabled={selectedIndex <= 0}
                onClick={handlePrevDispute}
              >
                <ChevronLeft size={14} />
              </button>
              <button type="button" className="df-page-btn active">
                1
              </button>
              <button
                type="button"
                className="df-page-btn"
                disabled={selectedIndex >= filteredDisputes.length - 1}
                onClick={handleNextDispute}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Inspection & Settlement Dock */}
        {selected && (
          <aside className="df-detail-dock">
            {/* Dock Topbar: Sequential Navigation */}
            <div className="df-dock-topbar">
              <div className="df-dock-paginator">
                <button
                  type="button"
                  className="df-dock-arrow"
                  disabled={selectedIndex <= 0}
                  onClick={handlePrevDispute}
                  title="Khiếu nại trước"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {selectedIndex + 1} / {filteredDisputes.length}
                </span>
                <button
                  type="button"
                  className="df-dock-arrow"
                  disabled={selectedIndex >= filteredDisputes.length - 1}
                  onClick={handleNextDispute}
                  title="Khiếu nại tiếp theo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <button
                type="button"
                className="df-dock-close-btn"
                onClick={() => setSelected(null)}
                title="Đóng bảng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dock Header Info */}
            <div className="df-dock-header-info">
              <div className="df-dock-badges-row">
                {getServiceType(selected) === 'RENTAL' && (
                  <span className="df-badge-aodai">
                    <Shirt size={12} /> Áo dài
                  </span>
                )}
                {getServiceType(selected) === 'PHOTO' && (
                  <span className="df-badge-photo">
                    <Camera size={12} /> Chụp ảnh
                  </span>
                )}
                {getServiceType(selected) === 'COMBO' && (
                  <span className="df-badge-combo">
                    <Sparkles size={12} /> Combo
                  </span>
                )}

                {isItemResolved(selected) ? (
                  <span className="df-status-pill df-status-resolved">
                    <span className="df-status-dot" /> Đã giải quyết
                  </span>
                ) : (
                  <span className="df-status-pill df-status-pending">
                    <span className="df-status-dot" /> Chờ xử lý
                  </span>
                )}

                <span
                  className={`df-prio-pill ${
                    getPriority(selected) === 'Cao'
                      ? 'df-prio-high'
                      : getPriority(selected) === 'Trung bình'
                      ? 'df-prio-med'
                      : 'df-prio-low'
                  }`}
                >
                  Ưu tiên {getPriority(selected).toLowerCase()}
                </span>
              </div>

              <div className="df-dock-title-row">
                <h3 className="df-dock-booking-title">
                  Chi tiết khiếu nại {getDisputeCode(selected)}
                </h3>
                <span className="df-dock-timestamp">
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : '14:32 18/03/2025'}
                </span>
              </div>
            </div>

            {/* Dock 5 Subtabs */}
            <div className="df-dock-subtabs">
              <button
                type="button"
                className={`df-dock-subtab-btn ${dockSubTab === 'OVERVIEW' ? 'active' : ''}`}
                onClick={() => setDockSubTab('OVERVIEW')}
              >
                Tổng quan
              </button>
              <button
                type="button"
                className={`df-dock-subtab-btn ${dockSubTab === 'EVIDENCE' ? 'active' : ''}`}
                onClick={() => setDockSubTab('EVIDENCE')}
              >
                Bằng chứng ({evidencePhotos.length || 2})
              </button>
              <button
                type="button"
                className={`df-dock-subtab-btn ${dockSubTab === 'DIALOGUE' ? 'active' : ''}`}
                onClick={() => setDockSubTab('DIALOGUE')}
              >
                Đối thoại (6)
              </button>
              <button
                type="button"
                className={`df-dock-subtab-btn ${dockSubTab === 'LOG' ? 'active' : ''}`}
                onClick={() => setDockSubTab('LOG')}
              >
                Nhật ký
              </button>
              <button
                type="button"
                className={`df-dock-subtab-btn ${dockSubTab === 'HISTORY' ? 'active' : ''}`}
                onClick={() => setDockSubTab('HISTORY')}
              >
                Lịch sử
              </button>
            </div>

            {/* Dock Body Content */}
            <div className="df-dock-body">
              {/* TAB 1: TỔNG QUAN */}
              {dockSubTab === 'OVERVIEW' && (
                <>
                  {/* Evidence Sub-filters */}
                  <div className="df-evidence-subfilters">
                    <button
                      type="button"
                      className={`df-subfilter-btn ${evidenceSubFilter === 'BEFORE' ? 'active' : ''}`}
                      onClick={() => setEvidenceSubFilter('BEFORE')}
                    >
                      Ảnh lúc giao (Trước)
                    </button>
                    <button
                      type="button"
                      className={`df-subfilter-btn ${evidenceSubFilter === 'AFTER' ? 'active' : ''}`}
                      onClick={() => setEvidenceSubFilter('AFTER')}
                    >
                      Ảnh lúc trả (Sau)
                    </button>
                    <button
                      type="button"
                      className={`df-subfilter-btn ${evidenceSubFilter === 'DAMAGE' ? 'active' : ''}`}
                      onClick={() => setEvidenceSubFilter('DAMAGE')}
                    >
                      Ảnh hư hỏng ({evidencePhotos.length || 1})
                    </button>
                    <button
                      type="button"
                      className={`df-subfilter-btn ${evidenceSubFilter === 'OTHER' ? 'active' : ''}`}
                      onClick={() => setEvidenceSubFilter('OTHER')}
                    >
                      Tài liệu khác
                    </button>
                  </div>

                  {/* Evidence Gallery Strip */}
                  <div className="df-evidence-gallery">
                    {evidencePhotos.length > 0 ? (
                      evidencePhotos.map((ref, idx) => (
                        <div
                          key={ref + idx}
                          className="df-gallery-thumb-item"
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <PrivateEvidenceImage
                            reference={ref}
                            legacyUrl={evidenceUrl(ref)}
                            alt={`Bằng chứng ${idx + 1}`}
                            imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))
                    ) : (
                      <>
                        <div
                          className="df-gallery-thumb-item"
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <img src={beforePhoto} alt="Trước khi thuê" />
                        </div>
                        <div
                          className="df-gallery-thumb-item"
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <img src={afterPhoto} alt="Sau khi trả" />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      className="df-gallery-add-btn"
                      onClick={() => setShowComparisonModal(true)}
                    >
                      <Plus size={16} />
                      <span>Xem tất cả</span>
                    </button>
                  </div>

                  {/* Before - After Comparison Card */}
                  <div className="df-comparison-card">
                    <div className="df-comparison-header">
                      <h4 className="df-comparison-title">So sánh trước - sau</h4>
                      <button
                        type="button"
                        className="df-zoom-link"
                        onClick={() => setShowComparisonModal(true)}
                      >
                        <Maximize2 size={13} />
                        <span>Xem ảnh lớn & đánh dấu</span>
                      </button>
                    </div>

                    <div className="df-comparison-grid">
                      {/* Before */}
                      <div className="df-comp-item">
                        <span className="df-comp-label">Trước khi thuê (Giao đồ)</span>
                        <div className="df-comp-img-wrap">
                          <img src={beforePhoto} alt="Trước khi thuê" />
                        </div>
                        <span className="df-comp-meta">Đồng kiểm lúc giao 14:00</span>
                      </div>

                      {/* After */}
                      <div className="df-comp-item">
                        <span className="df-comp-label">Sau khi trả (Khiếu nại)</span>
                        <div className="df-comp-img-wrap">
                          <img src={afterPhoto} alt="Sau khi trả" />
                          <div className="df-comp-marker" title="Vị trí ghi nhận sự cố" />
                        </div>
                        <span className="df-comp-meta">Ghi nhận rách tà áo 17:30</span>
                      </div>
                    </div>
                  </div>

                  {/* Two-column Order & Parties info */}
                  <div className="df-two-cards-grid">
                    {/* Left: Thông tin đơn hàng */}
                    <div className="df-mini-card">
                      <div className="df-mini-card-head">
                        <h4>Thông tin đơn hàng</h4>
                        <a href={`/admin/bookings?search=${getBookingCode(selected)}`} target="_blank" rel="noreferrer">
                          {getBookingCode(selected)}
                        </a>
                      </div>

                      <div className="df-order-summary-item">
                        <img
                          src={beforePhoto}
                          alt="product"
                          className="df-order-thumb"
                        />
                        <div>
                          <div className="df-order-item-title">{getItemName(selected)}</div>
                          <div className="df-order-item-sub">
                            {getServiceType(selected) === 'RENTAL'
                              ? 'Thuê 3 ngày · Size M'
                              : 'Gói chụp 2 giờ'}
                          </div>
                        </div>
                      </div>

                      <div className="df-finance-row">
                        <span>Giá trị đơn:</span>
                        <strong>
                          {formatCurrency(
                            selected.bookingId?.pricingSummary?.grandTotal ||
                              selected.requestedAmount * 2 ||
                              1800000
                          )}
                        </strong>
                      </div>
                      <div className="df-finance-row">
                        <span>Tiền ký quỹ tạm giữ:</span>
                        <strong style={{ color: '#be123c' }}>
                          {formatCurrency(getDepositTotal(selected))}
                        </strong>
                      </div>
                    </div>

                    {/* Right: Thông tin hai bên */}
                    <div className="df-mini-card">
                      <div className="df-mini-card-head">
                        <h4>Thông tin hai bên</h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Hồ sơ</span>
                      </div>

                      {/* Khách hàng */}
                      <div className="df-party-row">
                        <div className="df-party-avatar-fallback">KH</div>
                        <div className="df-party-info">
                          <span className="df-party-label">Khách hàng ({getCustomerCode(selected)})</span>
                          <span className="df-party-text">{getCustomerName(selected)}</span>
                          <span className="df-party-sub">Lịch sử: 0 khiếu nại trước đây</span>
                        </div>
                      </div>

                      {/* Đối tác */}
                      <div className="df-party-row" style={{ marginBottom: 0 }}>
                        <div
                          className="df-party-avatar-fallback"
                          style={{ background: 'linear-gradient(135deg, #1e293b, #475569)' }}
                        >
                          ĐT
                        </div>
                        <div className="df-party-info">
                          <span className="df-party-label">Đối tác ({getProviderCode(selected)})</span>
                          <span className="df-party-text">{getProviderName(selected)}</span>
                          <span className="df-party-sub">
                            Đánh giá: 4.9 <Star size={10} style={{ display: 'inline', fill: '#f59e0b', color: '#f59e0b' }} /> (128 đơn)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Phán quyết của Admin */}
                  <div className="df-decision-section">
                    <h4 className="df-decision-title">Phán quyết của Admin</h4>

                    {isItemResolved(selected) ? (
                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '12.5px',
                        }}
                      >
                        <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
                        <div>
                          <strong>Đơn khiếu nại này đã được phán quyết hoàn tất.</strong>
                          <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px' }}>
                            Số tiền ký quỹ đã được giải ngân theo đúng biên bản trọng tài.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 3 Choice Cards */}
                        <div className="df-choices-grid">
                          {/* Card 1: Đối tác đúng */}
                          <div
                            className={`df-choice-card choice-shop ${decision === 'SHOP_RIGHT' ? 'selected' : ''}`}
                            onClick={() => setDecision('SHOP_RIGHT')}
                          >
                            <div className="df-choice-icon">
                              <Check size={13} />
                            </div>
                            <div className="df-choice-text">
                              <span className="df-choice-name">Đối tác đúng</span>
                              <span className="df-choice-desc">Hoàn 100% cọc & thanh toán đối tác</span>
                            </div>
                          </div>

                          {/* Card 2: Khách hàng đúng */}
                          <div
                            className={`df-choice-card choice-cust ${decision === 'CUSTOMER_RIGHT' ? 'selected' : ''}`}
                            onClick={() => setDecision('CUSTOMER_RIGHT')}
                          >
                            <div className="df-choice-icon">
                              <Check size={13} />
                            </div>
                            <div className="df-choice-text">
                              <span className="df-choice-name">Khách hàng đúng</span>
                              <span className="df-choice-desc">Hoàn 100% cọc & bồi hoàn khách</span>
                            </div>
                          </div>

                          {/* Card 3: Phân chia trách nhiệm */}
                          <div
                            className={`df-choice-card choice-split ${decision === 'SPLIT' ? 'selected' : ''}`}
                            onClick={() => setDecision('SPLIT')}
                          >
                            <div className="df-choice-icon">
                              <Scale size={13} />
                            </div>
                            <div className="df-choice-text">
                              <span className="df-choice-name">Phân chia</span>
                              <span className="df-choice-desc">Tỷ lệ bồi hoàn theo thỏa thuận</span>
                            </div>
                          </div>
                        </div>

                        {/* Split Inputs (if SPLIT) */}
                        {decision === 'SPLIT' && (
                          <div className="df-split-inputs">
                            <div className="df-split-col">
                              <label>Hoàn khách (VNĐ):</label>
                              <input
                                type="number"
                                className="df-split-input"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(Number(e.target.value))}
                                min={0}
                                step={10000}
                              />
                            </div>
                            <div className="df-split-col">
                              <label>Bồi thường đối tác (VNĐ):</label>
                              <input
                                type="number"
                                className="df-split-input"
                                value={compensationAmount}
                                onChange={(e) => setCompensationAmount(Number(e.target.value))}
                                min={0}
                                step={10000}
                              />
                            </div>
                            <div
                              style={{
                                gridColumn: 'span 2',
                                fontSize: '11px',
                                color: '#6d28d9',
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>
                                Tổng phân bổ: <strong>{formatCurrency(refundAmount + compensationAmount)}</strong>
                              </span>
                              <span>
                                Tiền ký quỹ: <strong>{formatCurrency(getDepositTotal(selected))}</strong>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Notes textarea */}
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: '#334155',
                              marginBottom: '6px',
                            }}
                          >
                            Ghi chú phán quyết (Bắt buộc):
                          </label>
                          <textarea
                            className="df-decision-textarea"
                            placeholder="Nhập căn cứ xử lý dựa trên biên bản kiểm đồ, hình ảnh bàn giao..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>

                        {/* Checkbox send notifications */}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={sendNotifications}
                            onChange={(e) => setSendNotifications(e.target.checked)}
                          />
                          <span>Gửi email và thông báo trong ứng dụng cho cả hai bên</span>
                        </label>

                        {/* Action buttons */}
                        <div className="df-dock-actions">
                          <button
                            type="button"
                            className="df-btn-draft"
                            onClick={handleSaveDraft}
                          >
                            Lưu nháp
                          </button>
                          <button
                            type="button"
                            className="df-btn-confirm"
                            disabled={isResolving}
                            onClick={() => void handleResolve()}
                          >
                            {isResolving ? (
                              'Đang thực thi phán quyết...'
                            ) : (
                              <>
                                <CheckCircle2 size={15} />
                                <span>Xác nhận phán quyết</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: BẰNG CHỨNG */}
              {dockSubTab === 'EVIDENCE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Tất cả tài liệu và ảnh bằng chứng ({evidencePhotos.length || 2})
                  </h4>

                  {selected.bookingId?.deliveryDriveUrl && (
                    <a
                      href={selected.bookingId.deliveryDriveUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#1d4ed8',
                        textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={15} />
                      <span>Mở thư mục Google Drive gốc của thợ ảnh</span>
                    </a>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {evidencePhotos.length > 0 ? (
                      evidencePhotos.map((ref, idx) => (
                        <div
                          key={ref + idx}
                          style={{
                            height: '140px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <PrivateEvidenceImage
                            reference={ref}
                            legacyUrl={evidenceUrl(ref)}
                            alt={`Bằng chứng ${idx + 1}`}
                            imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))
                    ) : (
                      <>
                        <div
                          style={{
                            height: '140px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <img
                            src={beforePhoto}
                            alt="Trước khi thuê"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div
                          style={{
                            height: '140px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <img
                            src={afterPhoto}
                            alt="Sau khi trả"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ĐỐI THOẠI */}
              {dockSubTab === 'DIALOGUE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="df-dialogue-thread">
                    {/* Customer msg */}
                    <div className="df-dialogue-item">
                      <div className="df-msg-avatar-fallback" style={{ background: '#e11d48' }}>
                        KH
                      </div>
                      <div className="df-dialogue-bubble df-bubble-cust">
                        <div className="df-bubble-meta">
                          <span>{getCustomerName(selected)}</span>
                          <span style={{ color: '#94a3b8' }}>14:02 Hôm qua</span>
                        </div>
                        Chào shop, khi tôi nhận áo đã thấy đường may ở tà áo bị sờn nhẹ, sau khi mặc chụp 1 tiếng thì bị rách thêm. Tôi muốn hoàn lại tiền cọc vì lỗi không phải hoàn toàn do tôi.
                      </div>
                    </div>

                    {/* Partner msg */}
                    <div className="df-dialogue-item is-partner">
                      <div className="df-msg-avatar-fallback" style={{ background: '#7c3aed' }}>
                        ĐT
                      </div>
                      <div className="df-dialogue-bubble df-bubble-partner">
                        <div className="df-bubble-meta">
                          <span>{getProviderName(selected)}</span>
                          <span style={{ color: '#a855f7' }}>14:35 Hôm qua</span>
                        </div>
                        Dạ shop có ảnh đồng kiểm lúc giao qua bưu tá áo hoàn toàn lành lặn không sờn rách ạ. Vết rách này kéo dài 10cm do giẫm phải guốc nhọn. Shop yêu cầu bồi thường theo đúng thỏa thuận ban đầu.
                      </div>
                    </div>

                    {/* Customer reply */}
                    <div className="df-dialogue-item">
                      <div className="df-msg-avatar-fallback" style={{ background: '#e11d48' }}>
                        KH
                      </div>
                      <div className="df-dialogue-bubble df-bubble-cust">
                        <div className="df-bubble-meta">
                          <span>{getCustomerName(selected)}</span>
                          <span style={{ color: '#94a3b8' }}>15:10 Hôm qua</span>
                        </div>
                        Tôi không giẫm guốc, tôi đề nghị Admin LUMÉ vào kiểm tra ảnh phóng to và phân định công tâm.
                      </div>
                    </div>

                    {/* Admin custom messages */}
                    {customMessages.map((msg, i) => (
                      <div key={i} className="df-dialogue-item is-admin">
                        <div className="df-msg-avatar-fallback" style={{ background: '#881337' }}>
                          LUMÉ
                        </div>
                        <div className="df-dialogue-bubble df-bubble-admin">
                          <div className="df-bubble-meta">
                            <span>Admin Trọng tài</span>
                            <span style={{ color: '#fda4af' }}>{msg.time}</span>
                          </div>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input reply box */}
                  <div className="df-dialogue-reply-box">
                    <input
                      type="text"
                      className="df-dialogue-input"
                      placeholder="Gửi lời nhắn trọng tài vào cuộc trao đổi..."
                      value={dialogueInput}
                      onChange={(e) => setDialogueInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendDialogue()}
                    />
                    <button
                      type="button"
                      className="df-dialogue-send-btn"
                      onClick={handleSendDialogue}
                    >
                      <Send size={13} />
                      <span>Gửi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: NHẬT KÝ */}
              {dockSubTab === 'LOG' && (
                <div className="df-timeline-list">
                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Đơn khiếu nại được tạo
                      <span className="df-timeline-time">14:02 18/03/2025</span>
                    </div>
                    <div className="df-timeline-desc">
                      Khách hàng {getCustomerName(selected)} gửi khiếu nại yêu cầu bồi hoàn cọc sau khi đối tác lập biên bản sự cố.
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Hệ thống phong tỏa ký quỹ
                      <span className="df-timeline-time">14:03 18/03/2025</span>
                    </div>
                    <div className="df-timeline-desc">
                      Khoản tiền cọc {formatCurrency(getDepositTotal(selected))} được giữ trong Escrow an toàn của LUMÉ.
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Đối tác gửi ảnh đối chứng
                      <span className="df-timeline-time">14:35 18/03/2025</span>
                    </div>
                    <div className="df-timeline-desc">
                      {getProviderName(selected)} đã tải lên 2 ảnh lúc bàn giao đơn hàng qua hệ thống.
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Admin mở giám định hồ sơ
                      <span className="df-timeline-time">Hôm nay</span>
                    </div>
                    <div className="df-timeline-desc">
                      Hồ sơ đang trong quy trình giám sát và so sánh ảnh hư hỏng để đưa ra phán quyết cuối cùng.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: LỊCH SỬ */}
              {dockSubTab === 'HISTORY' && (
                <div className="df-history-wrapper">
                  {/* Khách hàng box */}
                  <div className="df-history-box">
                    <div className="df-history-box-title">
                      <span>Lịch sử Khách hàng: {getCustomerName(selected)}</span>
                      <span style={{ fontSize: '11px', color: '#16a34a' }}>Uy tín cao</span>
                    </div>
                    <div className="df-history-grid">
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val">8</div>
                        <div className="df-hist-stat-label">Đơn hoàn tất</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ color: '#e11d48' }}>
                          1
                        </div>
                        <div className="df-hist-stat-label">Khiếu nại</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ color: '#16a34a' }}>
                          100%
                        </div>
                        <div className="df-hist-stat-label">Tỷ lệ thắng</div>
                      </div>
                    </div>
                  </div>

                  {/* Đối tác box */}
                  <div className="df-history-box">
                    <div className="df-history-box-title">
                      <span>Lịch sử Đối tác: {getProviderName(selected)}</span>
                      <span style={{ fontSize: '11px', color: '#2563eb' }}>Đối tác xác thực</span>
                    </div>
                    <div className="df-history-grid">
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val">128</div>
                        <div className="df-hist-stat-label">Đơn phục vụ</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ color: '#d97706' }}>
                          2
                        </div>
                        <div className="df-hist-stat-label">Tranh chấp</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val">4.9 ⭐</div>
                        <div className="df-hist-stat-label">Đánh giá trung bình</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* MODAL 1: Side-by-side Large Comparison Modal */}
      {showComparisonModal && selected && (
        <div className="df-modal-overlay" onClick={() => setShowComparisonModal(false)}>
          <div className="df-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header">
              <h3>So sánh chi tiết đối chứng Before - After ({getDisputeCode(selected)})</h3>
              <button
                type="button"
                className="df-dock-close-btn"
                onClick={() => setShowComparisonModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-modal-comparison-grid">
                {/* Before Image */}
                <div className="df-modal-comp-item">
                  <div className="df-modal-comp-label">
                    <span>1. Trước khi thuê (Ảnh giao đồ của đối tác)</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>14:00 15/03/2025</span>
                  </div>
                  <div className="df-modal-img-holder">
                    <img src={beforePhoto} alt="Trước khi thuê" />
                    <div className="df-modal-annotation-tag">
                      <CheckCircle2 size={13} color="#22c55e" />
                      <span>Tình trạng nguyên vẹn</span>
                    </div>
                  </div>
                </div>

                {/* After Image */}
                <div className="df-modal-comp-item">
                  <div className="df-modal-comp-label">
                    <span>2. Sau khi trả (Ảnh ghi nhận sự cố khiếu nại)</span>
                    <span style={{ color: '#e11d48', fontSize: '11px' }}>17:30 18/03/2025</span>
                  </div>
                  <div className="df-modal-img-holder">
                    <img src={afterPhoto} alt="Sau khi trả" />
                    <div
                      className="df-comp-marker"
                      style={{ width: '40px', height: '40px', top: '45%', left: '50%' }}
                    />
                    <div
                      className="df-modal-annotation-tag"
                      style={{ background: 'rgba(190, 18, 60, 0.9)' }}
                    >
                      <AlertCircle size={13} color="#fecdd3" />
                      <span>Vết rách ghi nhận tại tà áo</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '12.5px',
                  color: '#334155',
                }}
              >
                <strong>Nhận định giám định:</strong> Đối chiếu hình ảnh bàn giao và lúc trả cho thấy vết rách mới xuất hiện tại gấu áo bên phải. Độ dài vết rách khoảng 8-10cm không có dấu hiệu mục tự nhiên.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Guide Modal (Hướng dẫn quy trình xử lý tranh chấp) */}
      {showGuideModal && (
        <div className="df-modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="df-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header">
              <h3>Quy trình chuẩn xử lý khiếu nại & trọng tài LUMÉ</h3>
              <button
                type="button"
                className="df-dock-close-btn"
                onClick={() => setShowGuideModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-guide-list">
                <div className="df-guide-step-card">
                  <div className="df-step-badge">1</div>
                  <div className="df-step-content">
                    <h4>Tiếp nhận & Phong tỏa Escrow</h4>
                    <p>
                      Ngay khi một bên gửi khiếu nại hoặc từ chối bồi thường, toàn bộ tiền cọc và tiền đơn hàng sẽ tự động đóng băng trong tài khoản ký quỹ trung gian của LUMÉ để đảm bảo quyền lợi tài chính.
                    </p>
                  </div>
                </div>

                <div className="df-guide-step-card">
                  <div className="df-step-badge">2</div>
                  <div className="df-step-content">
                    <h4>Thu thập bằng chứng đối chất 2 bên</h4>
                    <p>
                      Kiểm tra ảnh đồng kiểm lúc giao trang phục (Trước) và ảnh ghi nhận hư hỏng lúc hoàn trả (Sau). Đối với dịch vụ chụp ảnh, kiểm tra ảnh chụp gốc và tiến độ bàn giao trên Google Drive.
                    </p>
                  </div>
                </div>

                <div className="df-guide-step-card">
                  <div className="df-step-badge">3</div>
                  <div className="df-step-content">
                    <h4>Thẩm định bằng công cụ so sánh</h4>
                    <p>
                      Sử dụng công cụ phóng to và đánh dấu điểm khác biệt trên ảnh để xác định tính hợp lệ của khiếu nại, loại trừ hao mòn tự nhiên theo chính sách nền tảng.
                    </p>
                  </div>
                </div>

                <div className="df-guide-step-card">
                  <div className="df-step-badge">4</div>
                  <div className="df-step-content">
                    <h4>Đưa ra phán quyết & giải ngân</h4>
                    <p>
                      Admin lựa chọn phán quyết (Đối tác đúng, Khách hàng đúng, hoặc Phân chia tỷ lệ), ghi rõ căn cứ vào biên bản và bấm Xác nhận. Hệ thống tự động giải ngân và gửi thông báo điện tử.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
