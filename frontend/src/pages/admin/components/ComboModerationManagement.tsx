import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminReloadButton } from './AdminReloadButton';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { API_BASE_URL } from '../../../config/env';
import './comboModerationFigma.css';

import {
  LayoutGrid,
  CheckCircle,
  XCircle,
  AlertCircle,
  Layers,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  MoreHorizontal,
  HelpCircle,
  Sparkles,
  Camera,
  Shirt,
  Scissors,
  Eye,
  User,
  ShieldCheck,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ComboStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface ComboItem {
  _id: string;
  id?: string;
  name: string;
  code?: string;
  partnerCode?: string;
  description?: string;
  status: ComboStatus;
  providerId?: {
    _id?: string;
    businessName?: string;
    phone?: string;
    address?: string;
    avatar?: string;
    rating?: number;
  };
  productId?: {
    _id?: string;
    name?: string;
    images?: string[];
    basePrice?: number;
  };
  photographyPackageId?: {
    _id?: string;
    name?: string;
    images?: string[];
    price?: number;
    durationHours?: number;
    location?: string;
    editedPhotosCount?: number;
  };
  comboPrice?: number;
  finalPrice?: number;
  originalTotal?: number;
  discountPercent?: number;
  validFrom?: string;
  validTo?: string;
  shootDate?: string;
  shootTimeSlot?: string;
  maxUsage?: number;
  usedCount?: number;
  aoDaiQuantity?: number;
  shootPeopleCount?: number;
  location?: string;
  durationHours?: number;
  inclusions?: string[];
  images?: string[];
  image?: string;
  moderationReason?: string;
  moderatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComboMetrics {
  pending: number;
  approved: number;
  rejected: number;
  changesRequested: number;
  total: number;
  trends: {
    pending: string;
    approved: string;
    rejected: string;
    changesRequested: string;
    total: string;
  };
}

export interface ComboApiResponse {
  items: ComboItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: ComboMetrics;
}

const fallbackImage = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600';

const resolveImageUrl = (url?: string): string => {
  if (!url) return fallbackImage;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const formatVND = (amount?: number): string => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  return new Intl.NumberFormat('vi-VN').format(amount);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '—';
  }
};

// ============================================================================
// Component
// ============================================================================

export const ComboModerationManagement: React.FC = () => {
  const toast = useToast();

  // Data states
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [metrics, setMetrics] = useState<ComboMetrics>({
    pending: 0,
    approved: 0,
    rejected: 0,
    changesRequested: 0,
    total: 0,
    trends: {
      pending: '↑ 12% so với tuần trước',
      approved: '↑ 18% so với tháng trước',
      rejected: '↓ 11% so với tháng trước',
      changesRequested: '↑ 33% so với tháng trước',
      total: '↑ 26% so với tháng trước',
    },
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | ComboStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  // Selection & Detail
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCombo, setSelectedCombo] = useState<ComboItem | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);
  const [detailSubtab, setDetailSubtab] = useState<'info' | 'schedule' | 'terms' | 'reviews'>('info');
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCombo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Current combo index for navigation
  const currentIndex = useMemo(() => {
    if (!selectedCombo) return -1;
    return combos.findIndex((c) => c._id === selectedCombo._id);
  }, [selectedCombo, combos]);

  const handlePrevCombo = () => {
    if (currentIndex > 0) {
      setSelectedCombo(combos[currentIndex - 1]);
      setActiveGalleryIndex(0);
    }
  };

  const handleNextCombo = () => {
    if (currentIndex >= 0 && currentIndex < combos.length - 1) {
      setSelectedCombo(combos[currentIndex + 1]);
      setActiveGalleryIndex(0);
    }
  };

  // Modals
  const [isGuidelineOpen, setIsGuidelineOpen] = useState<boolean>(false);
  const [rejectModalCombo, setRejectModalCombo] = useState<ComboItem | null>(null);
  const [rejectPreset, setRejectPreset] = useState<string>('Hình ảnh mờ hoặc không đạt chuẩn chất lượng');
  const [rejectCustomReason, setRejectCustomReason] = useState<string>('');
  const [revisionModalCombo, setRevisionModalCombo] = useState<ComboItem | null>(null);
  const [revisionChecklist, setRevisionChecklist] = useState<Record<string, boolean>>({
    imageQuality: false,
    pricingDetail: false,
    inclusionDetail: false,
    durationLocation: false,
    cancelPolicy: false,
  });
  const [revisionNotes, setRevisionNotes] = useState<string>('');
  const [partnerProfileModal, setPartnerProfileModal] = useState<any | null>(null);
  const [processingAction, setProcessingAction] = useState<boolean>(false);

  // Providers list for filter dropdown
  const [providersList, setProvidersList] = useState<{ id: string; name: string }[]>([]);

  // Drag-to-scroll horizontal container
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [scrollLeftState, setScrollLeftState] = useState<number>(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!tableScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableScrollRef.current.offsetLeft);
    setScrollLeftState(tableScrollRef.current.scrollLeft);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tableScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tableScrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const onMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Close action menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.lume-combo-action-menu-wrap')) {
        setActionMenuOpenId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch Providers List once
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res: any = await httpClient.get('/admin/stats/providers?limit=100').catch(() => null);
        if (res && Array.isArray(res.items)) {
          const list = res.items.map((p: any) => ({
            id: p._id || p.id,
            name: p.businessName || p.userId?.profile?.fullName || 'Đối tác',
          }));
          setProvidersList(list);
        }
      } catch (err) {
        // Fallback: providers extracted from combos
      }
    };
    void fetchProviders();
  }, []);

  // Load Combos from API
  const loadCombos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      // Priority: activeTab takes precedence if not 'ALL', otherwise statusFilter
      const effectiveStatus = activeTab !== 'ALL' ? activeTab : statusFilter !== 'ALL' ? statusFilter : '';
      if (effectiveStatus) {
        params.append('status', effectiveStatus);
      }

      if (partnerFilter !== 'ALL') {
        params.append('providerId', partnerFilter);
      }

      if (priceRangeFilter !== 'ALL') {
        params.append('priceRange', priceRangeFilter);
      }

      const res = await httpClient.get<ComboApiResponse>(`/combo-promotions/admin/all?${params.toString()}`);

      if (res && Array.isArray(res.items)) {
        setCombos(res.items);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.metrics) {
          setMetrics(res.metrics);
        }

        // Keep selected combo updated if currently selected
        if (selectedCombo) {
          const refreshed = res.items.find((c) => c._id === selectedCombo._id);
          if (refreshed) setSelectedCombo(refreshed);
        }
      } else if (Array.isArray(res)) {
        // Fallback if backend returned plain array
        setCombos(res);
        setTotalCount(res.length);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải danh sách combo');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, activeTab, statusFilter, partnerFilter, priceRangeFilter, toast]);

  useEffect(() => {
    void loadCombos();
  }, [loadCombos]);

  // Handle Tab Change
  const handleTabSelect = (tab: 'ALL' | ComboStatus) => {
    setActiveTab(tab);
    setStatusFilter(tab);
    setPage(1);
  };

  // Checkbox Selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === combos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(combos.map((c) => c._id)));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Row selection for detail dock
  const handleRowClick = (combo: ComboItem) => {
    if (selectedCombo?._id === combo._id) {
      setSelectedCombo(null);
    } else {
      setSelectedCombo(combo);
      setActiveGalleryIndex(0);
      setDetailSubtab('info');
    }
  };

  // Moderation Handlers
  const handleApprove = async (combo: ComboItem) => {
    setProcessingAction(true);
    try {
      await httpClient.patch(`/combo-promotions/admin/${combo._id}/moderation`, {
        status: 'ACTIVE',
        reason: 'Đạt chuẩn phê duyệt hệ thống LUMÉ',
      });
      toast.success(`Đã phê duyệt thành công combo "${combo.name}"`);
      await loadCombos();
      if (selectedCombo?._id === combo._id) {
        setSelectedCombo((prev) => (prev ? { ...prev, status: 'ACTIVE' } : null));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể phê duyệt combo');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenRejectModal = (combo: ComboItem) => {
    setRejectModalCombo(combo);
    setRejectPreset('Hình ảnh mờ hoặc không đạt chuẩn chất lượng');
    setRejectCustomReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalCombo) return;
    const finalReason = [rejectPreset, rejectCustomReason.trim()].filter(Boolean).join(' - Chi tiết: ');
    if (!finalReason) {
      toast.error('Vui lòng chọn hoặc nhập lý do từ chối');
      return;
    }

    setProcessingAction(true);
    try {
      await httpClient.patch(`/combo-promotions/admin/${rejectModalCombo._id}/moderation`, {
        status: 'REJECTED',
        reason: finalReason,
      });
      toast.success(`Đã từ chối combo "${rejectModalCombo.name}"`);
      setRejectModalCombo(null);
      await loadCombos();
      if (selectedCombo?._id === rejectModalCombo._id) {
        setSelectedCombo((prev) => (prev ? { ...prev, status: 'REJECTED', moderationReason: finalReason } : null));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể từ chối combo');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenRevisionModal = (combo: ComboItem) => {
    setRevisionModalCombo(combo);
    setRevisionChecklist({
      imageQuality: false,
      pricingDetail: false,
      inclusionDetail: false,
      durationLocation: false,
      cancelPolicy: false,
    });
    setRevisionNotes('');
  };

  const handleConfirmRevision = async () => {
    if (!revisionModalCombo) return;

    const checklistLabels: Record<string, string> = {
      imageQuality: 'Nâng cấp hình ảnh độ phân giải cao',
      pricingDetail: 'Làm rõ chi tiết giá gốc & tỷ lệ chiết khấu',
      inclusionDetail: 'Bổ sung danh sách dịch vụ đi kèm cụ thể',
      durationLocation: 'Xác nhận lại địa điểm & thời lượng chụp',
      cancelPolicy: 'Ghi rõ chính sách đổi trả & hoàn hủy cọc',
    };

    const selectedItems = Object.entries(revisionChecklist)
      .filter(([_, checked]) => checked)
      .map(([key]) => checklistLabels[key]);

    const reasonParts = [];
    if (selectedItems.length > 0) {
      reasonParts.push(`Mục cần bổ sung: ${selectedItems.join(', ')}`);
    }
    if (revisionNotes.trim()) {
      reasonParts.push(`Ghi chú: ${revisionNotes.trim()}`);
    }

    const finalReason = reasonParts.join(' | ') || 'Cần bổ sung thêm thông tin chi tiết cho combo dịch vụ';

    setProcessingAction(true);
    try {
      await httpClient.patch(`/combo-promotions/admin/${revisionModalCombo._id}/moderation`, {
        status: 'CHANGES_REQUESTED',
        reason: finalReason,
      });
      toast.success(`Đã gửi yêu cầu bổ sung cho combo "${revisionModalCombo.name}"`);
      setRevisionModalCombo(null);
      await loadCombos();
      if (selectedCombo?._id === revisionModalCombo._id) {
        setSelectedCombo((prev) => (prev ? { ...prev, status: 'CHANGES_REQUESTED', moderationReason: finalReason } : null));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi yêu cầu bổ sung');
    } finally {
      setProcessingAction(false);
    }
  };

  // Status Pill Renderer
  const renderStatusPill = (status: ComboStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="lume-combo-status-pill pending">
            <span className="lume-combo-status-dot" />
            Chờ duyệt
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="lume-combo-status-pill approved">
            <span className="lume-combo-status-dot" />
            Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="lume-combo-status-pill rejected">
            <span className="lume-combo-status-dot" />
            Đã từ chối
          </span>
        );
      case 'CHANGES_REQUESTED':
        return (
          <span className="lume-combo-status-pill revision">
            <span className="lume-combo-status-dot" />
            Cần bổ sung
          </span>
        );
      default:
        return (
          <span className="lume-combo-status-pill pending">
            <span className="lume-combo-status-dot" />
            {status}
          </span>
        );
    }
  };

  // Category display
  const getCategoryLabel = (combo: ComboItem) => {
    if (combo.productId && combo.photographyPackageId) {
      return 'Áo dài + Chụp ảnh';
    }
    if (combo.photographyPackageId) {
      return 'Chụp ảnh ngoại cảnh';
    }
    return 'Áo dài truyền thống';
  };

  // Unique partner options from combos list if providersList is empty
  const partnerOptions = useMemo(() => {
    if (providersList.length > 0) return providersList;
    const map = new Map<string, string>();
    combos.forEach((c) => {
      if (c.providerId?._id && c.providerId.businessName) {
        map.set(c.providerId._id, c.providerId.businessName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [providersList, combos]);

  // Gallery images for active combo
  const currentImages = useMemo(() => {
    if (!selectedCombo) return [];
    if (selectedCombo.images && selectedCombo.images.length > 0) {
      return selectedCombo.images;
    }
    const list: string[] = [];
    if (selectedCombo.image) list.push(selectedCombo.image);
    if (selectedCombo.productId?.images) list.push(...selectedCombo.productId.images);
    if (selectedCombo.photographyPackageId?.images) list.push(...selectedCombo.photographyPackageId.images);
    return list.length > 0 ? Array.from(new Set(list)) : [fallbackImage];
  }, [selectedCombo]);

  return (
    <div className="lume-combo-mod-container">
      {/* 1. Breadcrumb */}
      <div className="lume-combo-mod-breadcrumb">
        <span>Trang chủ</span>
        <span className="separator">/</span>
        <span className="current">Phê duyệt combo</span>
      </div>

      {/* 2. Header & Action Button */}
      <div className="lume-combo-mod-header">
        <div className="lume-combo-mod-header-left">
          <h1>Kiểm duyệt combo</h1>
          <p>Xem xét và phê duyệt các combo dịch vụ được đăng bởi đối tác trước khi hiển thị trên nền tảng.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AdminReloadButton onClick={loadCombos} isLoading={loading} />
          <button
            type="button"
            className="lume-combo-guideline-btn"
            onClick={() => setIsGuidelineOpen(true)}
          >
            <HelpCircle size={16} />
            <span>Hướng dẫn duyệt combo</span>
          </button>
        </div>
      </div>

      {/* 3. 5 KPI Metric Cards (Figma exact match) */}
      <div className="lume-combo-metrics-grid">
        {/* Card 1: Chờ duyệt */}
        <div
          className={`lume-combo-metric-card ${activeTab === 'PENDING_REVIEW' ? 'active-border' : ''}`}
          onClick={() => handleTabSelect('PENDING_REVIEW')}
          style={{ cursor: 'pointer' }}
        >
          <div className="lume-combo-metric-top">
            <div className="lume-combo-metric-icon pending">
              <LayoutGrid size={20} />
            </div>
            <div className="lume-combo-metric-info">
              <span className="lume-combo-metric-label">Tổng chờ duyệt</span>
              <span className="lume-combo-metric-value">{metrics.pending}</span>
            </div>
          </div>
          <div className="lume-combo-metric-trend up-red">
            <span>{metrics.trends.pending || '↑ 12% so với tuần trước'}</span>
          </div>
        </div>

        {/* Card 2: Đã duyệt */}
        <div
          className={`lume-combo-metric-card ${activeTab === 'ACTIVE' ? 'active-border' : ''}`}
          onClick={() => handleTabSelect('ACTIVE')}
          style={{ cursor: 'pointer' }}
        >
          <div className="lume-combo-metric-top">
            <div className="lume-combo-metric-icon approved">
              <CheckCircle size={20} />
            </div>
            <div className="lume-combo-metric-info">
              <span className="lume-combo-metric-label">Đã duyệt</span>
              <span className="lume-combo-metric-value">{metrics.approved}</span>
            </div>
          </div>
          <div className="lume-combo-metric-trend up">
            <span>{metrics.trends.approved || '↑ 18% so với tháng trước'}</span>
          </div>
        </div>

        {/* Card 3: Đã từ chối */}
        <div
          className={`lume-combo-metric-card ${activeTab === 'REJECTED' ? 'active-border' : ''}`}
          onClick={() => handleTabSelect('REJECTED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="lume-combo-metric-top">
            <div className="lume-combo-metric-icon rejected">
              <XCircle size={20} />
            </div>
            <div className="lume-combo-metric-info">
              <span className="lume-combo-metric-label">Đã từ chối</span>
              <span className="lume-combo-metric-value">{metrics.rejected}</span>
            </div>
          </div>
          <div className="lume-combo-metric-trend down">
            <span>{metrics.trends.rejected || '↓ 11% so với tháng trước'}</span>
          </div>
        </div>

        {/* Card 4: Cần bổ sung */}
        <div
          className={`lume-combo-metric-card ${activeTab === 'CHANGES_REQUESTED' ? 'active-border' : ''}`}
          onClick={() => handleTabSelect('CHANGES_REQUESTED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="lume-combo-metric-top">
            <div className="lume-combo-metric-icon revision">
              <AlertCircle size={20} />
            </div>
            <div className="lume-combo-metric-info">
              <span className="lume-combo-metric-label">Cần bổ sung</span>
              <span className="lume-combo-metric-value">{metrics.changesRequested}</span>
            </div>
          </div>
          <div className="lume-combo-metric-trend amber">
            <span>{metrics.trends.changesRequested || '↑ 33% so với tháng trước'}</span>
          </div>
        </div>

        {/* Card 5: Tổng combo */}
        <div
          className={`lume-combo-metric-card ${activeTab === 'ALL' ? 'active-border' : ''}`}
          onClick={() => handleTabSelect('ALL')}
          style={{ cursor: 'pointer' }}
        >
          <div className="lume-combo-metric-top">
            <div className="lume-combo-metric-icon total">
              <Layers size={20} />
            </div>
            <div className="lume-combo-metric-info">
              <span className="lume-combo-metric-label">Tổng combo</span>
              <span className="lume-combo-metric-value">{metrics.total}</span>
            </div>
          </div>
          <div className="lume-combo-metric-trend up">
            <span>{metrics.trends.total || '↑ 26% so với tháng trước'}</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Bar (Figma match) */}
      <div className="lume-combo-filter-bar">
        {/* Search */}
        <div className="lume-combo-search-wrap">
          <Search size={16} />
          <input
            type="text"
            className="lume-combo-search-input"
            placeholder="Tìm kiếm theo tên combo, mã combo, đối tác..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              style={{
                position: 'absolute',
                right: 10,
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Danh mục */}
        <div className="lume-combo-filter-group">
          <label className="lume-combo-filter-label">Danh mục</label>
          <select
            className="lume-combo-filter-select"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="AO_DAI_PHOTO">Áo dài + Chụp ảnh</option>
            <option value="AO_DAI_MAKEUP">Áo dài + Chụp ảnh + Makeup</option>
            <option value="PHOTO_OUTDOOR">Chụp ảnh ngoại cảnh</option>
          </select>
        </div>

        {/* Đối tác */}
        <div className="lume-combo-filter-group">
          <label className="lume-combo-filter-label">Đối tác</label>
          <select
            className="lume-combo-filter-select"
            value={partnerFilter}
            onChange={(e) => {
              setPartnerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            {partnerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Trạng thái */}
        <div className="lume-combo-filter-group">
          <label className="lume-combo-filter-label">Trạng thái</label>
          <select
            className="lume-combo-filter-select"
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as any;
              setStatusFilter(val);
              setActiveTab(val);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="PENDING_REVIEW">Chờ duyệt</option>
            <option value="ACTIVE">Đã duyệt</option>
            <option value="CHANGES_REQUESTED">Cần bổ sung</option>
            <option value="REJECTED">Đã từ chối</option>
          </select>
        </div>

        {/* Khoảng giá */}
        <div className="lume-combo-filter-group">
          <label className="lume-combo-filter-label">Khoảng giá</label>
          <select
            className="lume-combo-filter-select"
            value={priceRangeFilter}
            onChange={(e) => {
              setPriceRangeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="UNDER_1M">Dưới 1 triệu</option>
            <option value="1M_2M">1 - 2 triệu</option>
            <option value="2M_3M">2 - 3 triệu</option>
            <option value="OVER_3M">Trên 3 triệu</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        <button
          type="button"
          className="lume-combo-filter-btn"
          onClick={() => {
            setSearchTerm('');
            setCategoryFilter('ALL');
            setPartnerFilter('ALL');
            setStatusFilter('ALL');
            setActiveTab('ALL');
            setPriceRangeFilter('ALL');
            setPage(1);
          }}
          title="Đặt lại toàn bộ bộ lọc"
        >
          <SlidersHorizontal size={14} />
          <span>Bộ lọc</span>
        </button>
      </div>

      {/* 5. Status Tabs Bar (Figma exact match) */}
      <div className="lume-combo-tabs-bar">
        <button
          type="button"
          className={`lume-combo-tab-item ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => handleTabSelect('ALL')}
        >
          <span>Tất cả</span>
          <span className="lume-combo-tab-count">{metrics.total}</span>
        </button>

        <button
          type="button"
          className={`lume-combo-tab-item ${activeTab === 'PENDING_REVIEW' ? 'active' : ''}`}
          onClick={() => handleTabSelect('PENDING_REVIEW')}
        >
          <span>Chờ duyệt</span>
          <span className="lume-combo-tab-count">{metrics.pending}</span>
        </button>

        <button
          type="button"
          className={`lume-combo-tab-item ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => handleTabSelect('ACTIVE')}
        >
          <span>Đã duyệt</span>
          <span className="lume-combo-tab-count">{metrics.approved}</span>
        </button>

        <button
          type="button"
          className={`lume-combo-tab-item ${activeTab === 'REJECTED' ? 'active' : ''}`}
          onClick={() => handleTabSelect('REJECTED')}
        >
          <span>Đã từ chối</span>
          <span className="lume-combo-tab-count">{metrics.rejected}</span>
        </button>

        <button
          type="button"
          className={`lume-combo-tab-item ${activeTab === 'CHANGES_REQUESTED' ? 'active' : ''}`}
          onClick={() => handleTabSelect('CHANGES_REQUESTED')}
        >
          <span>Cần bổ sung</span>
          <span className="lume-combo-tab-count">{metrics.changesRequested}</span>
        </button>
      </div>

      {/* 6. Workspace: Full Width Table */}
      <div className="lume-combo-workspace">
        {/* Table Container */}
        <div className="lume-combo-table-card">
          <div
            ref={tableScrollRef}
            className="lume-combo-table-scroll"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUpOrLeave}
            onMouseLeave={onMouseUpOrLeave}
          >
            <table className="lume-combo-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={combos.length > 0 && selectedIds.size === combos.length}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: 45, textAlign: 'center' }}>#</th>
                  <th style={{ width: 64 }}>Ảnh</th>
                  <th style={{ minWidth: 220 }}>Tên combo / Mã combo</th>
                  <th style={{ minWidth: 160 }}>Danh mục</th>
                  <th style={{ minWidth: 180 }}>Đối tác</th>
                  <th style={{ minWidth: 130 }}>Giá (VNĐ)</th>
                  <th style={{ minWidth: 140 }}>Ngày đăng</th>
                  <th style={{ minWidth: 120 }}>Trạng thái</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 8px', display: 'block', color: '#881337' }} />
                      Đang tải danh sách combo từ hệ thống...
                    </td>
                  </tr>
                ) : combos.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '56px 20px', color: '#64748b' }}>
                      <Layers size={32} style={{ margin: '0 auto 8px', display: 'block', color: '#cbd5e1' }} />
                      Không tìm thấy combo nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  combos.map((combo, idx) => {
                    const isSelected = selectedCombo?._id === combo._id;
                    const isChecked = selectedIds.has(combo._id);
                    const rowNum = (page - 1) * pageSize + idx + 1;
                    const thumbUrl = resolveImageUrl(
                      combo.images?.[0] || combo.image || combo.productId?.images?.[0] || combo.photographyPackageId?.images?.[0]
                    );

                    return (
                      <tr
                        key={combo._id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => handleRowClick(combo)}
                      >
                        {/* Checkbox */}
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleToggleSelectRow(combo._id, e as any)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* Row Index */}
                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{rowNum}</td>

                        {/* Thumbnail */}
                        <td>
                          <img
                            src={thumbUrl}
                            alt={combo.name}
                            className="lume-combo-thumb-cell"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackImage;
                            }}
                          />
                        </td>

                        {/* Name & Code */}
                        <td>
                          <div className="lume-combo-name-block">
                            <span className="lume-combo-name-title">{combo.name}</span>
                            <span className="lume-combo-code-sub">{combo.code || `CB${combo._id.slice(-6).toUpperCase()}`}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td>
                          <span className="lume-combo-cat-pill">
                            {getCategoryLabel(combo)}
                          </span>
                        </td>

                        {/* Partner */}
                        <td>
                          <div className="lume-combo-partner-block">
                            <span className="lume-combo-partner-name">
                              {combo.providerId?.businessName || 'Áo Dài Cố Đô'}
                            </span>
                            <span className="lume-combo-partner-code">
                              {combo.partnerCode || (combo.providerId?._id ? `#DT${combo.providerId._id.slice(-5).toUpperCase()}` : '#DT00012')}
                            </span>
                          </div>
                        </td>

                        {/* Price */}
                        <td>
                          <span className="lume-combo-price-cell">
                            {formatVND(combo.finalPrice ?? combo.comboPrice)}
                          </span>
                        </td>

                        {/* Date Registered */}
                        <td style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(combo.createdAt)}
                        </td>

                        {/* Status */}
                        <td>{renderStatusPill(combo.status)}</td>

                        {/* 3 Dots Actions Menu */}
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div className="lume-combo-action-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={() => setActionMenuOpenId(actionMenuOpenId === combo._id ? null : combo._id)}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                                width: 28,
                                height: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#64748b',
                                cursor: 'pointer',
                              }}
                            >
                              <MoreHorizontal size={15} />
                            </button>

                            {actionMenuOpenId === combo._id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: 4,
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 8,
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                                  width: 170,
                                  zIndex: 50,
                                  overflow: 'hidden',
                                  textAlign: 'left',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCombo(combo);
                                    setActionMenuOpenId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 12,
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Eye size={14} color="#64748b" />
                                  <span>Xem chi tiết</span>
                                </button>

                                {combo.status !== 'ACTIVE' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleApprove(combo);
                                      setActionMenuOpenId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      fontSize: 12,
                                      color: '#059669',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <CheckCircle size={14} />
                                    <span>Phê duyệt</span>
                                  </button>
                                )}

                                {combo.status !== 'CHANGES_REQUESTED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenRevisionModal(combo);
                                      setActionMenuOpenId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      fontSize: 12,
                                      color: '#ea580c',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <AlertCircle size={14} />
                                    <span>Yêu cầu bổ sung</span>
                                  </button>
                                )}

                                {combo.status !== 'REJECTED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenRejectModal(combo);
                                      setActionMenuOpenId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      fontSize: 12,
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <XCircle size={14} />
                                    <span>Từ chối combo</span>
                                  </button>
                                )}
                              </div>
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

          {/* Table Footer: Counter & Pagination */}
          <div className="lume-combo-mod-footer">
            <div>
              Hiển thị {combos.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(page * pageSize, totalCount)} của {totalCount} combo
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Pagination controls */}
              <div className="lume-combo-mod-pagination">
                <button
                  type="button"
                  className="lume-combo-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`lume-combo-page-btn ${page === pNum ? 'active' : ''}`}
                      onClick={() => setPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="lume-combo-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Page size dropdown (Figma exact match: 8 / trang) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="lume-combo-filter-select"
                  style={{ padding: '5px 10px', fontSize: 12 }}
                >
                  <option value={8}>8 / trang</option>
                  <option value={15}>15 / trang</option>
                  <option value={25}>25 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Spacious Slide-Over Inspection Drawer (980px - 1380px) */}
      {selectedCombo && (
        <>
          <div
            className="lume-combo-drawer-backdrop"
            onClick={() => setSelectedCombo(null)}
          />

          <div className={`lume-combo-detail-drawer ${isMaximized ? 'maximized' : ''}`}>
            {/* Drawer Header */}
            <div className="lume-combo-drawer-header">
              <div className="lume-combo-drawer-title-wrap">
                <h2 className="lume-combo-drawer-title" title={selectedCombo.name}>
                  {selectedCombo.name}
                </h2>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  ({selectedCombo.code || `CB${selectedCombo._id.slice(-6).toUpperCase()}`})
                </span>
                {renderStatusPill(selectedCombo.status)}
              </div>

              <div className="lume-combo-drawer-controls">
                {/* Navigation between combos */}
                {combos.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                    <button
                      type="button"
                      className="lume-combo-drawer-nav-btn"
                      onClick={handlePrevCombo}
                      disabled={currentIndex <= 0}
                      title="Combo trước"
                    >
                      <ChevronLeft size={14} />
                      <span>Trước</span>
                    </button>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: '0 4px' }}>
                      {currentIndex + 1} / {combos.length}
                    </span>
                    <button
                      type="button"
                      className="lume-combo-drawer-nav-btn"
                      onClick={handleNextCombo}
                      disabled={currentIndex >= combos.length - 1}
                      title="Combo tiếp theo"
                    >
                      <span>Tiếp</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Maximize / Minimize Button */}
                <button
                  type="button"
                  className="lume-combo-drawer-icon-btn"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Thu nhỏ giao diện (980px)' : 'Mở rộng toàn màn hình (1380px)'}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  className="lume-combo-drawer-icon-btn"
                  onClick={() => setSelectedCombo(null)}
                  title="Đóng chi tiết (Phím Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 2-Column Spacious Body */}
            <div className="lume-combo-drawer-body">
              {/* CỘT TRÁI: Visuals + Mô tả + Dịch vụ bao gồm */}
              <div className="lume-combo-drawer-col">
                {/* Showcase ảnh lớn */}
                <div className="lume-combo-showcase-box">
                  <img
                    src={resolveImageUrl(currentImages[activeGalleryIndex] || currentImages[0])}
                    alt={selectedCombo.name}
                    className="lume-combo-showcase-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = fallbackImage;
                    }}
                  />
                  <div className="lume-combo-showcase-badge">
                    {getCategoryLabel(selectedCombo)}
                  </div>
                  <div className="lume-combo-showcase-counter">
                    {activeGalleryIndex + 1} / {currentImages.length}
                  </div>
                </div>

                {/* Dải thumbnails nếu có nhiều ảnh */}
                {currentImages.length > 1 && (
                  <div className="lume-combo-thumbs-strip">
                    {currentImages.map((img, idx) => (
                      <div
                        key={idx}
                        className={`lume-combo-thumb-item ${activeGalleryIndex === idx ? 'active' : ''}`}
                        onClick={() => setActiveGalleryIndex(idx)}
                      >
                        <img
                          src={resolveImageUrl(img)}
                          alt={`Thumbnail ${idx + 1}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackImage;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Card: Mô tả dịch vụ */}
                <div className="lume-combo-card">
                  <h4 className="lume-combo-card-title">Mô tả chi tiết combo</h4>
                  <p className="lume-combo-desc-text">
                    {selectedCombo.description ||
                      'Trải nghiệm vẻ đẹp cổ kính của Huế với combo áo dài truyền thống kết hợp chụp ảnh tại Đại Nội và sông Hương. Bao gồm trang phục, makeup nhẹ, nhiếp ảnh gia chuyên nghiệp và chỉnh sửa ảnh.'}
                  </p>
                </div>

                {/* Card: Dịch vụ bao gồm trong combo (5 Tiện ích) */}
                <div className="lume-combo-card">
                  <h4 className="lume-combo-card-title">Dịch vụ bao gồm trong combo</h4>
                  <div className="lume-combo-inclusions-grid">
                    <div className="lume-combo-inc-card">
                      <div className="lume-combo-inc-icon"><Shirt size={16} /></div>
                      <div>
                        <div style={{ color: '#0f172a' }}>Áo dài truyền thống</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{selectedCombo.aoDaiQuantity || 1} bộ cao cấp</div>
                      </div>
                    </div>

                    <div className="lume-combo-inc-card">
                      <div className="lume-combo-inc-icon"><Camera size={16} /></div>
                      <div>
                        <div style={{ color: '#0f172a' }}>Chụp ảnh nghệ thuật</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {selectedCombo.photographyPackageId?.editedPhotosCount ? `${selectedCombo.photographyPackageId.editedPhotosCount}+` : '100+'} ảnh gốc
                        </div>
                      </div>
                    </div>

                    <div className="lume-combo-inc-card">
                      <div className="lume-combo-inc-icon"><Sparkles size={16} /></div>
                      <div>
                        <div style={{ color: '#0f172a' }}>Makeup & Làm tóc</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Phong cách nhẹ nhàng tự nhiên</div>
                      </div>
                    </div>

                    <div className="lume-combo-inc-card">
                      <div className="lume-combo-inc-icon"><Layers size={16} /></div>
                      <div>
                        <div style={{ color: '#0f172a' }}>Chỉnh sửa ảnh</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>20 ảnh Photoshop hoàn thiện</div>
                      </div>
                    </div>

                    <div className="lume-combo-inc-card" style={{ gridColumn: 'span 2' }}>
                      <div className="lume-combo-inc-icon"><Scissors size={16} /></div>
                      <div>
                        <div style={{ color: '#0f172a' }}>Hỗ trợ tạo dáng & Stylist</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Kèm đạo cụ nón lá, hoa sen theo concept</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: Pricing + Subtabs + Chi tiết + Ghi chú */}
              <div className="lume-combo-drawer-col">
                {/* Quick Pricing Ribbon */}
                <div className="lume-combo-pricing-ribbon">
                  <div className="lume-combo-price-main">
                    <span className="lume-combo-price-label">Giá bán combo</span>
                    <span className="lume-combo-price-amount">
                      {formatVND(selectedCombo.finalPrice ?? selectedCombo.comboPrice)} VNĐ
                    </span>
                    <div className="lume-combo-price-orig-wrap">
                      {selectedCombo.originalTotal ? (
                        <span className="lume-combo-price-orig">
                          {formatVND(selectedCombo.originalTotal)} VNĐ
                        </span>
                      ) : null}
                      <span className="lume-combo-discount-badge">
                        -{selectedCombo.discountPercent || 20}% Tiết kiệm
                      </span>
                    </div>
                  </div>

                  <div className="lume-combo-meta-chips">
                    <div className="lume-combo-meta-chip">
                      <Clock size={14} color="#881337" />
                      <span>{selectedCombo.durationHours || 3} giờ chụp</span>
                    </div>
                    <div className="lume-combo-meta-chip">
                      <User size={14} color="#881337" />
                      <span>{selectedCombo.shootPeopleCount || 1} người</span>
                    </div>
                  </div>
                </div>

                {/* 4 Subtabs Bar */}
                <div className="lume-combo-drawer-subtabs">
                  <button
                    type="button"
                    className={`lume-combo-dsubtab-btn ${detailSubtab === 'info' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('info')}
                  >
                    Thông tin cơ bản
                  </button>
                  <button
                    type="button"
                    className={`lume-combo-dsubtab-btn ${detailSubtab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('schedule')}
                  >
                    Lịch trình ({selectedCombo.durationHours || 3}h)
                  </button>
                  <button
                    type="button"
                    className={`lume-combo-dsubtab-btn ${detailSubtab === 'terms' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('terms')}
                  >
                    Điều khoản
                  </button>
                  <button
                    type="button"
                    className={`lume-combo-dsubtab-btn ${detailSubtab === 'reviews' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('reviews')}
                  >
                    Đánh giá (4.9 ★)
                  </button>
                </div>

                {/* Subtab 1: Thông tin cơ bản */}
                {detailSubtab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Partner Card */}
                    <div className="lume-combo-partner-profile-card">
                      <div className="lume-combo-partner-profile-left">
                        <img
                          src={
                            selectedCombo.providerId?.avatar
                              ? resolveImageUrl(selectedCombo.providerId.avatar)
                              : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
                          }
                          alt="Avatar đối tác"
                          className="lume-combo-partner-profile-avatar"
                        />
                        <div>
                          <div className="lume-combo-partner-profile-name">
                            {selectedCombo.providerId?.businessName || 'Áo Dài Cố Đô'}
                          </div>
                          <div className="lume-combo-partner-profile-code">
                            Mã đối tác: {selectedCombo.partnerCode || '#DT00012'} • ★ 4.9 uy tín
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="lume-combo-partner-link"
                        onClick={() =>
                          setPartnerProfileModal({
                            name: selectedCombo.providerId?.businessName || 'Áo Dài Cố Đô',
                            code: selectedCombo.partnerCode || '#DT00012',
                            phone: selectedCombo.providerId?.phone || '0905 123 456',
                            address: selectedCombo.providerId?.address || '45 Lê Lợi, TP. Huế',
                            rating: selectedCombo.providerId?.rating || 4.9,
                          })
                        }
                      >
                        Xem hồ sơ
                      </button>
                    </div>

                    {/* Specs Grid */}
                    <div className="lume-combo-spec-grid">
                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Mã định danh combo</span>
                        <span className="lume-combo-spec-val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {selectedCombo.code || `CB${selectedCombo._id.slice(-6).toUpperCase()}`}
                        </span>
                      </div>

                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Danh mục dịch vụ</span>
                        <span className="lume-combo-spec-val">{getCategoryLabel(selectedCombo)}</span>
                      </div>

                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Địa điểm tổ chức</span>
                        <span className="lume-combo-spec-val">
                          {selectedCombo.location || selectedCombo.photographyPackageId?.location || 'Đại Nội Huế, Sông Hương'}
                        </span>
                      </div>

                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Khung giờ thực hiện</span>
                        <span className="lume-combo-spec-val">
                          {selectedCombo.shootTimeSlot || '08:00 - 11:00'}
                        </span>
                      </div>

                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Thời hạn áp dụng</span>
                        <span className="lume-combo-spec-val">01/07/2026 - 31/12/2026</span>
                      </div>

                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Ngày đối tác đăng ký</span>
                        <span className="lume-combo-spec-val">{formatDate(selectedCombo.createdAt)}</span>
                      </div>
                    </div>

                    {/* Moderation Note if present */}
                    {selectedCombo.moderationReason && (
                      <div className="lume-combo-audit-card">
                        <div style={{ fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertCircle size={15} />
                          <span>Ghi chú từ ban kiểm duyệt:</span>
                        </div>
                        <div className="lume-combo-audit-reason">
                          {selectedCombo.moderationReason}
                        </div>
                        {selectedCombo.moderatedAt && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            Xử lý lúc: {formatDate(selectedCombo.moderatedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 2: Lịch trình */}
                {detailSubtab === 'schedule' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="lume-combo-spec-grid">
                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Khung giờ chuẩn</span>
                        <span className="lume-combo-spec-val">{selectedCombo.shootTimeSlot || '08:00 - 11:00'}</span>
                      </div>
                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Thời lượng chụp</span>
                        <span className="lume-combo-spec-val">{selectedCombo.durationHours || 3} giờ liên tục</span>
                      </div>
                      <div className="lume-combo-spec-row">
                        <span className="lume-combo-spec-label">Số người chụp</span>
                        <span className="lume-combo-spec-val">{selectedCombo.shootPeopleCount || 1} người</span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Lộ trình mẫu chuẩn của combo</h4>
                      <div style={{ borderLeft: '2px solid #fecdd3', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#881337' }}>08:00 - 08:30</div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>Đón khách tại cửa hàng đối tác, chọn áo dài & phụ kiện nón lá</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#881337' }}>08:30 - 09:15</div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>Trang điểm tự nhiên & làm tóc cổ phong xứ Huế</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#881337' }}>09:15 - 10:45</div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>Di chuyển đến Đại Nội / Sông Hương, thực hiện bộ ảnh ngoại cảnh cùng nhiếp ảnh gia</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#881337' }}>10:45 - 11:00</div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>Hoàn trả trang phục & bàn giao toàn bộ file ảnh gốc chất lượng cao</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 3: Điều khoản */}
                {detailSubtab === 'terms' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4 }}>
                        1. Chính sách hoàn hủy & đổi lịch
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Miễn phí hủy lịch trước 48 giờ. Hủy trong vòng 24-48 giờ hoàn 50% tiền cọc. Đổi ngày chụp miễn phí tối đa 1 lần nếu thông báo trước 24 giờ.
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4 }}>
                        2. Cam kết bàn giao ảnh
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Toàn bộ ảnh gốc (100+ ảnh) được tải lên Google Drive trong vòng 24h sau buổi chụp. 20 ảnh chỉnh sửa Photoshop chuyên nghiệp được bàn giao trong 3-5 ngày làm việc.
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4 }}>
                        3. Trách nhiệm trang phục & phụ kiện
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Khách hàng có trách nhiệm giữ gìn áo dài và phụ kiện trong suốt buổi chụp. Trường hợp hư hỏng nặng hoặc rách vải do lỗi chủ quan sẽ bồi hoàn theo quy định của tiệm.
                      </span>
                    </div>
                  </div>
                )}

                {/* Subtab 4: Đánh giá */}
                {detailSubtab === 'reviews' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#881337', lineHeight: 1 }}>4.9</div>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', margin: '6px 0', color: '#f59e0b', fontSize: 16 }}>
                          {'★'.repeat(5)}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>128 đánh giá thực tế</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, borderLeft: '1px solid #e2e8f0', paddingLeft: 18 }}>
                        Đối tác đã đồng hành cùng LUMÉ hơn 2 năm, đạt tỷ lệ hoàn thành lịch hẹn 99.4%, không có bất kỳ tranh chấp chưa xử lý nào. Đánh giá chất lượng dịch vụ đạt chuẩn Premium.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Bottom Action Footer */}
            <div className="lume-combo-drawer-footer">
              <div className="lume-combo-drawer-footer-left">
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedCombo.code || `CB${selectedCombo._id.slice(-6).toUpperCase()}`}
                </span>
                <span>•</span>
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <ShieldCheck size={15} /> Đối tác đã xác thực KYC
                </span>
              </div>

              <div className="lume-combo-drawer-footer-actions">
                <button
                  type="button"
                  className="lume-combo-btn-reject"
                  onClick={() => handleOpenRejectModal(selectedCombo)}
                  disabled={processingAction}
                >
                  <XCircle size={16} />
                  <span>Từ chối</span>
                </button>

                <button
                  type="button"
                  className="lume-combo-btn-revision-full"
                  onClick={() => handleOpenRevisionModal(selectedCombo)}
                  disabled={processingAction}
                >
                  <AlertCircle size={16} />
                  <span>Yêu cầu bổ sung</span>
                </button>

                <button
                  type="button"
                  className="lume-combo-btn-approve"
                  onClick={() => handleApprove(selectedCombo)}
                  disabled={processingAction}
                >
                  <CheckCircle size={16} />
                  <span>Duyệt combo</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ====================================================================
          MODALS
         ==================================================================== */}

      {/* Modal 1: Hướng dẫn duyệt combo */}
      {isGuidelineOpen && (
        <div className="lume-modal-backdrop" onClick={() => setIsGuidelineOpen(false)}>
          <div className="lume-modal-box size-lg" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon wine">
                  <HelpCircle size={22} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Quy chuẩn kiểm duyệt Combo dịch vụ LUMÉ</h3>
                  <p className="lume-modal-subtitle">Tiêu chuẩn chất lượng áp dụng cho toàn bộ đối tác áo dài & nhiếp ảnh</p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setIsGuidelineOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body" style={{ maxHeight: 420 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#334155' }}>
                <div style={{ borderLeft: '3px solid #881337', paddingLeft: 10 }}>
                  <strong style={{ color: '#881337' }}>1. Yêu cầu về hình ảnh sản phẩm & chụp mẫu:</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                    Tối thiểu 3 hình ảnh độ phân giải tối thiểu 1200x800px. Phải là ảnh chụp thực tế tại các địa danh Huế hoặc studio được chứng thực, không dùng ảnh mạng watermark mờ.
                  </p>
                </div>

                <div style={{ borderLeft: '3px solid #059669', paddingLeft: 10 }}>
                  <strong style={{ color: '#059669' }}>2. Quy chuẩn chiết khấu & giá combo:</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                    Giá bán combo phải thấp hơn ít nhất 5% và không vượt quá 80% tổng giá niêm yết của áo dài và gói chụp riêng lẻ để đảm bảo quyền lợi khuyến mãi cho khách hàng.
                  </p>
                </div>

                <div style={{ borderLeft: '3px solid #d97706', paddingLeft: 10 }}>
                  <strong style={{ color: '#d97706' }}>3. Cam kết dịch vụ đi kèm:</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                    Phải nêu rõ số lượng áo dài cung cấp, phong cách trang điểm, thời lượng buổi chụp, số lượng ảnh gốc và số ảnh chỉnh sửa chi tiết.
                  </p>
                </div>

                <div style={{ borderLeft: '3px solid #dc2626', paddingLeft: 10 }}>
                  <strong style={{ color: '#dc2626' }}>4. Xử lý vi phạm:</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                    Combo bị từ chối 3 lần do vi phạm thông tin sai sự thật sẽ dẫn đến việc đình chỉ quyền đăng combo của đối tác trong vòng 14 ngày.
                  </p>
                </div>
              </div>
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-primary"
                onClick={() => setIsGuidelineOpen(false)}
              >
                Đã hiểu quy chuẩn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Từ chối Combo */}
      {rejectModalCombo && (
        <div className="lume-modal-backdrop" onClick={() => setRejectModalCombo(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon red">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Từ chối phê duyệt combo</h3>
                  <p className="lume-modal-subtitle">{rejectModalCombo.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setRejectModalCombo(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Chọn lý do vi phạm phổ biến:
              </label>
              <select
                className="lume-combo-filter-select"
                value={rejectPreset}
                onChange={(e) => setRejectPreset(e.target.value)}
                style={{ width: '100%', padding: '9px 12px' }}
              >
                <option value="Hình ảnh mờ hoặc không đạt chuẩn chất lượng">Hình ảnh mờ hoặc không đạt chuẩn chất lượng</option>
                <option value="Giá combo không hợp lý hoặc vượt quá mức chiết khấu quy định">Giá combo không hợp lý hoặc vượt quá mức chiết khấu</option>
                <option value="Mô tả không đầy đủ cam kết dịch vụ chụp & trang phục">Mô tả không đầy đủ cam kết dịch vụ</option>
                <option value="Nghi vấn vi phạm bản quyền hình ảnh của bên thứ ba">Nghi vấn vi phạm bản quyền hình ảnh</option>
                <option value="Đối tác chưa hoàn thiện hồ sơ xác thực danh tính">Đối tác chưa hoàn thiện hồ sơ xác thực</option>
              </select>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 8 }}>
                Ghi chú chi tiết cho đối tác (tùy chọn):
              </label>
              <textarea
                rows={3}
                className="lume-combo-search-input"
                placeholder="Nhập hướng dẫn cụ thể để đối tác khắc phục trước khi gửi lại..."
                value={rejectCustomReason}
                onChange={(e) => setRejectCustomReason(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-ghost"
                onClick={() => setRejectModalCombo(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="lume-combo-btn-reject"
                style={{ padding: '8px 16px' }}
                onClick={handleConfirmReject}
                disabled={processingAction}
              >
                {processingAction ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Yêu cầu bổ sung */}
      {revisionModalCombo && (
        <div className="lume-modal-backdrop" onClick={() => setRevisionModalCombo(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon revision">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Yêu cầu bổ sung thông tin</h3>
                  <p className="lume-modal-subtitle">{revisionModalCombo.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setRevisionModalCombo(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Chọn các danh mục cần đối tác cập nhật:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={revisionChecklist.imageQuality}
                    onChange={(e) => setRevisionChecklist((p) => ({ ...p, imageQuality: e.target.checked }))}
                  />
                  <span>Hình ảnh: Bổ sung ảnh mẫu thực tế sắc nét tại địa điểm chụp</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={revisionChecklist.pricingDetail}
                    onChange={(e) => setRevisionChecklist((p) => ({ ...p, pricingDetail: e.target.checked }))}
                  />
                  <span>Giá bán: Minh bạch giá gốc và giá combo khuyến mãi</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={revisionChecklist.inclusionDetail}
                    onChange={(e) => setRevisionChecklist((p) => ({ ...p, inclusionDetail: e.target.checked }))}
                  />
                  <span>Dịch vụ bao gồm: Ghi rõ số lượng ảnh chỉnh sửa & trang phục</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={revisionChecklist.durationLocation}
                    onChange={(e) => setRevisionChecklist((p) => ({ ...p, durationLocation: e.target.checked }))}
                  />
                  <span>Lịch trình: Xác nhận địa điểm chụp và thời lượng cụ thể</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={revisionChecklist.cancelPolicy}
                    onChange={(e) => setRevisionChecklist((p) => ({ ...p, cancelPolicy: e.target.checked }))}
                  />
                  <span>Điều khoản: Bổ sung chính sách đổi lịch & hoàn cọc</span>
                </label>
              </div>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 10 }}>
                Tin nhắn hướng dẫn chi tiết gửi đối tác:
              </label>
              <textarea
                rows={3}
                className="lume-combo-search-input"
                placeholder="Nhập chi tiết yêu cầu để đối tác chỉnh sửa nhanh chóng..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-ghost"
                onClick={() => setRevisionModalCombo(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="lume-combo-btn-revision-full"
                style={{ padding: '8px 16px' }}
                onClick={handleConfirmRevision}
                disabled={processingAction}
              >
                {processingAction ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Hồ sơ đối tác */}
      {partnerProfileModal && (
        <div className="lume-modal-backdrop" onClick={() => setPartnerProfileModal(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon wine">
                  <User size={22} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Hồ sơ đối tác liên kết</h3>
                  <p className="lume-modal-subtitle">{partnerProfileModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setPartnerProfileModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <div className="lume-combo-dock-info-list">
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Mã đối tác</span>
                  <span className="lume-combo-dock-info-val">{partnerProfileModal.code}</span>
                </div>
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Tên kinh doanh</span>
                  <span className="lume-combo-dock-info-val">{partnerProfileModal.name}</span>
                </div>
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Số điện thoại liên hệ</span>
                  <span className="lume-combo-dock-info-val">{partnerProfileModal.phone}</span>
                </div>
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Địa chỉ trụ sở</span>
                  <span className="lume-combo-dock-info-val">{partnerProfileModal.address}</span>
                </div>
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Điểm đánh giá uy tín</span>
                  <span className="lume-combo-dock-info-val" style={{ color: '#d97706', fontWeight: 800 }}>
                    ★ {partnerProfileModal.rating} / 5.0
                  </span>
                </div>
                <div className="lume-combo-dock-info-row">
                  <span className="lume-combo-dock-info-label">Tình trạng kiểm định</span>
                  <span className="lume-combo-status-pill approved" style={{ padding: '2px 8px' }}>
                    <ShieldCheck size={12} /> Đã xác thực KYC
                  </span>
                </div>
              </div>
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-primary"
                onClick={() => setPartnerProfileModal(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboModerationManagement;
