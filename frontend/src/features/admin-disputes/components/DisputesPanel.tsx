import { useState, useMemo, useEffect, type CSSProperties } from 'react';
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
} from 'lucide-react';
import { PrivateEvidenceImage } from '../../../components/common/PrivateEvidenceImage';
import { RentalEvidenceImage } from '../../rentals/components/RentalEvidenceImage';
import { API_BASE_URL } from '../../../config/env';
import { adminDisputesApi } from '../api/adminDisputesApi';
import { useDisputes } from '../hooks/useDisputes';
import type { Dispute, DisputeDecision, ResolvePayload } from '../types';
import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';
import { getDisputeStatusMeta, getIncidentStatusMeta } from '../../../utils/bookingStatus';
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

// New rental lifecycle uploads are UUID file IDs.  Older return requests keep
// their upload URL (or a dispute private reference) directly in the booking.
// Only UUIDs can be fetched through the rental-evidence endpoint.
const isRentalEvidenceFileId = (reference: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference);

type EvidenceSource = 'BEFORE' | 'AFTER' | 'DAMAGE' | 'OTHER';

type EvidenceEntry = {
  id: string;
  reference: string;
  source: EvidenceSource;
  label: string;
  rental?: { bookingId: string; itemId: string };
};

function EvidenceImage({ entry, alt, style }: { entry: EvidenceEntry; alt: string; style?: CSSProperties }) {
  if (entry.rental) {
    return (
      <RentalEvidenceImage
        bookingId={entry.rental.bookingId}
        itemId={entry.rental.itemId}
        fileId={entry.reference}
        alt={alt}
        asLink={false}
        style={style}
      />
    );
  }

  return (
    <PrivateEvidenceImage
      reference={entry.reference}
      legacyUrl={evidenceUrl(entry.reference)}
      alt={alt}
      imageStyle={style}
    />
  );
}

export function DisputesPanel() {
  const { error, items, loading, refresh, setError } = useDisputes();

  // Selection state
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDrawerMaximized, setIsDrawerMaximized] = useState(false);

  // Form settlement state
  const [decision, setDecision] = useState<DisputeDecision>('SHOP_RIGHT');
  const [notes, setNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  // Form errors belong to the active drawer, not the page-level data loader.
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const { calculatedCompensation, calculatedRefund } = useMemo(() => {
    if (!selected) return { calculatedCompensation: 0, calculatedRefund: 0 };
    const dep = getDepositTotal(selected);
    const claimed = Math.min(selected.requestedAmount || dep, dep);

    if (decision === 'CUSTOMER_RIGHT') {
      return { calculatedCompensation: 0, calculatedRefund: dep };
    }
    if (decision === 'SHOP_RIGHT') {
      return { calculatedCompensation: claimed, calculatedRefund: Math.max(dep - claimed, 0) };
    }
    // SPLIT
    return { calculatedCompensation: compensationAmount, calculatedRefund: refundAmount };
  }, [selected, decision, refundAmount, compensationAmount]);

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

  const getBookingCode = (d: Dispute) => d.bookingId?.bookingCode || '';

  const getItemName = (d: Dispute) =>
    d.productId?.name || d.bookingItemId?.name || '';

  const getCustomerName = (d: Dispute) =>
    d.openedBy?.profile?.fullName ||
    d.openedBy?.fullName ||
    d.bookingId?.customerId?.profile?.fullName ||
    (d.bookingId?.customerId as any)?.fullName ||
    '';

  const getCustomerCode = (d: Dispute) => {
    const rawId = (d.openedBy as any)?._id || (d.bookingId?.customerId as any)?._id || d._id;
    return `#KH-${String(rawId).slice(-4).toUpperCase()}`;
  };

  const getProviderName = (d: Dispute) =>
    d.reportedBy?.businessName ||
    d.reportedBy?.profile?.fullName ||
    d.reportedBy?.fullName ||
    '';

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
    d.status === 'RESOLVED' ||
    d.status === 'CANCELLED' ||
    d.status === 'ACCEPTED' ||
    Boolean((d as any).resolvedAt) ||
    Boolean((d as any).adminDecision);

  const isItemNegotiating = (d: Dispute) =>
    !isItemResolved(d) && (d.status === 'UNDER_REVIEW' || (d as any).isNegotiating === true);

  const isItemPending = (d: Dispute) =>
    !isItemResolved(d) && !isItemNegotiating(d);

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
    () => items.filter((i) => isItemPending(i)).length,
    [items]
  );
  const countNegotiating = useMemo(
    () => items.filter((i) => isItemNegotiating(i)).length,
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
        // Status tab
        if (statusTab === 'PENDING' && !isItemPending(item)) return false;
        if (statusTab === 'NEGOTIATING' && !isItemNegotiating(item)) return false;
        if (statusTab === 'RESOLVED' && !isItemResolved(item)) return false;

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

  // Keep selected dispute updated if list updates
  useEffect(() => {
    if (selected) {
      const current = filteredDisputes.find((d) => d._id === selected._id);
      if (current) setSelected(current);
    }
  }, [filteredDisputes]);

  // When selected dispute changes, prepare split amounts
  const handleSelectDispute = (dispute: Dispute) => {
    setSelected(dispute);
    setIsDetailOpen(true);
    setResolutionError(null);
    setNotes(dispute.adminNotes || '');
    setDecision('SHOP_RIGHT');
    const deposit = getDepositTotal(dispute);
    const half = Math.round(deposit / 2);
    setRefundAmount(half);
    setCompensationAmount(deposit - half);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelected(null);
    setResolutionError(null);
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

  // Submit Resolution
  const handleResolve = async () => {
    if (!selected) return;
    const bookingId = typeof selected.bookingId === 'object' ? (selected.bookingId as any)?._id : selected.bookingId;
    if (!bookingId) {
      setDockSubTab('OVERVIEW');
      setResolutionError('Không xác định được đơn hàng để xử lý.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setDockSubTab('OVERVIEW');
      setResolutionError('Vui lòng nhập ghi chú phán quyết bắt buộc.');
      await Swal.fire({
        title: 'Thiếu thông tin bắt buộc',
        text: 'Vui lòng nhập ghi chú căn cứ phán quyết trước khi xác nhận.',
        icon: 'warning',
        confirmButtonColor: '#881337',
        confirmButtonText: 'Đã hiểu',
      });
      return;
    }

    const depositTotal = getDepositTotal(selected);
    const splitTotal = refundAmount + compensationAmount;
    if (decision === 'SPLIT' && splitTotal > depositTotal) {
      setDockSubTab('OVERVIEW');
      const limitMsg = `Tổng khoản hoàn và bồi thường (${formatCurrency(splitTotal)}) không được vượt quá số tiền ký quỹ (${formatCurrency(depositTotal)}).`;
      setResolutionError(limitMsg);
      await Swal.fire({
        title: 'Vượt quá hạn mức ký quỹ',
        text: limitMsg,
        icon: 'warning',
        confirmButtonColor: '#881337',
        confirmButtonText: 'Đã hiểu',
      });
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
          ? `Xác nhận ${decisionLabels[decision]}: Khấu trừ ${formatCurrency(calculatedCompensation)} bồi thường cho Đối tác, hoàn lại ${formatCurrency(calculatedRefund)} tiền cọc cho Khách hàng.`
          : `Xác nhận ${decisionLabels[decision]}: Hoàn trả 100% cọc (${formatCurrency(calculatedRefund)}) cho Khách hàng, bác bỏ yêu cầu bồi thường.`;

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
    setResolutionError(null);
    try {
      await adminDisputesApi.resolve(bookingId, payload);
      await refresh();
      handleCloseDetail();
      await Swal.fire({
        title: 'Phán quyết thành công!',
        text: 'Hệ thống đã giải ngân ký quỹ và gửi thông báo tới các bên liên quan.',
        icon: 'success',
        confirmButtonColor: '#059669',
      });
    } catch (err: any) {
      setDockSubTab('OVERVIEW');
      const errMsg = err?.message || 'Không thể xử lý tranh chấp.';
      setResolutionError(errMsg);
      await Swal.fire({
        title: 'Thao tác không thành công',
        text: errMsg,
        icon: 'error',
        confirmButtonColor: '#be123c',
      });
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
  const evidenceEntries = useMemo<EvidenceEntry[]>(() => {
    if (!selected) return [];
    const booking = selected.bookingId as any;
    const item = typeof selected.bookingItemId === 'object' ? selected.bookingItemId as any : null;
    const bookingId = booking?._id?.toString?.() || booking?._id || '';
    const itemId = item?._id?.toString?.() || item?._id || '';
    const entries: EvidenceEntry[] = [];
    const seen = new Set<string>();
    const add = (reference: unknown, source: EvidenceSource, label: string, rental = false) => {
      if (typeof reference !== 'string' || !reference.trim()) return;
      const key = `${rental ? 'rental' : 'direct'}:${reference}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        id: key,
        reference,
        source,
        label,
        rental: rental && bookingId && itemId ? { bookingId, itemId } : undefined,
      });
    };

    const fulfillment = item?.rentalFulfillment;
    fulfillment?.pickupEvidence?.files?.forEach((file: any) =>
      add(file?.fileId, 'BEFORE', 'Shop bàn giao', true),
    );
    fulfillment?.customerReturnEvidence?.files?.forEach((fileId: string) =>
      add(fileId, 'AFTER', 'Khách trả đồ', isRentalEvidenceFileId(fileId)),
    );
    fulfillment?.returnEvidence?.files?.forEach((file: any) =>
      add(file?.fileId, 'AFTER', 'Shop nhận lại', true),
    );

    [...(booking?.deliveredPhotos || []), ...(booking?.handoverPhotos || [])].forEach((ref: string) =>
      add(ref, 'BEFORE', 'Ảnh bàn giao'),
    );
    (selected.evidencePhotos || []).forEach((ref) =>
      add(ref, 'DAMAGE', 'Bằng chứng phía Shop'),
    );
    (selected.customerEvidencePhotos || []).forEach((ref) =>
      add(ref, 'DAMAGE', 'Bằng chứng phía Khách'),
    );
    (booking?.disputeEvidencePhotos || booking?.evidencePhotos || []).forEach((ref: string) =>
      add(ref, 'DAMAGE', 'Bằng chứng khiếu nại'),
    );

    return entries;
  }, [selected]);

  const evidencePhotos = evidenceEntries.map((entry) => entry.reference);
  const filteredEvidence = evidenceEntries.filter((entry) => entry.source === evidenceSubFilter);
  const beforeEvidence = evidenceEntries.find((entry) => entry.source === 'BEFORE');
  const afterEvidence = evidenceEntries.find((entry) => entry.source === 'AFTER')
    || evidenceEntries.find((entry) => entry.source === 'DAMAGE');

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
            Hệ thống tiếp nhận, đối soát và đưa ra phán quyết công bằng giữa Khách hàng và Đối tác TàGo.
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
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            title="Đóng thông báo"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#be123c',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 6. Workspace Layout: Table */}
      <div className="df-workspace">
        {/* Left: Disputes Table */}
        <div className="df-table-container">
          <table className="df-table">
            <thead>
              <tr>
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

                      {/* Mã khiếu nại + Thumbnail */}
                      <td>
                        <div className="df-cell-code">
                          <div className="df-booking-thumb" style={{ backgroundColor: '#F3EFE8' }} aria-hidden="true" />
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
                            <span className="df-status-dot" />{' '}
                            {item.status === 'CANCELLED'
                              ? getDisputeStatusMeta('CANCELLED').label
                              : item.status === 'ACCEPTED'
                                ? getIncidentStatusMeta('ACCEPTED').label
                                : getDisputeStatusMeta('RESOLVED').label}
                          </span>
                        ) : negotiating ? (
                          <span className="df-status-pill df-status-disputed">
                            <span className="df-status-dot" /> {getDisputeStatusMeta('UNDER_REVIEW').label}
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
                          className={`df-prio-pill ${priority === 'Cao'
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
      </div>

      {/* 7. Slide-over Detail Modal / Inspection Drawer (matching Product Moderation style) */}
      {isDetailOpen && selected && (
        <>
          <div className="df-drawer-backdrop" onClick={handleCloseDetail} />
          <aside className={`df-detail-drawer ${isDrawerMaximized ? 'maximized' : ''}`}>
            {/* Drawer Header */}
            <div className="df-drawer-header">
              <div className="df-drawer-title-wrap">
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
                      <span className="df-status-dot" />{' '}
                      {selected.status === 'CANCELLED'
                        ? getDisputeStatusMeta('CANCELLED').label
                        : selected.status === 'ACCEPTED'
                          ? getIncidentStatusMeta('ACCEPTED').label
                          : getDisputeStatusMeta('RESOLVED').label}
                    </span>
                  ) : isItemNegotiating(selected) ? (
                    <span className="df-status-pill df-status-disputed">
                      <span className="df-status-dot" /> {getDisputeStatusMeta('UNDER_REVIEW').label}
                    </span>
                  ) : (
                    <span className="df-status-pill df-status-pending">
                      <span className="df-status-dot" /> Chờ xử lý
                    </span>
                  )}

                  <span
                    className={`df-prio-pill ${getPriority(selected) === 'Cao'
                      ? 'df-prio-high'
                      : getPriority(selected) === 'Trung bình'
                        ? 'df-prio-med'
                        : 'df-prio-low'
                      }`}
                  >
                    Ưu tiên {getPriority(selected).toLowerCase()}
                  </span>
                </div>

                <div className="df-drawer-heading-row">
                  <h3 className="df-drawer-title">
                    Chi tiết khiếu nại {getDisputeCode(selected)}
                  </h3>
                  <span className="df-drawer-timestamp">
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

              {/* Navigation Controls, Maximize & Close */}
              <div className="df-drawer-controls">
                <div className="df-dock-paginator">
                  <button
                    type="button"
                    className="df-dock-arrow"
                    disabled={selectedIndex <= 0}
                    onClick={handlePrevDispute}
                    title="Khiếu nại trước"
                  >
                    <ChevronLeft size={14} /> Trước
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    {selectedIndex + 1} / {filteredDisputes.length}
                  </span>
                  <button
                    type="button"
                    className="df-dock-arrow"
                    disabled={selectedIndex >= filteredDisputes.length - 1}
                    onClick={handleNextDispute}
                    title="Khiếu nại tiếp theo"
                  >
                    Tiếp <ChevronRight size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="df-drawer-icon-btn"
                  onClick={() => setIsDrawerMaximized(!isDrawerMaximized)}
                  title={isDrawerMaximized ? 'Thu nhỏ' : 'Phóng to'}
                >
                  <Maximize2 size={16} />
                </button>

                <button
                  type="button"
                  className="df-drawer-icon-btn"
                  onClick={handleCloseDetail}
                  title="Đóng bảng chi tiết"
                >
                  <X size={18} />
                </button>
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
            <div className="df-drawer-body">
              {/* TAB 1: TỔNG QUAN */}
              {dockSubTab === 'OVERVIEW' && (
                <div className="df-drawer-grid-2col">
                  {/* CỘT TRÁI: Chứng cứ & Thông tin đơn hàng & Đối ứng */}
                  <div className="df-drawer-col">
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
                      Ảnh hư hỏng ({evidenceEntries.filter((entry) => entry.source === 'DAMAGE').length})
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
                    {filteredEvidence.length > 0 ? (
                      filteredEvidence.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="df-gallery-thumb-item"
                          onClick={() => setShowComparisonModal(true)}
                          title={entry.label}
                        >
                          <EvidenceImage entry={entry} alt={`${entry.label} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))
                    ) : (
                      <span className="df-empty-state">Chưa có ảnh thuộc nhóm này</span>
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
                          {beforeEvidence ? <EvidenceImage entry={beforeEvidence} alt="Trước khi thuê" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>Chưa có ảnh bàn giao</span>}
                        </div>
                        <span className="df-comp-meta">
                          {selected.bookingId?.rentalStartDate
                            ? `Bàn giao theo lịch: ${new Date(selected.bookingId.rentalStartDate).toLocaleDateString('vi-VN')}`
                            : 'Đồng kiểm lúc giao'}
                        </span>
                      </div>

                      {/* After */}
                      <div className="df-comp-item">
                        <span className="df-comp-label">Sau khi trả (Khiếu nại)</span>
                        <div className="df-comp-img-wrap">
                          {afterEvidence ? <EvidenceImage entry={afterEvidence} alt="Sau khi trả" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>Chưa có ảnh trả đồ / sự cố</span>}
                          {afterEvidence?.source === 'DAMAGE' && <div className="df-comp-marker" title="Vị trí ghi nhận sự cố" />}
                        </div>
                        <span className="df-comp-meta">
                          {selected.description ? `Sự cố: ${selected.description}` : 'Ghi nhận hư hại lúc nhận lại đồ'}
                        </span>
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
                        {beforeEvidence ? (
                          <EvidenceImage entry={beforeEvidence} alt="Ảnh sản phẩm bàn giao" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                        ) : (
                          <div className="df-order-thumb" aria-label="Chưa có ảnh sản phẩm" />
                        )}
                        <div>
                          <div className="df-order-item-title">{getItemName(selected)}</div>
                          <div className="df-order-item-sub">
                            {getServiceType(selected) === 'RENTAL' ? (
                              <span>
                                {selected.bookingItemId?.size ? `Size: ${selected.bookingItemId.size}` : 'Tiêu chuẩn'}
                                {selected.bookingItemId?.color ? ` · Màu: ${selected.bookingItemId.color}` : ''}
                                {selected.bookingId?.rentalStartDate && selected.bookingId?.rentalEndDate ? (
                                  ` · ${Math.max(1, Math.round((new Date(selected.bookingId.rentalEndDate).getTime() - new Date(selected.bookingId.rentalStartDate).getTime()) / (1000 * 60 * 60 * 24)))} ngày`
                                ) : ' · Thuê trang phục'}
                              </span>
                            ) : (
                              'Gói dịch vụ chụp ảnh'
                            )}
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
                          <span className="df-party-sub">
                            {selected.openedBy?.phone || selected.bookingId?.customerId?.phone || selected.bookingId?.customerId?.phoneNumber || 'Tài khoản khách hàng'}
                          </span>
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
                            {selected.reportedBy?.phone || 'Đối tác cung cấp dịch vụ'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CỘT PHẢI: Ký quỹ Escrow & Quyết định Admin */}
                <div className="df-drawer-col">
                    {/* Ribbon ký quỹ nổi bật */}
                    <div className="df-escrow-ribbon">
                      <div className="df-escrow-ribbon-left">
                        <div className="df-escrow-ribbon-icon">
                          <Scale size={20} />
                        </div>
                        <div>
                          <div className="df-escrow-ribbon-label">Tiền ký quỹ Escrow bảo đảm</div>
                          <div className="df-escrow-ribbon-amount">
                            {formatCurrency(getDepositTotal(selected))}
                          </div>
                        </div>
                      </div>
                      <div className="df-escrow-ribbon-badge">
                        <ShieldAlert size={14} />
                        <span>Đang tạm giữ an toàn</span>
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
                          alignItems: 'flex-start',
                          gap: '10px',
                          fontSize: '12.5px',
                        }}
                      >
                        <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Đơn khiếu nại này đã được phán quyết hoàn tất.</strong>
                          <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '4px' }}>
                            Số tiền ký quỹ đã được giải ngân theo đúng biên bản trọng tài.
                          </div>
                          {selected.adminNotes && (
                            <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #d1fae5', color: '#064e3b' }}>
                              <strong>Ghi chú phán quyết:</strong> {selected.adminNotes}
                            </div>
                          )}
                          {selected.resolvedAt && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#059669' }}>
                              Thời gian: {new Date(selected.resolvedAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                          )}
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
                              <span className="df-choice-desc">Bồi thường Shop theo thiệt hại, hoàn cọc thừa (nếu có)</span>
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
                              <span className="df-choice-desc">Bác bỏ đền bù, hoàn 100% cọc cho Khách hàng</span>
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

                        {/* Financial Preview Box */}
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12.5px',
                            marginTop: '2px',
                          }}
                        >
                          <div>
                            <span style={{ color: '#64748b' }}>Bồi thường Shop: </span>
                            <strong style={{ color: '#b91c1c' }}>{formatCurrency(calculatedCompensation)}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Hoàn cọc Khách: </span>
                            <strong style={{ color: '#047857' }}>{formatCurrency(calculatedRefund)}</strong>
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
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setRefundAmount(val);
                                  setCompensationAmount(Math.max(0, getDepositTotal(selected) - val));
                                }}
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
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setCompensationAmount(val);
                                  setRefundAmount(Math.max(0, getDepositTotal(selected) - val));
                                }}
                                min={0}
                                step={10000}
                              />
                            </div>
                            <div
                              style={{
                                gridColumn: 'span 2',
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <button
                                type="button"
                                className="df-subfilter-btn"
                                onClick={() => {
                                  const dep = getDepositTotal(selected);
                                  const half = Math.round(dep / 2);
                                  setRefundAmount(half);
                                  setCompensationAmount(dep - half);
                                }}
                              >
                                Chia 50/50
                              </button>
                              <button
                                type="button"
                                className="df-subfilter-btn"
                                onClick={() => {
                                  const dep = getDepositTotal(selected);
                                  const r = Math.round(dep * 0.7);
                                  setRefundAmount(r);
                                  setCompensationAmount(dep - r);
                                }}
                              >
                                70% Khách - 30% Shop
                              </button>
                              <button
                                type="button"
                                className="df-subfilter-btn"
                                onClick={() => {
                                  const dep = getDepositTotal(selected);
                                  const r = Math.round(dep * 0.3);
                                  setRefundAmount(r);
                                  setCompensationAmount(dep - r);
                                }}
                              >
                                30% Khách - 70% Shop
                              </button>
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
                            onChange={(e) => {
                              setNotes(e.target.value);
                              if (resolutionError) setResolutionError(null);
                            }}
                          />
                          {resolutionError && (
                            <p role="alert" style={{ margin: '7px 0 0', color: '#be123c', fontSize: '12px', fontWeight: 600 }}>
                              <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: '5px' }} />
                              {resolutionError}
                            </p>
                          )}
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

                        {/* Các thao tác được gom ở thanh cố định cuối drawer để
                            tránh hiển thị hai nút có cùng chức năng. */}
                      </>
                    )}
                  </div>
                </div>
              </div>
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
                    {evidenceEntries.length > 0 ? (
                      evidenceEntries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          style={{
                            height: '140px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowComparisonModal(true)}
                        >
                          <EvidenceImage entry={entry} alt={`${entry.label} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'relative', display: 'block', marginTop: '-26px', padding: '4px 7px', color: '#fff', background: 'rgba(15, 23, 42, .72)', fontSize: '11px', fontWeight: 700 }}>
                            {entry.label}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="df-empty-state">Chưa có ảnh bằng chứng</span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ĐỐI THOẠI */}
              {dockSubTab === 'DIALOGUE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="df-dialogue-thread">
                    {/* Shop Statement */}
                    <div className="df-dialogue-item is-partner">
                      <div className="df-msg-avatar-fallback" style={{ background: '#7c3aed' }}>
                        ĐT
                      </div>
                      <div className="df-dialogue-bubble df-bubble-partner">
                        <div className="df-bubble-meta">
                          <span>{getProviderName(selected)} (Đối tác)</span>
                          <span style={{ color: '#a855f7' }}>{formatRelativeTime(selected)}</span>
                        </div>
                        <div>
                          <strong>Báo cáo sự cố:</strong> {selected.description || 'Ghi nhận lỗi sau khi kiểm tra hiện vật trả lại.'}
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#6d28d9' }}>
                          Yêu cầu bồi thường: <strong>{formatCurrency(selected.requestedAmount)}</strong> • Phương án: <strong>{selected.actionType || 'CLEANING'}</strong>
                        </div>
                        {selected.evidencePhotos && selected.evidencePhotos.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                            Đã đính kèm {selected.evidencePhotos.length} ảnh bằng chứng hư hại.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer Statement */}
                    <div className="df-dialogue-item">
                      <div className="df-msg-avatar-fallback" style={{ background: '#e11d48' }}>
                        KH
                      </div>
                      <div className="df-dialogue-bubble df-bubble-cust">
                        <div className="df-bubble-meta">
                          <span>{getCustomerName(selected)} (Khách hàng)</span>
                          <span style={{ color: '#94a3b8' }}>{formatRelativeTime(selected)}</span>
                        </div>
                        <div>
                          <strong>Ý kiến của khách hàng:</strong>{' '}
                          {selected.customerReason || 'Khách hàng không đồng ý với yêu cầu đền bù của Shop và đề nghị Ban Quản trị TàGo phân định công tâm.'}
                        </div>
                        {selected.customerEvidencePhotos && selected.customerEvidencePhotos.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#9f1239' }}>
                            Đã đính kèm {selected.customerEvidencePhotos.length} ảnh đối chứng từ khách hàng.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Resolution if already resolved */}
                    {isItemResolved(selected) && (selected.adminNotes || (selected as any).adminDecision) && (
                      <div className="df-dialogue-item is-admin">
                        <div className="df-msg-avatar-fallback" style={{ background: '#881337' }}>
                          TàGo
                        </div>
                        <div className="df-dialogue-bubble df-bubble-admin">
                          <div className="df-bubble-meta">
                            <span>Admin Trọng tài TàGo (Phán quyết chính thức)</span>
                            <span style={{ color: '#fda4af' }}>
                              {selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleDateString('vi-VN') : 'Đã phán quyết'}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600 }}>
                            Căn cứ phán quyết: {selected.adminNotes || 'Hồ sơ đã được phán quyết và giải ngân thành công theo quy chế trọng tài.'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Admin custom messages */}
                    {customMessages.map((msg, i) => (
                      <div key={i} className="df-dialogue-item is-admin">
                        <div className="df-msg-avatar-fallback" style={{ background: '#881337' }}>
                          TàGo
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
                      placeholder="Ghi chú nội bộ hoặc lời nhắn trọng tài..."
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
                      <span>Thêm</span>
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
                      Đơn hàng được khởi tạo #{getBookingCode(selected)}
                      <span className="df-timeline-time">
                        {selected.bookingId?.createdAt
                          ? new Date(selected.bookingId.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Đã xác nhận'}
                      </span>
                    </div>
                    <div className="df-timeline-desc">
                      Khách hàng {getCustomerName(selected)} đặt thuê {getItemName(selected)} với giá trị {formatCurrency(selected.bookingId?.pricingSummary?.grandTotal || 0)}.
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Ký quỹ Escrow bảo đảm
                      <span className="df-timeline-time">Tự động phong tỏa</span>
                    </div>
                    <div className="df-timeline-desc">
                      Khoản tiền cọc {formatCurrency(getDepositTotal(selected))} được giữ an toàn tại ví ký quỹ trung gian của nền tảng.
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Shop báo cáo sự cố & lập biên bản
                      <span className="df-timeline-time">
                        {selected.createdAt
                          ? new Date(selected.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Ghi nhận sau trả đồ'}
                      </span>
                    </div>
                    <div className="df-timeline-desc">
                      {getProviderName(selected)} lập yêu cầu bồi thường {formatCurrency(selected.requestedAmount)}: "{selected.description || 'Sự cố phát sinh'}".
                    </div>
                  </div>

                  <div className="df-timeline-item">
                    <div className="df-timeline-dot" />
                    <div className="df-timeline-title">
                      Chuyển trạng thái sang Trọng tài giải quyết
                      <span className="df-timeline-time">Đang đối soát</span>
                    </div>
                    <div className="df-timeline-desc">
                      {selected.customerReason
                        ? `Khách hàng phản hồi: "${selected.customerReason}"`
                        : 'Khách hàng không chấp nhận phương án và yêu cầu Admin phân định.'}
                    </div>
                  </div>

                  {isItemResolved(selected) && (
                    <div className="df-timeline-item">
                      <div className="df-timeline-dot" style={{ background: '#059669', borderColor: '#a7f3d0' }} />
                      <div className="df-timeline-title" style={{ color: '#065f46' }}>
                        Phán quyết hoàn tất
                        <span className="df-timeline-time">
                          {selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleDateString('vi-VN') : 'Đã giải quyết'}
                        </span>
                      </div>
                      <div className="df-timeline-desc">
                        Căn cứ: {selected.adminNotes || 'Đã tất toán và giải ngân khoản ký quỹ theo phán quyết trọng tài.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: LỊCH SỬ */}
              {dockSubTab === 'HISTORY' && (
                <div className="df-history-wrapper">
                  {/* Khách hàng box */}
                  <div className="df-history-box">
                    <div className="df-history-box-title">
                      <span>Khách hàng: {getCustomerName(selected)}</span>
                      <span style={{ fontSize: '11px', color: '#16a34a' }}>Hồ sơ hợp lệ</span>
                    </div>
                    <div className="df-history-grid">
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '14px' }}>
                          {getCustomerCode(selected)}
                        </div>
                        <div className="df-hist-stat-label">Mã khách hàng</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '13px', color: '#2563eb' }}>
                          {selected.openedBy?.phone || selected.bookingId?.customerId?.phone || 'Đã xác thực'}
                        </div>
                        <div className="df-hist-stat-label">Số điện thoại</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '13px', color: '#16a34a' }}>
                          Đã thanh toán
                        </div>
                        <div className="df-hist-stat-label">Trạng thái thanh toán</div>
                      </div>
                    </div>
                  </div>

                  {/* Đối tác box */}
                  <div className="df-history-box">
                    <div className="df-history-box-title">
                      <span>Đối tác: {getProviderName(selected)}</span>
                      <span style={{ fontSize: '11px', color: '#2563eb' }}>Đối tác xác thực</span>
                    </div>
                    <div className="df-history-grid">
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '14px' }}>
                          {getProviderCode(selected)}
                        </div>
                        <div className="df-hist-stat-label">Mã đối tác</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '13px', color: '#d97706' }}>
                          {selected.actionType || 'CHO_THUE'}
                        </div>
                        <div className="df-hist-stat-label">Loại dịch vụ</div>
                      </div>
                      <div className="df-hist-stat">
                        <div className="df-hist-stat-val" style={{ fontSize: '13px', color: '#16a34a' }}>
                          Hoạt động
                        </div>
                        <div className="df-hist-stat-label">Trạng thái cửa hàng</div>
                      </div>
                    </div>
                  </div>

                  {/* Ký quỹ Escrow Box */}
                  <div className="df-history-box" style={{ gridColumn: 'span 2' }}>
                    <div className="df-history-box-title">
                      <span>Hợp đồng Ký quỹ TàGo Escrow #{getBookingCode(selected)}</span>
                      <span style={{ fontSize: '11px', color: '#059669' }}>Bảo chứng an toàn</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6', marginTop: '6px' }}>
                      Tiền cọc <strong>{formatCurrency(getDepositTotal(selected))}</strong> được phong tỏa độc lập trong Escrow. Mọi quyết định giải ngân được thực thi trực tiếp bởi Admin Trọng tài và tự động cập nhật vào ví đối tác & hoàn trả tài khoản khách hàng.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Drawer Fixed Footer */}
            <div className="df-drawer-footer">
              <div className="df-drawer-footer-left">
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Tiền ký quỹ tạm giữ:{' '}
                  <strong style={{ color: '#be123c', fontSize: '14px' }}>
                    {formatCurrency(getDepositTotal(selected))}
                  </strong>
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Phán quyết: <strong>{decisionLabels[decision]}</strong>
                </span>
              </div>

              <div className="df-drawer-footer-actions">
                <button
                  type="button"
                  className="df-btn-draft"
                  onClick={handleCloseDetail}
                >
                  Đóng
                </button>
                {!isItemResolved(selected) && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

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
                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                      {selected.bookingId?.rentalStartDate
                        ? `Lịch giao: ${new Date(selected.bookingId.rentalStartDate).toLocaleDateString('vi-VN')}`
                        : 'Lúc bàn giao'}
                    </span>
                  </div>
                  <div className="df-modal-img-holder">
                    {beforeEvidence ? <EvidenceImage entry={beforeEvidence} alt="Trước khi thuê" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>Chưa có ảnh bàn giao</span>}
                    <div className="df-modal-annotation-tag">
                      <CheckCircle2 size={13} color="#22c55e" />
                      <span>Biên bản đồng kiểm bàn giao</span>
                    </div>
                  </div>
                </div>

                {/* After Image */}
                <div className="df-modal-comp-item">
                  <div className="df-modal-comp-label">
                    <span>2. Sau khi trả (Ảnh ghi nhận sự cố khiếu nại)</span>
                    <span style={{ color: '#e11d48', fontSize: '11px' }}>
                      {selected.createdAt
                        ? new Date(selected.createdAt).toLocaleDateString('vi-VN')
                        : 'Lúc nhận lại đồ'}
                    </span>
                  </div>
                  <div className="df-modal-img-holder">
                    {afterEvidence ? <EvidenceImage entry={afterEvidence} alt="Sau khi trả" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>Chưa có ảnh trả đồ / sự cố</span>}
                    <div
                      className="df-comp-marker"
                      style={{ width: '40px', height: '40px', top: '45%', left: '50%' }}
                    />
                    <div
                      className="df-modal-annotation-tag"
                      style={{ background: 'rgba(190, 18, 60, 0.9)' }}
                    >
                      <AlertCircle size={13} color="#fecdd3" />
                      <span>{selected.description || 'Vị trí ghi nhận sự cố'}</span>
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
                <strong>Hồ sơ khiếu nại thực tế:</strong> Shop báo cáo: "{selected.description || 'Sự cố hư hại sau khi trả đồ'}" — Yêu cầu bồi thường {formatCurrency(selected.requestedAmount)}.
                {selected.customerReason && (
                  <div style={{ marginTop: '6px', color: '#b91c1c' }}>
                    <strong>Ý kiến khách hàng:</strong> "{selected.customerReason}"
                  </div>
                )}
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
              <h3>Quy trình chuẩn xử lý khiếu nại & trọng tài TàGo</h3>
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
                      Ngay khi một bên gửi khiếu nại hoặc từ chối bồi thường, toàn bộ tiền cọc và tiền đơn hàng sẽ tự động đóng băng trong tài khoản ký quỹ trung gian của TàGo để đảm bảo quyền lợi tài chính.
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
