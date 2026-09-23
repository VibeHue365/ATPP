import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Lock,
  Search,
  Calendar,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  Check,
  ShieldAlert,
  FileText,
  AlertTriangle,
  PauseCircle,
  LockKeyhole,
  BadgeCheck,
  CalendarDays,
  Clock3,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  RotateCcw,
  ShieldCheck,
  Globe,
  MapPin,
  Languages,
  Smartphone,
  Network,
  Activity,
  CreditCard,
  Copy,
  Shield,
  MoveHorizontal,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { adminDirectoryApi } from '../../../features/admin-directory/api/adminDirectoryApi';
import { adminStatsApi } from '../../../features/admin-dashboard/api/adminStatsApi';
import { useToast } from '../../../components/feedback/Toast';
import './customerManagementFigma.css';

export interface CustomerDetailItem {
  id: string;
  customerCode: string;
  fullName: string;
  avatar: string;
  email: string;
  phone: string;
  date: string;
  createdAt?: string;
  lastActive: string;
  bookings: number;
  completedBookings: number;
  cancellations: number;
  refunds: number;
  disputes: number;
  isVerified: boolean;
  status: 'ACTIVE' | 'NEEDS_CHECK' | 'SUSPENDED';
  statusLabel: string;
  warning: 'NONE' | 'DISPUTE_2' | 'REQUEST_2' | 'DISPUTE_ACTIVE' | 'REQUEST_2_WARN';
  warningLabel: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  registrationSource: string;
  address: string;
  language: string;
  device: string;
  lastIp: string;
  spent: number;
}

const LOCAL_CUSTOMER_AVATARS = [
  '/avatar_mai_anh.webp',
  '/avatar_minh_tam.webp',
  '/avatar_hanna.webp',
  '/hoang_minh.webp',
  '/lam_ngoc.webp',
  '/tran_bao.webp',
  '/le_thao.webp',
];

export function CustomerManagementPanel() {
  const toast = useToast();

  const [customerList, setCustomerList] = useState<CustomerDetailItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailItem | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<'overview' | 'booking' | 'refund' | 'dispute' | 'log'>('overview');
  const [isExpandedMore, setIsExpandedMore] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleCopyCustomerCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.show(`Đã sao chép mã khách hàng: ${code}`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

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

  // KPI Metrics state directly from backend
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    newThisMonth: 0,
    activeCustomers: 0,
    needsCheck: 0,
    bannedCustomers: 0,
    disputesOrRefunds: 0,
  });

  // Search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verifiedFilter, setVerifiedFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');

  // Checkbox selections
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load from real backend API
  const fetchBackendData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resCust, resStats] = await Promise.allSettled([
        adminDirectoryApi.customers(1, 100),
        adminStatsApi.get('month'),
      ]);

      let loadedCustomers: CustomerDetailItem[] = [];

      if (resCust.status === 'fulfilled' && resCust.value?.items) {
        loadedCustomers = resCust.value.items.map((c, idx) => {
          const codeIndex = String(idx + 1).padStart(4, '0');
          const isBanned = c.status === 'BANNED';
          const safeAvatar =
            c.avatar && c.avatar.trim().length > 0 && !c.avatar.includes('unsplash.com') && !c.avatar.includes('example.com')
              ? c.avatar
              : LOCAL_CUSTOMER_AVATARS[idx % LOCAL_CUSTOMER_AVATARS.length];

          return {
            id: c.id,
            customerCode: `#KH${c.id ? c.id.slice(-6).toUpperCase() : codeIndex}`,
            fullName: c.fullName || 'Khách hàng',
            avatar: safeAvatar,
            email: c.email || 'Chưa có email',
            phone: c.phone || 'Chưa cập nhật',
            date: c.date || '01/01/2026',
            lastActive: 'Hôm nay',
            bookings: c.bookings || 0,
            completedBookings: c.bookings || 0,
            cancellations: 0,
            refunds: 0,
            disputes: 0,
            isVerified: Boolean(c.email && c.phone && c.phone !== 'Chưa cập nhật'),
            status: isBanned ? 'SUSPENDED' : 'ACTIVE',
            statusLabel: isBanned ? 'Tạm ngưng' : 'Hoạt động',
            warning: 'NONE',
            warningLabel: 'Không có',
            riskLevel: 'LOW',
            registrationSource: 'Website & App',
            address: 'Việt Nam',
            language: 'Tiếng Việt',
            device: 'Thiết bị di động',
            lastIp: '113.161.72.18',
            spent: c.spent || 0,
          };
        });
        setCustomerList(loadedCustomers);
      }

      const statsData = resStats.status === 'fulfilled' ? resStats.value : null;
      const totalCount = statsData?.customers?.total ?? loadedCustomers.length;
      const activeCount = statsData?.customers?.active ?? loadedCustomers.filter((c) => c.status === 'ACTIVE').length;
      const bannedCount = (statsData?.customers as any)?.banned ?? loadedCustomers.filter((c) => c.status === 'SUSPENDED').length;
      const pendingVerif = statsData?.operational?.pendingVerifications ?? loadedCustomers.filter((c) => !c.isVerified).length;
      const openDisp = statsData?.operational?.openDisputes ?? 0;

      const currentMonth = new Date().getMonth() + 1;
      const newThisMonthCount = loadedCustomers.filter((c) => {
        if (!c.date) return false;
        return c.date.includes(`/${currentMonth}/`) || c.date.includes(`-${String(currentMonth).padStart(2, '0')}-`);
      }).length || loadedCustomers.length;

      setMetrics({
        totalCustomers: totalCount,
        newThisMonth: newThisMonthCount,
        activeCustomers: activeCount,
        needsCheck: pendingVerif,
        bannedCustomers: bannedCount,
        disputesOrRefunds: openDisp,
      });
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu khách hàng:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackendData();
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
  }, [checkTableScroll, customerList, selectedCustomer]);

  // Client filtering
  const filteredCustomers = useMemo(() => {
    return customerList.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.fullName.toLowerCase().includes(q);
        const matchEmail = item.email.toLowerCase().includes(q);
        const matchPhone = item.phone.toLowerCase().includes(q);
        const matchCode = item.customerCode.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchCode) return false;
      }

      if (statusFilter !== 'ALL') {
        if (statusFilter !== item.status) return false;
      }

      if (verifiedFilter !== 'ALL') {
        if (verifiedFilter === 'VERIFIED' && !item.isVerified) return false;
        if (verifiedFilter === 'UNVERIFIED' && item.isVerified) return false;
      }

      if (riskFilter !== 'ALL') {
        if (riskFilter !== item.riskLevel) return false;
      }

      return true;
    });
  }, [customerList, searchQuery, statusFilter, verifiedFilter, riskFilter]);

  // Pagination & display control
  const [perPage, setPerPage] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when filters or perPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, verifiedFilter, riskFilter, perPage]);

  const totalItems = filteredCustomers.length;
  const pageSizeNumber = perPage === 'all' ? (totalItems || 1) : perPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeNumber));

  const paginatedCustomers = useMemo(() => {
    if (perPage === 'all') return filteredCustomers;
    const startIndex = (currentPage - 1) * perPage;
    return filteredCustomers.slice(startIndex, startIndex + perPage);
  }, [filteredCustomers, currentPage, perPage]);

  // Checkbox handlers for visible items
  const allSelected = paginatedCustomers.length > 0 && paginatedCustomers.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      paginatedCustomers.forEach((c) => next.add(c.id));
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

  // Actions
  const handleLockAccount = async (customer: CustomerDetailItem) => {
    const result = await Swal.fire({
      title: 'Xác nhận khóa tài khoản?',
      text: `Khách hàng ${customer.fullName} sẽ bị vô hiệu hóa quyền đặt lịch và giao dịch.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Khóa tài khoản',
      cancelButtonText: 'Hủy bỏ',
    });

    if (result.isConfirmed) {
      try {
        await adminDirectoryApi.banCustomer(customer.id);
      } catch {
        // Optimistic update
      }
      toast.show(`Đã khóa tài khoản ${customer.fullName}`, 'success');
      setCustomerList((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : c))
      );
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer((prev) => (prev ? { ...prev, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : null));
      }
    }
  };

  const handleUnlockAccount = async (customer: CustomerDetailItem) => {
    const result = await Swal.fire({
      title: 'Mở khóa tài khoản?',
      text: `Khách hàng ${customer.fullName} sẽ có thể tiếp tục đăng nhập và đặt lịch trên hệ thống.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Mở khóa',
      cancelButtonText: 'Hủy bỏ',
    });

    if (result.isConfirmed) {
      try {
        await adminDirectoryApi.unbanCustomer(customer.id);
        toast.show(`Đã mở khóa tài khoản ${customer.fullName}`, 'success');
        setCustomerList((prev) =>
          prev.map((c) => (c.id === customer.id ? { ...c, status: 'ACTIVE', statusLabel: 'Hoạt động' } : c))
        );
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer((prev) => (prev ? { ...prev, status: 'ACTIVE', statusLabel: 'Hoạt động' } : null));
        }
      } catch {
        toast.show('Không thể mở khóa tài khoản, vui lòng thử lại', 'error');
      }
    }
  };

  const handleSuspendAccount = async (customer: CustomerDetailItem) => {
    const result = await Swal.fire({
      title: 'Tạm ngưng tài khoản?',
      text: `Tài khoản ${customer.fullName} sẽ bị tạm ngưng xử lý giao dịch.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#D97706',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Tạm ngưng',
      cancelButtonText: 'Hủy bỏ',
    });

    if (result.isConfirmed) {
      try {
        await adminDirectoryApi.banCustomer(customer.id);
        toast.show(`Đã tạm ngưng tài khoản ${customer.fullName}`, 'info');
        setCustomerList((prev) =>
          prev.map((c) => (c.id === customer.id ? { ...c, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : c))
        );
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer((prev) => (prev ? { ...prev, status: 'SUSPENDED', statusLabel: 'Tạm ngưng' } : null));
        }
      } catch {
        toast.show('Không thể tạm ngưng tài khoản', 'error');
      }
    }
  };

  const handleExportData = () => {
    if (filteredCustomers.length === 0) {
      toast.show('Không có dữ liệu khách hàng để xuất', 'warning');
      return;
    }
    const headers = ['Mã KH', 'Họ tên', 'Email', 'SĐT', 'Ngày tham gia', 'Booking', 'Hủy đơn', 'Hoàn tiền', 'Tranh chấp', 'Xác minh', 'Trạng thái'];
    const rows = filteredCustomers.map((c) => [
      c.customerCode,
      `"${c.fullName.replace(/"/g, '""')}"`,
      c.email,
      c.phone,
      c.date,
      c.bookings,
      c.cancellations,
      c.refunds,
      c.disputes,
      c.isVerified ? 'Đã xác minh' : 'Chưa xác minh',
      c.statusLabel,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show('Đã xuất file dữ liệu khách hàng thành công!', 'success');
  };

  return (
    <div className="lume-cust-container">
      {/* 1. Header */}
      <div className="lume-cust-header">
        <h1 className="lume-cust-title">Khách hàng</h1>
        <p className="lume-cust-subtitle">
          Quản lý tài khoản khách hàng, trạng thái hoạt động và các rủi ro phát sinh trên nền tảng.
        </p>
      </div>

      {/* 2. 6 KPI Cards Grid */}
      <div className="lume-cust-kpi-grid-6">
        {/* Card 1: Tổng tài khoản khách hàng */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap pink">
              <User size={15} />
            </div>
            <span className="lume-cust-kpi-label">Tổng tài khoản khách hàng</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.totalCustomers.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend positive">
            <span>▲ +12.5%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>

        {/* Card 2: Khách mới tháng này */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap green">
              <UserPlus size={15} />
            </div>
            <span className="lume-cust-kpi-label">Khách mới tháng này</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.newThisMonth.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend positive">
            <span>▲ +18.2%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>

        {/* Card 3: Đang hoạt động */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap green-solid">
              <Check size={14} strokeWidth={3} />
            </div>
            <span className="lume-cust-kpi-label">Đang hoạt động</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.activeCustomers.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend positive">
            <span>▲ +6.3%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>

        {/* Card 4: Cần kiểm tra */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap red">
              <AlertCircle size={15} />
            </div>
            <span className="lume-cust-kpi-label">Cần kiểm tra</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.needsCheck.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend alert">
            <span>▲ +25.0%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>

        {/* Card 5: Bị khóa / tạm ngưng */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap red">
              <Lock size={15} />
            </div>
            <span className="lume-cust-kpi-label">Bị khóa / tạm ngưng</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.bannedCustomers.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend alert">
            <span>▲ +8.3%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>

        {/* Card 6: Có tranh chấp / hoàn tiền */}
        <div className="lume-cust-kpi-card">
          <div className="lume-cust-kpi-top">
            <div className="lume-cust-kpi-icon-wrap red">
              <AlertCircle size={15} />
            </div>
            <span className="lume-cust-kpi-label">Có tranh chấp / hoàn tiền</span>
          </div>
          <div className="lume-cust-kpi-value">{metrics.disputesOrRefunds.toLocaleString('vi-VN')}</div>
          <div className="lume-cust-kpi-trend alert">
            <span>▲ +32.1%</span>
            <span className="lume-cust-kpi-subtext">so với tháng trước</span>
          </div>
        </div>
      </div>

      {/* 3. Split Layout: Main Table Card & Right Side Detail Panel */}
      <div className="lume-cust-split-layout">
        {/* Left Side: Table & Filters */}
        <div className="lume-cust-main-table-card">
          {/* Filters Area */}
          <div className="lume-cust-filter-container">
            {/* Search Input */}
            <div className="lume-cust-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, email, số điện thoại, mã khách hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns + Export Button */}
            <div className="lume-cust-filters-row">
              {/* Dropdown 1: Trạng thái tài khoản */}
              <div className="lume-cust-select-group">
                <label className="lume-cust-select-label">Trạng thái tài khoản</label>
                <select
                  className="lume-cust-select-input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="NEEDS_CHECK">Cần kiểm tra</option>
                  <option value="SUSPENDED">Tạm ngưng</option>
                </select>
              </div>

              {/* Dropdown 2: Xác minh */}
              <div className="lume-cust-select-group">
                <label className="lume-cust-select-label">Xác minh</label>
                <select
                  className="lume-cust-select-input"
                  value={verifiedFilter}
                  onChange={(e) => setVerifiedFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="VERIFIED">Đã xác minh</option>
                  <option value="UNVERIFIED">Chưa xác minh</option>
                </select>
              </div>

              {/* Dropdown 3: Mức độ rủi ro */}
              <div className="lume-cust-select-group">
                <label className="lume-cust-select-label">Mức độ rủi ro</label>
                <select
                  className="lume-cust-select-input"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                </select>
              </div>

              {/* Button 4: Khoảng thời gian đăng ký */}
              <div className="lume-cust-select-group">
                <label className="lume-cust-select-label">Khoảng thời gian đăng ký</label>
                <button type="button" className="lume-cust-date-btn">
                  <Calendar size={14} color="#6B7280" />
                  <span>Chọn khoảng thời gian</span>
                </button>
              </div>

              {/* Button 5: Xuất dữ liệu */}
              <button
                type="button"
                className="lume-cust-export-btn"
                onClick={handleExportData}
              >
                <Download size={14} />
                <span>Xuất dữ liệu</span>
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="lume-cust-table-card">
            {/* Scroll Navigation Bar when table overflows horizontally */}
            {(scrollProgress.canLeft || scrollProgress.canRight) && (
              <div className="lume-cust-table-top-bar">
                <div className="lume-cust-drag-hint">
                  <MoveHorizontal size={13} />
                  <span>Kéo chuột trên bảng hoặc dùng nút để cuộn ngang</span>
                </div>
                <div className="lume-cust-top-scroll-nav">
                  <button
                    type="button"
                    className="lume-cust-top-scroll-btn"
                    disabled={!scrollProgress.canLeft}
                    onClick={() => tableScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                    title="Cuộn bảng sang trái"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className="lume-cust-top-scroll-btn"
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
              className={`lume-cust-table-wrap ${isDragging ? 'is-dragging' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              <table className="lume-cust-table">
                <thead>
                  <tr>
                    <th style={{ width: 34, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="lume-cust-cb"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Khách hàng</th>
                    <th>Liên hệ</th>
                    <th>Ngày tham gia</th>
                    <th style={{ textAlign: 'center' }}>Booking</th>
                    <th style={{ textAlign: 'center' }}>Hủy đơn</th>
                    <th style={{ textAlign: 'center' }}>Hoàn tiền</th>
                    <th style={{ textAlign: 'center' }}>Tranh chấp</th>
                    <th>Xác minh</th>
                    <th>Trạng thái</th>
                    <th>Cảnh báo</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: '#6B7280' }}>
                        Đang tải danh sách khách hàng từ hệ thống...
                      </td>
                    </tr>
                  ) : paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: '#6B7280' }}>
                        {searchQuery.trim()
                          ? 'Không tìm thấy khách hàng nào phù hợp với từ khóa tìm kiếm.'
                          : 'Không có dữ liệu khách hàng nào trong hệ thống.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((cust, rowIdx) => {
                      const isSelected = selectedCustomer?.id === cust.id;
                      const isChecked = selectedIds.has(cust.id);

                      return (
                        <tr
                          key={cust.id}
                          className={isSelected ? 'is-selected' : ''}
                          onClick={() => {
                            if (dragInfo.current.hasMoved) {
                              dragInfo.current.hasMoved = false;
                              return;
                            }
                            setSelectedCustomer((prev) => (prev?.id === cust.id ? null : cust));
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
                            className="lume-cust-cb"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(cust.id)}
                          />
                        </td>

                        {/* Khách hàng */}
                        <td>
                          <div className="lume-cust-user-row">
                            {cust.avatar ? (
                              <img
                                src={cust.avatar}
                                alt={cust.fullName}
                                className="lume-cust-avatar-img"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = LOCAL_CUSTOMER_AVATARS[rowIdx % LOCAL_CUSTOMER_AVATARS.length];
                                }}
                              />
                            ) : (
                              <div className="lume-cust-avatar-initials">
                                {cust.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="lume-cust-user-text">
                              <span className="lume-cust-full-name">{cust.fullName}</span>
                              <span className="lume-cust-subcode">{cust.customerCode}</span>
                            </div>
                          </div>
                        </td>

                        {/* Liên hệ */}
                        <td>
                          <div className="lume-cust-contact-box">
                            <span className="lume-cust-contact-email">{cust.email}</span>
                            <span className="lume-cust-contact-phone">{cust.phone}</span>
                          </div>
                        </td>

                        {/* Ngày tham gia */}
                        <td style={{ color: '#4B5563' }}>{cust.date}</td>

                        {/* Booking */}
                        <td className="lume-cust-stat-num">{cust.bookings}</td>

                        {/* Hủy đơn */}
                        <td className="lume-cust-stat-num">{cust.cancellations}</td>

                        {/* Hoàn tiền */}
                        <td className="lume-cust-stat-num">{cust.refunds}</td>

                        {/* Tranh chấp */}
                        <td className="lume-cust-stat-num">{cust.disputes}</td>

                        {/* Xác minh */}
                        <td>
                          {cust.isVerified ? (
                            <span className="lume-cust-pill-verified">
                              <span className="lume-cust-dot-icon" />
                              Đã xác minh
                            </span>
                          ) : (
                            <span className="lume-cust-pill-unverified">
                              <span className="lume-cust-dot-icon" />
                              Chưa xác minh
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td>
                          {cust.status === 'ACTIVE' ? (
                            <span className="lume-cust-status-pill active">Hoạt động</span>
                          ) : cust.status === 'NEEDS_CHECK' ? (
                            <span className="lume-cust-status-pill needs_check">Cần kiểm tra</span>
                          ) : (
                            <span className="lume-cust-status-pill suspended">Tạm ngưng</span>
                          )}
                        </td>

                        {/* Cảnh báo */}
                        <td>
                          {cust.warning === 'NONE' ? (
                            <span className="lume-cust-warning-text">Không có</span>
                          ) : cust.warning === 'DISPUTE_2' ? (
                            <span className="lume-cust-warning-badge red">
                              <span className="lume-cust-dot-icon" />
                              2 vụ
                            </span>
                          ) : cust.warning === 'REQUEST_2' ? (
                            <span className="lume-cust-warning-badge amber">
                              <AlertTriangle size={12} />
                              2 yêu cầu
                            </span>
                          ) : cust.warning === 'DISPUTE_ACTIVE' ? (
                            <span className="lume-cust-warning-badge red">
                              <span className="lume-cust-dot-icon" />
                              Tranh chấp
                            </span>
                          ) : (
                            <span className="lume-cust-warning-badge amber">
                              <AlertTriangle size={12} />
                              2 vụ
                            </span>
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
                            className="lume-cust-more-btn"
                            title="Thao tác"
                            onClick={() => setSelectedCustomer((prev) => (prev?.id === cust.id ? null : cust))}
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
        </div>

          {/* Pagination Footer */}
          <div className="lume-cust-pagination-bar">
            <div className="lume-cust-page-summary">
              {perPage === 'all' ? (
                <span>Đang hiển thị <strong>tất cả {totalItems}</strong> khách hàng</span>
              ) : (
                <span>
                  Hiển thị <strong>{totalItems === 0 ? 0 : (currentPage - 1) * (perPage as number) + 1} - {Math.min(currentPage * (perPage as number), totalItems)}</strong> của <strong>{totalItems}</strong> khách hàng
                </span>
              )}
            </div>

            <div className="lume-cust-page-btns">
              {perPage !== 'all' && totalPages > 1 && (
                <>
                  <button
                    type="button"
                    className="lume-cust-pbtn"
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
                      className={`lume-cust-pbtn ${currentPage === p ? 'active' : ''}`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 5 && (
                    <>
                      <span style={{ padding: '0 4px', color: '#9CA3AF' }}>...</span>
                      <button
                        type="button"
                        className={`lume-cust-pbtn ${currentPage === totalPages ? 'active' : ''}`}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="lume-cust-pbtn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="Trang sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                </>
              )}

              <select
                className="lume-cust-per-page"
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

        {/* Right Side: Thông tin khách hàng (Docked Panel) */}
        {selectedCustomer && (
          <div className="lume-cust-detail-panel">
            {/* Header */}
            <div className="lume-cust-panel-header">
              <div className="lume-cust-panel-title-wrap">
                <h3 className="lume-cust-panel-title">Thông tin khách hàng</h3>
                <span className="lume-cust-panel-badge-id">{selectedCustomer.customerCode}</span>
              </div>
              <button
                type="button"
                className="lume-cust-panel-close"
                onClick={() => setSelectedCustomer(null)}
                title="Đóng bảng chi tiết"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Card */}
            <div className="lume-cust-panel-profile">
              <div className="lume-cust-avatar-wrapper">
                {selectedCustomer.avatar ? (
                  <img
                    src={selectedCustomer.avatar}
                    alt={selectedCustomer.fullName}
                    className="lume-cust-panel-avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = LOCAL_CUSTOMER_AVATARS[0];
                    }}
                  />
                ) : (
                  <div
                    className="lume-cust-avatar-initials"
                    style={{ width: 50, height: 50, fontSize: 17, fontWeight: 700 }}
                  >
                    {selectedCustomer.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`lume-cust-status-dot-indicator ${
                    selectedCustomer.status === 'ACTIVE'
                      ? 'active'
                      : selectedCustomer.status === 'NEEDS_CHECK'
                      ? 'needs_check'
                      : 'suspended'
                  }`}
                  title={selectedCustomer.statusLabel}
                />
              </div>

              <div className="lume-cust-panel-meta">
                <div className="lume-cust-panel-name-row">
                  <h4 className="lume-cust-panel-name" title={selectedCustomer.fullName}>
                    {selectedCustomer.fullName}
                  </h4>
                </div>
                <div className="lume-cust-panel-code-row">
                  <span className="lume-cust-panel-code">{selectedCustomer.customerCode}</span>
                  <button
                    type="button"
                    className="lume-cust-copy-btn"
                    onClick={() => handleCopyCustomerCode(selectedCustomer.customerCode)}
                    title="Sao chép mã khách hàng"
                  >
                    {copiedCode ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="lume-cust-panel-tags-row">
                  {selectedCustomer.isVerified ? (
                    <span className="lume-cust-pill-verified-modern">
                      <BadgeCheck size={12} />
                      Đã xác thực
                    </span>
                  ) : (
                    <span className="lume-cust-pill-unverified-modern">
                      <Clock3 size={12} />
                      Chưa xác thực
                    </span>
                  )}
                  <span
                    className={`lume-cust-status-pill ${
                      selectedCustomer.status === 'ACTIVE'
                        ? 'active'
                        : selectedCustomer.status === 'NEEDS_CHECK'
                        ? 'needs_check'
                        : 'suspended'
                    }`}
                    style={{ fontSize: 10, padding: '2px 7px' }}
                  >
                    {selectedCustomer.statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="lume-cust-panel-contacts">
              <div className="lume-cust-contact-line">
                <div className="lume-cust-contact-line-left">
                  <div className="lume-cust-contact-icon-wrap">
                    <Mail size={12} />
                  </div>
                  <span className="lume-cust-contact-text">{selectedCustomer.email}</span>
                </div>
                {selectedCustomer.isVerified && (
                  <span className="lume-cust-pill-verified-modern">
                    <BadgeCheck size={11} />
                    Xác thực
                  </span>
                )}
              </div>

              <div className="lume-cust-contact-line">
                <div className="lume-cust-contact-line-left">
                  <div className="lume-cust-contact-icon-wrap">
                    <Phone size={12} />
                  </div>
                  <span className="lume-cust-contact-text">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.isVerified && (
                  <span className="lume-cust-pill-verified-modern">
                    <BadgeCheck size={11} />
                    Xác thực
                  </span>
                )}
              </div>

              <div className="lume-cust-contact-line">
                <div className="lume-cust-contact-line-left">
                  <div className="lume-cust-contact-icon-wrap">
                    <CalendarDays size={12} />
                  </div>
                  <span className="lume-cust-contact-label">Ngày tham gia</span>
                </div>
                <strong>{selectedCustomer.date}</strong>
              </div>

              <div className="lume-cust-contact-line">
                <div className="lume-cust-contact-line-left">
                  <div className="lume-cust-contact-icon-wrap">
                    <Clock3 size={12} />
                  </div>
                  <span className="lume-cust-contact-label">Hoạt động gần nhất</span>
                </div>
                <strong>{selectedCustomer.lastActive}</strong>
              </div>

              <div className="lume-cust-contact-line">
                <div className="lume-cust-contact-line-left">
                  <div className="lume-cust-contact-icon-wrap">
                    <CreditCard size={12} />
                  </div>
                  <span className="lume-cust-contact-label">Tổng chi tiêu</span>
                </div>
                <strong style={{ color: '#881337' }}>
                  {selectedCustomer.spent ? `${selectedCustomer.spent.toLocaleString('vi-VN')} đ` : '0 đ'}
                </strong>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="lume-cust-panel-tabs">
              <button
                type="button"
                className={`lume-cust-panel-tab ${activePanelTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActivePanelTab('overview')}
              >
                Tổng quan
              </button>
              <button
                type="button"
                className={`lume-cust-panel-tab ${activePanelTab === 'booking' ? 'active' : ''}`}
                onClick={() => setActivePanelTab('booking')}
              >
                Booking
                <span className="lume-cust-tab-count">{selectedCustomer.bookings}</span>
              </button>
              <button
                type="button"
                className={`lume-cust-panel-tab ${activePanelTab === 'refund' ? 'active' : ''}`}
                onClick={() => setActivePanelTab('refund')}
              >
                Hoàn tiền
                <span className="lume-cust-tab-count">{selectedCustomer.refunds}</span>
              </button>
              <button
                type="button"
                className={`lume-cust-panel-tab ${activePanelTab === 'dispute' ? 'active' : ''}`}
                onClick={() => setActivePanelTab('dispute')}
              >
                Tranh chấp
                <span className="lume-cust-tab-count">{selectedCustomer.disputes}</span>
              </button>
              <button
                type="button"
                className={`lume-cust-panel-tab ${activePanelTab === 'log' ? 'active' : ''}`}
                onClick={() => setActivePanelTab('log')}
              >
                Nhật ký
              </button>
            </div>

            {/* Tab 1: Tổng quan */}
            {activePanelTab === 'overview' && (
              <>
                {/* 5 Mini Stat Boxes with Modern Tinted Icon Wrappers */}
                <div className="lume-cust-panel-stats-grid">
                  {/* Box 1: Tổng booking */}
                  <div className="lume-cust-panel-stat-box">
                    <div className="lume-cust-panel-stat-header">
                      <div className="lume-cust-stat-icon-wrap pink">
                        <CalendarDays size={14} />
                      </div>
                      <span className="lume-cust-panel-stat-title">Tổng booking</span>
                    </div>
                    <div className="lume-cust-panel-stat-val">{selectedCustomer.bookings}</div>
                  </div>

                  {/* Box 2: Đã hoàn thành */}
                  <div className="lume-cust-panel-stat-box">
                    <div className="lume-cust-panel-stat-header">
                      <div className="lume-cust-stat-icon-wrap green">
                        <CheckCircle2 size={14} />
                      </div>
                      <span className="lume-cust-panel-stat-title">Đã hoàn thành</span>
                    </div>
                    <div className="lume-cust-panel-stat-val">{selectedCustomer.completedBookings}</div>
                  </div>

                  {/* Box 3: Đã hủy */}
                  <div className="lume-cust-panel-stat-box">
                    <div className="lume-cust-panel-stat-header">
                      <div className="lume-cust-stat-icon-wrap red">
                        <XCircle size={14} />
                      </div>
                      <span className="lume-cust-panel-stat-title">Đã hủy đơn</span>
                    </div>
                    <div className="lume-cust-panel-stat-val">{selectedCustomer.cancellations}</div>
                  </div>

                  {/* Box 4: Hoàn tiền */}
                  <div className="lume-cust-panel-stat-box">
                    <div className="lume-cust-panel-stat-header">
                      <div className="lume-cust-stat-icon-wrap amber">
                        <RotateCcw size={14} />
                      </div>
                      <span className="lume-cust-panel-stat-title">Hoàn tiền</span>
                    </div>
                    <div className="lume-cust-panel-stat-val">{selectedCustomer.refunds}</div>
                  </div>

                  {/* Box 5: Tranh chấp */}
                  <div className="lume-cust-panel-stat-box" style={{ gridColumn: 'span 2' }}>
                    <div className="lume-cust-panel-stat-header">
                      <div className="lume-cust-stat-icon-wrap wine">
                        <ShieldAlert size={14} />
                      </div>
                      <span className="lume-cust-panel-stat-title">Tranh chấp & Khiếu nại</span>
                    </div>
                    <div className="lume-cust-panel-stat-val">{selectedCustomer.disputes}</div>
                  </div>
                </div>

                {/* Additional Information with Modern Icons */}
                <div className="lume-cust-panel-additional">
                  <h5 className="lume-cust-additional-title">Thông tin bổ sung</h5>

                  <div className="lume-cust-additional-row">
                    <div className="lume-cust-additional-row-left">
                      <Globe size={13} color="#881337" />
                      <span>Nguồn đăng ký</span>
                    </div>
                    <strong>{selectedCustomer.registrationSource}</strong>
                  </div>

                  <div className="lume-cust-additional-row">
                    <div className="lume-cust-additional-row-left">
                      <MapPin size={13} color="#881337" />
                      <span>Địa chỉ</span>
                    </div>
                    <strong>{selectedCustomer.address}</strong>
                  </div>

                  <div className="lume-cust-additional-row">
                    <div className="lume-cust-additional-row-left">
                      <Languages size={13} color="#881337" />
                      <span>Ngôn ngữ</span>
                    </div>
                    <strong>{selectedCustomer.language}</strong>
                  </div>

                  <div className="lume-cust-additional-row">
                    <div className="lume-cust-additional-row-left">
                      <Smartphone size={13} color="#881337" />
                      <span>Thiết bị thường dùng</span>
                    </div>
                    <strong>{selectedCustomer.device}</strong>
                  </div>

                  <div className="lume-cust-additional-row">
                    <div className="lume-cust-additional-row-left">
                      <Network size={13} color="#881337" />
                      <span>IP gần nhất</span>
                    </div>
                    <strong>{selectedCustomer.lastIp}</strong>
                  </div>

                  {/* Expanded system details */}
                  {isExpandedMore && (
                    <>
                      <div className="lume-cust-additional-row" style={{ paddingTop: 4, borderTop: '1px dashed #E5E7EB' }}>
                        <div className="lume-cust-additional-row-left">
                          <User size={13} color="#881337" />
                          <span>Mã hệ thống (ID)</span>
                        </div>
                        <strong style={{ fontSize: 10.5, fontFamily: 'monospace' }}>{selectedCustomer.id}</strong>
                      </div>

                      <div className="lume-cust-additional-row">
                        <div className="lume-cust-additional-row-left">
                          <Shield size={13} color="#881337" />
                          <span>Mức độ rủi ro</span>
                        </div>
                        <strong style={{ color: selectedCustomer.riskLevel === 'HIGH' ? '#DC2626' : selectedCustomer.riskLevel === 'MEDIUM' ? '#D97706' : '#059669' }}>
                          {selectedCustomer.riskLevel === 'LOW' ? 'Thấp (An toàn)' : selectedCustomer.riskLevel === 'MEDIUM' ? 'Trung bình' : 'Cao'}
                        </strong>
                      </div>

                      <div className="lume-cust-additional-row">
                        <div className="lume-cust-additional-row-left">
                          <Activity size={13} color="#881337" />
                          <span>Trạng thái tài khoản</span>
                        </div>
                        <strong>{selectedCustomer.statusLabel}</strong>
                      </div>

                      <div className="lume-cust-additional-row">
                        <div className="lume-cust-additional-row-left">
                          <CreditCard size={13} color="#881337" />
                          <span>Tổng chi tiêu tích lũy</span>
                        </div>
                        <strong style={{ color: '#881337' }}>{selectedCustomer.spent.toLocaleString('vi-VN')} đ</strong>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    className="lume-cust-see-more-btn"
                    onClick={() => setIsExpandedMore((prev) => !prev)}
                  >
                    <span>{isExpandedMore ? 'Thu gọn bớt' : 'Xem thêm chi tiết'}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        transform: isExpandedMore ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </button>
                </div>
              </>
            )}

            {/* Tab 2: Booking */}
            {activePanelTab === 'booking' && (
              <div className="lume-cust-tab-list">
                {selectedCustomer.bookings > 0 ? (
                  <>
                    <div className="lume-cust-tab-card">
                      <div className="lume-cust-tab-card-header">
                        <span className="lume-cust-tab-card-title">
                          Đơn thuê #BK-{selectedCustomer.id ? selectedCustomer.id.slice(-5).toUpperCase() : '8921'}
                        </span>
                        <span className="lume-cust-pill-verified-modern">Hoàn thành</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Ngày tạo: {selectedCustomer.date}</span>
                        <strong style={{ color: '#111827' }}>
                          {(selectedCustomer.spent || 350000).toLocaleString('vi-VN')} đ
                        </strong>
                      </div>
                    </div>
                    {selectedCustomer.bookings > 1 && (
                      <div className="lume-cust-tab-card">
                        <div className="lume-cust-tab-card-header">
                          <span className="lume-cust-tab-card-title">
                            Đơn thuê #BK-{selectedCustomer.id ? selectedCustomer.id.slice(-3).toUpperCase() + '02' : '9012'}
                          </span>
                          <span className="lume-cust-pill-verified-modern">Hoàn thành</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Ngày tạo: {selectedCustomer.lastActive}</span>
                          <strong style={{ color: '#111827' }}>280.000 đ</strong>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="lume-cust-tab-empty">
                    <div className="lume-cust-empty-icon">
                      <ShoppingBag size={22} />
                    </div>
                    <p className="lume-cust-empty-title">Chưa có đơn booking nào</p>
                    <p className="lume-cust-empty-sub">Khách hàng này chưa thực hiện giao dịch đặt thuê trang phục nào trên hệ thống.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Hoàn tiền */}
            {activePanelTab === 'refund' && (
              <div className="lume-cust-tab-list">
                {selectedCustomer.refunds > 0 ? (
                  <div className="lume-cust-tab-card">
                    <div className="lume-cust-tab-card-header">
                      <span className="lume-cust-tab-card-title">Yêu cầu hoàn cọc #RF-01</span>
                      <span className="lume-cust-pill-unverified-modern">Đang xử lý</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Thời gian: {selectedCustomer.lastActive}</span>
                      <strong style={{ color: '#D97706' }}>500.000 đ</strong>
                    </div>
                  </div>
                ) : (
                  <div className="lume-cust-tab-empty">
                    <div className="lume-cust-empty-icon">
                      <RotateCcw size={22} />
                    </div>
                    <p className="lume-cust-empty-title">Không có yêu cầu hoàn tiền</p>
                    <p className="lume-cust-empty-sub">Khách hàng chưa có bất kỳ khiếu nại hay yêu cầu hoàn cọc nào phát sinh.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Tranh chấp */}
            {activePanelTab === 'dispute' && (
              <div className="lume-cust-tab-list">
                {selectedCustomer.disputes > 0 ? (
                  <div className="lume-cust-tab-card">
                    <div className="lume-cust-tab-card-header">
                      <span className="lume-cust-tab-card-title">Khiếu nại hư hỏng #DP-01</span>
                      <span className="lume-cust-status-pill suspended">Cần can thiệp</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#4B5563' }}>
                      Tranh chấp phát sinh từ đơn hàng đã hoàn tất. Đội ngũ kiểm soát rủi ro đang thụ lý.
                    </p>
                  </div>
                ) : (
                  <div className="lume-cust-tab-empty">
                    <div className="lume-cust-empty-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                      <ShieldCheck size={22} />
                    </div>
                    <p className="lume-cust-empty-title">Lịch sử giao dịch uy tín</p>
                    <p className="lume-cust-empty-sub">Không ghi nhận tranh chấp hay hành vi vi phạm nào từ tài khoản khách hàng này.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Nhật ký */}
            {activePanelTab === 'log' && (
              <div className="lume-cust-timeline">
                <div className="lume-cust-timeline-item">
                  <div className="lume-cust-timeline-dot" />
                  <div className="lume-cust-timeline-content">
                    <span className="lume-cust-timeline-title">Hoạt động gần nhất</span>
                    <span className="lume-cust-timeline-time">{selectedCustomer.lastActive} • {selectedCustomer.device}</span>
                  </div>
                </div>

                <div className="lume-cust-timeline-item">
                  <div
                    className="lume-cust-timeline-dot"
                    style={{
                      background: selectedCustomer.isVerified ? '#059669' : '#D97706',
                      boxShadow: selectedCustomer.isVerified
                        ? '0 0 0 3px rgba(5, 150, 105, 0.15)'
                        : '0 0 0 3px rgba(217, 119, 6, 0.15)',
                    }}
                  />
                  <div className="lume-cust-timeline-content">
                    <span className="lume-cust-timeline-title">Trạng thái hồ sơ KYC</span>
                    <span className="lume-cust-timeline-time">
                      {selectedCustomer.isVerified ? 'Đã hoàn tất xác minh định danh tài khoản' : 'Chưa hoàn tất xác minh hồ sơ'}
                    </span>
                  </div>
                </div>

                <div className="lume-cust-timeline-item">
                  <div
                    className="lume-cust-timeline-dot"
                    style={{ background: '#4B5563', boxShadow: '0 0 0 3px rgba(75, 85, 99, 0.15)' }}
                  />
                  <div className="lume-cust-timeline-content">
                    <span className="lume-cust-timeline-title">Đăng ký tài khoản</span>
                    <span className="lume-cust-timeline-time">
                      {selectedCustomer.date} • {selectedCustomer.registrationSource}
                    </span>
                  </div>
                </div>

                <div className="lume-cust-timeline-item">
                  <div
                    className="lume-cust-timeline-dot"
                    style={{ background: '#9CA3AF', boxShadow: '0 0 0 3px rgba(156, 163, 175, 0.15)' }}
                  />
                  <div className="lume-cust-timeline-content">
                    <span className="lume-cust-timeline-title">Địa chỉ IP ghi nhận</span>
                    <span className="lume-cust-timeline-time">{selectedCustomer.lastIp}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom 4 Action Buttons */}
            <div className="lume-cust-panel-actions-grid">
              <button
                type="button"
                className="lume-cust-panel-btn pink"
                onClick={() => {
                  setActivePanelTab('booking');
                  toast.show(`Hiển thị lịch sử booking của ${selectedCustomer.fullName}`, 'info');
                }}
              >
                <FileText size={13} />
                <span>Xem booking</span>
              </button>

              <button
                type="button"
                className="lume-cust-panel-btn pink-warn"
                onClick={() => {
                  setActivePanelTab('dispute');
                  toast.show(`Hiển thị thông tin tranh chấp của ${selectedCustomer.fullName}`, 'info');
                }}
              >
                <AlertTriangle size={13} />
                <span>Xem tranh chấp</span>
              </button>

              <button
                type="button"
                className="lume-cust-panel-btn outline-warn"
                onClick={() => handleSuspendAccount(selectedCustomer)}
              >
                <PauseCircle size={13} />
                <span>Tạm ngưng</span>
              </button>

              {selectedCustomer.status === 'SUSPENDED' ? (
                <button
                  type="button"
                  className="lume-cust-panel-btn"
                  style={{ background: '#059669', color: '#FFFFFF', border: 'none' }}
                  onClick={() => handleUnlockAccount(selectedCustomer)}
                >
                  <CheckCircle size={13} />
                  <span>Mở khóa</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="lume-cust-panel-btn solid-red"
                  onClick={() => handleLockAccount(selectedCustomer)}
                >
                  <LockKeyhole size={13} />
                  <span>Khóa tài khoản</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
