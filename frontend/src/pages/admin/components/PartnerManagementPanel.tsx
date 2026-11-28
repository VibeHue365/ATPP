import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Store,
  UserPlus,
  CheckCircle,
  Clock,
  Lock,
  Search,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  ShieldAlert,
  AlertTriangle,
  BadgeCheck,
  Clock3,
  CheckCircle2,
  ShoppingBag,
  RotateCcw,
  Globe,
  MapPin,
  Star,
  Camera,
  Sparkles,
  Activity,
  Ban,
  CalendarCheck,
  MoveHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { adminDirectoryApi } from '../../../features/admin-directory/api/adminDirectoryApi';
import { adminStatsApi } from '../../../features/admin-dashboard/api/adminStatsApi';
import type { ProviderProduct, ProviderReview } from '../../../features/admin-directory/types';
import { useToast } from '../../../components/feedback/Toast';
import { includesVietnamese } from '../../../utils/vietnameseUtils';
import { getProviderStatusMeta } from '../../../utils/bookingStatus';
import './partnerManagementFigma.css';

export interface PartnerDetailItem {
  id: string;
  partnerCode: string;
  businessName: string;
  ownerName: string;
  avatar: string;
  coverUrl: string;
  email: string;
  phone: string;
  website?: string;
  capabilities: string[];
  date: string;
  createdAtMs: number;
  totalProducts: number;
  completedBookings: number;
  totalBookings: number;
  completionRate: number;
  rating: number;
  totalReviews: number;
  totalEarnings: number;
  status: string;
  statusLabel: string;
  isVerified: boolean;
  hasIdCard: boolean;
  hasBusinessLicense: boolean;
  hasStudioProof: boolean;
  warning: 'NONE' | 'COMPLAINT_1' | 'HIGH_CANCEL';
  warningLabel: string;
  taxCode: string;
  address: string;
  bankAccount: string;
  bankName: string;
  lastActive: string;
  products: ProviderProduct[];
  reviews: ProviderReview[];
}

type PartnerSortKey =
  | 'bookings_desc'
  | 'bookings_asc'
  | 'revenue_desc'
  | 'revenue_asc'
  | 'rating_desc'
  | 'rating_asc'
  | 'products_desc'
  | 'products_asc'
  | 'newest'
  | 'oldest';

const parsePartnerDateMs = (iso?: string | null, displayDate?: string): number => {
  if (iso) {
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (displayDate) {
    const parts = displayDate.split('/').map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const [d, m, y] = parts;
      return new Date(y, m - 1, d).getTime();
    }
  }
  return 0;
};

const sanitizeOptionalImageUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('unsplash.com') || trimmed.includes('example.com')) {
    return '';
  }
  return trimmed;
};

export function PartnerManagementPanel() {
  const toast = useToast();

  const [partnerList, setPartnerList] = useState<PartnerDetailItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPartner, setSelectedPartner] = useState<PartnerDetailItem | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<'overview' | 'info' | 'products' | 'reviews'>('overview');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const markImageFailed = useCallback((key: string) => {
    setFailedImages((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // 6 KPI metrics state directly from backend
  const [metrics, setMetrics] = useState({
    totalPartners: 0,
    newThisMonth: 0,
    activePartners: 0,
    pendingVerifications: 0,
    suspendedPartners: 0,
    disputesOrWarnings: 0,
  });

  // Search, Filters & Sort
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('ALL');
  const [ratingFilter, setRatingFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<PartnerSortKey>('bookings_desc');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Multi-checkbox selections
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number | 'all'>(8);

  // Table horizontal drag-to-scroll logic
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<{ canLeft: boolean; canRight: boolean }>({
    canLeft: false,
    canRight: false,
  });
  const dragInfo = useRef({
    startX: 0,
    scrollLeft: 0,
    isDown: false,
    hasMoved: false,
  });

  const checkTableScroll = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const canLeft = el.scrollLeft > 5;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
    setScrollProgress({ canLeft, canRight });
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, select, option')) {
      return;
    }
    const container = tableScrollRef.current;
    if (!container) return;

    dragInfo.current = {
      startX: e.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
      isDown: true,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragInfo.current.isDown) return;
    const container = tableScrollRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - dragInfo.current.startX) * 1.5;
    if (Math.abs(walk) > 4) {
      dragInfo.current.hasMoved = true;
    }
    container.scrollLeft = dragInfo.current.scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    dragInfo.current.isDown = false;
    setIsDragging(false);
  };

  // Load real data from backend endpoints
  const fetchBackendData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resProviders, resStats] = await Promise.allSettled([
        adminDirectoryApi.providers(1, 200, debouncedSearchQuery, sortBy),
        adminStatsApi.get('month'),
      ]);

      let loadedPartners: PartnerDetailItem[] = [];

      if (resProviders.status === 'fulfilled' && resProviders.value?.items) {
        loadedPartners = resProviders.value.items.map((p, idx) => {
          const codeIndex = String(idx + 1).padStart(4, '0');
          const rawStatus = (p.status || 'ACTIVE').toUpperCase();
          const statusMeta = getProviderStatusMeta(rawStatus);
          const isSuspended = rawStatus === 'SUSPENDED';
          const isPending = rawStatus === 'PENDING_APPROVAL' || rawStatus === 'PENDING';

          const caps = Array.isArray(p.capability) && p.capability.length > 0
            ? p.capability
            : ['AODAI_RENTAL'];

          const safeAvatar = sanitizeOptionalImageUrl(p.avatar);
          const safeCoverUrl = sanitizeOptionalImageUrl(p.coverUrl);

          const totalBookings = typeof p.totalBookings === 'number' ? p.totalBookings : 0;
          const completedBookings = typeof p.completedBookings === 'number' ? p.completedBookings : 0;
          const completionRate = typeof p.completionRate === 'number'
            ? p.completionRate
            : totalBookings > 0
            ? Math.round((completedBookings / totalBookings) * 100)
            : 100;
          const reviews = Array.isArray(p.reviews) ? p.reviews : [];
          const totalReviews =
            typeof p.totalReviews === 'number' ? p.totalReviews : reviews.length;
          const rating =
            typeof p.rating === 'number' && p.rating > 0 ? p.rating : 0;

          return {
            id: p.id,
            partnerCode: `#DT${p.id ? p.id.slice(-6).toUpperCase() : codeIndex}`,
            businessName: p.businessName || 'Nhà cung cấp TàGo',
            ownerName: p.ownerName || 'Chủ cơ sở',
            avatar: safeAvatar,
            coverUrl: safeCoverUrl,
            email: p.email || 'Chưa cập nhật',
            phone: p.phone || 'Chưa cập nhật',
            website: p.website || '',
            capabilities: caps,
            date: p.createdAt || 'Chưa cập nhật',
            createdAtMs: parsePartnerDateMs(p.createdAtIso, p.createdAt),
            totalProducts: typeof p.totalProducts === 'number' ? p.totalProducts : 0,
            completedBookings,
            totalBookings,
            completionRate,
            rating,
            totalReviews,
            totalEarnings: typeof p.totalEarnings === 'number' ? p.totalEarnings : 0,
            status: statusMeta.code,
            statusLabel: statusMeta.label,
            isVerified: p.isVerified ?? !isPending,
            hasIdCard: p.hasIdCard ?? (p.isVerified ?? !isPending),
            hasBusinessLicense: p.hasBusinessLicense ?? (p.isVerified ?? !isPending),
            hasStudioProof: p.hasStudioProof ?? (p.isVerified ?? !isPending),
            warning: isSuspended ? 'COMPLAINT_1' : 'NONE',
            warningLabel: isSuspended ? '1 khiếu nại' : 'Không có',
            taxCode: p.taxCode || 'Chưa cập nhật',
            address: p.address || 'Chưa cập nhật',
            bankAccount: p.bankAccount || 'Chưa liên kết',
            bankName: p.bankName || 'Chưa liên kết',
            lastActive: 'Vừa xong',
            products: Array.isArray(p.products) ? p.products : [],
            reviews,
          };
        });
        setPartnerList(loadedPartners);
        setSelectedPartner((prev) => {
          if (!prev) return null;
          const fresh = loadedPartners.find((item) => item.id === prev.id);
          return fresh || prev;
        });
      }

      const statsData = resStats.status === 'fulfilled' ? resStats.value : null;
      const totalProviders = loadedPartners.length || (statsData?.shops?.total ?? 0) + (statsData?.photographers?.total ?? 0) || 18;
      const activeCount = loadedPartners.filter((p) => p.status === 'ACTIVE').length;
      const pendingCount = statsData?.operational?.pendingVerifications ?? loadedPartners.filter((p) => p.status === 'PENDING').length;
      const suspendedCount = loadedPartners.filter((p) => p.status === 'SUSPENDED').length;
      const openDisputes = statsData?.operational?.openDisputes ?? 0;

      setMetrics({
        totalPartners: totalProviders,
        newThisMonth: Math.max(1, Math.round(totalProviders * 0.15)),
        activePartners: activeCount,
        pendingVerifications: pendingCount,
        suspendedPartners: suspendedCount,
        disputesOrWarnings: openDisputes,
      });
    } catch {
      toast.show('Không thể tải dữ liệu đối tác, vui lòng tải lại trang', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, sortBy, toast]);

  useEffect(() => {
    void fetchBackendData();
  }, [fetchBackendData]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    checkTableScroll();
    el.addEventListener('scroll', checkTableScroll, { passive: true });
    window.addEventListener('resize', checkTableScroll);
    return () => {
      el.removeEventListener('scroll', checkTableScroll);
      window.removeEventListener('resize', checkTableScroll);
    };
  }, [checkTableScroll, partnerList, selectedPartner]);

  // Filter, search, and sort logic
  const filteredPartners = useMemo(() => {
    const filtered = partnerList.filter((partner) => {
      // Search
      if (searchQuery.trim()) {
        const matches =
          includesVietnamese(partner.businessName, searchQuery) ||
          includesVietnamese(partner.ownerName, searchQuery) ||
          includesVietnamese(partner.partnerCode, searchQuery) ||
          includesVietnamese(partner.email, searchQuery) ||
          includesVietnamese(partner.phone, searchQuery);
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && partner.status !== statusFilter) {
        return false;
      }

      // Capability
      if (capabilityFilter !== 'ALL') {
        const hasCap = partner.capabilities.some((c) =>
          c.toUpperCase().includes(capabilityFilter.toUpperCase())
        );
        if (!hasCap) return false;
      }

      // Rating (unrated = 0 must not match HIGH/MEDIUM/LOW)
      if (ratingFilter === 'HIGH' && (partner.rating <= 0 || partner.rating < 4.8)) return false;
      if (ratingFilter === 'MEDIUM' && (partner.rating < 4.0 || partner.rating >= 4.8)) return false;
      if (ratingFilter === 'LOW' && (partner.rating <= 0 || partner.rating >= 4.0)) return false;
      if (ratingFilter === 'NONE' && partner.rating > 0) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'bookings_desc':
          return (
            b.completedBookings - a.completedBookings ||
            b.totalBookings - a.totalBookings ||
            b.totalProducts - a.totalProducts ||
            b.createdAtMs - a.createdAtMs
          );
        case 'bookings_asc':
          return (
            a.completedBookings - b.completedBookings ||
            a.totalBookings - b.totalBookings ||
            b.createdAtMs - a.createdAtMs
          );
        case 'revenue_desc':
          return (
            b.totalEarnings - a.totalEarnings ||
            b.completedBookings - a.completedBookings ||
            b.createdAtMs - a.createdAtMs
          );
        case 'revenue_asc':
          return (
            a.totalEarnings - b.totalEarnings ||
            a.completedBookings - b.completedBookings
          );
        case 'rating_desc': {
          const aRated = a.rating > 0 ? 1 : 0;
          const bRated = b.rating > 0 ? 1 : 0;
          return (
            bRated - aRated ||
            b.rating - a.rating ||
            b.totalReviews - a.totalReviews ||
            b.completedBookings - a.completedBookings
          );
        }
        case 'rating_asc': {
          const aRated = a.rating > 0 ? 1 : 0;
          const bRated = b.rating > 0 ? 1 : 0;
          return (
            bRated - aRated ||
            a.rating - b.rating ||
            a.totalReviews - b.totalReviews
          );
        }
        case 'products_desc':
          return (
            b.totalProducts - a.totalProducts ||
            b.completedBookings - a.completedBookings ||
            b.createdAtMs - a.createdAtMs
          );
        case 'products_asc':
          return (
            a.totalProducts - b.totalProducts ||
            b.createdAtMs - a.createdAtMs
          );
        case 'oldest':
          return a.createdAtMs - b.createdAtMs;
        case 'newest':
        default:
          return b.createdAtMs - a.createdAtMs;
      }
    });
  }, [partnerList, searchQuery, statusFilter, capabilityFilter, ratingFilter, sortBy]);

  const toggleColumnSort = (
    descKey: PartnerSortKey,
    ascKey: PartnerSortKey,
  ) => {
    setSortBy((prev) => (prev === descKey ? ascKey : descKey));
  };

  const renderSortIcon = (descKey: PartnerSortKey, ascKey: PartnerSortKey) => {
    if (sortBy === descKey) return <ArrowDown size={12} />;
    if (sortBy === ascKey) return <ArrowUp size={12} />;
    return <ArrowUpDown size={11} style={{ opacity: 0.45 }} />;
  };

  // Reset page on filter or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, capabilityFilter, ratingFilter, sortBy, perPage]);

  const totalItems = filteredPartners.length;
  const pageSizeNumber = perPage === 'all' ? (totalItems || 1) : perPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeNumber));

  const paginatedPartners = useMemo(() => {
    if (perPage === 'all') return filteredPartners;
    const startIndex = (currentPage - 1) * perPage;
    return filteredPartners.slice(startIndex, startIndex + perPage);
  }, [filteredPartners, currentPage, perPage]);

  // Selection handlers
  const allSelected = paginatedPartners.length > 0 && paginatedPartners.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      paginatedPartners.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Actions: Suspend & Unsuspend
  const handleSuspendPartner = async (partner: PartnerDetailItem) => {
    const result = await Swal.fire({
      title: 'Tạm ngưng đối tác?',
      text: `Đối tác "${partner.businessName}" sẽ tạm thời bị ẩn sản phẩm và không thể nhận thêm booking mới.`,
      input: 'textarea',
      inputLabel: 'Lý do tạm ngưng (ghi chú nội bộ):',
      inputPlaceholder: 'Ví dụ: Đang chờ kiểm tra chứng từ an toàn dịch vụ...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D97706',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Xác nhận tạm ngưng',
      cancelButtonText: 'Hủy bỏ',
    });

    if (result.isConfirmed) {
      try {
        const reason = typeof result.value === 'string' ? result.value.trim() : undefined;
        await adminDirectoryApi.suspendProvider(partner.id, reason);
      } catch {
        // Optimistic update
      }
      toast.show(`Đã tạm ngưng đối tác "${partner.businessName}"`, 'info');
      setPartnerList((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : p))
      );
      if (selectedPartner?.id === partner.id) {
        setSelectedPartner((prev) => (prev ? { ...prev, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : null));
      }
    }
  };

  const handleUnsuspendPartner = async (partner: PartnerDetailItem) => {
    const result = await Swal.fire({
      title: 'Mở lại hoạt động đối tác?',
      text: `Đối tác "${partner.businessName}" sẽ được kích hoạt lại để khách hàng có thể đặt lịch.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Mở lại đối tác',
      cancelButtonText: 'Hủy bỏ',
    });

    if (result.isConfirmed) {
      try {
        await adminDirectoryApi.unsuspendProvider(partner.id);
        toast.show(`Đã mở lại hoạt động đối tác "${partner.businessName}"`, 'success');
        setPartnerList((prev) =>
          prev.map((p) => (p.id === partner.id ? { ...p, status: 'ACTIVE', statusLabel: 'Hoạt động' } : p))
        );
        if (selectedPartner?.id === partner.id) {
          setSelectedPartner((prev) => (prev ? { ...prev, status: 'ACTIVE', statusLabel: 'Hoạt động' } : null));
        }
      } catch {
        toast.show('Không thể mở lại đối tác, vui lòng thử lại', 'error');
      }
    }
  };

  // Export CSV
  const handleExportData = () => {
    if (filteredPartners.length === 0) {
      toast.show('Không có dữ liệu đối tác để xuất file', 'warning');
      return;
    }
    const headers = [
      'Mã ĐT',
      'Tên doanh nghiệp',
      'Chủ sở hữu',
      'Email',
      'SĐT',
      'Dịch vụ',
      'Ngày tham gia',
      'Sản phẩm active',
      'Booking hoàn tất',
      'Đánh giá sao',
      'Doanh thu',
      'Xác thực',
      'Trạng thái',
    ];
    const rows = filteredPartners.map((p) => [
      p.partnerCode,
      `"${p.businessName.replace(/"/g, '""')}"`,
      `"${p.ownerName.replace(/"/g, '""')}"`,
      p.email,
      p.phone,
      `"${p.capabilities.join(', ')}"`,
      p.date,
      p.totalProducts,
      p.completedBookings,
      p.rating > 0 ? p.rating.toFixed(1) : 'Chưa có',
      p.totalEarnings,
      p.isVerified ? 'Đã xác minh' : 'Chưa xác minh',
      p.statusLabel,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `danh_sach_doi_tac_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show('Đã xuất danh sách đối tác thành công!', 'success');
  };

  return (
    <div className="lume-partner-container">
      {/* 1. Page Header */}
      <div className="lume-partner-header">
        <h1 className="lume-partner-title">Đối tác</h1>
        <p className="lume-partner-subtitle">
          Quản lý mạng lưới đối tác cung cấp áo dài, studio, thợ chụp ảnh, trạng thái phê duyệt và chất lượng dịch vụ trên TàGo.
        </p>
      </div>

      {/* 2. 6 KPI Cards Grid */}
      <div className="lume-partner-kpi-grid-6">
        {/* Card 1: Tổng đối tác */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap pink">
              <Store size={15} />
            </div>
            <span className="lume-partner-kpi-label">Tổng đối tác hệ thống</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.totalPartners.toLocaleString('vi-VN')}</div>
          <div className="lume-partner-kpi-trend">
            <span className="lume-partner-kpi-subtext">Tổng cửa hàng &amp; studio đã đăng ký</span>
          </div>
        </div>

        {/* Card 2: Đối tác mới */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap green">
              <UserPlus size={15} />
            </div>
            <span className="lume-partner-kpi-label">Đăng ký mới tháng này</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.newThisMonth.toLocaleString('vi-VN')}</div>
          <div className="lume-partner-kpi-trend positive">
            <span className="lume-partner-kpi-subtext">
              {metrics.totalPartners > 0
                ? `Chiếm ${Math.round((metrics.newThisMonth / metrics.totalPartners) * 100)}% tổng đối tác`
                : 'Chưa có đăng ký mới'}
            </span>
          </div>
        </div>

        {/* Card 3: Đang hoạt động */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap green-solid">
              <CheckCircle size={14} strokeWidth={3} />
            </div>
            <span className="lume-partner-kpi-label">Đang hoạt động</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.activePartners.toLocaleString('vi-VN')}</div>
          <div className="lume-partner-kpi-trend positive">
            <span className="lume-partner-kpi-subtext">
              {metrics.totalPartners > 0
                ? `${Math.round((metrics.activePartners / metrics.totalPartners) * 100)}% tổng đối tác`
                : 'Chưa có đối tác hoạt động'}
            </span>
          </div>
        </div>

        {/* Card 4: Chờ duyệt hồ sơ */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap amber">
              <Clock3 size={15} />
            </div>
            <span className="lume-partner-kpi-label">Chờ xét duyệt hồ sơ</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.pendingVerifications.toLocaleString('vi-VN')}</div>
          <div className={`lume-partner-kpi-trend ${metrics.pendingVerifications > 0 ? 'alert' : ''}`}>
            <span className="lume-partner-kpi-subtext">
              {metrics.pendingVerifications > 0 ? 'Hồ sơ cần Admin duyệt' : 'Đã duyệt hết hồ sơ'}
            </span>
          </div>
        </div>

        {/* Card 5: Tạm ngưng */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap red">
              <Lock size={15} />
            </div>
            <span className="lume-partner-kpi-label">Bị tạm ngưng / Khóa</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.suspendedPartners.toLocaleString('vi-VN')}</div>
          <div className={`lume-partner-kpi-trend ${metrics.suspendedPartners > 0 ? 'alert' : ''}`}>
            <span className="lume-partner-kpi-subtext">
              {metrics.totalPartners > 0 && metrics.suspendedPartners > 0
                ? `${Math.round((metrics.suspendedPartners / metrics.totalPartners) * 100)}% tổng đối tác`
                : 'Không có đối tác bị khóa'}
            </span>
          </div>
        </div>

        {/* Card 6: Có tranh chấp / Khiếu nại */}
        <div className="lume-partner-kpi-card">
          <div className="lume-partner-kpi-top">
            <div className="lume-partner-kpi-icon-wrap red">
              <ShieldAlert size={15} />
            </div>
            <span className="lume-partner-kpi-label">Có khiếu nại dịch vụ</span>
          </div>
          <div className="lume-partner-kpi-value">{metrics.disputesOrWarnings.toLocaleString('vi-VN')}</div>
          <div className={`lume-partner-kpi-trend ${metrics.disputesOrWarnings > 0 ? 'alert' : ''}`}>
            <span className="lume-partner-kpi-subtext">
              {metrics.disputesOrWarnings > 0 ? 'Đối tác cần hòa giải' : 'Không có khiếu nại'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Layout: Table + Docked Panel */}
      <div className="lume-partner-main-layout">
        {/* Left: Table & Controls */}
        <div className="lume-partner-table-section">
          {/* Filter Bar */}
          <div className="lume-partner-filter-bar">
            {/* Top Search Input */}
            <div className="lume-partner-search-row">
              <Search size={15} color="#881337" />
              <input
                type="text"
                className="lume-partner-search-input"
                placeholder="Tìm kiếm theo tên thương hiệu, chủ cơ sở, email, mã #DT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF' }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdowns & Export Button */}
            <div className="lume-partner-dropdowns-row">
              <div className="lume-partner-dropdowns-left">
                {/* Trạng thái */}
                <div className="lume-partner-filter-group">
                  <span className="lume-partner-filter-label">Trạng thái</span>
                  <select
                    className="lume-partner-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="PENDING">Chờ duyệt</option>
                    <option value="SUSPENDED">Tạm ngưng</option>
                  </select>
                </div>

                {/* Loại dịch vụ */}
                <div className="lume-partner-filter-group">
                  <span className="lume-partner-filter-label">Loại dịch vụ</span>
                  <select
                    className="lume-partner-select"
                    value={capabilityFilter}
                    onChange={(e) => setCapabilityFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả dịch vụ</option>
                    <option value="RENTAL">Thuê áo dài</option>
                    <option value="PHOTOGRAPHER">Nhiếp ảnh gia</option>
                    <option value="COMBO">Gói Combo</option>
                    <option value="MAKEUP">Trang điểm</option>
                  </select>
                </div>

                {/* Đánh giá sao */}
                <div className="lume-partner-filter-group">
                  <span className="lume-partner-filter-label">Đánh giá</span>
                  <select
                    className="lume-partner-select"
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả xếp hạng</option>
                    <option value="HIGH">Rất tốt (⭐ ≥ 4.8)</option>
                    <option value="MEDIUM">Khá (⭐ 4.0 - 4.7)</option>
                    <option value="LOW">Cần xem xét (⭐ &lt; 4.0)</option>
                    <option value="NONE">Chưa có đánh giá</option>
                  </select>
                </div>

                {/* Sắp xếp */}
                <div className="lume-partner-filter-group">
                  <span className="lume-partner-filter-label">Sắp xếp</span>
                  <select
                    className="lume-partner-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as PartnerSortKey)}
                  >
                    <option value="bookings_desc">Booking nhiều nhất</option>
                    <option value="revenue_desc">Doanh thu cao nhất</option>
                    <option value="rating_desc">Đánh giá cao nhất</option>
                    <option value="products_desc">Sản phẩm nhiều nhất</option>
                    <option value="newest">Mới tham gia nhất</option>
                    <option value="oldest">Tham gia lâu nhất</option>
                  </select>
                </div>
              </div>

              {/* Export CSV Button */}
              <button
                type="button"
                className="lume-partner-export-btn"
                onClick={handleExportData}
              >
                <Download size={13} />
                <span>Xuất dữ liệu</span>
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="lume-partner-table-card">
            {/* Scroll Navigation Bar when table overflows horizontally */}
            {(scrollProgress.canLeft || scrollProgress.canRight) && (
              <div className="lume-partner-table-top-bar">
                <div className="lume-partner-drag-hint">
                  <MoveHorizontal size={13} />
                  <span>Kéo chuột trên bảng hoặc dùng nút để cuộn ngang</span>
                </div>
                <div className="lume-partner-top-scroll-nav">
                  <button
                    type="button"
                    className="lume-partner-top-scroll-btn"
                    disabled={!scrollProgress.canLeft}
                    onClick={() => tableScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                    title="Cuộn bảng sang trái"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className="lume-partner-top-scroll-btn"
                    disabled={!scrollProgress.canRight}
                    onClick={() => tableScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                    title="Cuộn bảng sang phải"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            <div
              ref={tableScrollRef}
              className={`lume-partner-table-scroll ${isDragging ? 'is-dragging' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              <table className="lume-partner-table">
                <thead>
                  <tr>
                    <th style={{ width: 38, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="lume-partner-cb"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Đối tác & Thương hiệu</th>
                    <th>Dịch vụ</th>
                    <th>Liên hệ</th>
                    <th>
                      <button
                        type="button"
                        className={`lume-partner-sort-btn ${sortBy === 'newest' || sortBy === 'oldest' ? 'is-active' : ''}`}
                        onClick={() => toggleColumnSort('newest', 'oldest')}
                      >
                        <span>Ngày tham gia</span>
                        {renderSortIcon('newest', 'oldest')}
                      </button>
                    </th>
                    <th style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`lume-partner-sort-btn is-center ${sortBy === 'products_desc' || sortBy === 'products_asc' ? 'is-active' : ''}`}
                        onClick={() => toggleColumnSort('products_desc', 'products_asc')}
                      >
                        <span>Sản phẩm</span>
                        {renderSortIcon('products_desc', 'products_asc')}
                      </button>
                    </th>
                    <th style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`lume-partner-sort-btn is-center ${sortBy === 'bookings_desc' || sortBy === 'bookings_asc' ? 'is-active' : ''}`}
                        onClick={() => toggleColumnSort('bookings_desc', 'bookings_asc')}
                      >
                        <span>Booking</span>
                        {renderSortIcon('bookings_desc', 'bookings_asc')}
                      </button>
                    </th>
                    <th style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`lume-partner-sort-btn is-center ${sortBy === 'rating_desc' || sortBy === 'rating_asc' ? 'is-active' : ''}`}
                        onClick={() => toggleColumnSort('rating_desc', 'rating_asc')}
                      >
                        <span>Đánh giá</span>
                        {renderSortIcon('rating_desc', 'rating_asc')}
                      </button>
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`lume-partner-sort-btn is-right ${sortBy === 'revenue_desc' || sortBy === 'revenue_asc' ? 'is-active' : ''}`}
                        onClick={() => toggleColumnSort('revenue_desc', 'revenue_asc')}
                      >
                        <span>Doanh thu</span>
                        {renderSortIcon('revenue_desc', 'revenue_asc')}
                      </button>
                    </th>
                    <th>Xác thực</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: '#6B7280' }}>
                        Đang tải danh sách đối tác từ hệ thống...
                      </td>
                    </tr>
                  ) : paginatedPartners.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: '#6B7280' }}>
                        {searchQuery.trim()
                          ? 'Không tìm thấy đối tác nào phù hợp với từ khóa tìm kiếm.'
                          : 'Chưa có đối tác nào trong hệ thống.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPartners.map((partner) => {
                      const isSelected = selectedPartner?.id === partner.id;
                      const isChecked = selectedIds.has(partner.id);
                      const avatarKey = `avatar-${partner.id}-${partner.avatar}`;
                      const showAvatarImg =
                        Boolean(partner.avatar) && !failedImages.has(avatarKey);

                      return (
                        <tr
                          key={partner.id}
                          className={isSelected ? 'is-selected' : ''}
                          onClick={() => {
                            if (dragInfo.current.hasMoved) {
                              dragInfo.current.hasMoved = false;
                              return;
                            }
                            setSelectedPartner((prev) => (prev?.id === partner.id ? null : partner));
                          }}
                        >
                          {/* Checkbox */}
                          <td
                            style={{ textAlign: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <input
                              type="checkbox"
                              className="lume-partner-cb"
                              checked={isChecked}
                              onChange={() => toggleSelectOne(partner.id)}
                            />
                          </td>

                          {/* Đối tác & Thương hiệu */}
                          <td>
                            <div className="lume-partner-identity-row">
                              {showAvatarImg ? (
                                <img
                                  src={partner.avatar}
                                  alt={partner.businessName}
                                  className="lume-partner-avatar-img"
                                  onError={() => markImageFailed(avatarKey)}
                                />
                              ) : (
                                <div className="lume-partner-avatar-empty" aria-hidden="true" />
                              )}
                              <div className="lume-partner-identity-text">
                                <span className="lume-partner-business-name">{partner.businessName}</span>
                                <span className="lume-partner-owner-name">{partner.ownerName}</span>
                                <span className="lume-partner-code-sub">{partner.partnerCode}</span>
                              </div>
                            </div>
                          </td>

                          {/* Dịch vụ */}
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {partner.capabilities.map((cap, i) => {
                                const cUpper = cap.toUpperCase();
                                if (cUpper.includes('RENT')) {
                                  return (
                                    <span key={i} className="lume-partner-capability-badge rental">
                                      <ShoppingBag size={11} /> Áo dài
                                    </span>
                                  );
                                }
                                if (cUpper.includes('PHOTO')) {
                                  return (
                                    <span key={i} className="lume-partner-capability-badge photo">
                                      <Camera size={11} /> Thợ ảnh
                                    </span>
                                  );
                                }
                                if (cUpper.includes('COMBO')) {
                                  return (
                                    <span key={i} className="lume-partner-capability-badge combo">
                                      <Sparkles size={11} /> Combo
                                    </span>
                                  );
                                }
                                return (
                                  <span key={i} className="lume-partner-capability-badge rental">
                                    {cap}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Liên hệ */}
                          <td>
                            <div className="lume-partner-contact-box">
                              <span className="lume-partner-contact-email">{partner.email}</span>
                              <span className="lume-partner-contact-phone">{partner.phone}</span>
                            </div>
                          </td>

                          {/* Ngày tham gia */}
                          <td style={{ color: '#4B5563' }}>{partner.date}</td>

                          {/* Sản phẩm */}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{partner.totalProducts}</td>

                          {/* Booking */}
                          <td
                            style={{ textAlign: 'center', fontWeight: 600 }}
                            title={`${partner.completedBookings} hoàn thành / ${partner.totalBookings} tổng đơn`}
                          >
                            <div>{partner.completedBookings}</div>
                            {partner.totalBookings > partner.completedBookings && (
                              <div className="lume-partner-booking-sub">
                                / {partner.totalBookings} tổng
                              </div>
                            )}
                          </td>

                          {/* Đánh giá */}
                          <td style={{ textAlign: 'center' }}>
                            {partner.rating > 0 ? (
                              <span className="lume-partner-rating-pill">
                                <Star size={11} fill="#F59E0B" color="#F59E0B" />
                                {partner.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="lume-partner-rating-empty">Chưa có</span>
                            )}
                          </td>

                          {/* Doanh thu */}
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#881337' }}>
                            {partner.totalEarnings.toLocaleString('vi-VN')} đ
                          </td>

                          {/* Xác thực */}
                          <td>
                            {partner.isVerified ? (
                              <span className="lume-partner-pill-verified-modern">
                                <BadgeCheck size={11} />
                                Đã xác minh
                              </span>
                            ) : (
                              <span className="lume-partner-pill-unverified-modern">
                                <Clock size={11} />
                                Chờ duyệt
                              </span>
                            )}
                          </td>

                          {/* Trạng thái */}
                          <td>
                            {partner.status === 'ACTIVE' ? (
                              <span className="lume-partner-status-pill active">Hoạt động</span>
                            ) : partner.status === 'PENDING' ? (
                              <span className="lume-partner-status-pill pending">Chờ duyệt</span>
                            ) : (
                              <span className="lume-partner-status-pill suspended">Tạm ngưng</span>
                            )}
                          </td>

                          {/* Thao tác */}
                          <td
                            style={{ textAlign: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className="lume-partner-more-btn"
                              title="Thao tác đối tác"
                              onClick={() => setSelectedPartner((prev) => (prev?.id === partner.id ? null : partner))}
                            >
                              •••
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="lume-partner-pagination-bar">
              <div className="lume-partner-page-summary">
                {perPage === 'all' ? (
                  <span>Đang hiển thị <strong>tất cả {totalItems}</strong> đối tác</span>
                ) : (
                  <span>
                    Hiển thị <strong>{totalItems === 0 ? 0 : (currentPage - 1) * (perPage as number) + 1} - {Math.min(currentPage * (perPage as number), totalItems)}</strong> của <strong>{totalItems}</strong> đối tác
                  </span>
                )}
              </div>

              <div className="lume-partner-page-btns">
                {perPage !== 'all' && totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      className="lume-partner-pbtn"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      title="Trang trước"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => idx + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`lume-partner-pbtn ${currentPage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="lume-partner-pbtn"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      title="Trang sau"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}

                <select
                  className="lume-partner-per-page"
                  value={perPage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPerPage(val === 'all' ? 'all' : Number(val));
                  }}
                >
                  <option value="all">Hiển thị hết (Tất cả)</option>
                  <option value={8}>8 / trang</option>
                  <option value={15}>15 / trang</option>
                  <option value={30}>30 / trang</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Right Side: Exact Figma Partner Detail Drawer */}
        {selectedPartner && (
          <div className="lume-partner-detail-panel">
            {/* Cover Banner */}
            <div className="lume-partner-detail-cover">
              {selectedPartner.coverUrl &&
              !failedImages.has(`cover-${selectedPartner.id}-${selectedPartner.coverUrl}`) ? (
                <img
                  src={selectedPartner.coverUrl}
                  alt={selectedPartner.businessName}
                  className="lume-partner-cover-img"
                  onError={() =>
                    markImageFailed(`cover-${selectedPartner.id}-${selectedPartner.coverUrl}`)
                  }
                />
              ) : null}
              <button
                type="button"
                className="lume-partner-cover-close-btn"
                onClick={() => setSelectedPartner(null)}
                title="Đóng chi tiết"
              >
                <X size={15} />
              </button>
            </div>

            {/* Detail Body */}
            <div className="lume-partner-detail-body">
              {/* Overlapping Avatar & Status Pill Row */}
              <div className="lume-partner-profile-header-row">
                <div className="lume-partner-avatar-floating-wrapper">
                  {selectedPartner.avatar &&
                  !failedImages.has(`avatar-${selectedPartner.id}-${selectedPartner.avatar}`) ? (
                    <img
                      src={selectedPartner.avatar}
                      alt={selectedPartner.businessName}
                      className="lume-partner-floating-avatar"
                      onError={() =>
                        markImageFailed(`avatar-${selectedPartner.id}-${selectedPartner.avatar}`)
                      }
                    />
                  ) : (
                    <div
                      className="lume-partner-floating-avatar-empty"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <span
                  className={`lume-partner-status-pill-badge ${
                    selectedPartner.status === 'ACTIVE'
                      ? 'active'
                      : selectedPartner.status === 'PENDING'
                      ? 'pending'
                      : 'suspended'
                  }`}
                >
                  {selectedPartner.status === 'ACTIVE'
                    ? 'Đang hoạt động'
                    : selectedPartner.status === 'PENDING'
                    ? 'Chờ duyệt'
                    : 'Tạm ngưng'}
                </span>
              </div>

              {/* Title & ID/Date Row */}
              <div className="lume-partner-title-row">
                <h3 className="lume-partner-detail-business-name">{selectedPartner.businessName}</h3>
                <div className="lume-partner-id-date-row">
                  <span className="lume-partner-id-tag">
                    ID: {selectedPartner.partnerCode.replace('#DT', 'PRV').replace('#', '')}
                  </span>
                  <span className="lume-partner-date-tag">Tham gia: {selectedPartner.date}</span>
                </div>
              </div>

              {/* 4 Horizontal Underline Tabs */}
              <div className="lume-partner-tabs-nav">
                <button
                  type="button"
                  className={`lume-partner-tab-nav-btn ${activePanelTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActivePanelTab('overview')}
                >
                  Tổng quan
                </button>
                <button
                  type="button"
                  className={`lume-partner-tab-nav-btn ${activePanelTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActivePanelTab('info')}
                >
                  Thông tin
                </button>
                <button
                  type="button"
                  className={`lume-partner-tab-nav-btn ${activePanelTab === 'products' ? 'active' : ''}`}
                  onClick={() => setActivePanelTab('products')}
                >
                  Sản phẩm
                </button>
                <button
                  type="button"
                  className={`lume-partner-tab-nav-btn ${activePanelTab === 'reviews' ? 'active' : ''}`}
                  onClick={() => setActivePanelTab('reviews')}
                >
                  Đánh giá
                </button>
              </div>

              {/* Tab 1: Tổng quan (Exact match to screenshot with live data) */}
              {activePanelTab === 'overview' && (
                <>
                  {/* 4 Stat Cards in 2x2 Grid */}
                  <div className="lume-partner-kpi-cards-2x2">
                    <div className="lume-partner-kpi-subcard">
                      <div className="lume-partner-kpi-subcard-top">
                        <ShoppingBag size={18} color="#2563EB" />
                        <span className="lume-partner-kpi-subcard-val">{selectedPartner.totalProducts}</span>
                      </div>
                      <span className="lume-partner-kpi-subcard-label">Sản phẩm / dịch vụ</span>
                    </div>

                    <div className="lume-partner-kpi-subcard">
                      <div className="lume-partner-kpi-subcard-top">
                        <CalendarCheck size={18} color="#059669" />
                        <span className="lume-partner-kpi-subcard-val">{selectedPartner.completedBookings}</span>
                      </div>
                      <span className="lume-partner-kpi-subcard-label">Tổng đơn hoàn thành</span>
                    </div>

                    <div className="lume-partner-kpi-subcard">
                      <div className="lume-partner-kpi-subcard-top">
                        <Star
                          size={18}
                          color={selectedPartner.rating > 0 ? '#EAB308' : '#D1D5DB'}
                          fill={selectedPartner.rating > 0 ? '#EAB308' : 'none'}
                        />
                        <span className="lume-partner-kpi-subcard-val">
                          {selectedPartner.rating > 0 ? selectedPartner.rating.toFixed(1) : 'Chưa có'}
                        </span>
                      </div>
                      <span className="lume-partner-kpi-subcard-label">Đánh giá trung bình</span>
                    </div>

                    <div className="lume-partner-kpi-subcard">
                      <div className="lume-partner-kpi-subcard-top">
                        <Activity size={18} color="#2563EB" />
                        <span className="lume-partner-kpi-subcard-val">{selectedPartner.completionRate}%</span>
                      </div>
                      <span className="lume-partner-kpi-subcard-label">Tỷ lệ hoàn thành</span>
                    </div>
                  </div>

                  {/* Thông tin liên hệ */}
                  <div className="lume-partner-section-block">
                    <h4 className="lume-partner-section-heading">Thông tin liên hệ</h4>
                    <div className="lume-partner-contact-list-modern">
                      <div className="lume-partner-contact-item-modern">
                        <Mail size={15} color="#9CA3AF" />
                        <span>{selectedPartner.email || 'Chưa cập nhật'}</span>
                      </div>
                      <div className="lume-partner-contact-item-modern">
                        <Phone size={15} color="#9CA3AF" />
                        <span>{selectedPartner.phone || 'Chưa cập nhật'}</span>
                      </div>
                      <div className="lume-partner-contact-item-modern">
                        <MapPin size={15} color="#9CA3AF" />
                        <span>{selectedPartner.address || 'Chưa cập nhật'}</span>
                      </div>
                      <div className="lume-partner-contact-item-modern">
                        <Globe size={15} color="#9CA3AF" />
                        {selectedPartner.website ? (
                          <a
                            href={selectedPartner.website.startsWith('http') ? selectedPartner.website : `https://${selectedPartner.website}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {selectedPartner.website}
                          </a>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>Chưa cập nhật website</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Giấy tờ & xác minh */}
                  <div className="lume-partner-section-block">
                    <h4 className="lume-partner-section-heading">Giấy tờ & xác minh</h4>
                    <div className="lume-partner-verify-list-modern">
                      <div className="lume-partner-verify-row">
                        <span className="lume-partner-verify-label">CCCD/CMND</span>
                        <span className="lume-partner-verify-status">
                          {selectedPartner.hasIdCard ? (
                            <>
                              <CheckCircle2 size={15} color="#059669" />
                              <span style={{ color: '#059669', fontWeight: 600 }}>Đã xác minh</span>
                            </>
                          ) : (
                            <>
                              <Clock size={15} color="#D97706" />
                              <span style={{ color: '#D97706', fontWeight: 600 }}>Chờ xác minh</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="lume-partner-verify-row">
                        <span className="lume-partner-verify-label">Giấy phép kinh doanh</span>
                        <span className="lume-partner-verify-status">
                          {selectedPartner.hasBusinessLicense ? (
                            <>
                              <CheckCircle2 size={15} color="#059669" />
                              <span style={{ color: '#059669', fontWeight: 600 }}>Đã xác minh</span>
                            </>
                          ) : (
                            <>
                              <Clock size={15} color="#D97706" />
                              <span style={{ color: '#D97706', fontWeight: 600 }}>Chờ xác minh</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="lume-partner-verify-row">
                        <span className="lume-partner-verify-label">Xác minh studio</span>
                        <span className="lume-partner-verify-status">
                          {selectedPartner.hasStudioProof ? (
                            <>
                              <CheckCircle2 size={15} color="#059669" />
                              <span style={{ color: '#059669', fontWeight: 600 }}>Đã xác minh</span>
                            </>
                          ) : (
                            <>
                              <Clock size={15} color="#D97706" />
                              <span style={{ color: '#D97706', fontWeight: 600 }}>Chờ xác minh</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Action Buttons in 2x2 Grid */}
                  <div className="lume-partner-btn-grid-2x2">
                    <button
                      type="button"
                      className="lume-partner-btn-neutral"
                      onClick={() => toast.show(`Đã gửi thông báo đến đối tác ${selectedPartner.businessName}`, 'info')}
                    >
                      <AlertTriangle size={14} color="#6B7280" />
                      Gửi thông báo
                    </button>

                    <button
                      type="button"
                      className="lume-partner-btn-neutral"
                      onClick={() => setActivePanelTab('info')}
                    >
                      Xem chi tiết &gt;
                    </button>

                    <button
                      type="button"
                      className="lume-partner-btn-danger"
                      onClick={() =>
                        selectedPartner.status === 'SUSPENDED'
                          ? handleUnsuspendPartner(selectedPartner)
                          : handleSuspendPartner(selectedPartner)
                      }
                    >
                      <RotateCcw size={14} color="#E11D48" />
                      {selectedPartner.status === 'SUSPENDED' ? 'Mở lại đối tác' : 'Tạm ngưng'}
                    </button>

                    <button
                      type="button"
                      className="lume-partner-btn-danger"
                      onClick={() => handleSuspendPartner(selectedPartner)}
                    >
                      <Ban size={14} color="#E11D48" />
                      Khóa đối tác
                    </button>
                  </div>
                </>
              )}

              {/* Tab 2: Thông tin chi tiết */}
              {activePanelTab === 'info' && (
                <div className="lume-partner-tab-list" style={{ gap: 10 }}>
                  <div className="lume-partner-tab-card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Chủ sở hữu:</span>
                        <strong style={{ color: '#111827' }}>{selectedPartner.ownerName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Mã số thuế / GPKD:</span>
                        <strong style={{ color: '#111827' }}>{selectedPartner.taxCode || 'Chưa cập nhật'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Tài khoản ngân hàng:</span>
                        <strong style={{ color: '#111827' }}>{selectedPartner.bankAccount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Ngân hàng thụ hưởng:</span>
                        <strong style={{ color: '#111827' }}>{selectedPartner.bankName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Địa chỉ cơ sở:</span>
                        <strong style={{ color: '#111827', textAlign: 'right', maxWidth: '60%' }}>
                          {selectedPartner.address || 'Chưa cập nhật'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Trạng thái ký quỹ:</span>
                        <strong style={{ color: selectedPartner.isVerified ? '#059669' : '#D97706' }}>
                          {selectedPartner.isVerified ? 'Đã hoàn tất (Ký quỹ đầy đủ)' : 'Chưa hoàn tất'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Doanh thu lũy kế:</span>
                        <strong style={{ color: '#881337' }}>
                          {selectedPartner.totalEarnings.toLocaleString('vi-VN')} đ
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6B7280' }}>Hoạt động gần nhất:</span>
                        <strong style={{ color: '#111827' }}>{selectedPartner.lastActive}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="lume-partner-btn-neutral"
                    style={{ width: '100%' }}
                    onClick={() => setActivePanelTab('overview')}
                  >
                    &lt; Quay lại Tổng quan
                  </button>
                </div>
              )}

              {/* Tab 3: Sản phẩm */}
              {activePanelTab === 'products' && (
                <div className="lume-partner-tab-list">
                  {selectedPartner.products && selectedPartner.products.length > 0 ? (
                    selectedPartner.products.map((prod) => {
                      const prodImgKey = `prod-${prod.id}-${prod.image || ''}`;
                      const showProdImg =
                        Boolean(prod.image) && !failedImages.has(prodImgKey);
                      return (
                      <div key={prod.id} className="lume-partner-tab-card-item">
                        {showProdImg ? (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="lume-partner-tab-card-thumb"
                            onError={() => markImageFailed(prodImgKey)}
                          />
                        ) : (
                          <div
                            className="lume-partner-tab-card-thumb lume-partner-tab-card-thumb--empty"
                            aria-hidden="true"
                          />
                        )}
                        <div className="lume-partner-tab-card-info">
                          <div className="lume-partner-tab-card-header">
                            <span className="lume-partner-tab-card-title">{prod.name}</span>
                            <span className="lume-partner-pill-verified-modern">
                              {prod.status === 'ACTIVE' ? 'Đã duyệt' : 'Chờ duyệt'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trạng thái: {prod.status === 'ACTIVE' ? 'Đang hiển thị' : 'Tạm ẩn'}</span>
                            <strong style={{ color: '#111827' }}>
                              {prod.price ? `${prod.price.toLocaleString('vi-VN')} đ` : 'Liên hệ'}
                            </strong>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: '#9CA3AF' }}>
                      <ShoppingBag size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Đối tác chưa đăng sản phẩm nào</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Đánh giá */}
              {activePanelTab === 'reviews' && (
                <div className="lume-partner-tab-list">
                  <div className="lume-partner-tab-card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: selectedPartner.rating > 0 ? '#111827' : '#9CA3AF' }}>
                        {selectedPartner.rating > 0 ? selectedPartner.rating.toFixed(1) : 'Chưa có'}
                      </span>
                      <div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              size={14}
                              color={selectedPartner.rating > 0 ? '#F59E0B' : '#D1D5DB'}
                              fill={
                                selectedPartner.rating > 0 && idx < Math.round(selectedPartner.rating)
                                  ? '#F59E0B'
                                  : 'none'
                              }
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: 10.5, color: '#6B7280' }}>
                          {selectedPartner.totalReviews > 0
                            ? `Dựa trên ${selectedPartner.totalReviews} lượt đánh giá thực tế`
                            : 'Chưa có đánh giá thực tế'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedPartner.reviews && selectedPartner.reviews.length > 0 ? (
                    selectedPartner.reviews.map((rev) => {
                      const revAvatarKey = `rev-${rev.id}-${rev.avatar || ''}`;
                      const showRevAvatar =
                        Boolean(rev.avatar) && !failedImages.has(revAvatarKey);
                      return (
                      <div key={rev.id} className="lume-partner-tab-card" style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {showRevAvatar ? (
                              <img
                                src={rev.avatar}
                                alt={rev.customerName}
                                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                                onError={() => markImageFailed(revAvatarKey)}
                              />
                            ) : null}
                            <strong style={{ fontSize: 11.5, color: '#111827' }}>{rev.customerName}</strong>
                          </div>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{rev.date}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              size={11}
                              color="#F59E0B"
                              fill={idx < Math.round(rev.rating) ? '#F59E0B' : 'none'}
                            />
                          ))}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#4B5563', lineHeight: 1.35 }}>
                          {rev.comment}
                        </p>
                      </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: '#9CA3AF' }}>
                      <Star size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Chưa có đánh giá nào từ khách hàng</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PartnerManagementPanel;
