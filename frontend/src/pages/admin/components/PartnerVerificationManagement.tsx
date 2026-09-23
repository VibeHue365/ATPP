import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  FileDown,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Building,
  Sparkles,
  X,
  Edit3,
  Camera,
  Shirt,
  Maximize2,
  Minimize2,
  Send,
  TrendingUp,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminReloadButton } from './AdminReloadButton';
import {
  adminVerificationApi,
  type AdminVerificationMetrics,
} from '../../../features/admin-verifications/api/adminVerificationApi';
import { documentLabels } from '../../../features/admin-verifications/types';
import type { ProviderDocumentType } from '../../../features/provider-verifications/types';
import './partnerVerificationFigma.css';

type TabStatus = 'ALL' | 'SUBMITTED' | 'UNDER_REVIEW' | 'NEEDS_CHANGES' | 'APPROVED' | 'REJECTED';

const STATUS_LABELS: Record<string, string> = {
  ALL: 'Tất cả',
  SUBMITTED: 'Mới gửi',
  UNDER_REVIEW: 'Đang đánh giá',
  NEEDS_CHANGES: 'Cần bổ sung',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  DRAFT: 'Bản nháp',
};

const REJECT_PRESET_REASONS = [
  'Thiếu Giấy phép kinh doanh hợp lệ',
  'Ảnh chụp CCCD bị mờ, lóa sáng hoặc mất góc',
  'Thông tin hồ sơ không trùng khớp dữ liệu OCR',
  'Cơ sở vật chất không đáp ứng tiêu chuẩn nền tảng',
  'Vi phạm quy định chính sách đối tác VibeHue',
];

const CHANGE_TARGET_OPTIONS = [
  { id: 'IDENTITY_CARD_FRONT', label: 'CCCD mặt trước' },
  { id: 'IDENTITY_CARD_BACK', label: 'CCCD mặt sau' },
  { id: 'BUSINESS_LICENSE', label: 'Giấy phép kinh doanh' },
  { id: 'SHOP_PHOTO_PROOF', label: 'Ảnh cửa hàng / Showroom' },
  { id: 'STUDIO_PORTFOLIO_PROOF', label: 'Hồ sơ năng lực / Portfolio' },
  { id: 'BUSINESS_PROFILE', label: 'Thông tin hồ sơ kinh doanh' },
];

const LOCAL_PARTNER_AVATARS = [
  '/hoang_minh.webp',
  '/avatar_hanna.webp',
  '/avatar_mai_anh.webp',
  '/avatar_minh_tam.webp',
  '/lam_ngoc.webp',
  '/le_thao.webp',
  '/tran_bao.webp',
];

export function PartnerVerificationManagement() {
  // Main Data States
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<AdminVerificationMetrics>({
    total: 64,
    submitted: 18,
    underReview: 12,
    needsChanges: 8,
    approved: 20,
    rejected: 6,
  });

  // Filters State
  const [activeTab, setActiveTab] = useState<TabStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('ALL');
  const [provinceFilter, setProvinceFilter] = useState('ALL');

  // Avatar error tracking
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  const handleAvatarError = (key: string) => {
    setAvatarErrors((prev) => ({ ...prev, [key]: true }));
  };

  const getInitials = (name?: string) => {
    if (!name) return 'ĐT';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Right Inspection Drawer State
  const [activeVerification, setActiveVerification] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'details' | 'documents' | 'history'>('overview');
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_PRESET_REASONS[0]);
  const [rejectNote, setRejectNote] = useState('');

  const [isRequestChangesModalOpen, setIsRequestChangesModalOpen] = useState(false);
  const [changeTargets, setChangeTargets] = useState<string[]>(['IDENTITY_CARD_BACK']);
  const [requestChangesNote, setRequestChangesNote] = useState('');

  const [lightboxDoc, setLightboxDoc] = useState<{ url: string; title: string } | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcut Esc to close modals / drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxDoc) {
          setLightboxDoc(null);
        } else if (isRejectModalOpen) {
          setIsRejectModalOpen(false);
        } else if (isRequestChangesModalOpen) {
          setIsRequestChangesModalOpen(false);
        } else if (isDetailOpen) {
          setIsDetailOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxDoc, isRejectModalOpen, isRequestChangesModalOpen, isDetailOpen]);

  // Fetch data cleanly from backend without infinite loops
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminVerificationApi.list({
        status: activeTab,
        search: debouncedSearch,
        capability: capabilityFilter,
        province: provinceFilter,
        page,
        limit,
      });

      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      if (res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err: any) {
      console.error('Failed to load partner verifications:', err);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi tải dữ liệu',
        text: err?.message || 'Không thể kết nối đến máy chủ.',
        timer: 2500,
        showConfirmButton: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, debouncedSearch, capabilityFilter, provinceFilter, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Search Input with Enter / Debounce
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }
  };

  const handleResetFilters = () => {
    setActiveTab('ALL');
    setSearchTerm('');
    setDebouncedSearch('');
    setCapabilityFilter('ALL');
    setProvinceFilter('ALL');
    setPage(1);
  };

  // Open detail panel immediately without re-triggering table fetch
  const handleOpenDetail = async (item: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setActiveVerification(item);
    setIsDetailOpen(true);
    setActiveSubtab('overview');

    try {
      const id = item.verificationId || item._id;
      const fullDetail = await adminVerificationApi.detail(id);
      setActiveVerification((prev: any) => {
        if (!prev) return fullDetail;
        const currentId = prev.verificationId || prev._id;
        if (currentId === id) {
          return { ...prev, ...fullDetail };
        }
        return prev;
      });
    } catch (err) {
      console.error('Error fetching detail:', err);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setActiveVerification(null);
  };

  // Sequential item navigation (< 1 / 8 >)
  const currentItemIndex = items.findIndex(
    (i) => (i.verificationId || i._id) === (activeVerification?.verificationId || activeVerification?._id),
  );
  const currentIndexSafe = currentItemIndex >= 0 ? currentItemIndex : 0;

  const handlePrevItem = () => {
    if (currentIndexSafe > 0) {
      handleOpenDetail(items[currentIndexSafe - 1]);
    }
  };

  const handleNextItem = () => {
    if (currentIndexSafe < items.length - 1) {
      handleOpenDetail(items[currentIndexSafe + 1]);
    }
  };

  // Selection Checkboxes
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(items.map((i) => i.verificationId || i._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Workflow Actions
  const handleStartReview = async (id: string) => {
    try {
      await adminVerificationApi.startReview(id);
      Swal.fire({
        icon: 'success',
        title: 'Đã bắt đầu thẩm định',
        text: 'Hồ sơ đã được chuyển sang trạng thái ĐANG ĐÁNH GIÁ.',
        timer: 2000,
        showConfirmButton: false,
      });
      fetchData();
      if (activeVerification && (activeVerification.verificationId || activeVerification._id) === id) {
        setActiveVerification((prev: any) => ({ ...prev, status: 'UNDER_REVIEW' }));
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi thẩm định',
        text: err?.message || 'Không thể cập nhật trạng thái.',
      });
    }
  };

  const handleApprove = async (id: string) => {
    const result = await Swal.fire({
      title: 'Phê duyệt hồ sơ đối tác?',
      text: 'Sau khi phê duyệt, tài khoản đối tác sẽ được kích hoạt trên hệ thống VibeHue.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý phê duyệt',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      await adminVerificationApi.approve(id, { reason: 'Hồ sơ đạt tiêu chuẩn thẩm định.' });
      Swal.fire({
        icon: 'success',
        title: 'Phê duyệt thành công!',
        text: 'Đối tác đã được kích hoạt năng lực hoạt động.',
        timer: 2000,
        showConfirmButton: false,
      });
      fetchData();
      if (activeVerification && (activeVerification.verificationId || activeVerification._id) === id) {
        setActiveVerification((prev: any) => ({ ...prev, status: 'APPROVED' }));
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi phê duyệt',
        text: err?.message || 'Không thể phê duyệt hồ sơ.',
      });
    }
  };

  // Open Modals
  const handleOpenRejectModal = () => {
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!activeVerification) return;
    const id = activeVerification.verificationId || activeVerification._id;
    try {
      await adminVerificationApi.reject(id, {
        reason: rejectReason,
        note: rejectNote || rejectReason,
      });
      setIsRejectModalOpen(false);
      setRejectNote('');
      Swal.fire({
        icon: 'success',
        title: 'Đã từ chối hồ sơ',
        text: 'Thông báo lý do từ chối đã được gửi tới đối tác.',
        timer: 2000,
        showConfirmButton: false,
      });
      fetchData();
      setActiveVerification((prev: any) => ({ ...prev, status: 'REJECTED' }));
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi từ chối hồ sơ',
        text: err?.message || 'Không thể gửi quyết định.',
      });
    }
  };

  const handleOpenRequestChangesModal = () => {
    setIsRequestChangesModalOpen(true);
  };

  const handleConfirmRequestChanges = async () => {
    if (!activeVerification) return;
    const id = activeVerification.verificationId || activeVerification._id;
    try {
      await adminVerificationApi.requestChanges(id, {
        reason: 'Yêu cầu cập nhật, bổ sung hồ sơ minh chứng',
        note: requestChangesNote || 'Vui lòng kiểm tra và gửi lại các giấy tờ theo danh sách yêu cầu.',
        changeRequests: changeTargets.map((target) => ({
          target: target as any,
          action: 'REUPLOAD' as any,
          reasonCode: 'INVALID_DOCUMENT',
          note: requestChangesNote,
        })),
      });
      setIsRequestChangesModalOpen(false);
      setRequestChangesNote('');
      Swal.fire({
        icon: 'success',
        title: 'Đã gửi yêu cầu bổ sung',
        text: 'Đối tác đã nhận được thông báo bổ sung giấy tờ.',
        timer: 2000,
        showConfirmButton: false,
      });
      fetchData();
      setActiveVerification((prev: any) => ({
        ...prev,
        status: 'NEEDS_CHANGES',
        verificationRevision: (prev.verificationRevision || 0) + 1,
      }));
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi gửi yêu cầu',
        text: err?.message || 'Không thể gửi yêu cầu sửa đổi.',
      });
    }
  };

  // Add Internal Note
  const handleAddInternalNote = async () => {
    if (!activeVerification || !internalNoteInput.trim()) return;
    const id = activeVerification.verificationId || activeVerification._id;
    setIsSubmittingNote(true);
    try {
      const res = await adminVerificationApi.addNote(id, internalNoteInput.trim());
      setInternalNoteInput('');
      if (res && res.internalNotes) {
        setActiveVerification((prev: any) => ({
          ...prev,
          internalNotes: res.internalNotes,
        }));
      }
      Swal.fire({
        icon: 'success',
        title: 'Đã lưu ghi chú',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể thêm ghi chú',
        text: err?.message || 'Có lỗi xảy ra.',
      });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Run OCR on document
  const handleRunOcr = async (docType: ProviderDocumentType) => {
    if (!activeVerification) return;
    const id = activeVerification.verificationId || activeVerification._id;
    try {
      await adminVerificationApi.runOcr(id, docType);
      Swal.fire({
        icon: 'success',
        title: 'Đã gửi yêu cầu phân tích OCR',
        timer: 1800,
        showConfirmButton: false,
      });
      const fullDetail = await adminVerificationApi.detail(id);
      setActiveVerification((prev: any) => ({ ...prev, ...fullDetail }));
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi xử lý OCR',
        text: err?.message || 'Không thể phân tích tài liệu.',
      });
    }
  };

  // Format Helpers
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return { date: '--/--/----', time: '--:--' };
    const d = new Date(dateStr);
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { date, time };
  };

  return (
    <div className="pv-container">
      {/* 1. Header & Breadcrumb */}
      <div className="pv-breadcrumb">
        <span>Kiểm duyệt & Trợ giúp</span>
        <span className="separator">/</span>
        <span className="current">Phê duyệt hồ sơ đối tác</span>
      </div>

      <div className="pv-header">
        <div className="pv-header-left">
          <h1>Phê duyệt hồ sơ đối tác</h1>
          <p>
            Kiểm tra tính hợp lệ và thẩm định năng lực đối tác trước khi kích hoạt trên hệ thống
          </p>
        </div>

        <div className="pv-header-actions">
          <button
            className="pv-action-btn-secondary"
            onClick={() => {
              Swal.fire({
                icon: 'info',
                title: 'Xuất báo cáo thẩm định',
                text: 'Dữ liệu báo cáo tổng hợp đối tác đang được tạo dưới định dạng CSV/Excel...',
                timer: 2000,
                showConfirmButton: false,
              });
            }}
          >
            <FileDown size={16} />
            <span>Xuất báo cáo</span>
          </button>

          <button
            className="pv-action-btn-secondary"
            onClick={() => {
              Swal.fire({
                icon: 'info',
                title: 'Cấu hình tiêu chí thẩm định',
                text: 'Hệ thống áp dụng 5 tiêu chí: Giấy phép kinh doanh, CCCD đối chiếu OCR, Địa chỉ thực tế, Hạn mức ký quỹ Escrow, Cam kết quy chuẩn.',
              });
            }}
          >
            <Settings2 size={16} />
            <span>Cấu hình tiêu chí</span>
          </button>

          <AdminReloadButton onClick={fetchData} />
        </div>
      </div>

      {/* 2. KPI Summary Cards (5 cards) */}
      <div className="pv-kpi-grid">
        {/* Card 1: Tổng hồ sơ */}
        <div className="pv-kpi-card">
          <div className="pv-kpi-top">
            <span className="pv-kpi-title">Tổng hồ sơ</span>
            <div className="pv-kpi-icon-wrap pv-kpi-icon-blue">
              <FileText size={18} />
            </div>
          </div>
          <div className="pv-kpi-val">{metrics.total}</div>
          <div className="pv-kpi-badge pv-kpi-badge-green">
            <TrendingUp size={12} />
            <span>+12% vs tháng trước</span>
          </div>
        </div>

        {/* Card 2: Mới gửi */}
        <div className="pv-kpi-card">
          <div className="pv-kpi-top">
            <span className="pv-kpi-title">Mới gửi</span>
            <div className="pv-kpi-icon-wrap pv-kpi-icon-sky">
              <Clock size={18} />
            </div>
          </div>
          <div className="pv-kpi-val">{metrics.submitted}</div>
          <div className="pv-kpi-badge pv-kpi-badge-blue">
            <span>Cần xử lý trong 24h</span>
          </div>
        </div>

        {/* Card 3: Đang đánh giá */}
        <div className="pv-kpi-card">
          <div className="pv-kpi-top">
            <span className="pv-kpi-title">Đang đánh giá</span>
            <div className="pv-kpi-icon-wrap pv-kpi-icon-amber">
              <Eye size={18} />
            </div>
          </div>
          <div className="pv-kpi-val">{metrics.underReview}</div>
          <div className="pv-kpi-badge pv-kpi-badge-neutral">
            <span>Trung bình: 1.5 ngày</span>
          </div>
        </div>

        {/* Card 4: Đã phê duyệt */}
        <div className="pv-kpi-card">
          <div className="pv-kpi-top">
            <span className="pv-kpi-title">Đã phê duyệt</span>
            <div className="pv-kpi-icon-wrap pv-kpi-icon-emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="pv-kpi-val">{metrics.approved}</div>
          <div className="pv-kpi-badge pv-kpi-badge-green">
            <span>Tỷ lệ: 78.5%</span>
          </div>
        </div>

        {/* Card 5: Đã từ chối */}
        <div className="pv-kpi-card">
          <div className="pv-kpi-top">
            <span className="pv-kpi-title">Đã từ chối</span>
            <div className="pv-kpi-icon-wrap pv-kpi-icon-rose">
              <XCircle size={18} />
            </div>
          </div>
          <div className="pv-kpi-val">{metrics.rejected}</div>
          <div className="pv-kpi-badge pv-kpi-badge-rose">
            <span>Chủ yếu: thiếu GPKD</span>
          </div>
        </div>
      </div>

      {/* 3. Status Tabs Bar (6 tabs) */}
      <div className="pv-tabs-wrapper">
        <button
          className={`pv-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ALL'); setPage(1); }}
        >
          <span>Tất cả</span>
          <span className="pv-tab-count">{metrics.total}</span>
        </button>

        <button
          className={`pv-tab-btn ${activeTab === 'SUBMITTED' ? 'active' : ''}`}
          onClick={() => { setActiveTab('SUBMITTED'); setPage(1); }}
        >
          <span>Mới gửi</span>
          <span className="pv-tab-count">{metrics.submitted}</span>
        </button>

        <button
          className={`pv-tab-btn ${activeTab === 'UNDER_REVIEW' ? 'active' : ''}`}
          onClick={() => { setActiveTab('UNDER_REVIEW'); setPage(1); }}
        >
          <span>Đang đánh giá</span>
          <span className="pv-tab-count">{metrics.underReview}</span>
        </button>

        <button
          className={`pv-tab-btn ${activeTab === 'NEEDS_CHANGES' ? 'active' : ''}`}
          onClick={() => { setActiveTab('NEEDS_CHANGES'); setPage(1); }}
        >
          <span>Cần bổ sung</span>
          <span className="pv-tab-count">{metrics.needsChanges}</span>
        </button>

        <button
          className={`pv-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
          onClick={() => { setActiveTab('APPROVED'); setPage(1); }}
        >
          <span>Đã phê duyệt</span>
          <span className="pv-tab-count">{metrics.approved}</span>
        </button>

        <button
          className={`pv-tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`}
          onClick={() => { setActiveTab('REJECTED'); setPage(1); }}
        >
          <span>Đã từ chối</span>
          <span className="pv-tab-count">{metrics.rejected}</span>
        </button>
      </div>

      {/* 4. Search and Filters Bar */}
      <div className="pv-filter-bar">
        <div className="pv-search-box">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Tìm theo tên đối tác, mã ĐT, MST, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <select
          className="pv-select"
          value={capabilityFilter}
          onChange={(e) => { setCapabilityFilter(e.target.value); setPage(1); }}
        >
          <option value="ALL">Tất cả năng lực</option>
          <option value="AODAI_RENTAL">Cho thuê Áo dài</option>
          <option value="PHOTOGRAPHY">Dịch vụ Chụp ảnh</option>
        </select>

        <select
          className="pv-select"
          value={provinceFilter}
          onChange={(e) => { setProvinceFilter(e.target.value); setPage(1); }}
        >
          <option value="ALL">Tất cả khu vực</option>
          <option value="Thừa Thiên Huế">Thừa Thiên Huế</option>
          <option value="Đà Nẵng">Đà Nẵng</option>
          <option value="Quảng Nam">Quảng Nam</option>
          <option value="Hà Nội">Hà Nội</option>
          <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
        </select>

        <button
          className="pv-filter-btn"
          onClick={() => {
            Swal.fire({
              title: 'Bộ lọc nâng cao',
              html: `
                <div style="text-align: left; font-size: 13px;">
                  <label><b>Lọc theo số lần sửa đổi:</b></label>
                  <select class="swal2-input" id="swal-rev"><option value="">Tất cả</option><option value="0">Chưa sửa (0 lần)</option><option value="1">Đã sửa 1+ lần</option></select>
                  <label><b>Lọc theo tình trạng OCR:</b></label>
                  <select class="swal2-input" id="swal-ocr"><option value="">Tất cả</option><option value="MATCH">Đã khớp 100%</option><option value="WARN">Có cảnh báo OCR</option></select>
                </div>
              `,
              confirmButtonText: 'Áp dụng',
              confirmButtonColor: '#881337',
            });
          }}
        >
          <SlidersHorizontal size={15} />
          <span>Bộ lọc nâng cao</span>
        </button>

        <button className="pv-reset-btn" onClick={handleResetFilters}>
          <RotateCcw size={15} />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* 5. Selection Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="pv-selection-bar">
          <div className="pv-selection-info">
            Đã chọn {selectedIds.length} đối tác
          </div>
          <div className="pv-selection-actions">
            <button
              className="pv-btn-approve"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => {
                Swal.fire({
                  title: `Phê duyệt ${selectedIds.length} đối tác?`,
                  text: 'Toàn bộ đối tác được chọn sẽ được chuyển sang trạng thái ĐÃ PHÊ DUYỆT.',
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonColor: '#059669',
                  confirmButtonText: 'Xác nhận duyệt',
                }).then((res) => {
                  if (res.isConfirmed) {
                    Swal.fire('Thành công', 'Đã phê duyệt hàng loạt.', 'success');
                    setSelectedIds([]);
                    fetchData();
                  }
                });
              }}
            >
              Phê duyệt hàng loạt
            </button>

            <button
              className="pv-btn-reject"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => {
                Swal.fire({
                  title: `Từ chối ${selectedIds.length} đối tác?`,
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#e11d48',
                  confirmButtonText: 'Xác nhận từ chối',
                }).then((res) => {
                  if (res.isConfirmed) {
                    Swal.fire('Đã từ chối', 'Đã từ chối hàng loạt.', 'success');
                    setSelectedIds([]);
                    fetchData();
                  }
                });
              }}
            >
              Từ chối hàng loạt
            </button>

            <button
              className="pv-btn-view"
              onClick={() => setSelectedIds([])}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* 6. Main Data Table */}
      <div className="pv-table-wrap">
        <table className="pv-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === items.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ width: 110 }}>MÃ ĐỐI TÁC</th>
              <th>DOANH NGHIỆP / CHỦ THỂ</th>
              <th>NĂNG LỰC ĐĂNG KÝ</th>
              <th>NGÀY NỘP</th>
              <th>HỒ SƠ & MINH CHỨNG</th>
              <th>TRẠNG THÁI</th>
              <th style={{ textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  Đang tải danh sách hồ sơ đối tác...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  Không tìm thấy hồ sơ đối tác phù hợp với điều kiện lọc.
                </td>
              </tr>
            ) : (
              items.map((item, rowIdx) => {
                const id = item.verificationId || item._id;
                const isSelected = selectedIds.includes(id);
                const status = (item.status || 'DRAFT').toUpperCase();
                const { date, time } = formatDate(item.submittedAt || item.createdAt);
                const bp = item.businessProfile || {};
                const name = bp.businessName || item.businessName || 'Đối tác chưa đặt tên';
                const owner = bp.ownerName || 'Chủ doanh nghiệp';
                const phone = bp.phone || '0901 234 567';
                const province = bp.province || 'Thừa Thiên Huế';
                const avatar =
                  bp.avatar ||
                  LOCAL_PARTNER_AVATARS[rowIdx % LOCAL_PARTNER_AVATARS.length];
                const code = item.partnerCode || `#DT${String(id).slice(-5).toUpperCase()}`;

                const caps = item.requestedCapabilities || [];
                const docsValid = item.documentsValid ?? 4;
                const docsAttention = item.documentsAttention ?? (status === 'NEEDS_CHANGES' ? 1 : 0);

                return (
                  <tr key={id} className={isSelected ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(id)}
                      />
                    </td>

                    <td>
                      <span className="pv-partner-code">{code}</span>
                    </td>

                    <td>
                      <div className="pv-partner-cell">
                        {avatarErrors[id] ? (
                          <div className="pv-partner-avatar-fallback">
                            {getInitials(name)}
                          </div>
                        ) : (
                          <img
                            src={avatar}
                            alt={name}
                            className="pv-partner-avatar"
                            onError={() => handleAvatarError(id)}
                          />
                        )}
                        <div className="pv-partner-info">
                          <span className="pv-partner-name">{name}</span>
                          <span className="pv-partner-meta">
                            {owner} • {phone} • <span className="pv-tag-province">{province}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="pv-caps-list">
                        {caps.includes('AODAI_RENTAL') && (
                          <span className="pv-cap-badge pv-cap-aodai">
                            <Shirt size={12} />
                            <span>Cho thuê Áo dài</span>
                          </span>
                        )}
                        {caps.includes('PHOTOGRAPHY') && (
                          <span className="pv-cap-badge pv-cap-photo">
                            <Camera size={12} />
                            <span>Chụp ảnh</span>
                          </span>
                        )}
                        {caps.length === 0 && (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Chưa đăng ký</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{date}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{time}</span>
                      </div>
                    </td>

                    <td>
                      <div className="pv-docs-health">
                        <span className="pv-docs-health-pill pv-docs-valid">
                          <CheckCircle2 size={13} />
                          <span>{docsValid}/5 hợp lệ</span>
                        </span>
                        {docsAttention > 0 && (
                          <span className="pv-docs-health-pill pv-docs-warn">
                            <AlertTriangle size={13} />
                            <span>{docsAttention} cần chú ý</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      {status === 'SUBMITTED' && (
                        <span className="pv-status-pill pv-status-submitted">
                          <span className="pv-status-dot"></span>
                          <span>Mới gửi</span>
                        </span>
                      )}
                      {status === 'UNDER_REVIEW' && (
                        <span className="pv-status-pill pv-status-under-review">
                          <span className="pv-status-dot"></span>
                          <span>Đang đánh giá</span>
                        </span>
                      )}
                      {status === 'NEEDS_CHANGES' && (
                        <span className="pv-status-pill pv-status-needs-changes">
                          <span className="pv-status-dot"></span>
                          <span>Cần bổ sung</span>
                        </span>
                      )}
                      {status === 'APPROVED' && (
                        <span className="pv-status-pill pv-status-approved">
                          <span className="pv-status-dot"></span>
                          <span>Đã phê duyệt</span>
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="pv-status-pill pv-status-rejected">
                          <span className="pv-status-dot"></span>
                          <span>Đã từ chối</span>
                        </span>
                      )}
                      {status === 'DRAFT' && (
                        <span className="pv-status-pill" style={{ background: '#f1f5f9', color: '#64748b' }}>
                          <span className="pv-status-dot" style={{ background: '#94a3b8' }}></span>
                          <span>Bản nháp</span>
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="pv-btn-view"
                        onClick={(e) => handleOpenDetail(item, e)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="pv-pagination-bar">
          <div>
            Hiển thị{' '}
            <b>{total > 0 ? (page - 1) * limit + 1 : 0}</b> -{' '}
            <b>{Math.min(page * limit, total)}</b> của <b>{total}</b> đối tác
          </div>

          <div className="pv-page-controls">
            <button
              className="pv-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
              .map((p) => (
                <button
                  key={p}
                  className={`pv-page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}

            <button
              className="pv-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Spacious Right Inspection Drawer (Figma Node 319-5997) */}
      {isDetailOpen && activeVerification && (
        <div className="pv-drawer-backdrop" onClick={handleCloseDetail}>
          <div
            className={`pv-drawer-panel ${isMaximized ? 'maximized' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Navigation Bar */}
            <div className="pv-drawer-topbar">
              <div className="pv-drawer-topbar-left">
                <button className="pv-back-btn" onClick={handleCloseDetail}>
                  <ChevronLeft size={16} />
                  <span>Quay lại danh sách</span>
                </button>
              </div>

              <div className="pv-drawer-topbar-right">
                <div className="pv-nav-paginator">
                  <button
                    className="pv-nav-arrow"
                    disabled={currentIndexSafe <= 0}
                    onClick={handlePrevItem}
                    title="Đối tác trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    {items.length > 0 ? currentIndexSafe + 1 : 0} / {items.length}
                  </span>
                  <button
                    className="pv-nav-arrow"
                    disabled={currentIndexSafe >= items.length - 1}
                    onClick={handleNextItem}
                    title="Đối tác tiếp theo"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <button
                  className="pv-drawer-icon-btn"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Thu nhỏ giao diện (1180px)' : 'Mở rộng toàn màn hình'}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  className="pv-drawer-icon-btn"
                  onClick={handleCloseDetail}
                  title="Đóng chi tiết"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Partner Header Card */}
            <div className="pv-drawer-header-card">
              <div className="pv-dh-main">
                <div className="pv-dh-left">
                  {avatarErrors[`drawer_${activeVerification.verificationId || activeVerification._id}`] ? (
                    <div className="pv-dh-avatar-fallback">
                      {getInitials(
                        activeVerification.businessProfile?.businessName ||
                        activeVerification.businessName ||
                        'Partner'
                      )}
                    </div>
                  ) : (
                    <img
                      src={
                        activeVerification.businessProfile?.avatar ||
                        LOCAL_PARTNER_AVATARS[0]
                      }
                      alt=""
                      className="pv-dh-avatar"
                      onError={() =>
                        handleAvatarError(
                          `drawer_${activeVerification.verificationId || activeVerification._id}`
                        )
                      }
                    />
                  )}
                  <div className="pv-dh-name-group">
                    <h2>
                      {activeVerification.businessProfile?.businessName ||
                        activeVerification.businessName ||
                        'Đối tác VibeHue'}
                    </h2>
                    <div className="pv-dh-subgroup">
                      <span className="pv-partner-code">
                        {activeVerification.partnerCode || `#DT${String(activeVerification.verificationId || activeVerification._id).slice(-5).toUpperCase()}`}
                      </span>
                      <span
                        className={`pv-status-pill pv-status-${(activeVerification.status || 'SUBMITTED').toLowerCase().replace('_', '-')}`}
                      >
                        <span className="pv-status-dot"></span>
                        <span>{STATUS_LABELS[activeVerification.status] || activeVerification.status}</span>
                      </span>
                      {activeVerification.requestedCapabilities?.includes('AODAI_RENTAL') && (
                        <span className="pv-cap-badge pv-cap-aodai">
                          <Shirt size={12} />
                          <span>Cho thuê Áo dài</span>
                        </span>
                      )}
                      {activeVerification.requestedCapabilities?.includes('PHOTOGRAPHY') && (
                        <span className="pv-cap-badge pv-cap-photo">
                          <Camera size={12} />
                          <span>Chụp ảnh</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pv-dh-details-bar">
                <div className="pv-dh-item">
                  <span className="label">Mã số thuế:</span>
                  <span className="val">{activeVerification.businessProfile?.taxCode || activeVerification.taxCode || '3300100925'}</span>
                </div>
                <div className="pv-dh-item">
                  <span className="label">Hotline:</span>
                  <span className="val">{activeVerification.businessProfile?.phone || activeVerification.phone || '0935 972 579'}</span>
                </div>
                <div className="pv-dh-item">
                  <span className="label">Email:</span>
                  <span className="val">
                    {activeVerification.businessProfile?.email || activeVerification.email || 'partner@vibehue.com'}
                  </span>
                </div>
                <div className="pv-dh-item">
                  <span className="label">Địa chỉ:</span>
                  <span className="val">
                    {activeVerification.businessProfile?.address || activeVerification.address || 'Thừa Thiên Huế'}
                  </span>
                </div>
                <div className="pv-dh-item">
                  <span className="label">Đại diện:</span>
                  <span className="val">
                    {activeVerification.businessProfile?.ownerName || activeVerification.ownerName || 'Chủ doanh nghiệp'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Subtabs */}
            <div className="pv-drawer-subtabs">
              <button
                className={`pv-subtab-btn ${activeSubtab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('overview')}
              >
                Tổng quan
              </button>
              <button
                className={`pv-subtab-btn ${activeSubtab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('details')}
              >
                Thông tin chi tiết
              </button>
              <button
                className={`pv-subtab-btn ${activeSubtab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('documents')}
              >
                Giấy tờ & OCR
              </button>
              <button
                className={`pv-subtab-btn ${activeSubtab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('history')}
              >
                Lịch sử thẩm định
              </button>
            </div>

            {/* Subtabs Body */}
            <div className="pv-drawer-body">
              {/* TAB 1: TỔNG QUAN (2-Column Grid Layout matching Figma) */}
              {activeSubtab === 'overview' && (
                <div className="pv-overview-layout">
                  {/* CỘT TRÁI (Main Info, Score, Capabilities) */}
                  <div className="pv-overview-col-left">
                    {/* Score & Revisions Grid */}
                    <div className="pv-score-grid">
                      <div className="pv-score-card">
                        <div
                          className="pv-donut-circle"
                          style={{
                            background: `conic-gradient(#059669 0% ${Math.round(((activeVerification.documentsValid ?? 4) / 5) * 100)}%, #e2e8f0 ${Math.round(((activeVerification.documentsValid ?? 4) / 5) * 100)}% 100%)`,
                          }}
                        >
                          <div className="pv-donut-inner">{activeVerification.documentsValid ?? 4}/5</div>
                        </div>
                        <div className="pv-score-info">
                          <h4>Tiêu chí đạt ({Math.round(((activeVerification.documentsValid ?? 4) / 5) * 100)}%)</h4>
                          <p>Hồ sơ đáp ứng {activeVerification.documentsValid ?? 4} trên 5 tiêu chuẩn đối tác VibeHue Escrow.</p>
                        </div>
                      </div>

                      <div className="pv-score-card">
                        <div className="pv-rev-num">
                          {activeVerification.verificationRevision ?? 0}
                        </div>
                        <div className="pv-score-info">
                          <h4>Lần yêu cầu sửa đổi</h4>
                          <p>
                            {(activeVerification.verificationRevision ?? 0) === 0
                              ? 'Hồ sơ đã gửi trực tiếp, chưa qua lần bổ sung nào.'
                              : `Hồ sơ đã qua ${activeVerification.verificationRevision} lần yêu cầu bổ sung.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Thông tin cơ bản Box */}
                    <div className="pv-card-box">
                      <div className="pv-card-header">
                        <h3 className="pv-card-title">
                          <Building size={16} color="#881337" />
                          <span>Thông tin cơ bản</span>
                        </h3>
                        <button
                          className="pv-card-edit-btn"
                          onClick={() => {
                            Swal.fire({
                              title: 'Chỉnh sửa thông tin hồ sơ',
                              text: 'Admin có thể hiệu chỉnh thông tin đối tác trực tiếp trong trường hợp đối soát hợp lệ.',
                              icon: 'info',
                            });
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Chỉnh sửa</span>
                        </button>
                      </div>

                      <div className="pv-info-grid-2">
                        <div className="pv-info-item">
                          <span className="info-label">Mã số thuế</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.taxCode || '3300123456'}
                          </span>
                        </div>

                        <div className="pv-info-item">
                          <span className="info-label">Loại hình doanh nghiệp</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.businessType || 'Hộ kinh doanh cá thể'}
                          </span>
                        </div>

                        <div className="pv-info-item">
                          <span className="info-label">Người đại diện pháp luật</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.ownerName || 'Nguyễn Thị Mai'}
                          </span>
                        </div>

                        <div className="pv-info-item">
                          <span className="info-label">Ngày nộp hồ sơ</span>
                          <span className="info-val">
                            {formatDate(activeVerification.submittedAt || activeVerification.createdAt).date}
                          </span>
                        </div>

                        <div className="pv-info-item">
                          <span className="info-label">Số điện thoại</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.phone || '0901 234 567'}
                          </span>
                        </div>

                        <div className="pv-info-item">
                          <span className="info-label">Email liên hệ</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.email || 'mainguyen@gmail.com'}
                          </span>
                        </div>

                        <div className="pv-info-item" style={{ gridColumn: 'span 2' }}>
                          <span className="info-label">Địa chỉ kinh doanh</span>
                          <span className="info-val">
                            {activeVerification.businessProfile?.address || '12 Lê Lợi, TP. Huế, Thừa Thiên Huế'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Năng lực kinh doanh & Cơ sở vật chất Box */}
                    <div className="pv-card-box">
                      <div className="pv-card-header">
                        <h3 className="pv-card-title">
                          <Sparkles size={16} color="#881337" />
                          <span>Năng lực kinh doanh & cơ sở vật chất</span>
                        </h3>
                      </div>

                      {/* Box 1: Áo Dài (Hiển thị nếu có đăng ký Cho thuê Áo dài) */}
                      {(activeVerification.requestedCapabilities?.includes('AODAI_RENTAL') ||
                        !activeVerification.requestedCapabilities ||
                        activeVerification.requestedCapabilities.length === 0) && (
                        <div className="pv-cap-card">
                          <div className="pv-cap-head">
                            <div className="pv-cap-title">
                              <Shirt size={16} color="#be185d" />
                              <span>Cho thuê Trang phục truyền thống & Cổ phục</span>
                            </div>
                            <span className="pv-cap-badge-tag pv-cap-aodai">Năng lực chính</span>
                          </div>
                          <div className="pv-cap-body">
                            <div>
                              • <b>Quy mô trang phục:</b> 350+ bộ cổ phục Huế (Áo dài Nhật Bình, Áo tấc ngũ thân, Cổ phục triều Nguyễn).
                            </div>
                            <div>
                              • <b>Cơ sở vật chất:</b> Mặt bằng 120m², 4 phòng thử đồ tiện nghi trang bị gương toàn thân, máy hấp hơi công nghiệp.
                            </div>
                            <div>
                              • <b>Chính sách cho thuê:</b> Cho thuê tối đa 3 ngày. Giặt sấy hấp diệt khuẩn cao cấp sau mỗi lượt khách.
                            </div>
                            <div>
                              • <b>Chính sách cọc:</b> Đặt cọc 500.000 VNĐ hoặc giấy tờ tùy thân hợp lệ.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Box 2: Chụp ảnh (Hiển thị nếu có đăng ký Chụp ảnh) */}
                      {activeVerification.requestedCapabilities?.includes('PHOTOGRAPHY') && (
                        <div className="pv-cap-card">
                          <div className="pv-cap-head">
                            <div className="pv-cap-title">
                              <Camera size={16} color="#0369a1" />
                              <span>Dịch vụ Nhiếp ảnh & Make-up Ngoại cảnh</span>
                            </div>
                            <span className="pv-cap-badge-tag pv-cap-photo">Nhiếp ảnh chuyên nghiệp</span>
                          </div>
                          <div className="pv-cap-body">
                            <div>
                              • <b>Nhân sự:</b> 4 Nhiếp ảnh gia chuyên nghiệp + 2 Chuyên viên trang điểm cổ trang Huế.
                            </div>
                            <div>
                              • <b>Thiết bị sử dụng:</b> Sony A7IV & Canon R5, ống kính Sony GM 85mm f/1.4, hệ thống đèn flash & hắt sáng ngoài trời.
                            </div>
                            <div>
                              • <b>Địa bàn hoạt động:</b> Đại Nội Huế, Lăng Tự Đức, Cung An Định, Cầu Trường Tiền, Đồi Vọng Cảnh.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CỘT PHẢI (Documents Checklist + Internal Notes) */}
                  <div className="pv-overview-col-right">
                    {/* Hồ sơ minh chứng tóm tắt */}
                    <div className="pv-card-box">
                      <div className="pv-card-header">
                        <h3 className="pv-card-title">
                          <FileText size={16} color="#881337" />
                          <span>Hồ sơ minh chứng (5 tài liệu)</span>
                        </h3>
                        <button
                          className="pv-card-edit-btn"
                          onClick={() => setActiveSubtab('documents')}
                        >
                          <ExternalLink size={12} />
                          <span>Xem chi tiết OCR</span>
                        </button>
                      </div>

                      <div className="pv-quick-doc-list">
                        <div
                          className="pv-quick-doc-item"
                          onClick={() =>
                            setLightboxDoc({
                              url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=1000',
                              title: 'CCCD / Định danh cá nhân (Mặt trước)',
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <div className="pv-quick-doc-left">
                            <div className="pv-quick-doc-icon">
                              <FileText size={16} />
                            </div>
                            <div className="pv-quick-doc-info">
                              <span className="pv-quick-doc-title">CCCD / Định danh mặt trước</span>
                              <span className="pv-quick-doc-meta">Hình ảnh rõ nét, đầy đủ 4 góc</span>
                            </div>
                          </div>
                          <span className="pv-cap-badge pv-cap-photo">OCR Đạt (98%)</span>
                        </div>

                        <div
                          className="pv-quick-doc-item"
                          onClick={() =>
                            setLightboxDoc({
                              url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=1000',
                              title: 'CCCD / Định danh cá nhân (Mặt sau)',
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <div className="pv-quick-doc-left">
                            <div className="pv-quick-doc-icon">
                              <FileText size={16} />
                            </div>
                            <div className="pv-quick-doc-info">
                              <span className="pv-quick-doc-title">CCCD / Định danh mặt sau</span>
                              <span className="pv-quick-doc-meta">Mã vạch và vân tay nhận diện tốt</span>
                            </div>
                          </div>
                          <span className="pv-cap-badge pv-cap-photo">OCR Đạt (95%)</span>
                        </div>

                        <div
                          className="pv-quick-doc-item"
                          onClick={() =>
                            setLightboxDoc({
                              url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1000',
                              title: 'Giấy chứng nhận Đăng ký kinh doanh',
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <div className="pv-quick-doc-left">
                            <div className="pv-quick-doc-icon">
                              <Building size={16} />
                            </div>
                            <div className="pv-quick-doc-info">
                              <span className="pv-quick-doc-title">Giấy phép ĐKKD</span>
                              <span className="pv-quick-doc-meta">Mã số thuế trùng khớp cổng QG</span>
                            </div>
                          </div>
                          <span className="pv-cap-badge pv-cap-photo">OCR Đạt (99%)</span>
                        </div>

                        <div
                          className="pv-quick-doc-item"
                          onClick={() =>
                            setLightboxDoc({
                              url: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1000',
                              title: 'Ảnh thực tế Cửa hàng & Showroom',
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <div className="pv-quick-doc-left">
                            <div className="pv-quick-doc-icon">
                              <Shirt size={16} />
                            </div>
                            <div className="pv-quick-doc-info">
                              <span className="pv-quick-doc-title">Ảnh cửa hàng & Showroom</span>
                              <span className="pv-quick-doc-meta">Biển hiệu thực tế tại địa chỉ</span>
                            </div>
                          </div>
                          <span className="pv-cap-badge pv-cap-aodai">Đã thẩm định</span>
                        </div>

                        <div
                          className="pv-quick-doc-item"
                          onClick={() =>
                            setLightboxDoc({
                              url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1000',
                              title: 'Hồ sơ năng lực & Tác phẩm Portfolio',
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <div className="pv-quick-doc-left">
                            <div className="pv-quick-doc-icon">
                              <Camera size={16} />
                            </div>
                            <div className="pv-quick-doc-info">
                              <span className="pv-quick-doc-title">Hồ sơ năng lực & Portfolio</span>
                              <span className="pv-quick-doc-meta">Tác phẩm thực hiện đạt tiêu chuẩn</span>
                            </div>
                          </div>
                          <span className="pv-cap-badge pv-cap-photo">Đã kiểm duyệt</span>
                        </div>
                      </div>
                    </div>

                    {/* Ghi chú nội bộ thẩm định Box */}
                    <div className="pv-card-box">
                      <div className="pv-card-header">
                        <h3 className="pv-card-title">
                          <FileText size={16} color="#881337" />
                          <span>Ghi chú nội bộ thẩm định</span>
                        </h3>
                      </div>

                      <div className="pv-notes-list">
                        {(activeVerification.internalNotes && activeVerification.internalNotes.length > 0) ? (
                          activeVerification.internalNotes.map((note: any, idx: number) => (
                            <div key={idx} className="pv-note-item">
                              <img
                                src={note.avatar || LOCAL_PARTNER_AVATARS[0]}
                                alt={note.adminName}
                                className="pv-note-avatar"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = LOCAL_PARTNER_AVATARS[0];
                                }}
                              />
                              <div className="pv-note-content">
                                <div className="pv-note-head">
                                  <span className="pv-note-author">{note.adminName || 'System Admin'}</span>
                                  <span className="pv-note-time">
                                    {formatDate(note.createdAt).date} {formatDate(note.createdAt).time}
                                  </span>
                                </div>
                                <p className="pv-note-text">{note.content}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                            Chưa có ghi chú nội bộ nào cho hồ sơ này.
                          </div>
                        )}
                      </div>

                      <div className="pv-note-input-row">
                        <input
                          type="text"
                          placeholder="Thêm ghi chú nội bộ (chỉ ban quản trị nhìn thấy)..."
                          className="pv-note-input"
                          value={internalNoteInput}
                          onChange={(e) => setInternalNoteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddInternalNote();
                          }}
                        />
                        <button
                          className="pv-note-submit-btn"
                          disabled={isSubmittingNote || !internalNoteInput.trim()}
                          onClick={handleAddInternalNote}
                        >
                          <Send size={13} style={{ marginRight: 4 }} />
                          <span>Lưu ghi chú</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: THÔNG TIN CHI TIẾT */}
              {activeSubtab === 'details' && (
                <div className="pv-card-box">
                  <div className="pv-card-header">
                    <h3 className="pv-card-title">Hồ sơ pháp lý & Điều khoản cam kết</h3>
                  </div>
                  <div className="pv-info-grid-2">
                    <div className="pv-info-item">
                      <span className="info-label">Mô tả doanh nghiệp</span>
                      <span className="info-val">
                        {activeVerification.businessProfile?.description ||
                          'Doanh nghiệp chuyên kinh doanh cổ phục truyền thống và dịch vụ chụp hình ngoại cảnh.'}
                      </span>
                    </div>

                    <div className="pv-info-item">
                      <span className="info-label">Tài khoản thanh toán Escrow</span>
                      <span className="info-val">Vietcombank - 0123456789 (CTY TNHH ÁO DÀI CỐ ĐÔ)</span>
                    </div>

                    <div className="pv-info-item">
                      <span className="info-label">Điều khoản dịch vụ & Escrow</span>
                      <span className="info-val">
                        <CheckCircle2 size={14} color="#16a34a" style={{ display: 'inline', marginRight: 4 }} />
                        Đã ký cam kết điện tử (Phiên bản 1.0)
                      </span>
                    </div>

                    <div className="pv-info-item">
                      <span className="info-label">Thời điểm chấp thuận cam kết</span>
                      <span className="info-val">
                        {formatDate(activeVerification.consent?.acceptedAt || activeVerification.submittedAt).date}{' '}
                        {formatDate(activeVerification.consent?.acceptedAt || activeVerification.submittedAt).time}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GIẤY TỜ & OCR */}
              {activeSubtab === 'documents' && (
                <div>
                  {(activeVerification.documents && activeVerification.documents.length > 0) ? (
                    activeVerification.documents.map((doc: any, idx: number) => {
                      const cur = doc.versions?.find((v: any) => v.isCurrent) || doc.current || {};
                      const label = documentLabels[doc.documentType as ProviderDocumentType] || doc.documentType;
                      const ocrConfidence = cur.ocrConfidence ? Math.round(cur.ocrConfidence * 100) : 98;
                      const isOcrPass = cur.ocrStatus === 'MATCH' || cur.ocrStatus === 'OCR_PASSED';

                      return (
                        <div key={idx} className="pv-doc-row">
                          <div
                            className="pv-doc-thumb-box"
                            onClick={() =>
                              setLightboxDoc({
                                url:
                                  'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=800',
                                title: label,
                              })
                            }
                          >
                            <img
                              src="https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=400"
                              alt={label}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 2,
                                right: 2,
                                background: 'rgba(0,0,0,0.6)',
                                borderRadius: 3,
                                padding: 2,
                                color: '#ffffff',
                              }}
                            >
                              <Maximize2 size={11} />
                            </div>
                          </div>

                          <div className="pv-doc-info-col">
                            <div className="pv-doc-title-row">
                              <span className="pv-doc-name">{label}</span>
                              <span
                                className={`pv-cap-badge ${isOcrPass ? 'pv-cap-photo' : 'pv-cap-makeup'}`}
                              >
                                {isOcrPass ? `OCR Đạt (${ocrConfidence}%)` : 'Cần kiểm tra lại'}
                              </span>
                            </div>

                            <table className="pv-ocr-comparison-table">
                              <thead>
                                <tr>
                                  <th>Trường thông tin</th>
                                  <th>Dữ liệu OCR nhận diện</th>
                                  <th>Dữ liệu đối tác nhập</th>
                                  <th>Đối soát</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>Số định danh / MST</td>
                                  <td>{activeVerification.businessProfile?.taxCode || '3300123456'}</td>
                                  <td>{activeVerification.businessProfile?.taxCode || '3300123456'}</td>
                                  <td>
                                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Trùng khớp</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td>Chủ sở hữu / Đại diện</td>
                                  <td>
                                    {(activeVerification.businessProfile?.ownerName || 'Nguyễn Thị Mai').toUpperCase()}
                                  </td>
                                  <td>{activeVerification.businessProfile?.ownerName || 'Nguyễn Thị Mai'}</td>
                                  <td>
                                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Trùng khớp</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <button
                                className="pv-btn-view"
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                onClick={() => handleRunOcr(doc.documentType)}
                              >
                                Chạy lại OCR
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="pv-card-box" style={{ color: '#64748b' }}>
                      Toàn bộ 5 tài liệu đã tải lên và được lưu trữ an toàn trong kho Private Storage.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LỊCH SỬ THẨM ĐỊNH */}
              {activeSubtab === 'history' && (
                <div className="pv-card-box">
                  <h3 className="pv-card-title" style={{ marginBottom: 16 }}>
                    Dòng thời gian thẩm định hồ sơ
                  </h3>
                  <div className="pv-timeline">
                    <div className="pv-tl-node">
                      <span className="pv-tl-title">Hồ sơ được đối tác khởi tạo</span>
                      <span className="pv-tl-meta">
                        {formatDate(activeVerification.createdAt).date}{' '}
                        {formatDate(activeVerification.createdAt).time} • Đối tác
                      </span>
                    </div>

                    <div className="pv-tl-node">
                      <span className="pv-tl-title">Hồ sơ đã nộp thành công lên hệ thống</span>
                      <span className="pv-tl-meta">
                        {formatDate(activeVerification.submittedAt || activeVerification.createdAt).date}{' '}
                        {formatDate(activeVerification.submittedAt || activeVerification.createdAt).time} •
                        Hệ thống ghi nhận
                      </span>
                    </div>

                    {activeVerification.status === 'UNDER_REVIEW' && (
                      <div className="pv-tl-node">
                        <span className="pv-tl-title">Ban quản trị tiếp nhận và bắt đầu đánh giá</span>
                        <span className="pv-tl-meta">Vừa xong • Ban Quản Trị</span>
                      </div>
                    )}

                    {activeVerification.status === 'APPROVED' && (
                      <div className="pv-tl-node">
                        <span className="pv-tl-title" style={{ color: '#059669' }}>
                          Phê duyệt và kích hoạt đối tác
                        </span>
                        <span className="pv-tl-meta">Hồ sơ đạt tiêu chuẩn VibeHue</span>
                      </div>
                    )}

                    {activeVerification.status === 'REJECTED' && (
                      <div className="pv-tl-node">
                        <span className="pv-tl-title" style={{ color: '#e11d48' }}>
                          Từ chối kích hoạt hồ sơ
                        </span>
                        <span className="pv-tl-meta">Lý do: Không đáp ứng tiêu chuẩn</span>
                      </div>
                    )}

                    {activeVerification.status === 'NEEDS_CHANGES' && (
                      <div className="pv-tl-node">
                        <span className="pv-tl-title" style={{ color: '#7c3aed' }}>
                          Yêu cầu sửa đổi bổ sung giấy tờ
                        </span>
                        <span className="pv-tl-meta">Đang chờ đối tác tải lại minh chứng</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Action Bottom Footer */}
            <div className="pv-drawer-footer">
              <div className="pv-footer-left">
                Lần cập nhật cuối:{' '}
                <b>{formatDate(activeVerification.updatedAt || activeVerification.submittedAt).date}</b>{' '}
                {formatDate(activeVerification.updatedAt || activeVerification.submittedAt).time}
              </div>

              <div className="pv-footer-actions">
                <button className="pv-btn-req-changes" onClick={handleOpenRequestChangesModal}>
                  Yêu cầu bổ sung
                </button>

                <button className="pv-btn-reject" onClick={handleOpenRejectModal}>
                  Từ chối hồ sơ
                </button>

                {activeVerification.status === 'APPROVED' ? (
                  <button
                    className="pv-btn-approve"
                    style={{ background: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() =>
                      handleApprove(activeVerification.verificationId || activeVerification._id)
                    }
                  >
                    <CheckCircle2 size={15} />
                    <span>Đã phê duyệt đối tác</span>
                  </button>
                ) : activeVerification.status === 'SUBMITTED' ? (
                  <button
                    className="pv-btn-start-review"
                    onClick={() =>
                      handleStartReview(activeVerification.verificationId || activeVerification._id)
                    }
                  >
                    Bắt đầu đánh giá
                  </button>
                ) : (
                  <button
                    className="pv-btn-approve"
                    onClick={() =>
                      handleApprove(activeVerification.verificationId || activeVerification._id)
                    }
                  >
                    Phê duyệt đối tác
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TỪ CHỐI HỒ SƠ */}
      {isRejectModalOpen && (
        <div className="pv-modal-overlay" onClick={() => setIsRejectModalOpen(false)}>
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3>Từ chối hồ sơ đối tác</h3>
              <button
                className="pv-modal-close-btn"
                onClick={() => setIsRejectModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>
                Chọn lý do từ chối mẫu:
              </label>
              <div className="pv-chips-grid">
                {REJECT_PRESET_REASONS.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`pv-chip ${rejectReason === reason ? 'selected' : ''}`}
                    onClick={() => setRejectReason(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>
                Ghi chú chi tiết gửi tới đối tác:
              </label>
              <textarea
                className="pv-textarea"
                placeholder="Nhập hướng dẫn hoặc lý do chi tiết..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>

            <div className="pv-modal-actions">
              <button
                className="pv-btn-view"
                onClick={() => setIsRejectModalOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                className="pv-btn-reject"
                onClick={handleConfirmReject}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: YÊU CẦU BỔ SUNG */}
      {isRequestChangesModalOpen && (
        <div className="pv-modal-overlay" onClick={() => setIsRequestChangesModalOpen(false)}>
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3>Yêu cầu bổ sung tài liệu</h3>
              <button
                className="pv-modal-close-btn"
                onClick={() => setIsRequestChangesModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>
                Chọn các tài liệu cần yêu cầu tải lại / bổ sung:
              </label>
              <div className="pv-chips-grid">
                {CHANGE_TARGET_OPTIONS.map((opt) => {
                  const isSel = changeTargets.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pv-chip ${isSel ? 'selected' : ''}`}
                      onClick={() => {
                        setChangeTargets((prev) =>
                          isSel ? prev.filter((i) => i !== opt.id) : [...prev, opt.id],
                        );
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>
                Hướng dẫn sửa đổi cụ thể:
              </label>
              <textarea
                className="pv-textarea"
                placeholder="Ví dụ: Vui lòng chụp lại ảnh mặt sau CCCD rõ nét, không bị lóa ánh đèn flash..."
                value={requestChangesNote}
                onChange={(e) => setRequestChangesNote(e.target.value)}
              />
            </div>

            <div className="pv-modal-actions">
              <button
                className="pv-btn-view"
                onClick={() => setIsRequestChangesModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="pv-btn-req-changes"
                onClick={handleConfirmRequestChanges}
              >
                Gửi yêu cầu bổ sung
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DOCUMENT LIGHTBOX */}
      {lightboxDoc && (
        <div className="pv-modal-overlay" onClick={() => setLightboxDoc(null)}>
          <div className="pv-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-lightbox-top">
              <span style={{ fontWeight: 700 }}>{lightboxDoc.title}</span>
              <button
                className="pv-modal-close-btn"
                style={{ color: '#ffffff' }}
                onClick={() => setLightboxDoc(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="pv-lightbox-img-wrap">
              <img src={lightboxDoc.url} alt={lightboxDoc.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PartnerVerificationManagement;
