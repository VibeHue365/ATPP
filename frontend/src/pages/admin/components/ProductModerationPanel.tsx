import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Camera,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Check,
  X,
  Eye,
  HelpCircle,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Shirt,
  Calendar,
  MapPin,
  Layers,
  Tag,
} from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import './productModerationFigma.css';

type ModerationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
type ModerationItemType = 'AODAI' | 'PHOTOGRAPHY';
type TabKey = 'ALL' | 'PENDING' | 'AODAI' | 'PHOTOGRAPHY' | 'APPROVED' | 'CHANGES_REQUESTED';

interface ModerationItem {
  _id: string;
  id: string;
  itemType: ModerationItemType;
  name: string;
  code: string;
  partnerCode: string;
  description?: string;
  images: string[];
  basePrice: number;
  depositAmount?: number;
  status: string;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  moderationHistory?: Array<{
    action: string;
    reason?: string | null;
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  quantity?: number;
  categoryId?: { _id: string; name: string; slug?: string };
  providerId?: {
    _id: string;
    businessName: string;
    contact?: { phone?: string; email?: string };
    address?: string;
    media?: { avatarUrl?: string };
  };
  // Photography Package fields:
  durationHours?: number;
  editedPhotosCount?: number;
  deliveryDays?: number;
  maxPeople?: number;
  location?: string;
  inclusions?: string[];
  // Ao Dai product fields:
  sizes?: string[];
  colors?: string[];
  materials?: string[];
}

interface ModerationMetrics {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalChangesRequested: number;
  pendingAodai: number;
  pendingPhotography: number;
  total: number;
  trends: {
    pending: string;
    approved: string;
    rejected: string;
    changesRequested: string;
    total: string;
  };
}

const fallbackThumb =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='none' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23F1F5F9'/%3E%3Cpath d='M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z' fill='%2394A3B8'/%3E%3Cpath d='m4 17 5-5 3 3 4-4 4 4' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const ProductModerationPanel: React.FC = () => {
  const toast = useToast();

  // Data State
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(8);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Metrics State (Purely dynamic from MongoDB Atlas)
  const [metrics, setMetrics] = useState<ModerationMetrics>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalChangesRequested: 0,
    pendingAodai: 0,
    pendingPhotography: 0,
    total: 0,
    trends: {
      pending: '0%',
      approved: '0%',
      rejected: '0%',
      changesRequested: '0%',
      total: '0 sản phẩm',
    },
  });

  // Filters & Tabs State
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('Tất cả');
  const [providerFilter, setProviderFilter] = useState<string>('Tất cả');
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả');
  const [dateFilter, setDateFilter] = useState<string>('Tất cả');

  // Categories & Providers lists for filter dropdowns
  const [categoriesList, setCategoriesList] = useState<Array<{ id: string; name: string }>>([]);
  const [providersList, setProvidersList] = useState<Array<{ id: string; name: string }>>([]);

  // Selection & Slide-Over Inspection Drawer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeProduct, setActiveProduct] = useState<ModerationItem | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number>(0);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [detailSubtab, setDetailSubtab] = useState<'info' | 'standards' | 'terms' | 'reputation'>('info');
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Sequential Navigation between products in the drawer
  const currentIndex = useMemo(() => {
    if (!activeProduct) return -1;
    return items.findIndex(
      (item) => (item.id || item._id) === (activeProduct.id || activeProduct._id)
    );
  }, [activeProduct, items]);

  const handlePrevProduct = () => {
    if (currentIndex > 0) {
      setActiveProduct(items[currentIndex - 1]);
      setActiveGalleryIndex(0);
    }
  };

  const handleNextProduct = () => {
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      setActiveProduct(items[currentIndex + 1]);
      setActiveGalleryIndex(0);
    }
  };

  // Keyboard shortcut: Esc to close slide-over inspection drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDetailOpen) {
        setIsDetailOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailOpen]);

  // Drag to scroll table horizontally
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

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

  // Modals
  const [isGuidelineOpen, setIsGuidelineOpen] = useState<boolean>(false);
  const [rejectModalProduct, setRejectModalProduct] = useState<ModerationItem | null>(null);
  const [rejectPreset, setRejectPreset] = useState<string>('Hình ảnh mờ hoặc không đúng quy chuẩn');
  const [rejectCustomReason, setRejectCustomReason] = useState<string>('');
  const [revisionModalProduct, setRevisionModalProduct] = useState<ModerationItem | null>(null);
  const [revisionChecklist, setRevisionChecklist] = useState<Record<string, boolean>>({
    sizeChart: false,
    detailedPhotos: false,
    materialDetails: false,
    packageDetails: false,
  });
  const [revisionNotes, setRevisionNotes] = useState<string>('');
  const [processingAction, setProcessingAction] = useState<boolean>(false);

  // Close context dropdown on outside click
  useEffect(() => {
    const handleDocClick = () => setActiveActionMenuId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Fetch filter options (Categories & Providers)
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [cats, provs] = await Promise.all([
          httpClient.get<any[]>('/categories').catch(() => []),
          httpClient.get<any>('/admin/stats/providers?limit=100').catch(() => ({ items: [] })),
        ]);
        if (Array.isArray(cats)) {
          setCategoriesList(cats.map((c) => ({ id: c._id || c.id, name: c.name })));
        }
        if (provs && provs.items) {
          setProvidersList(provs.items.map((p: any) => ({ id: p.id || p._id, name: p.name || p.businessName })));
        }
      } catch (e) {
        console.warn('Could not load filter dropdown lists', e);
      }
    };
    loadFilterOptions();
  }, []);

  // Format VND
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num || 0);

  // Format Date & Time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '—', time: '' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: '—', time: '' };
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return {
        date: `${day}/${month}/${year}`,
        time: `${hours}:${mins}`,
      };
    } catch {
      return { date: '—', time: '' };
    }
  };

  // Status Badge Renderer
  const renderStatusBadge = (status: ModerationStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="lume-mod-status-pill pending">
            <span className="lume-mod-status-dot" />
            Chờ duyệt
          </span>
        );
      case 'APPROVED':
        return (
          <span className="lume-mod-status-pill approved">
            <span className="lume-mod-status-dot" />
            Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="lume-mod-status-pill rejected">
            <span className="lume-mod-status-dot" />
            Đã từ chối
          </span>
        );
      case 'CHANGES_REQUESTED':
        return (
          <span className="lume-mod-status-pill revision">
            <span className="lume-mod-status-dot" />
            Cần bổ sung
          </span>
        );
      default:
        return (
          <span className="lume-mod-status-pill pending">
            <span className="lume-mod-status-dot" />
            Chờ duyệt
          </span>
        );
    }
  };

  // Type Badge Renderer
  const renderTypeBadge = (itemType: ModerationItemType) => {
    if (itemType === 'PHOTOGRAPHY') {
      return (
        <span className="lume-type-badge photography">
          <Camera size={12} />
          <span>Chụp ảnh</span>
        </span>
      );
    }
    return (
      <span className="lume-type-badge aodai">
        <Sparkles size={12} />
        <span>Áo dài</span>
      </span>
    );
  };

  // Fetch Products & Photography Packages
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      // Map tab selection to query filters
      let effectiveStatus = statusFilter !== 'Tất cả' ? statusFilter : '';
      let effectiveItemType = itemTypeFilter !== 'ALL' ? itemTypeFilter : '';

      if (activeTab === 'PENDING') {
        effectiveStatus = 'PENDING_REVIEW';
      } else if (activeTab === 'AODAI') {
        effectiveItemType = 'AODAI';
      } else if (activeTab === 'PHOTOGRAPHY') {
        effectiveItemType = 'PHOTOGRAPHY';
      } else if (activeTab === 'APPROVED') {
        effectiveStatus = 'APPROVED';
      } else if (activeTab === 'CHANGES_REQUESTED') {
        effectiveStatus = 'CHANGES_REQUESTED';
      }

      if (effectiveStatus) params.set('status', effectiveStatus);
      if (effectiveItemType) params.set('itemType', effectiveItemType);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter !== 'Tất cả') params.set('categoryId', categoryFilter);
      if (providerFilter !== 'Tất cả') params.set('providerId', providerFilter);

      const res = await httpClient.get<any>(`/admin/products/moderation?${params.toString()}`);
      if (res) {
        let loadedItems: ModerationItem[] = [];
        if (Array.isArray(res)) {
          loadedItems = res.map((p: any) => ({
            ...p,
            id: p._id || p.id,
            itemType: p.itemType || 'AODAI',
            code: p.code || (p.itemType === 'PHOTOGRAPHY' ? `GOI${(p._id || '').slice(-6).toUpperCase()}` : `SP${(p._id || '').slice(-7).toUpperCase()}`),
            partnerCode: p.partnerCode || (p.providerId?._id ? `#DT${p.providerId._id.slice(-5).toUpperCase()}` : '—'),
            quantity: p.quantity ?? (p.sizes?.length || 1),
          }));
          setItems(loadedItems);
          setTotal(loadedItems.length);
          setTotalPages(Math.ceil(loadedItems.length / limit) || 1);
        } else if (res.items) {
          loadedItems = res.items.map((p: any) => ({
            ...p,
            id: p._id || p.id,
            itemType: p.itemType || 'AODAI',
            code: p.code || (p.itemType === 'PHOTOGRAPHY' ? `GOI${(p._id || '').slice(-6).toUpperCase()}` : `SP${(p._id || '').slice(-7).toUpperCase()}`),
            partnerCode: p.partnerCode || (p.providerId?._id ? `#DT${p.providerId._id.slice(-5).toUpperCase()}` : '—'),
            quantity: p.quantity ?? (p.sizes?.length || 1),
          }));
          setItems(loadedItems);
          setTotal(res.total || loadedItems.length);
          setTotalPages(res.totalPages || Math.ceil((res.total || loadedItems.length) / limit) || 1);
          if (res.metrics) {
            setMetrics((prev) => ({
              ...prev,
              ...res.metrics,
            }));
          }
        }

        // Keep active product in sync if already selected
        if (loadedItems.length > 0) {
          setActiveProduct((prev) => {
            if (!prev) return null;
            return loadedItems.find((p) => p._id === prev._id || p.id === prev.id) || null;
          });
        }
      }
    } catch (err: any) {
      console.error('Error loading products for moderation:', err);
      toast.error(err?.message || 'Không thể tải danh sách kiểm duyệt sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [page, limit, activeTab, itemTypeFilter, searchQuery, categoryFilter, providerFilter, statusFilter, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Checkbox handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id || i._id)));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Moderation Actions
  const handleApprove = async (product: ModerationItem) => {
    setProcessingAction(true);
    try {
      await httpClient.patch(`/admin/products/${product._id || product.id}/moderation`, {
        action: 'APPROVED',
      });
      toast.success(`Đã phê duyệt "${product.name}" thành công!`);

      // Optimistic update
      setItems((prev) =>
        prev.map((p) => (p._id === product._id ? { ...p, moderationStatus: 'APPROVED', status: 'ACTIVE' } : p))
      );
      if (activeProduct && (activeProduct._id === product._id || activeProduct.id === product.id)) {
        setActiveProduct((prev) => (prev ? { ...prev, moderationStatus: 'APPROVED', status: 'ACTIVE' } : null));
      }
      setMetrics((prev) => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        totalApproved: prev.totalApproved + 1,
        pendingAodai: product.itemType === 'AODAI' ? Math.max(0, prev.pendingAodai - 1) : prev.pendingAodai,
        pendingPhotography: product.itemType === 'PHOTOGRAPHY' ? Math.max(0, prev.pendingPhotography - 1) : prev.pendingPhotography,
      }));
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể phê duyệt mục này');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSubmitReject = async () => {
    if (!rejectModalProduct) return;
    const finalReason = rejectCustomReason.trim()
      ? `${rejectPreset}: ${rejectCustomReason.trim()}`
      : rejectPreset;

    setProcessingAction(true);
    try {
      await httpClient.patch(`/admin/products/${rejectModalProduct._id || rejectModalProduct.id}/moderation`, {
        action: 'REJECTED',
        reason: finalReason,
      });
      toast.success(`Đã từ chối "${rejectModalProduct.name}".`);

      setItems((prev) =>
        prev.map((p) =>
          p._id === rejectModalProduct._id
            ? { ...p, moderationStatus: 'REJECTED', moderationReason: finalReason, status: 'DRAFT' }
            : p
        )
      );
      if (
        activeProduct &&
        (activeProduct._id === rejectModalProduct._id || activeProduct.id === rejectModalProduct.id)
      ) {
        setActiveProduct((prev) =>
          prev
            ? { ...prev, moderationStatus: 'REJECTED', moderationReason: finalReason, status: 'DRAFT' }
            : null
        );
      }
      setMetrics((prev) => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        totalRejected: prev.totalRejected + 1,
        pendingAodai: rejectModalProduct.itemType === 'AODAI' ? Math.max(0, prev.pendingAodai - 1) : prev.pendingAodai,
        pendingPhotography: rejectModalProduct.itemType === 'PHOTOGRAPHY' ? Math.max(0, prev.pendingPhotography - 1) : prev.pendingPhotography,
      }));
      setRejectModalProduct(null);
      setRejectCustomReason('');
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi từ chối');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSubmitRevision = async () => {
    if (!revisionModalProduct) return;
    const checkedItems = [];
    if (revisionChecklist.sizeChart) checkedItems.push('Cập nhật bảng kích thước chi tiết (Size chart)');
    if (revisionChecklist.detailedPhotos) checkedItems.push('Bổ sung thêm ảnh chụp chất lượng cao / cận cảnh hoa văn');
    if (revisionChecklist.materialDetails) checkedItems.push('Làm rõ thành phần chất liệu và phụ kiện đi kèm');
    if (revisionChecklist.packageDetails) checkedItems.push('Làm rõ thời lượng buổi chụp, số ảnh chỉnh sửa và thời gian bàn giao');

    let finalReason = checkedItems.join('; ');
    if (revisionNotes.trim()) {
      finalReason = finalReason ? `${finalReason}. Ghi chú: ${revisionNotes.trim()}` : revisionNotes.trim();
    }
    if (!finalReason) finalReason = 'Vui lòng bổ sung thêm thông tin chi tiết về sản phẩm hoặc dịch vụ.';

    setProcessingAction(true);
    try {
      await httpClient.patch(`/admin/products/${revisionModalProduct._id || revisionModalProduct.id}/moderation`, {
        action: 'CHANGES_REQUESTED',
        reason: finalReason,
      });
      toast.success(`Đã gửi yêu cầu bổ sung thông tin cho đối tác.`);

      setItems((prev) =>
        prev.map((p) =>
          p._id === revisionModalProduct._id
            ? { ...p, moderationStatus: 'CHANGES_REQUESTED', moderationReason: finalReason, status: 'DRAFT' }
            : p
        )
      );
      if (
        activeProduct &&
        (activeProduct._id === revisionModalProduct._id || activeProduct.id === revisionModalProduct.id)
      ) {
        setActiveProduct((prev) =>
          prev
            ? { ...prev, moderationStatus: 'CHANGES_REQUESTED', moderationReason: finalReason, status: 'DRAFT' }
            : null
        );
      }
      setMetrics((prev) => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        totalChangesRequested: prev.totalChangesRequested + 1,
        pendingAodai: revisionModalProduct.itemType === 'AODAI' ? Math.max(0, prev.pendingAodai - 1) : prev.pendingAodai,
        pendingPhotography: revisionModalProduct.itemType === 'PHOTOGRAPHY' ? Math.max(0, prev.pendingPhotography - 1) : prev.pendingPhotography,
      }));
      setRevisionModalProduct(null);
      setRevisionNotes('');
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi gửi yêu cầu bổ sung');
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <div className="lume-product-mod-container">
      {/* 1. Breadcrumbs & Header */}
      <div className="lume-product-mod-breadcrumb">
        <span>Trang chủ</span>
        <span className="separator">›</span>
        <span className="current">Kiểm duyệt sản phẩm</span>
      </div>

      <div className="lume-product-mod-header">
        <div className="lume-product-mod-header-left">
          <h1>Kiểm duyệt sản phẩm & Dịch vụ</h1>
          <p>Xem xét và phê duyệt các mẫu Áo dài và Gói dịch vụ chụp ảnh được đăng bởi đối tác trước khi hiển thị trên nền tảng.</p>
        </div>

        <button
          type="button"
          className="lume-mod-guideline-btn"
          onClick={() => setIsGuidelineOpen(true)}
        >
          <HelpCircle size={15} />
          <span>Hướng dẫn duyệt sản phẩm</span>
        </button>
      </div>

      {/* 2. Six Metric KPI Summary Cards (Figma Node 313-3263) */}
      <div className="lume-product-mod-metrics">
        {/* Card 1: Tổng chờ duyệt */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon pending">
              <Clock size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Tổng chờ duyệt</span>
              <span className="lume-mod-metric-value">{metrics.totalPending}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend up-red">
            <span>{metrics.trends?.pending || 'Chờ xử lý'}</span>
          </div>
        </div>

        {/* Card 2: Đã phê duyệt */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon approved">
              <CheckCircle size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Đã phê duyệt</span>
              <span className="lume-mod-metric-value">{metrics.totalApproved}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend up">
            <span>{metrics.trends?.approved || 'Đang hoạt động'}</span>
          </div>
        </div>

        {/* Card 3: Đã từ chối */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon rejected">
              <XCircle size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Đã từ chối</span>
              <span className="lume-mod-metric-value">{metrics.totalRejected}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend up-red">
            <span>{metrics.trends?.rejected || 'Không đạt chuẩn'}</span>
          </div>
        </div>

        {/* Card 4: Cần bổ sung */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon revision">
              <AlertCircle size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Cần bổ sung</span>
              <span className="lume-mod-metric-value">{metrics.totalChangesRequested}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend down">
            <span>{metrics.trends?.changesRequested || 'Chờ đối tác sửa'}</span>
          </div>
        </div>

        {/* Card 5: Áo dài chờ duyệt */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon aodai">
              <Sparkles size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Áo dài chờ duyệt</span>
              <span className="lume-mod-metric-value">{metrics.pendingAodai}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend up">
            <span>Áo dài truyền thống</span>
          </div>
        </div>

        {/* Card 6: Dịch vụ chụp ảnh chờ duyệt */}
        <div className="lume-mod-metric-card">
          <div className="lume-mod-metric-top">
            <div className="lume-mod-metric-icon photography">
              <Camera size={20} />
            </div>
            <div className="lume-mod-metric-info">
              <span className="lume-mod-metric-label">Chụp ảnh chờ duyệt</span>
              <span className="lume-mod-metric-value">{metrics.pendingPhotography}</span>
            </div>
          </div>
          <div className="lume-mod-metric-trend up">
            <span>Dịch vụ nhiếp ảnh</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar - 2 Rows (Figma Node 313-3263) */}
      <div className="lume-mod-filter-bar">
        {/* Row 1: Search, Loại sản phẩm, Danh mục, Đối tác */}
        <div className="lume-mod-filter-row">
          <div className="lume-mod-search-wrap">
            <Search size={16} />
            <input
              type="text"
              className="lume-mod-search-input"
              placeholder="Tìm kiếm theo tên sản phẩm, mã, đối tác..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Loại sản phẩm */}
          <div className="lume-mod-filter-group">
            <span className="lume-mod-filter-label">Loại:</span>
            <select
              className="lume-mod-filter-select"
              value={itemTypeFilter}
              onChange={(e) => {
                setItemTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả loại</option>
              <option value="AODAI">Áo dài</option>
              <option value="PHOTOGRAPHY">Dịch vụ chụp ảnh</option>
            </select>
          </div>

          {/* Filter Danh mục */}
          <div className="lume-mod-filter-group">
            <span className="lume-mod-filter-label">Danh mục:</span>
            <select
              className="lume-mod-filter-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Tất cả">Tất cả danh mục</option>
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Đối tác */}
          <div className="lume-mod-filter-group">
            <span className="lume-mod-filter-label">Đối tác:</span>
            <select
              className="lume-mod-filter-select"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Tất cả">Tất cả đối tác</option>
              {providersList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Trạng thái, Ngày đăng, Nút Reset Bộ lọc */}
        <div className="lume-mod-filter-row-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filter Trạng thái */}
            <div className="lume-mod-filter-group">
              <span className="lume-mod-filter-label">Trạng thái:</span>
              <select
                className="lume-mod-filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="Tất cả">Tất cả trạng thái</option>
                <option value="PENDING_REVIEW">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="CHANGES_REQUESTED">Cần bổ sung</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>
            </div>

            {/* Filter Ngày đăng */}
            <div className="lume-mod-filter-group">
              <span className="lume-mod-filter-label">Ngày đăng:</span>
              <select
                className="lume-mod-filter-select"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="Tất cả">Toàn thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày qua</option>
                <option value="month">30 ngày qua</option>
              </select>
            </div>

            <button
              type="button"
              className="lume-mod-filter-btn"
              onClick={() => {
                setSearchQuery('');
                setItemTypeFilter('ALL');
                setCategoryFilter('Tất cả');
                setProviderFilter('Tất cả');
                setStatusFilter('Tất cả');
                setDateFilter('Tất cả');
                setActiveTab('ALL');
                setPage(1);
              }}
              title="Đặt lại bộ lọc về mặc định"
            >
              <SlidersHorizontal size={14} />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Tìm thấy <strong>{total}</strong> sản phẩm & dịch vụ
          </div>
        </div>
      </div>

      {/* 4. Six Status Tabs Bar (Figma Node 313-3263) */}
      <div className="lume-mod-tabs-bar">
        {/* Tab 1: Tất cả */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setItemTypeFilter('ALL');
            setStatusFilter('Tất cả');
            setPage(1);
          }}
        >
          <span>Tất cả</span>
          <span className="lume-mod-tab-count">{metrics.total || total}</span>
        </button>

        {/* Tab 2: Chờ duyệt */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('PENDING');
            setItemTypeFilter('ALL');
            setStatusFilter('PENDING_REVIEW');
            setPage(1);
          }}
        >
          <span>Chờ duyệt</span>
          <span className="lume-mod-tab-count">{metrics.totalPending}</span>
        </button>

        {/* Tab 3: Áo dài */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'AODAI' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('AODAI');
            setItemTypeFilter('AODAI');
            setStatusFilter('PENDING_REVIEW');
            setPage(1);
          }}
        >
          <Sparkles size={14} style={{ marginRight: 2 }} />
          <span>Áo dài</span>
          <span className="lume-mod-tab-count">{metrics.pendingAodai}</span>
        </button>

        {/* Tab 4: Chụp ảnh */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'PHOTOGRAPHY' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('PHOTOGRAPHY');
            setItemTypeFilter('PHOTOGRAPHY');
            setStatusFilter('PENDING_REVIEW');
            setPage(1);
          }}
        >
          <Camera size={14} style={{ marginRight: 2 }} />
          <span>Chụp ảnh</span>
          <span className="lume-mod-tab-count">{metrics.pendingPhotography}</span>
        </button>

        {/* Tab 5: Đã phê duyệt */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'APPROVED' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('APPROVED');
            setItemTypeFilter('ALL');
            setStatusFilter('APPROVED');
            setPage(1);
          }}
        >
          <span>Đã phê duyệt</span>
          <span className="lume-mod-tab-count">{metrics.totalApproved}</span>
        </button>

        {/* Tab 6: Cần bổ sung */}
        <button
          type="button"
          className={`lume-mod-tab-item ${activeTab === 'CHANGES_REQUESTED' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('CHANGES_REQUESTED');
            setItemTypeFilter('ALL');
            setStatusFilter('CHANGES_REQUESTED');
            setPage(1);
          }}
        >
          <span>Cần bổ sung</span>
          <span className="lume-mod-tab-count">{metrics.totalChangesRequested}</span>
        </button>
      </div>

      {/* 5. Workspace: Full-width Table Card */}
      <div className="lume-product-mod-workspace">
        {/* Table Card */}
        <div className="lume-product-mod-table-card">

          <div
            className="lume-product-mod-table-scroll"
            ref={tableScrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUpOrLeave}
            onMouseLeave={onMouseUpOrLeave}
          >
            <table className="lume-product-mod-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th style={{ width: 36 }}>#</th>
                  <th>Ảnh</th>
                  <th>Tên sản phẩm / Gói dịch vụ</th>
                  <th>Loại</th>
                  <th>Danh mục</th>
                  <th>Đối tác</th>
                  <th>Ngày đăng ˅</th>
                  <th>Giá (VNĐ)</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center', width: 48 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                      Đang tải danh sách kiểm duyệt từ cơ sở dữ liệu MongoDB Atlas...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                      Không có sản phẩm hoặc gói dịch vụ nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isSelected = activeProduct?._id === item._id && isDetailOpen;
                    const rowNumber = (page - 1) * limit + idx + 1;
                    const { date, time } = formatDateTime(item.createdAt);
                    const thumbUrl = item.images && item.images.length > 0 ? item.images[0] : fallbackThumb;

                    return (
                      <tr
                        key={item._id || item.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => {
                          if (activeProduct?._id === item._id && isDetailOpen) {
                            setIsDetailOpen(false);
                          } else {
                            setActiveProduct(item);
                            setActiveGalleryIndex(0);
                            setIsDetailOpen(true);
                          }
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id || item._id)}
                            onChange={(e) => handleToggleSelectRow(item.id || item._id, e as any)}
                          />
                        </td>

                        {/* # index */}
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{rowNumber}</td>

                        {/* Image Thumbnail */}
                        <td>
                          <img
                            src={thumbUrl}
                            alt={item.name}
                            className="lume-product-thumb-cell"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackThumb;
                            }}
                          />
                        </td>

                        {/* Name & Code */}
                        <td>
                          <div className="lume-product-name-block">
                            <span className="lume-product-name-title" title={item.name}>
                              {item.name}
                            </span>
                            <span className="lume-product-code-sub">{item.code}</span>
                          </div>
                        </td>

                        {/* Loại */}
                        <td>{renderTypeBadge(item.itemType)}</td>

                        {/* Danh mục */}
                        <td>
                          <span style={{ fontWeight: 500, color: '#334155' }}>
                            {item.categoryId?.name || (item.itemType === 'PHOTOGRAPHY' ? 'Gói chụp ảnh' : 'Áo dài')}
                          </span>
                        </td>

                        {/* Đối tác */}
                        <td>
                          <div className="lume-partner-block">
                            <span className="lume-partner-name">
                              {item.providerId?.businessName || 'Đối tác VibeHue'}
                            </span>
                            <span className="lume-partner-code">{item.partnerCode}</span>
                          </div>
                        </td>

                        {/* Ngày đăng */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{date}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{time}</span>
                          </div>
                        </td>

                        {/* Giá */}
                        <td>
                          <span className="lume-price-cell">{formatVND(item.basePrice)}</span>
                        </td>

                        {/* Trạng thái */}
                        <td>{renderStatusBadge(item.moderationStatus)}</td>

                        {/* Action Menu */}
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className="lume-mod-page-btn"
                              style={{ width: 28, height: 28 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId((prev) => (prev === item._id ? null : item._id));
                              }}
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {activeActionMenuId === item._id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                  padding: '4px',
                                  zIndex: 50,
                                  minWidth: '150px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="lume-mod-tab-item"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setActiveProduct(item);
                                    setActiveGalleryIndex(0);
                                    setIsDetailOpen(true);
                                  }}
                                >
                                  <Eye size={13} color="#881337" />
                                  <span>Xem chi tiết</span>
                                </button>

                                <button
                                  type="button"
                                  className="lume-mod-tab-item"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    handleApprove(item);
                                  }}
                                >
                                  <Check size={13} color="#16a34a" />
                                  <span>Phê duyệt</span>
                                </button>

                                <button
                                  type="button"
                                  className="lume-mod-tab-item"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setRevisionModalProduct(item);
                                  }}
                                >
                                  <AlertCircle size={13} color="#ea580c" />
                                  <span>Yêu cầu sửa</span>
                                </button>

                                <button
                                  type="button"
                                  className="lume-mod-tab-item"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: '#dc2626',
                                  }}
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setRejectModalProduct(item);
                                  }}
                                >
                                  <X size={13} color="#dc2626" />
                                  <span>Từ chối</span>
                                </button>
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

          {/* Table Footer */}
          <div className="lume-product-mod-footer">
            <div>
              Hiển thị {items.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} của {total} mục
            </div>

            <div className="lume-product-mod-pagination">
              <button
                type="button"
                className="lume-mod-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum = i + 1;
                if (totalPages > 5 && page > 3) {
                  pNum = page - 3 + i;
                  if (pNum > totalPages) pNum = totalPages - 4 + i;
                }
                return (
                  <button
                    key={pNum}
                    type="button"
                    className={`lume-mod-page-btn ${page === pNum ? 'active' : ''}`}
                    onClick={() => setPage(pNum)}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                type="button"
                className="lume-mod-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>

              <select
                className="lume-mod-filter-select"
                style={{ marginLeft: 6 }}
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={8}>8 / trang</option>
                <option value={15}>15 / trang</option>
                <option value={25}>25 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>Hiển thị tất cả ({total})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Spacious Slide-Over Inspection Drawer (960px - 1380px) */}
      {isDetailOpen && activeProduct && (
        <>
          <div
            className="lume-product-drawer-backdrop"
            onClick={() => setIsDetailOpen(false)}
          />

          <div className={`lume-product-detail-drawer ${isMaximized ? 'maximized' : ''}`}>
            {/* Drawer Header */}
            <div className="lume-product-drawer-header">
              <div className="lume-product-drawer-title-wrap">
                <h2 className="lume-product-drawer-title" title={activeProduct.name}>
                  {activeProduct.name}
                </h2>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  ({activeProduct.code})
                </span>
                {renderTypeBadge(activeProduct.itemType)}
                {renderStatusBadge(activeProduct.moderationStatus)}
              </div>

              <div className="lume-product-drawer-controls">
                {/* Previous / Next navigation */}
                {items.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                    <button
                      type="button"
                      className="lume-product-drawer-nav-btn"
                      onClick={handlePrevProduct}
                      disabled={currentIndex <= 0}
                      title="Sản phẩm trước"
                    >
                      <ChevronLeft size={14} />
                      <span>Trước</span>
                    </button>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: '0 4px' }}>
                      {currentIndex + 1} / {items.length}
                    </span>
                    <button
                      type="button"
                      className="lume-product-drawer-nav-btn"
                      onClick={handleNextProduct}
                      disabled={currentIndex >= items.length - 1}
                      title="Sản phẩm tiếp theo"
                    >
                      <span>Tiếp</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Maximize / Minimize Button */}
                <button
                  type="button"
                  className="lume-product-drawer-icon-btn"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Thu nhỏ giao diện (960px)' : 'Mở rộng toàn màn hình (1380px)'}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  className="lume-product-drawer-icon-btn"
                  onClick={() => setIsDetailOpen(false)}
                  title="Đóng chi tiết (Phím Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 2-Column Spacious Body */}
            <div className="lume-product-drawer-body">
              {/* CỘT TRÁI: Media Showcase + Description + Inclusions/Specs + Quality Checklist */}
              <div className="lume-product-drawer-col">
                {/* Showcase ảnh lớn */}
                <div className="lume-product-showcase-box">
                  {activeProduct.images && activeProduct.images.length > 0 ? (
                    <img
                      src={activeProduct.images[activeGalleryIndex] || activeProduct.images[0]}
                      alt={activeProduct.name}
                      className="lume-product-showcase-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackThumb;
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#94a3b8',
                        fontSize: '13px',
                      }}
                    >
                      Chưa có hình ảnh
                    </div>
                  )}
                  <div className="lume-product-showcase-badge">
                    {activeProduct.itemType === 'PHOTOGRAPHY' ? 'Dịch vụ chụp ảnh' : 'Áo dài truyền thống'}
                  </div>
                  {activeProduct.images && activeProduct.images.length > 0 && (
                    <div className="lume-product-showcase-counter">
                      {activeGalleryIndex + 1} / {activeProduct.images.length}
                    </div>
                  )}
                </div>

                {/* Dải Thumbnails */}
                {activeProduct.images && activeProduct.images.length > 1 && (
                  <div className="lume-product-thumbs-strip">
                    {activeProduct.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`lume-product-thumb-item ${activeGalleryIndex === idx ? 'active' : ''}`}
                        onClick={() => setActiveGalleryIndex(idx)}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackThumb;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Card: Mô tả chi tiết */}
                <div className="lume-product-card">
                  <h4 className="lume-product-card-title">
                    {activeProduct.itemType === 'PHOTOGRAPHY' ? 'Mô tả gói chụp ảnh' : 'Mô tả chi tiết sản phẩm'}
                  </h4>
                  <p className="lume-product-desc-text">
                    {activeProduct.description || 'Chưa có thông tin mô tả chi tiết từ đối tác.'}
                  </p>
                </div>

                {/* Card: Chi tiết dịch vụ / Thuộc tính áo dài */}
                {activeProduct.itemType === 'PHOTOGRAPHY' ? (
                  <div className="lume-product-card">
                    <h4 className="lume-product-card-title">Nội dung gói dịch vụ bao gồm</h4>
                    <div className="lume-product-inclusions-grid">
                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Camera size={15} /></div>
                        <div>
                          <div>Nhiếp ảnh gia chuyên nghiệp</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Trang thiết bị hiện đại</div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Sparkles size={15} /></div>
                        <div>
                          <div>{activeProduct.editedPhotosCount || 80}+ ảnh hoàn thiện</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Photoshop chuyên nghiệp</div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Clock size={15} /></div>
                        <div>
                          <div>{activeProduct.durationHours || 2} giờ chụp hình</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Thời gian linh hoạt</div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Calendar size={15} /></div>
                        <div>
                          <div>Trả ảnh trong {activeProduct.deliveryDays || 3} ngày</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Qua Google Drive / Cloud</div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card" style={{ gridColumn: 'span 2' }}>
                        <div className="lume-product-inc-icon"><MapPin size={15} /></div>
                        <div>
                          <div>Địa điểm chụp: {activeProduct.location || 'Studio & Ngoại cảnh nội thành Huế'}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Hỗ trợ tạo dáng & stylist tận tình</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="lume-product-card">
                    <h4 className="lume-product-card-title">Quy cách & Đặc tính áo dài</h4>
                    <div className="lume-product-inclusions-grid">
                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Shirt size={15} /></div>
                        <div>
                          <div>Kích cỡ sẵn có</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {activeProduct.sizes && activeProduct.sizes.length > 0
                              ? activeProduct.sizes.join(', ')
                              : 'S, M, L, XL'}
                          </div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Layers size={15} /></div>
                        <div>
                          <div>Chất liệu vải</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {activeProduct.materials && activeProduct.materials.length > 0
                              ? activeProduct.materials.join(', ')
                              : 'Lụa tơ tằm / Gấm cao cấp'}
                          </div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><Tag size={15} /></div>
                        <div>
                          <div>Màu sắc</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {activeProduct.colors && activeProduct.colors.length > 0
                              ? activeProduct.colors.join(', ')
                              : 'Đa dạng sắc thái cổ phong'}
                          </div>
                        </div>
                      </div>

                      <div className="lume-product-inc-card">
                        <div className="lume-product-inc-icon"><ShieldCheck size={15} /></div>
                        <div>
                          <div>Tiền đặt cọc bảo đảm</div>
                          <div style={{ fontSize: 11, color: '#881337', fontWeight: 700 }}>
                            {formatVND(activeProduct.depositAmount || 0)} VNĐ
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card: Tiêu chuẩn thẩm định 5 bước */}
                <div className="lume-product-card">
                  <h4 className="lume-product-card-title">Hồ sơ thẩm định chất lượng tiêu chuẩn</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        <span>1. Hình ảnh chất lượng cao, đúng góc & thẩm mỹ</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Đạt</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        <span>2. Giá niêm yết rõ ràng & minh bạch</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Đạt</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        <span>3. Mô tả chi tiết, đúng thuần phong mỹ tục</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Đạt</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        <span>4. Đối tác đã xác thực danh tính (KYC)</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Đạt</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        <span>5. Tuân thủ chính sách VibeHue Escrow</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Đạt</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: Pricing Ribbon + Subtabs + Partner Profile + Specs Grid + Moderation History */}
              <div className="lume-product-drawer-col">
                {/* Quick Pricing Ribbon */}
                <div className="lume-product-pricing-ribbon">
                  <div className="lume-product-price-main">
                    <span className="lume-product-price-label">Giá niêm yết</span>
                    <span className="lume-product-price-amount">
                      {formatVND(activeProduct.basePrice)} VNĐ
                    </span>
                  </div>

                  <div className="lume-product-meta-chips">
                    {activeProduct.itemType === 'PHOTOGRAPHY' ? (
                      <>
                        <div className="lume-product-meta-chip">
                          <Clock size={14} color="#881337" />
                          <span>{activeProduct.durationHours || 2} giờ chụp</span>
                        </div>
                        <div className="lume-product-meta-chip">
                          <Sparkles size={14} color="#881337" />
                          <span>{activeProduct.editedPhotosCount || 80}+ ảnh</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="lume-product-meta-chip">
                          <Shirt size={14} color="#881337" />
                          <span>Cọc: {formatVND(activeProduct.depositAmount || 0)}đ</span>
                        </div>
                        <div className="lume-product-meta-chip">
                          <Tag size={14} color="#881337" />
                          <span>Kho: {activeProduct.quantity ?? 'Sẵn sàng'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4 Subtabs Bar */}
                <div className="lume-product-drawer-subtabs">
                  <button
                    type="button"
                    className={`lume-product-dsubtab-btn ${detailSubtab === 'info' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('info')}
                  >
                    Thông tin hồ sơ
                  </button>
                  <button
                    type="button"
                    className={`lume-product-dsubtab-btn ${detailSubtab === 'standards' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('standards')}
                  >
                    Tiêu chuẩn dịch vụ
                  </button>
                  <button
                    type="button"
                    className={`lume-product-dsubtab-btn ${detailSubtab === 'terms' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('terms')}
                  >
                    Điều khoản & Escrow
                  </button>
                  <button
                    type="button"
                    className={`lume-product-dsubtab-btn ${detailSubtab === 'reputation' ? 'active' : ''}`}
                    onClick={() => setDetailSubtab('reputation')}
                  >
                    Uy tín đối tác (4.9 ★)
                  </button>
                </div>

                {/* Subtab 1: Thông tin hồ sơ */}
                {detailSubtab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Partner Card */}
                    <div className="lume-product-partner-profile-card">
                      <div className="lume-product-partner-profile-left">
                        <img
                          src={
                            activeProduct.providerId?.media?.avatarUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
                          }
                          alt="Partner"
                          className="lume-product-partner-profile-avatar"
                        />
                        <div>
                          <div className="lume-product-partner-profile-name">
                            {activeProduct.providerId?.businessName || 'Đối tác VibeHue'}
                          </div>
                          <div className="lume-product-partner-profile-code">
                            Mã đối tác: {activeProduct.partnerCode} • ★ 4.9 uy tín
                          </div>
                        </div>
                      </div>

                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={14} /> Đã KYC
                      </span>
                    </div>

                    {/* Specs Grid */}
                    <div className="lume-product-spec-grid">
                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Mã định danh sản phẩm</span>
                        <span className="lume-product-spec-val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {activeProduct.code}
                        </span>
                      </div>

                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Phân loại hồ sơ</span>
                        <span className="lume-product-spec-val">
                          {activeProduct.itemType === 'PHOTOGRAPHY' ? 'Dịch vụ chụp ảnh nghệ thuật' : 'Sản phẩm Áo dài truyền thống'}
                        </span>
                      </div>

                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Danh mục dịch vụ</span>
                        <span className="lume-product-spec-val">
                          {activeProduct.categoryId?.name || (activeProduct.itemType === 'PHOTOGRAPHY' ? 'Nhiếp ảnh du lịch' : 'Áo dài cổ phục')}
                        </span>
                      </div>

                      {activeProduct.itemType === 'PHOTOGRAPHY' ? (
                        <>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Địa điểm chụp ảnh</span>
                            <span className="lume-product-spec-val">{activeProduct.location || 'Ngoại cảnh & Studio Huế'}</span>
                          </div>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Thời lượng chụp</span>
                            <span className="lume-product-spec-val">{activeProduct.durationHours || 2} giờ</span>
                          </div>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Thời hạn bàn giao ảnh</span>
                            <span className="lume-product-spec-val">{activeProduct.deliveryDays || 3} ngày làm việc</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Kích cỡ sẵn có</span>
                            <span className="lume-product-spec-val">
                              {activeProduct.sizes && activeProduct.sizes.length > 0 ? activeProduct.sizes.join(', ') : 'S, M, L, XL'}
                            </span>
                          </div>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Chất liệu chính</span>
                            <span className="lume-product-spec-val">
                              {activeProduct.materials && activeProduct.materials.length > 0 ? activeProduct.materials.join(', ') : 'Lụa tơ tằm'}
                            </span>
                          </div>
                          <div className="lume-product-spec-row">
                            <span className="lume-product-spec-label">Tiền cọc thuê áo</span>
                            <span className="lume-product-spec-val">{formatVND(activeProduct.depositAmount || 0)} VNĐ</span>
                          </div>
                        </>
                      )}

                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Thời gian đăng ký</span>
                        <span className="lume-product-spec-val">
                          {formatDateTime(activeProduct.createdAt).date} {formatDateTime(activeProduct.createdAt).time}
                        </span>
                      </div>
                    </div>

                    {/* Moderation Reason Alert if present */}
                    {activeProduct.moderationReason && (
                      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <AlertCircle size={15} />
                          <span>Phản hồi từ ban kiểm duyệt:</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#881337', marginTop: 4, lineHeight: 1.5 }}>
                          {activeProduct.moderationReason}
                        </div>
                        {activeProduct.moderatedAt && (
                          <span style={{ fontSize: 11, color: '#9f1239', marginTop: 4, display: 'block' }}>
                            Xử lý lúc: {formatDateTime(activeProduct.moderatedAt).date} {formatDateTime(activeProduct.moderatedAt).time}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 2: Tiêu chuẩn dịch vụ */}
                {detailSubtab === 'standards' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="lume-product-spec-grid">
                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Chuẩn chất lượng ảnh</span>
                        <span className="lume-product-spec-val">Full HD / 4K không watermark đối tác</span>
                      </div>
                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Cam kết bảo mật</span>
                        <span className="lume-product-spec-val">Không phát tán ảnh cá nhân của khách</span>
                      </div>
                      <div className="lume-product-spec-row">
                        <span className="lume-product-spec-label">Tiêu chuẩn trang phục</span>
                        <span className="lume-product-spec-val">Giặt sấy tiệt trùng trước khi giao</span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        Cam kết chất lượng LUMÉ Quality Guarantee
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Sản phẩm & dịch vụ đăng tải phải tuân thủ nghiêm ngặt bảng giá niêm yết công khai trên VibeHue. Đối tác cam kết phục vụ đúng cam kết thời gian, trang phục sạch mới và thái độ chuyên nghiệp, tôn trọng di sản văn hóa xứ Huế.
                      </p>
                    </div>
                  </div>
                )}

                {/* Subtab 3: Điều khoản & Escrow */}
                {detailSubtab === 'terms' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4, fontSize: 13 }}>
                        1. Thanh toán an toàn qua VibeHue Escrow
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Toàn bộ tiền thuê và dịch vụ được tạm giữ tại cổng thanh toán VibeHue Escrow. Khoản tiền chỉ được giải ngân cho đối tác sau khi khách hàng hoàn tất buổi chụp hoặc xác nhận đã hoàn trả trang phục nguyên vẹn.
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4, fontSize: 13 }}>
                        2. Chính sách hủy đơn & hoàn tiền
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Hủy trước 24 giờ được hoàn 100% tiền cọc. Trường hợp thời tiết bất khả kháng (mưa bão), đối tác và khách hàng được hỗ trợ dời lịch miễn phí.
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4, fontSize: 13 }}>
                        3. Xử lý tranh chấp & đền bù hư hỏng
                      </strong>
                      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Nếu có khiếu nại về chất lượng ảnh hoặc hư hại trang phục, bộ phận VibeHue Trust & Safety sẽ đứng ra làm trọng tài đối soát căn cứ trên hợp đồng và biên bản bàn giao.
                      </span>
                    </div>
                  </div>
                )}

                {/* Subtab 4: Uy tín đối tác */}
                {detailSubtab === 'reputation' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#881337', lineHeight: 1 }}>4.9</div>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', margin: '6px 0', color: '#f59e0b', fontSize: 16 }}>
                          ★★★★★
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Đánh giá dịch vụ</span>
                      </div>
                      <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Tỷ lệ hoàn thành đúng hẹn:</span>
                          <strong style={{ color: '#059669' }}>99.2%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Tỷ lệ tranh chấp đơn hàng:</span>
                          <strong style={{ color: '#059669' }}>0.3%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Thời gian phản hồi trung bình:</span>
                          <strong style={{ color: '#0f172a' }}>Dưới 15 phút</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Action Footer with 3 buttons */}
            <div className="lume-product-drawer-footer">
              <div className="lume-product-drawer-footer-left">
                <span>
                  Hồ sơ: <strong>{activeProduct.code}</strong>
                </span>
                <span>•</span>
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <ShieldCheck size={15} /> Đối tác đã xác thực KYC
                </span>
              </div>

              <div className="lume-product-drawer-footer-actions">
                <button
                  type="button"
                  className="lume-product-btn-reject"
                  onClick={() => setRejectModalProduct(activeProduct)}
                  disabled={processingAction}
                >
                  <XCircle size={16} />
                  <span>Từ chối</span>
                </button>

                <button
                  type="button"
                  className="lume-product-btn-revision"
                  onClick={() => setRevisionModalProduct(activeProduct)}
                  disabled={processingAction}
                >
                  <AlertCircle size={16} />
                  <span>Yêu cầu bổ sung</span>
                </button>

                <button
                  type="button"
                  className="lume-product-btn-approve"
                  onClick={() => handleApprove(activeProduct)}
                  disabled={processingAction || activeProduct.moderationStatus === 'APPROVED'}
                >
                  <CheckCircle size={16} />
                  <span>
                    {activeProduct.moderationStatus === 'APPROVED' ? 'Đã phê duyệt' : 'Phê duyệt sản phẩm'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          MODAL 1: TỪ CHỐI SẢN PHẨM (REJECT MODAL)
          ========================================================================= */}
      {rejectModalProduct && (
        <div className="lume-modal-backdrop" onClick={() => setRejectModalProduct(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon red">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Từ chối duyệt hồ sơ</h3>
                  <p className="lume-modal-subtitle">
                    {rejectModalProduct.name} ({rejectModalProduct.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setRejectModalProduct(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Chọn lý do từ chối để gửi thông báo chi tiết đến đối tác:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Hình ảnh mờ hoặc không đúng quy chuẩn nhận diện di sản',
                  'Thông tin sản phẩm/dịch vụ không rõ ràng hoặc sai lệch danh mục',
                  'Giá niêm yết hoặc mức cọc bất thường so với quy định thị trường',
                  'Nghi vấn vi phạm bản quyền thương hiệu hoặc chính sách nền tảng',
                  'Lý do khác',
                ].map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: rejectPreset === reason ? '#fef2f2' : '#ffffff',
                      borderColor: rejectPreset === reason ? '#fca5a5' : '#e2e8f0',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="rejectPreset"
                      value={reason}
                      checked={rejectPreset === reason}
                      onChange={() => setRejectPreset(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Ghi chú giải thích chi tiết cho đối tác:
                </label>
                <textarea
                  rows={3}
                  value={rejectCustomReason}
                  onChange={(e) => setRejectCustomReason(e.target.value)}
                  placeholder="Nhập hướng dẫn cụ thể để đối tác nắm rõ và khắc phục nếu đăng lại..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-ghost"
                onClick={() => setRejectModalProduct(null)}
                disabled={processingAction}
              >
                Hủy
              </button>
              <button
                type="button"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleSubmitReject}
                disabled={processingAction}
              >
                {processingAction ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: YÊU CẦU BỔ SUNG (REVISION MODAL)
          ========================================================================= */}
      {revisionModalProduct && (
        <div className="lume-modal-backdrop" onClick={() => setRevisionModalProduct(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon revision">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Yêu cầu đối tác bổ sung</h3>
                  <p className="lume-modal-subtitle">
                    {revisionModalProduct.name} ({revisionModalProduct.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setRevisionModalProduct(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Chọn các hạng mục cần bổ sung hoặc chỉnh sửa:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={revisionChecklist.sizeChart}
                    onChange={(e) =>
                      setRevisionChecklist((prev) => ({ ...prev, sizeChart: e.target.checked }))
                    }
                  />
                  <span>Bổ sung bảng kích thước chuẩn (Size chart: Ngực, Eo, Mông, Dài áo)</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={revisionChecklist.detailedPhotos}
                    onChange={(e) =>
                      setRevisionChecklist((prev) => ({ ...prev, detailedPhotos: e.target.checked }))
                    }
                  />
                  <span>Bổ sung thêm ảnh chụp cận cảnh chất liệu vải gấm/lụa hoặc ảnh sản phẩm thực tế</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={revisionChecklist.materialDetails}
                    onChange={(e) =>
                      setRevisionChecklist((prev) => ({ ...prev, materialDetails: e.target.checked }))
                    }
                  />
                  <span>Làm rõ phụ kiện đi kèm (mấn đội đầu, kiềng cổ hoặc quần áo dài)</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={revisionChecklist.packageDetails}
                    onChange={(e) =>
                      setRevisionChecklist((prev) => ({ ...prev, packageDetails: e.target.checked }))
                    }
                  />
                  <span>Làm rõ thời lượng buổi chụp, số ảnh chỉnh sửa và thời gian bàn giao file</span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Ghi chú dặn dò đối tác:
                </label>
                <textarea
                  rows={3}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Nhập lời nhắn cụ thể để đối tác hoàn thiện hồ sơ..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-ghost"
                onClick={() => setRevisionModalProduct(null)}
                disabled={processingAction}
              >
                Hủy
              </button>
              <button
                type="button"
                style={{
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleSubmitRevision}
                disabled={processingAction}
              >
                {processingAction ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: HƯỚNG DẪN DUYỆT SẢN PHẨM (POLICY GUIDELINE MODAL)
          ========================================================================= */}
      {isGuidelineOpen && (
        <div className="lume-modal-backdrop" onClick={() => setIsGuidelineOpen(false)}>
          <div className="lume-modal-box size-lg" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon wine">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Quy chuẩn kiểm duyệt sản phẩm & dịch vụ LUMÉ</h3>
                  <p className="lume-modal-subtitle">Bộ nguyên tắc bảo đảm trải nghiệm di sản và niềm tin khách hàng</p>
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

            <div className="lume-modal-body" style={{ gap: '14px', maxHeight: '70vh' }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  color: '#881337',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Mục tiêu:</strong> Đảm bảo tất cả sản phẩm Áo dài và Gói dịch vụ chụp ảnh xuất hiện trên nền tảng VibeHue đều có chất lượng hình ảnh sắc nét, mô tả chân thực, đúng giá niêm yết và không vi phạm thuần phong mỹ tục.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    1. Tiêu chuẩn hình ảnh
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                    <li>Tối thiểu 3 ảnh chất lượng cao (độ phân giải từ 1080px trở lên).</li>
                    <li>Ảnh chụp rõ toàn thân, mặt trước, mặt sau và chi tiết hoa văn.</li>
                    <li>Không chèn watermark số điện thoại hoặc liên kết ngoài che khuất áo dài.</li>
                  </ul>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    2. Tiêu chuẩn giá & tiền cọc
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                    <li>Giá thuê hoặc giá bán phải đúng giá thực tế tại cửa hàng đối tác.</li>
                    <li>Tiền cọc đảm bảo không được vượt quá giá trị thực tế của sản phẩm.</li>
                    <li>Minh bạch chính sách phụ kiện đi kèm khi thuê áo dài hoặc chụp ảnh.</li>
                  </ul>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    3. Nội dung & Thông số dịch vụ
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                    <li>Tên sản phẩm/dịch vụ thuần Việt, trang nhã.</li>
                    <li>Cung cấp đầy đủ kích thước sẵn có (S, M, L, XL, Free size) hoặc thời lượng chụp ảnh.</li>
                    <li>Mô tả rõ loại vải (Gấm, Tơ tằm, Lụa Hà Đông,...) hoặc số lượng ảnh bàn giao.</li>
                  </ul>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    4. Cam kết bảo đảm & Ký quỹ
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                    <li>Đối tác chịu trách nhiệm về tính xác thực của sản phẩm đã đăng.</li>
                    <li>Hệ thống ký quỹ LUMÉ Escrow bảo vệ cả khách hàng và đối tác đối soát minh bạch.</li>
                  </ul>
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
    </div>
  );
};
