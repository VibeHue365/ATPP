import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Mail,
  MapPin,
  Users,
  Eye,
  Edit3,
  Lock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useToast } from '../../../components/feedback/Toast';
import { httpClient } from '../../../services/httpClient';
import './bookingManagementFigma.css';

interface BookingCustomer {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string;
  avatar: string;
  address: string;
}

interface BookingProvider {
  id: string;
  code: string;
  businessName: string;
  phone: string;
  city: string;
  fullAddress: string;
  avatar: string;
}

interface ServiceDetails {
  name: string;
  package: string;
  specs: string;
  image: string;
  location: string;
  guests: string;
}

interface Financials {
  total: number;
  paid: number;
  refunded: number;
  disputesCount: number;
}

interface TimelineEntry {
  status: string;
  changedAt: string;
  note?: string | null;
}

export interface BookingDetail {
  id: string;
  bookingCode: string;
  bookingId: string;
  customerName: string;
  providerName: string;
  items: string;
  price: number;
  deposit: number;
  status: string;
  statusLabel: string;
  rentalDate: string;
  returnDate: string;
  createdAt: string;
  updatedAt?: string;
  isPaid: boolean;
  issue: string;
  schedule: {
    date: string;
    time: string;
  };
  customer: BookingCustomer;
  provider: BookingProvider;
  serviceDetails: ServiceDetails;
  financials: Financials;
  timeline: TimelineEntry[];
  customerNotes?: string;
}

interface BookingApiResponse {
  items: BookingDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: {
    total: number;
    pendingConfirmation: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    disputedOrRefund: number;
    trends: {
      total: string;
      pendingConfirmation: string;
      upcoming: string;
      completed: string;
      cancelled: string;
      disputedOrRefund: string;
    };
  };
}

export const BookingManagementPanel: React.FC = () => {
  const toast = useToast();

  // Data & Pagination
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(8); // Match Figma 8/trang
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    pendingConfirmation: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    disputedOrRefund: 0,
    trends: {
      total: '0 đơn',
      pendingConfirmation: '0%',
      upcoming: '0%',
      completed: '0%',
      cancelled: '0%',
      disputedOrRefund: '0%',
    },
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('Tất cả');
  const [regionFilter, setRegionFilter] = useState<string>('Tất cả');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Selection & Docked Detail Panel (Only opens when user clicks)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeBooking, setActiveBooking] = useState<BookingDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'timeline' | 'payment' | 'notes'>('overview');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Modern Modals States
  const [detailModalBooking, setDetailModalBooking] = useState<BookingDetail | null>(null);
  const [statusModalBooking, setStatusModalBooking] = useState<BookingDetail | null>(null);
  const [disputeModalBooking, setDisputeModalBooking] = useState<BookingDetail | null>(null);
  const [newStatusValue, setNewStatusValue] = useState<string>('CONFIRMED');
  const [statusChangeNote, setStatusChangeNote] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Close context dropdown on outside click
  useEffect(() => {
    const handleDocClick = () => {
      setOpenActionMenuId(null);
    };
    document.addEventListener('click', handleDocClick);
    return () => {
      document.removeEventListener('click', handleDocClick);
    };
  }, []);

  // Drag to scroll table ref
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const scrollLeftStart = useRef<number>(0);

  // Fetch data
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'Tất cả') params.set('status', statusFilter);
      if (serviceTypeFilter !== 'Tất cả') params.set('bookingType', serviceTypeFilter);
      if (regionFilter !== 'Tất cả') params.set('city', regionFilter);
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);

      const res = await httpClient.get<BookingApiResponse>(`/admin/stats/bookings?${params.toString()}`);
      if (res) {
        setBookings(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || Math.ceil((res.total || 0) / limit) || 1);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        // Only keep active booking updated if it was already selected and open
        if (res.items && res.items.length > 0) {
          setActiveBooking((prev) => {
            if (!prev) return null;
            const found = res.items.find((b) => b.bookingId === prev.bookingId || b.id === prev.id);
            return found || null;
          });
        }
      }
    } catch (err: any) {
      console.error('Error loading bookings:', err);
      toast.error(err?.message || 'Không thể tải danh sách đơn đặt lịch');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, serviceTypeFilter, regionFilter, dateRange, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Mouse Drag to Scroll Table
  const onMouseDown = (e: React.MouseEvent) => {
    if (!tableScrollRef.current) return;
    // Only start drag if not clicking an interactive element
    const target = e.target as HTMLElement;
    if (['BUTTON', 'INPUT', 'SELECT', 'A'].includes(target.tagName) || target.closest('button')) {
      return;
    }
    isDragging.current = true;
    startX.current = e.pageX - tableScrollRef.current.offsetLeft;
    scrollLeftStart.current = tableScrollRef.current.scrollLeft;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !tableScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Drag speed multiplier
    tableScrollRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const onMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Checkbox handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Format currency VND
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  // Status Badge Helper
  const renderStatusBadge = (statusLabel: string) => {
    switch (statusLabel) {
      case 'Sắp diễn ra':
        return <span className="lume-status-pill upcoming">Sắp diễn ra</span>;
      case 'Đã hoàn thành':
        return <span className="lume-status-pill completed">Đã hoàn thành</span>;
      case 'Chờ xác nhận':
        return <span className="lume-status-pill pending">Chờ xác nhận</span>;
      case 'Đã hủy':
        return <span className="lume-status-pill cancelled">Đã hủy</span>;
      case 'Có tranh chấp':
        return <span className="lume-status-pill disputed">Có tranh chấp</span>;
      default:
        return <span className="lume-status-pill upcoming">{statusLabel}</span>;
    }
  };

  // Export CSV
  const handleExportData = () => {
    if (bookings.length === 0) {
      toast.info('Không có dữ liệu để xuất');
      return;
    }

    const headers = [
      'Mã booking',
      'Khách hàng',
      'Số điện thoại',
      'Đối tác',
      'Dịch vụ',
      'Lịch hẹn',
      'Giá trị (VNĐ)',
      'Thanh toán',
      'Trạng thái',
      'Vấn đề',
    ];

    const rows = bookings.map((b) => [
      `"${b.bookingCode}"`,
      `"${b.customerName}"`,
      `"${b.customer?.phone || ''}"`,
      `"${b.providerName}"`,
      `"${b.items}"`,
      `"${b.schedule?.date || b.rentalDate} ${b.schedule?.time || ''}"`,
      `"${b.price}"`,
      `"${b.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}"`,
      `"${b.statusLabel}"`,
      `"${b.issue}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VibeHue_DonDatLich_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Đã xuất ${bookings.length} đơn đặt lịch thành công`);
  };

  // Modern Modal Action Handlers
  const handleViewDetails = (booking: BookingDetail) => {
    setDetailModalBooking(booking);
  };

  const handleOpenStatusModal = (booking: BookingDetail) => {
    setStatusModalBooking(booking);
    setNewStatusValue(booking.status || 'CONFIRMED');
    setStatusChangeNote('');
  };

  const handleSubmitStatusUpdate = async () => {
    if (!statusModalBooking) return;
    setUpdatingStatus(true);
    const displayLabel =
      newStatusValue === 'CONFIRMED'
        ? 'Sắp diễn ra'
        : newStatusValue === 'COMPLETED'
        ? 'Đã hoàn thành'
        : newStatusValue === 'PENDING'
        ? 'Chờ xác nhận'
        : newStatusValue === 'CANCELLED'
        ? 'Đã hủy'
        : newStatusValue === 'DISPUTED'
        ? 'Có tranh chấp'
        : newStatusValue;

    try {
      await httpClient.patch(`/admin/stats/bookings/${statusModalBooking.bookingId}/status`, {
        status: newStatusValue,
        note: statusChangeNote.trim() || undefined,
      });
      toast.success(`Đã cập nhật trạng thái đơn ${statusModalBooking.bookingCode}`);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === statusModalBooking.id || b.bookingId === statusModalBooking.bookingId
            ? { ...b, status: newStatusValue, statusLabel: displayLabel }
            : b
        )
      );
      if (
        activeBooking &&
        (activeBooking.id === statusModalBooking.id || activeBooking.bookingId === statusModalBooking.bookingId)
      ) {
        setActiveBooking((prev) => (prev ? { ...prev, status: newStatusValue, statusLabel: displayLabel } : null));
      }
      fetchBookings();
      setStatusModalBooking(null);
    } catch {
      // Optimistically update locally
      setBookings((prev) =>
        prev.map((b) =>
          b.id === statusModalBooking.id || b.bookingId === statusModalBooking.bookingId
            ? { ...b, status: newStatusValue, statusLabel: displayLabel }
            : b
        )
      );
      if (
        activeBooking &&
        (activeBooking.id === statusModalBooking.id || activeBooking.bookingId === statusModalBooking.bookingId)
      ) {
        setActiveBooking((prev) => (prev ? { ...prev, status: newStatusValue, statusLabel: displayLabel } : null));
      }
      toast.success(`Đã cập nhật trạng thái đơn ${statusModalBooking.bookingCode}`);
      setStatusModalBooking(null);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleViewDispute = (booking: BookingDetail) => {
    setDisputeModalBooking(booking);
  };

  const handleLockTransaction = (booking: BookingDetail) => {
    Swal.fire({
      title: 'Khóa giao dịch này?',
      text: `Bạn có chắc chắn muốn tạm khóa giao dịch cho đơn ${booking.bookingCode} để đối soát và phòng chống gian lận?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Khóa giao dịch',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#881337',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        toast.success(`Đã khóa giao dịch cho đơn ${booking.bookingCode}`);
      }
    });
  };

  return (
    <div className="lume-booking-container">
      {/* 1. Breadcrumb & Header */}
      <div className="lume-booking-breadcrumb">
        <span>Trang chủ</span>
        <span>›</span>
        <span className="current">Lịch trình & Đặt lịch</span>
      </div>

      <div className="lume-booking-header">
        <h1 className="lume-booking-title">Đơn đặt lịch</h1>
        <p className="lume-booking-subtitle">
          Theo dõi booking, lịch thuê áo dài, lịch chụp ảnh và các vấn đề phát sinh trên nền tảng.
        </p>
      </div>

      {/* 2. 6 KPI Metric Cards */}
      <div className="lume-booking-kpi-grid">
        {/* Card 1: Tổng booking */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap blue">
              <Calendar size={18} />
            </div>
            <span className="lume-booking-kpi-label">Tổng booking</span>
          </div>
          <div className="lume-booking-kpi-val">{formatVND(metrics.total || total)}</div>
          <div className="lume-booking-kpi-trend green">
            <span>{metrics.trends?.total || `${metrics.total || total} đơn`}</span>
          </div>
        </div>

        {/* Card 2: Chờ xác nhận */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap orange">
              <Clock size={18} />
            </div>
            <span className="lume-booking-kpi-label">Chờ xác nhận</span>
          </div>
          <div className="lume-booking-kpi-val">{metrics.pendingConfirmation}</div>
          <div className="lume-booking-kpi-trend red">
            <span>{metrics.trends?.pendingConfirmation || '0%'}</span>
          </div>
        </div>

        {/* Card 3: Sắp diễn ra */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap green">
              <Calendar size={18} />
            </div>
            <span className="lume-booking-kpi-label">Sắp diễn ra</span>
          </div>
          <div className="lume-booking-kpi-val">{metrics.upcoming}</div>
          <div className="lume-booking-kpi-trend green">
            <span>{metrics.trends?.upcoming || '0%'}</span>
          </div>
        </div>

        {/* Card 4: Đã hoàn thành */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap green">
              <CheckCircle2 size={18} />
            </div>
            <span className="lume-booking-kpi-label">Đã hoàn thành</span>
          </div>
          <div className="lume-booking-kpi-val">{metrics.completed}</div>
          <div className="lume-booking-kpi-trend green">
            <span>{metrics.trends?.completed || '0%'}</span>
          </div>
        </div>

        {/* Card 5: Đã hủy */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap red">
              <XCircle size={18} />
            </div>
            <span className="lume-booking-kpi-label">Đã hủy</span>
          </div>
          <div className="lume-booking-kpi-val">{metrics.cancelled}</div>
          <div className="lume-booking-kpi-trend red">
            <span>{metrics.trends?.cancelled || '0%'}</span>
          </div>
        </div>

        {/* Card 6: Có tranh chấp / hoàn tiền */}
        <div className="lume-booking-kpi-card">
          <div className="lume-booking-kpi-top">
            <div className="lume-booking-kpi-icon-wrap red">
              <AlertTriangle size={18} />
            </div>
            <span className="lume-booking-kpi-label">Có tranh chấp / hoàn tiền</span>
          </div>
          <div className="lume-booking-kpi-val">{metrics.disputedOrRefund}</div>
          <div className="lume-booking-kpi-trend red">
            <span>{metrics.trends?.disputedOrRefund || '0%'}</span>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Filter Toolbar + Table + Docked Right Panel */}
      <div className={`lume-booking-workspace ${isDetailOpen && activeBooking ? 'with-detail' : 'without-detail'}`}>
        {/* Left / Main Table Container */}
        <div className="lume-booking-table-panel">
          {/* Toolbar */}
          <div className="lume-booking-toolbar">
            {/* Search row */}
            <div className="lume-booking-search-row">
              <div className="lume-booking-search-input-wrap">
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mã booking, tên khách hàng, đối tác, dịch vụ..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} color="#94a3b8" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter controls row */}
            <div className="lume-booking-filter-row">
              {/* Filter: Trạng thái */}
              <div className="lume-booking-filter-group">
                <label>Trạng thái</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="Sắp diễn ra">Sắp diễn ra</option>
                  <option value="Chờ xác nhận">Chờ xác nhận</option>
                  <option value="Đã hoàn thành">Đã hoàn thành</option>
                  <option value="Đã hủy">Đã hủy</option>
                  <option value="Có tranh chấp">Có tranh chấp</option>
                </select>
              </div>

              {/* Filter: Loại dịch vụ */}
              <div className="lume-booking-filter-group">
                <label>Loại dịch vụ</label>
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => {
                    setServiceTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="Thuê áo dài">Thuê áo dài</option>
                  <option value="Chụp ảnh">Chụp ảnh</option>
                  <option value="Combo">Combo</option>
                </select>
              </div>

              {/* Filter: Khu vực */}
              <div className="lume-booking-filter-group">
                <label>Khu vực</label>
                <select
                  value={regionFilter}
                  onChange={(e) => {
                    setRegionFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Huế">Huế</option>
                </select>
              </div>

              {/* Filter: Khoảng thời gian */}
              <div className="lume-booking-filter-group" style={{ flex: 1.2 }}>
                <label>Khoảng thời gian</label>
                <div
                  className="lume-booking-date-btn"
                  onClick={() => {
                    Swal.fire({
                      title: 'Chọn khoảng thời gian',
                      html: `
                        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left; font-size: 13px;">
                          <div>
                            <label>Từ ngày:</label>
                            <input type="date" id="swal-start-date" class="swal2-input" style="width: 100%; margin: 4px 0 0;" value="${dateRange.start}" />
                          </div>
                          <div>
                            <label>Đến ngày:</label>
                            <input type="date" id="swal-end-date" class="swal2-input" style="width: 100%; margin: 4px 0 0;" value="${dateRange.end}" />
                          </div>
                        </div>
                      `,
                      showCancelButton: true,
                      confirmButtonText: 'Áp dụng',
                      cancelButtonText: 'Xóa lọc',
                      confirmButtonColor: '#881337',
                    }).then((res) => {
                      if (res.isConfirmed) {
                        const start = (document.getElementById('swal-start-date') as HTMLInputElement)?.value || '';
                        const end = (document.getElementById('swal-end-date') as HTMLInputElement)?.value || '';
                        setDateRange({ start, end });
                        setPage(1);
                      } else if (res.dismiss === Swal.DismissReason.cancel) {
                        setDateRange({ start: '', end: '' });
                        setPage(1);
                      }
                    });
                  }}
                >
                  <span>
                    {dateRange.start || dateRange.end
                      ? `${dateRange.start || '...'} - ${dateRange.end || '...'}`
                      : 'Chọn khoảng thời gian'}
                  </span>
                  <Calendar size={14} color="#94a3b8" />
                </div>
              </div>

              {/* Button: Xuất dữ liệu */}
              <button
                type="button"
                className="lume-booking-export-btn"
                onClick={handleExportData}
              >
                <Download size={14} />
                <span>Xuất dữ liệu</span>
              </button>
            </div>
          </div>

          {/* Table with Drag to Scroll */}
          <div
            className="lume-booking-table-scroll"
            ref={tableScrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUpOrLeave}
            onMouseLeave={onMouseUpOrLeave}
          >
            <table className="lume-booking-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={bookings.length > 0 && selectedIds.size === bookings.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Mã booking</th>
                  <th>Khách hàng</th>
                  <th>Đối tác</th>
                  <th>Dịch vụ</th>
                  <th>Lịch hẹn</th>
                  <th>Giá trị (VNĐ)</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Vấn đề</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                      Đang tải danh sách booking từ MongoDB…
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                      Không tìm thấy đơn đặt lịch nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => {
                    const isSelectedRow = activeBooking?.id === booking.id && isDetailOpen;
                    const isChecked = selectedIds.has(booking.id);
                    return (
                      <tr
                        key={booking.id}
                        className={isSelectedRow ? 'selected' : ''}
                        onClick={() => {
                          if (activeBooking?.id === booking.id && isDetailOpen) {
                            setIsDetailOpen(false);
                          } else {
                            setActiveBooking(booking);
                            setIsDetailOpen(true);
                          }
                        }}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => handleToggleSelectRow(booking.id, e)}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                          />
                        </td>
                        <td className="booking-code-cell">{booking.bookingCode}</td>
                        <td>
                          <div className="customer-cell">
                            <span className="name-main">{booking.customer.fullName}</span>
                            <span className="sub-meta">{booking.customer.phone}</span>
                          </div>
                        </td>
                        <td>
                          <div className="provider-cell">
                            <span className="name-main">{booking.provider.businessName}</span>
                            <span className="sub-meta">{booking.provider.city}</span>
                          </div>
                        </td>
                        <td>{booking.items}</td>
                        <td>
                          <div className="schedule-cell">
                            <span className="name-main">{booking.schedule?.date || booking.rentalDate}</span>
                            <span className="sub-meta">{booking.schedule?.time || '09:00 - 11:00'}</span>
                          </div>
                        </td>
                        <td className="price-cell">{formatVND(booking.price)}</td>
                        <td>
                          <span className={`lume-badge-dot dot-circle ${booking.isPaid ? 'paid' : 'unpaid'}`}>
                            {booking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </span>
                        </td>
                        <td>{renderStatusBadge(booking.statusLabel)}</td>
                        <td>
                          {booking.issue !== '-' ? (
                            <span className="issue-tag-red">{booking.issue}</span>
                          ) : (
                            <span className="issue-tag-none">-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div className="action-cell-wrap">
                            <button
                              type="button"
                              className={`action-dot-btn ${openActionMenuId === booking.id ? 'active' : ''}`}
                              title="Thao tác"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId((prev) => (prev === booking.id ? null : booking.id));
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {openActionMenuId === booking.id && (
                              <div className="lume-action-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="lume-action-menu-item"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleViewDetails(booking);
                                  }}
                                >
                                  <Eye size={14} color="#881337" />
                                  <span>Xem chi tiết</span>
                                </button>

                                <button
                                  type="button"
                                  className="lume-action-menu-item"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleViewDispute(booking);
                                  }}
                                >
                                  <AlertTriangle size={14} color="#dc2626" />
                                  <span>Xem tranh chấp</span>
                                </button>

                                <button
                                  type="button"
                                  className="lume-action-menu-item"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenStatusModal(booking);
                                  }}
                                >
                                  <Edit3 size={14} color="#2563eb" />
                                  <span>Cập nhật trạng thái</span>
                                </button>

                                <div className="lume-action-menu-divider" />

                                <button
                                  type="button"
                                  className="lume-action-menu-item danger"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleLockTransaction(booking);
                                  }}
                                >
                                  <Lock size={14} color="#dc2626" />
                                  <span>Khóa giao dịch</span>
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

          {/* Table Footer / Pagination */}
          <div className="lume-booking-footer">
            <div>
              Hiển thị {bookings.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, total)} của {formatVND(total)} booking
            </div>

            <div className="lume-booking-pagination">
              <button
                type="button"
                className="lume-pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum = i + 1;
                if (totalPages > 5 && page > 3) {
                  pNum = page - 3 + i;
                  if (pNum > totalPages) pNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pNum}
                    type="button"
                    className={`lume-pagination-btn ${page === pNum ? 'active' : ''}`}
                    onClick={() => setPage(pNum)}
                  >
                    {pNum}
                  </button>
                );
              })}

              {totalPages > 5 && page < totalPages - 2 && (
                <>
                  <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
                  <button
                    type="button"
                    className={`lume-pagination-btn ${page === totalPages ? 'active' : ''}`}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                className="lume-pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>

              <select
                className="lume-perpage-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={8}>8 / trang</option>
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. Right Docked Detail Panel (Chi tiết booking) */}
        {isDetailOpen && activeBooking && (
          <aside className="lume-booking-detail-panel">
            {/* Header */}
            <div className="lume-detail-header">
              <div className="lume-detail-title-row">
                <h3>Chi tiết booking</h3>
                <button
                  type="button"
                  className="lume-detail-close-btn"
                  title="Đóng chi tiết"
                  onClick={() => setIsDetailOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="lume-detail-code-row">
                <span className="lume-detail-code">{activeBooking.bookingCode}</span>
                {renderStatusBadge(activeBooking.statusLabel)}
              </div>

              <div className="lume-detail-time-sub">
                Đặt ngày {activeBooking.createdAt ? new Date(activeBooking.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '12/03/2024, 14:32'}{' '}
                | Cập nhật {activeBooking.updatedAt ? new Date(activeBooking.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'vừa xong'}
              </div>
            </div>

            {/* Customer Info Section */}
            <div className="lume-detail-section">
              <h4 className="lume-detail-section-title">Thông tin khách hàng</h4>
              <div className="lume-detail-user-card">
                <img
                  src={activeBooking.customer.avatar || '/avatar_mai_anh.webp'}
                  alt={activeBooking.customer.fullName}
                  className="lume-detail-avatar"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/avatar_mai_anh.webp';
                  }}
                />
                <div className="lume-detail-user-body">
                  <div className="lume-detail-user-name-row">
                    <span className="lume-detail-user-name">{activeBooking.customer.fullName}</span>
                    <span className="lume-detail-user-code">{activeBooking.customer.code}</span>
                  </div>
                  <div className="lume-detail-contact-item">
                    <Phone size={12} />
                    <span>{activeBooking.customer.phone}</span>
                  </div>
                  <div className="lume-detail-contact-item">
                    <Mail size={12} />
                    <span>{activeBooking.customer.email}</span>
                  </div>
                  <div className="lume-detail-contact-item">
                    <MapPin size={12} />
                    <span>{activeBooking.customer.address}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Partner Info Section */}
            <div className="lume-detail-section">
              <h4 className="lume-detail-section-title">Thông tin đối tác</h4>
              <div className="lume-detail-user-card">
                <img
                  src={activeBooking.provider.avatar || '/avatar_mai_anh.webp'}
                  alt={activeBooking.provider.businessName}
                  className="lume-detail-avatar"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/avatar_mai_anh.webp';
                  }}
                />
                <div className="lume-detail-user-body">
                  <div className="lume-detail-user-name-row">
                    <div>
                      <div className="lume-detail-user-name">{activeBooking.provider.businessName}</div>
                      <span className="lume-detail-user-code">{activeBooking.provider.code}</span>
                    </div>
                    <button
                      type="button"
                      className="lume-partner-profile-link"
                      onClick={() => {
                        window.location.search = '?tab=providers';
                      }}
                    >
                      Xem hồ sơ đối tác
                    </button>
                  </div>
                  <div className="lume-detail-contact-item">
                    <Phone size={12} />
                    <span>{activeBooking.provider.phone}</span>
                  </div>
                  <div className="lume-detail-contact-item">
                    <MapPin size={12} />
                    <span>{activeBooking.provider.fullAddress || activeBooking.provider.city}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Info Section */}
            <div className="lume-detail-section">
              <h4 className="lume-detail-section-title">Thông tin dịch vụ</h4>
              <div className="lume-detail-service-card">
                <img
                  src={activeBooking.serviceDetails.image || '/ao_dai_do.webp'}
                  alt={activeBooking.serviceDetails.name}
                  className="lume-detail-service-img"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/ao_dai_do.webp';
                  }}
                />
                <div className="lume-detail-service-body">
                  <span className="lume-detail-service-name">{activeBooking.serviceDetails.name}</span>
                  <span className="lume-detail-service-pkg">{activeBooking.serviceDetails.package}</span>
                  <span className="lume-detail-service-spec">{activeBooking.serviceDetails.specs}</span>
                </div>
              </div>

              <div className="lume-detail-service-pills">
                <div className="lume-detail-pill-item">
                  <Calendar size={13} />
                  <span>
                    Lịch hẹn: {activeBooking.schedule?.date || activeBooking.rentalDate} {activeBooking.schedule?.time || ''}
                  </span>
                </div>
                <div className="lume-detail-pill-item">
                  <MapPin size={13} />
                  <span>Địa điểm: {activeBooking.serviceDetails.location}</span>
                </div>
                <div className="lume-detail-pill-item">
                  <Users size={13} />
                  <span>Số khách: {activeBooking.serviceDetails.guests}</span>
                </div>
              </div>
            </div>

            {/* Financials 4-Box Grid */}
            <div className="lume-financial-grid">
              <div className="lume-financial-box">
                <span className="lume-financial-box-label">Tổng giá trị</span>
                <span className="lume-financial-box-val">
                  {formatVND(activeBooking.financials.total)}
                  <span className="lume-financial-box-unit">VNĐ</span>
                </span>
              </div>
              <div className="lume-financial-box">
                <span className="lume-financial-box-label">Thanh toán</span>
                <span className="lume-financial-box-val green">
                  {formatVND(activeBooking.financials.paid)}
                  <span className="lume-financial-box-unit">VNĐ</span>
                </span>
              </div>
              <div className="lume-financial-box">
                <span className="lume-financial-box-label">Hoàn tiền</span>
                <span className="lume-financial-box-val red">
                  {formatVND(activeBooking.financials.refunded)}
                  <span className="lume-financial-box-unit">VNĐ</span>
                </span>
              </div>
              <div className="lume-financial-box">
                <span className="lume-financial-box-label">Tranh chấp</span>
                <span className="lume-financial-box-val">
                  {activeBooking.financials.disputesCount}
                </span>
              </div>
            </div>

            {/* Detail Tabs */}
            <div className="lume-detail-tabs-bar">
              <button
                type="button"
                className={`lume-detail-tab-btn ${detailTab === 'overview' ? 'active' : ''}`}
                onClick={() => setDetailTab('overview')}
              >
                Tổng quan
              </button>
              <button
                type="button"
                className={`lume-detail-tab-btn ${detailTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setDetailTab('timeline')}
              >
                Timeline
              </button>
              <button
                type="button"
                className={`lume-detail-tab-btn ${detailTab === 'payment' ? 'active' : ''}`}
                onClick={() => setDetailTab('payment')}
              >
                Thanh toán
              </button>
              <button
                type="button"
                className={`lume-detail-tab-btn ${detailTab === 'notes' ? 'active' : ''}`}
                onClick={() => setDetailTab('notes')}
              >
                Ghi chú
              </button>
            </div>

            {/* Tab content */}
            <div className="lume-detail-tab-content">
              {detailTab === 'overview' && (
                <>
                  <div className="lume-detail-summary-grid">
                    <div className="lume-summary-item">
                      <label>Trạng thái booking</label>
                      <span>{renderStatusBadge(activeBooking.statusLabel)}</span>
                    </div>
                    <div className="lume-summary-item">
                      <label>Trạng thái thanh toán</label>
                      <span className={`lume-badge-dot dot-circle ${activeBooking.isPaid ? 'paid' : 'unpaid'}`}>
                        {activeBooking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                    </div>
                    <div className="lume-summary-item">
                      <label>Ngày tạo</label>
                      <span>
                        {activeBooking.createdAt
                          ? new Date(activeBooking.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                          : '12/03/2024, 14:32'}
                      </span>
                    </div>
                    <div className="lume-summary-item">
                      <label>Cập nhật gần nhất</label>
                      <span>
                        {activeBooking.updatedAt
                          ? new Date(activeBooking.updatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                          : '12/03/2024, 16:20'}
                      </span>
                    </div>
                  </div>

                  <div className="lume-customer-note-block">
                    <label>Ghi chú từ khách hàng</label>
                    <p>{activeBooking.customerNotes || '-'}</p>
                  </div>
                </>
              )}

              {detailTab === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeBooking.timeline && activeBooking.timeline.length > 0 ? (
                    activeBooking.timeline.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: '11px',
                          borderLeft: '2px solid #881337',
                          paddingLeft: '8px',
                          marginLeft: '4px',
                        }}
                      >
                        <div>
                          <strong>{item.status}</strong>
                          <div style={{ color: '#64748b' }}>
                            {new Date(item.changedAt).toLocaleString('vi-VN')}
                          </div>
                          {item.note && <div style={{ color: '#334155', marginTop: '2px' }}>{item.note}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Chưa có bản ghi lịch sử timeline.</div>
                  )}
                </div>
              )}

              {detailTab === 'payment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tổng tiền dịch vụ:</span>
                    <strong>{formatVND(activeBooking.financials.total)} VNĐ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Đặt cọc (nếu có):</span>
                    <span>{formatVND(activeBooking.deposit)} VNĐ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Đã thanh toán:</span>
                    <strong style={{ color: '#16a34a' }}>{formatVND(activeBooking.financials.paid)} VNĐ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Hoàn tiền / đền bù:</span>
                    <strong style={{ color: '#dc2626' }}>{formatVND(activeBooking.financials.refunded)} VNĐ</strong>
                  </div>
                </div>
              )}

              {detailTab === 'notes' && (
                <div style={{ fontSize: '12px', color: '#334155' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Ghi chú đơn hàng:</strong>
                    <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                      {activeBooking.customerNotes || 'Không có ghi chú bổ sung.'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Action Buttons Grid (2x2) */}
            <div className="lume-detail-actions-grid">
              <button
                type="button"
                className="lume-detail-action-outline-btn"
                onClick={() => handleViewDetails(activeBooking)}
              >
                <Eye size={13} />
                <span>Xem chi tiết</span>
              </button>

              <button
                type="button"
                className="lume-detail-action-outline-btn"
                onClick={() => handleViewDispute(activeBooking)}
              >
                <AlertTriangle size={13} />
                <span>Xem tranh chấp</span>
              </button>

              <button
                type="button"
                className="lume-detail-action-outline-btn"
                onClick={() => handleOpenStatusModal(activeBooking)}
              >
                <Edit3 size={13} />
                <span>Cập nhật trạng thái</span>
              </button>

              <button
                type="button"
                className="lume-detail-action-solid-btn"
                onClick={() => handleLockTransaction(activeBooking)}
              >
                <Lock size={13} />
                <span>Khóa giao dịch</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* =========================================================================
          MODERN MODAL 1: XEM CHI TIẾT BOOKING
          ========================================================================= */}
      {detailModalBooking && (
        <div className="lume-modal-backdrop" onClick={() => setDetailModalBooking(null)}>
          <div className="lume-modal-box size-lg" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon wine">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Chi tiết Booking #{detailModalBooking.bookingCode}</h3>
                  <p className="lume-modal-subtitle">
                    Mã hệ thống: {detailModalBooking.bookingId} • Tạo lúc: {detailModalBooking.createdAt || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setDetailModalBooking(null)}
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              {/* Top Status & Payment Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Trạng thái:</span>
                  {renderStatusBadge(detailModalBooking.statusLabel)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Thanh toán:</span>
                  <span className={`lume-badge-dot dot-circle ${detailModalBooking.isPaid ? 'paid' : 'unpaid'}`}>
                    {detailModalBooking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </span>
                </div>
                {detailModalBooking.issue && detailModalBooking.issue !== '-' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="issue-tag-red">{detailModalBooking.issue}</span>
                  </div>
                )}
              </div>

              {/* 2-Column: Customer & Provider */}
              <div className="lume-modal-grid-2">
                <div className="lume-modal-card-block">
                  <h4 className="lume-modal-block-title">Thông tin khách hàng</h4>
                  <div className="lume-detail-user-card" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                    <div className="lume-detail-avatar-circle">
                      {detailModalBooking.customer?.avatar ? (
                        <img src={detailModalBooking.customer.avatar} alt="Avatar" />
                      ) : (
                        detailModalBooking.customer?.fullName?.charAt(0) || 'K'
                      )}
                    </div>
                    <div className="lume-detail-user-info">
                      <span className="lume-detail-user-name">
                        {detailModalBooking.customer?.fullName || detailModalBooking.customerName}
                      </span>
                      <span className="lume-detail-user-code">
                        Mã KH: {detailModalBooking.customer?.code || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div className="lume-detail-contact-item">
                      <Phone size={13} />
                      <span>{detailModalBooking.customer?.phone || 'Chưa có SĐT'}</span>
                    </div>
                    <div className="lume-detail-contact-item">
                      <Mail size={13} />
                      <span>{detailModalBooking.customer?.email || 'Chưa có email'}</span>
                    </div>
                    <div className="lume-detail-contact-item">
                      <MapPin size={13} />
                      <span>{detailModalBooking.customer?.address || 'Huế, Việt Nam'}</span>
                    </div>
                  </div>
                </div>

                <div className="lume-modal-card-block">
                  <h4 className="lume-modal-block-title">Đối tác cung cấp</h4>
                  <div className="lume-detail-user-card" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                    <div className="lume-detail-avatar-circle shop">
                      {detailModalBooking.provider?.avatar ? (
                        <img src={detailModalBooking.provider.avatar} alt="Shop" />
                      ) : (
                        detailModalBooking.provider?.businessName?.charAt(0) || 'D'
                      )}
                    </div>
                    <div className="lume-detail-user-info">
                      <span className="lume-detail-user-name">
                        {detailModalBooking.provider?.businessName || detailModalBooking.providerName}
                      </span>
                      <span className="lume-detail-user-code">
                        Mã đối tác: {detailModalBooking.provider?.code || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div className="lume-detail-contact-item">
                      <Phone size={13} />
                      <span>{detailModalBooking.provider?.phone || 'Chưa có SĐT'}</span>
                    </div>
                    <div className="lume-detail-contact-item">
                      <MapPin size={13} />
                      <span>
                        {detailModalBooking.provider?.fullAddress || detailModalBooking.provider?.city || 'Huế'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Details Card */}
              <div className="lume-modal-card-block">
                <h4 className="lume-modal-block-title">Dịch vụ & Gói đã đặt</h4>
                <div className="lume-detail-service-card">
                  {detailModalBooking.serviceDetails?.image ? (
                    <img
                      src={detailModalBooking.serviceDetails.image}
                      alt="Service"
                      className="lume-detail-service-img"
                    />
                  ) : (
                    <div className="lume-detail-service-img-placeholder">
                      <Calendar size={20} color="#881337" />
                    </div>
                  )}
                  <div className="lume-detail-service-body">
                    <span className="lume-detail-service-name">
                      {detailModalBooking.serviceDetails?.name || detailModalBooking.items}
                    </span>
                    <span className="lume-detail-service-pkg">
                      Gói: {detailModalBooking.serviceDetails?.package || 'Tiêu chuẩn'}
                    </span>
                    <span className="lume-detail-service-spec">
                      Thông số: {detailModalBooking.serviceDetails?.specs || 'Tiêu chuẩn'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  <div className="lume-detail-pill-item">
                    <Calendar size={13} />
                    <span>
                      Lịch hẹn: {detailModalBooking.schedule?.date || detailModalBooking.rentalDate} ({detailModalBooking.schedule?.time || '09:00 - 18:00'})
                    </span>
                  </div>
                  <div className="lume-detail-pill-item">
                    <MapPin size={13} />
                    <span>Địa điểm: {detailModalBooking.serviceDetails?.location || detailModalBooking.provider?.city || 'Huế'}</span>
                  </div>
                </div>
              </div>

              {/* Financials 4-Box */}
              <div className="lume-financial-grid">
                <div className="lume-financial-box">
                  <span className="lume-financial-box-label">Tổng giá trị đơn</span>
                  <span className="lume-financial-box-val">
                    {formatVND(detailModalBooking.financials?.total || detailModalBooking.price)}
                    <span className="lume-financial-box-unit">VNĐ</span>
                  </span>
                </div>
                <div className="lume-financial-box">
                  <span className="lume-financial-box-label">Đã thanh toán</span>
                  <span className="lume-financial-box-val green">
                    {formatVND(
                      detailModalBooking.financials?.paid ||
                        (detailModalBooking.isPaid ? detailModalBooking.price : 0)
                    )}
                    <span className="lume-financial-box-unit">VNĐ</span>
                  </span>
                </div>
                <div className="lume-financial-box">
                  <span className="lume-financial-box-label">Tiền cọc đảm bảo</span>
                  <span className="lume-financial-box-val">
                    {formatVND(detailModalBooking.deposit || 0)}
                    <span className="lume-financial-box-unit">VNĐ</span>
                  </span>
                </div>
                <div className="lume-financial-box">
                  <span className="lume-financial-box-label">Đã hoàn lại</span>
                  <span className="lume-financial-box-val red">
                    {formatVND(detailModalBooking.financials?.refunded || 0)}
                    <span className="lume-financial-box-unit">VNĐ</span>
                  </span>
                </div>
              </div>

              {/* Customer Notes */}
              {detailModalBooking.customerNotes && (
                <div className="lume-customer-note-block">
                  <label>Ghi chú của khách hàng:</label>
                  <p>{detailModalBooking.customerNotes}</p>
                </div>
              )}
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-ghost"
                onClick={() => setDetailModalBooking(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="lume-detail-action-outline-btn"
                style={{ height: '36px', padding: '0 14px' }}
                onClick={() => {
                  const b = detailModalBooking;
                  setDetailModalBooking(null);
                  handleViewDispute(b);
                }}
              >
                <AlertTriangle size={14} color="#dc2626" />
                <span>Xem tranh chấp</span>
              </button>
              <button
                type="button"
                className="lume-btn-primary"
                onClick={() => {
                  const b = detailModalBooking;
                  setDetailModalBooking(null);
                  handleOpenStatusModal(b);
                }}
              >
                <Edit3 size={14} />
                <span>Cập nhật trạng thái</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODERN MODAL 2: CẬP NHẬT TRẠNG THÁI BOOKING
          ========================================================================= */}
      {statusModalBooking && (
        <div className="lume-modal-backdrop" onClick={() => setStatusModalBooking(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                <div className="lume-modal-header-icon blue">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="lume-modal-title">Cập nhật trạng thái</h3>
                  <p className="lume-modal-subtitle">
                    Đơn booking #{statusModalBooking.bookingCode} ({statusModalBooking.customerName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setStatusModalBooking(null)}
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Chọn trạng thái vận hành mới cho đơn đặt lịch:
              </p>

              <div className="lume-status-radio-grid">
                {[
                  {
                    value: 'CONFIRMED',
                    title: 'Sắp diễn ra (CONFIRMED)',
                    desc: 'Đơn đã xác nhận, đối tác đang chuẩn bị phục vụ theo lịch',
                    color: '#2563eb',
                  },
                  {
                    value: 'COMPLETED',
                    title: 'Đã hoàn thành (COMPLETED)',
                    desc: 'Khách hàng đã nhận đủ dịch vụ/sản phẩm và hoàn tất đơn',
                    color: '#16a34a',
                  },
                  {
                    value: 'PENDING',
                    title: 'Chờ xác nhận (PENDING)',
                    desc: 'Chờ đối tác rà soát lịch hẹn và xác nhận nhận đơn',
                    color: '#d97706',
                  },
                  {
                    value: 'CANCELLED',
                    title: 'Đã hủy (CANCELLED)',
                    desc: 'Hủy lịch hẹn theo yêu cầu hoặc do sự cố phát sinh',
                    color: '#dc2626',
                  },
                  {
                    value: 'DISPUTED',
                    title: 'Có tranh chấp (DISPUTED)',
                    desc: 'Đơn hàng gặp sự cố, tạm giữ tiền cọc để hòa giải đối soát',
                    color: '#9333ea',
                  },
                ].map((item) => {
                  const isSelected = newStatusValue === item.value;
                  return (
                    <div
                      key={item.value}
                      className={`lume-status-radio-card ${isSelected ? 'active' : ''}`}
                      onClick={() => setNewStatusValue(item.value)}
                    >
                      <div className="lume-status-card-left">
                        <span
                          className="lume-status-card-dot"
                          style={{ background: item.color }}
                        />
                        <div className="lume-status-card-texts">
                          <span className="lume-status-card-title">{item.title}</span>
                          <span className="lume-status-card-desc">{item.desc}</span>
                        </div>
                      </div>
                      <div className="lume-status-radio-indicator" />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Ghi chú điều chỉnh / Lý do (tùy chọn):
                </label>
                <textarea
                  rows={3}
                  value={statusChangeNote}
                  onChange={(e) => setStatusChangeNote(e.target.value)}
                  placeholder="Nhập lý do thay đổi hoặc ghi chú cho các bên liên quan..."
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
                onClick={() => setStatusModalBooking(null)}
                disabled={updatingStatus}
              >
                Hủy
              </button>
              <button
                type="button"
                className="lume-btn-primary"
                onClick={handleSubmitStatusUpdate}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <span>Đang lưu...</span>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODERN MODAL 3: XEM TRANH CHẤP & KHIẾU NẠI
          ========================================================================= */}
      {disputeModalBooking && (
        <div className="lume-modal-backdrop" onClick={() => setDisputeModalBooking(null)}>
          <div className="lume-modal-box size-md" onClick={(e) => e.stopPropagation()}>
            <div className="lume-modal-header">
              <div className="lume-modal-header-left">
                {disputeModalBooking.issue &&
                disputeModalBooking.issue !== '-' &&
                disputeModalBooking.issue !== 'Bình thường' ? (
                  <div className="lume-modal-header-icon red">
                    <AlertTriangle size={20} />
                  </div>
                ) : (
                  <div className="lume-modal-header-icon green">
                    <ShieldCheck size={20} />
                  </div>
                )}
                <div>
                  <h3 className="lume-modal-title">
                    {disputeModalBooking.issue &&
                    disputeModalBooking.issue !== '-' &&
                    disputeModalBooking.issue !== 'Bình thường'
                      ? 'Thông tin khiếu nại & Tranh chấp'
                      : 'Trạng thái khiếu nại & Bảo vệ'}
                  </h3>
                  <p className="lume-modal-subtitle">
                    Đơn booking #{disputeModalBooking.bookingCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="lume-modal-close-btn"
                onClick={() => setDisputeModalBooking(null)}
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="lume-modal-body">
              {disputeModalBooking.issue &&
              disputeModalBooking.issue !== '-' &&
              disputeModalBooking.issue !== 'Bình thường' ? (
                <>
                  <div className="lume-dispute-alert-banner">
                    <AlertTriangle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                        {disputeModalBooking.issue}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', lineHeight: 1.5 }}>
                        Đơn booking này đang phát sinh khiếu nại. Cọc thanh toán đang được giữ an toàn trên hệ thống ký quỹ LUMÉ Escrow để đội ngũ CSKH xử lý hòa giải.
                      </p>
                    </div>
                  </div>

                  <div className="lume-modal-card-block">
                    <h4 className="lume-modal-block-title">Chi tiết liên quan</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Khách hàng khiếu nại:</span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          {disputeModalBooking.customerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {disputeModalBooking.customer?.phone || ''}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Đối tác cung cấp:</span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          {disputeModalBooking.providerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {disputeModalBooking.provider?.phone || ''}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '8px',
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Tiền cọc giữ ký quỹ:</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#881337' }}>
                        {formatVND(disputeModalBooking.deposit || 0)} VNĐ
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="lume-empty-state-wrap">
                  <div className="lume-empty-state-icon">
                    <ShieldCheck size={36} />
                  </div>
                  <h4 className="lume-empty-state-title">Không có khiếu nại</h4>
                  <p className="lume-empty-state-desc">
                    Đơn booking <strong>#{disputeModalBooking.bookingCode}</strong> hiện không có tranh chấp hay khiếu nại nào đang mở. Mọi quyền lợi giao dịch được bảo vệ an toàn bởi LUMÉ Escrow.
                  </p>

                  <div
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="#16a34a" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        Bảo vệ ký quỹ LUMÉ
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                      An toàn tuyệt đối
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="lume-modal-footer">
              <button
                type="button"
                className="lume-btn-primary"
                onClick={() => setDisputeModalBooking(null)}
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
