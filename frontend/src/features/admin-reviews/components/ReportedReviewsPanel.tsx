import { useState, useMemo, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  X,
  HelpCircle,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Ban,
  MoreVertical,
  Check,
  Calendar,
  EyeOff,
} from 'lucide-react';
import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';
import { adminReportedReviewsApi } from '../api/adminReportedReviewsApi';
import { useReportedReviews } from '../hooks/useReportedReviews';
import type { ReportedReview, ReportAction } from '../types';
import './reportedReviewsFigma.css';

const formatReportedTime = (value?: string | Date) => {
  if (!value) return '28/07/2024 14:32';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '28/07/2024 14:32';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '28/07/2024 14:32';
  }
};

const formatDateOnly = (value?: string | Date) => {
  if (!value) return '28/07/2024';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '28/07/2024';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '28/07/2024';
  }
};

export function ReportedReviewsPanel() {
  const { error, items, metrics, loading, refresh } = useReportedReviews();

  // Selection state
  const [selected, setSelected] = useState<ReportedReview | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Filter & tab state
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED'>('ALL');
  const [reasonTypeFilter, setReasonTypeFilter] = useState<string>('ALL');
  const [statusDropdown, setStatusDropdown] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'RATING_ASC' | 'RATING_DESC'>('NEWEST');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Modal state
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isHandling, setIsHandling] = useState(false);

  // Field extractors
  const getReportCode = (review: ReportedReview) =>
    review.reportCode || `#BR${review._id.slice(-5).toUpperCase()}`;

  const getBookingCode = (review: ReportedReview) =>
    review.bookingId?.bookingCode || `#BK${review.bookingId?._id?.slice(-6).toUpperCase() || '20240728'}`;

  const getCustomerName = (review: ReportedReview) =>
    review.customerId?.profile?.fullName || 'Nguyễn Văn A';

  const getCustomerCode = (review: ReportedReview) =>
    `#KH${String(review.customerId?._id || review._id).slice(-6).toUpperCase()}`;

  const getProviderName = (review: ReportedReview) =>
    review.providerId?.businessName || 'Áo Dài Cố Đô';

  const getProviderCode = (review: ReportedReview) =>
    review.providerId?.partnerCode || `#DT${String(review.providerId?._id || review._id).slice(-5).toUpperCase()}`;

  const getReporterName = (review: ReportedReview) =>
    review.reporterName || 'Lê Thị B';

  const getReporterCode = (review: ReportedReview) =>
    review.reporterCode || `#KH${String(review._id).slice(-4).toUpperCase()}`;

  const getReportReason = (review: ReportedReview) =>
    review.reportReason || 'Ngôn từ xúc phạm';

  const getReportStatus = (review: ReportedReview): 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' => {
    if (review.reportStatus === 'UNDER_REVIEW') return 'UNDER_REVIEW';
    if (review.reportStatus === 'RESOLVED' || review.reportStatus === 'DISMISSED') return 'RESOLVED';
    return 'PENDING';
  };

  // KPIs
  const kpiTotal = metrics?.total ?? items.length;
  const kpiPending = metrics?.pending ?? items.filter((i) => getReportStatus(i) === 'PENDING').length;
  const kpiResolved = (metrics?.resolved ?? items.filter((i) => getReportStatus(i) === 'RESOLVED').length) +
    (metrics?.underReview ?? items.filter((i) => getReportStatus(i) === 'UNDER_REVIEW').length);
  const kpiHidden = metrics?.hidden ?? items.filter((i) => i.isHidden === true).length;

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((review) => {
        const status = getReportStatus(review);

        // Tab filter
        if (statusTab === 'PENDING' && status !== 'PENDING') return false;
        if (statusTab === 'UNDER_REVIEW' && status !== 'UNDER_REVIEW') return false;
        if (statusTab === 'RESOLVED' && status !== 'RESOLVED') return false;

        // Dropdown status filter
        if (statusDropdown === 'PENDING' && status !== 'PENDING') return false;
        if (statusDropdown === 'UNDER_REVIEW' && status !== 'UNDER_REVIEW') return false;
        if (statusDropdown === 'RESOLVED' && status !== 'RESOLVED') return false;

        // Reason filter
        if (reasonTypeFilter !== 'ALL') {
          const reasonStr = (review.reportReason || '').toLowerCase();
          const reasonType = review.reportReasonType || '';
          if (reasonTypeFilter === 'OFFENSIVE_LANGUAGE' && !reasonStr.includes('xúc phạm') && reasonType !== 'OFFENSIVE_LANGUAGE') return false;
          if (reasonTypeFilter === 'SPAM' && !reasonStr.includes('spam') && reasonType !== 'SPAM') return false;
          if (reasonTypeFilter === 'FALSE_CONTENT' && !reasonStr.includes('sai sự thật') && reasonType !== 'FALSE_CONTENT') return false;
          if (reasonTypeFilter === 'COMPETITOR_BIAS' && !reasonStr.includes('cạnh tranh') && reasonType !== 'COMPETITOR_BIAS') return false;
          if (reasonTypeFilter === 'DEFAMATION' && !reasonStr.includes('bôi nhọ') && !reasonStr.includes('vu khống') && reasonType !== 'DEFAMATION') return false;
          if (reasonTypeFilter === 'VULGAR' && !reasonStr.includes('thô tục') && reasonType !== 'VULGAR') return false;
        }

        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const code = getReportCode(review).toLowerCase();
          const cust = getCustomerName(review).toLowerCase();
          const prov = getProviderName(review).toLowerCase();
          const comment = (review.comment || '').toLowerCase();
          const reason = (review.reportReason || '').toLowerCase();

          return (
            code.includes(q) ||
            cust.includes(q) ||
            prov.includes(q) ||
            comment.includes(q) ||
            reason.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NEWEST') {
          return new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime();
        }
        if (sortBy === 'OLDEST') {
          return new Date(a.reportedAt || 0).getTime() - new Date(b.reportedAt || 0).getTime();
        }
        if (sortBy === 'RATING_ASC') {
          return (a.rating || 0) - (b.rating || 0);
        }
        if (sortBy === 'RATING_DESC') {
          return (b.rating || 0) - (a.rating || 0);
        }
        return 0;
      });
  }, [items, statusTab, statusDropdown, reasonTypeFilter, sortBy, searchTerm]);

  // Paginated records
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Auto-select first item
  useEffect(() => {
    if (!selected && filteredItems.length > 0) {
      setSelected(filteredItems[0]);
    }
  }, [filteredItems, selected]);

  // Row selection checkbox
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === paginatedItems.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(paginatedItems.map((d) => d._id)));
    }
  };

  // Dock Sequential Navigation
  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    return filteredItems.findIndex((d) => d._id === selected._id);
  }, [selected, filteredItems]);

  const handlePrevReport = () => {
    if (selectedIndex > 0) {
      setSelected(filteredItems[selectedIndex - 1]);
    }
  };

  const handleNextReport = () => {
    if (selectedIndex < filteredItems.length - 1) {
      setSelected(filteredItems[selectedIndex + 1]);
    }
  };

  // Moderation Handlers
  const handleAction = async (action: ReportAction, promptTitle: string, defaultReason?: string) => {
    if (!selected) return;

    const result = await Swal.fire({
      title: promptTitle,
      input: 'textarea',
      inputLabel: 'Lý do / Căn cứ xử lý',
      inputValue: defaultReason || '',
      inputPlaceholder: 'Nhập ghi chú xử lý gửi thông báo đến các bên liên quan...',
      icon: action === 'HIDE' || action === 'DELETE' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xác nhận thực hiện',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    setIsHandling(true);
    try {
      await adminReportedReviewsApi.handle(selected._id, action, result.value || defaultReason || '');
      await refresh();
      await Swal.fire({
        title: 'Thành công!',
        text: 'Báo cáo đánh giá đã được xử lý và lưu vào lịch sử kiểm duyệt.',
        icon: 'success',
        confirmButtonColor: '#059669',
      });
    } catch (err: any) {
      await Swal.fire({
        title: 'Lỗi xử lý',
        text: err?.message || 'Không thể cập nhật báo cáo.',
        icon: 'error',
      });
    } finally {
      setIsHandling(false);
    }
  };

  return (
    <div className="rr-shell">
      {/* 1. Breadcrumbs */}
      <nav className="rr-breadcrumb" aria-label="Breadcrumb">
        <span>Trang chủ</span>
        <span className="separator">&gt;</span>
        <span className="current">Báo cáo vi phạm &amp; Spam đánh giá</span>
      </nav>

      {/* 2. Header */}
      <header className="rr-header">
        <div className="rr-header-left">
          <h1>Báo cáo vi phạm &amp; Spam đánh giá</h1>
          <p>
            Xem xét và xử lý các báo cáo về nội dung đánh giá vi phạm, spam hoặc không phù hợp với chính sách cộng đồng.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="rr-guide-btn"
            onClick={() => setShowGuideModal(true)}
          >
            <HelpCircle size={15} />
            <span>Hướng dẫn xử lý báo cáo</span>
          </button>
          <AdminReloadButton onClick={() => void refresh()} isLoading={loading} />
        </div>
      </header>

      {/* 3. 4 KPI Cards */}
      <div className="rr-kpi-grid">
        {/* KPI 1 */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <span className="rr-kpi-title">Tổng báo cáo</span>
            <div className="rr-kpi-icon-wrap rr-kpi-icon-red">
              <Flag size={18} />
            </div>
          </div>
          <div className="rr-kpi-val">{kpiTotal}</div>
          <div className="rr-kpi-trend">
            <span className="rr-trend-green">↑ 12%</span>
            <span className="rr-trend-sub">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <span className="rr-kpi-title">Chờ xử lý</span>
            <div className="rr-kpi-icon-wrap rr-kpi-icon-orange">
              <Clock size={18} />
            </div>
          </div>
          <div className="rr-kpi-val">{kpiPending}</div>
          <div className="rr-kpi-trend">
            <span className="rr-trend-orange">↑ 33%</span>
            <span className="rr-trend-sub">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <span className="rr-kpi-title">Đã xử lý</span>
            <div className="rr-kpi-icon-wrap rr-kpi-icon-green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="rr-kpi-val">{kpiResolved}</div>
          <div className="rr-kpi-trend">
            <span className="rr-trend-green">↑ 23%</span>
            <span className="rr-trend-sub">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <span className="rr-kpi-title">Đã ẩn/gỡ đánh giá</span>
            <div className="rr-kpi-icon-wrap rr-kpi-icon-darkred">
              <Ban size={18} />
            </div>
          </div>
          <div className="rr-kpi-val">{kpiHidden}</div>
          <div className="rr-kpi-trend">
            <span className="rr-trend-green">↑ 40%</span>
            <span className="rr-trend-sub">so với tháng trước</span>
          </div>
        </div>
      </div>

      {/* 4. 4 Status Tabs Bar */}
      <div className="rr-tabs-wrapper">
        <button
          type="button"
          className={`rr-tab-btn ${statusTab === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setStatusTab('ALL');
            setCurrentPage(1);
          }}
        >
          <span>Tất cả</span>
          <span className="rr-tab-count">{kpiTotal}</span>
        </button>

        <button
          type="button"
          className={`rr-tab-btn ${statusTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => {
            setStatusTab('PENDING');
            setCurrentPage(1);
          }}
        >
          <Clock size={13} color="#ea580c" />
          <span>Chờ xử lý</span>
          <span className="rr-tab-count">{kpiPending}</span>
        </button>

        <button
          type="button"
          className={`rr-tab-btn ${statusTab === 'UNDER_REVIEW' ? 'active' : ''}`}
          onClick={() => {
            setStatusTab('UNDER_REVIEW');
            setCurrentPage(1);
          }}
        >
          <AlertCircle size={13} color="#2563eb" />
          <span>Đang xem xét</span>
          <span className="rr-tab-count">
            {metrics?.underReview ?? items.filter((i) => getReportStatus(i) === 'UNDER_REVIEW').length}
          </span>
        </button>

        <button
          type="button"
          className={`rr-tab-btn ${statusTab === 'RESOLVED' ? 'active' : ''}`}
          onClick={() => {
            setStatusTab('RESOLVED');
            setCurrentPage(1);
          }}
        >
          <CheckCircle2 size={13} color="#059669" />
          <span>Đã xử lý</span>
          <span className="rr-tab-count">{kpiResolved}</span>
        </button>
      </div>

      {/* 5. Filter Bar with 3 Dropdowns */}
      <div className="rr-filter-bar">
        {/* Search */}
        <div className="rr-search-box">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Tìm kiếm theo nội dung, tên khách, đối tác..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
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

        {/* Dropdown 1: Loại báo cáo */}
        <div className="rr-select-group">
          <span className="rr-select-label">Loại báo cáo</span>
          <select
            className="rr-select"
            value={reasonTypeFilter}
            onChange={(e) => {
              setReasonTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="OFFENSIVE_LANGUAGE">Ngôn từ xúc phạm</option>
            <option value="SPAM">Nghi spam</option>
            <option value="FALSE_CONTENT">Nội dung sai sự thật</option>
            <option value="COMPETITOR_BIAS">Nghi có động cơ cạnh tranh</option>
            <option value="DEFAMATION">Vu khống / Bôi nhọ</option>
            <option value="VULGAR">Ngôn từ thô tục</option>
          </select>
        </div>

        {/* Dropdown 2: Trạng thái */}
        <div className="rr-select-group">
          <span className="rr-select-label">Trạng thái</span>
          <select
            className="rr-select"
            value={statusDropdown}
            onChange={(e) => {
              setStatusDropdown(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="UNDER_REVIEW">Đang xem xét</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
        </div>

        {/* Dropdown 3: Sắp xếp theo */}
        <div className="rr-select-group">
          <span className="rr-select-label">Sắp xếp theo</span>
          <select
            className="rr-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="OLDEST">Cũ nhất</option>
            <option value="RATING_ASC">Đánh giá thấp nhất</option>
            <option value="RATING_DESC">Đánh giá cao nhất</option>
          </select>
        </div>

        {/* Button Bộ lọc */}
        <button type="button" className="rr-filter-btn">
          <SlidersHorizontal size={14} />
          <span>Bộ lọc</span>
        </button>

        {/* Reset button */}
        {(searchTerm || reasonTypeFilter !== 'ALL' || statusDropdown !== 'ALL' || sortBy !== 'NEWEST') && (
          <button
            type="button"
            className="rr-reset-btn"
            onClick={() => {
              setSearchTerm('');
              setReasonTypeFilter('ALL');
              setStatusDropdown('ALL');
              setSortBy('NEWEST');
              setCurrentPage(1);
            }}
          >
            <RotateCcw size={13} />
            <span>Đặt lại</span>
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

      {/* 6. Workspace Layout (Table Left + Detail Dock Right) */}
      <div className="rr-workspace">
        {/* Left: Table Container */}
        <div className={`rr-table-container ${selected ? 'has-selected' : ''}`}>
          <table className="rr-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      paginatedItems.length > 0 &&
                      selectedRowIds.size === paginatedItems.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ width: '30px' }}>#</th>
                <th>Nội dung đánh giá</th>
                <th>Khách hàng</th>
                <th>Đối tác / Sản phẩm</th>
                <th>Lý do báo cáo</th>
                <th>Ngày báo cáo</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#64748b' }}>
                      Không tìm thấy báo cáo đánh giá nào phù hợp với bộ lọc.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((review, idx) => {
                  const isSelected = selected?._id === review._id;
                  const isChecked = selectedRowIds.has(review._id);
                  const stt = (currentPage - 1) * pageSize + idx + 1;
                  const status = getReportStatus(review);
                  const rating = review.rating || 5;

                  return (
                    <tr
                      key={review._id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => setSelected(review)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(review._id)}
                        />
                      </td>

                      <td style={{ color: '#64748b', fontWeight: 600 }}>{stt}</td>

                      {/* Nội dung đánh giá + Sao vàng */}
                      <td>
                        <div className="rr-review-preview">
                          <span className="rr-review-text" title={review.comment || ''}>
                            {review.comment || 'Dịch vụ quá tệ, lừa đảo. Không nên đặt ở đây...'}
                          </span>
                          <div className="rr-stars">
                            {Array.from({ length: 5 }).map((_, sIdx) => (
                              <Star
                                key={sIdx}
                                size={12}
                                fill={sIdx < rating ? '#f59e0b' : 'none'}
                                color={sIdx < rating ? '#f59e0b' : '#cbd5e1'}
                              />
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Khách hàng */}
                      <td>
                        <div className="rr-party-cell">
                          <img
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
                            alt="Khách hàng"
                            className="rr-party-avatar"
                          />
                          <div className="rr-party-info">
                            <span className="rr-party-name">{getCustomerName(review)}</span>
                            <span className="rr-party-code">{getCustomerCode(review)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Đối tác / Sản phẩm */}
                      <td>
                        <div className="rr-party-cell">
                          <img
                            src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=80&auto=format&fit=crop&q=80"
                            alt="Đối tác"
                            className="rr-party-avatar"
                          />
                          <div className="rr-party-info">
                            <span className="rr-party-name">{getProviderName(review)}</span>
                            <span className="rr-party-code">{getProviderCode(review)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Lý do báo cáo */}
                      <td>
                        <span className="rr-reason-badge">
                          <Flag size={11} /> {getReportReason(review)}
                        </span>
                      </td>

                      {/* Ngày báo cáo */}
                      <td style={{ color: '#64748b', fontSize: '12px' }}>
                        {formatReportedTime(review.reportedAt)}
                      </td>

                      {/* Trạng thái */}
                      <td>
                        {status === 'PENDING' && (
                          <span className="rr-status-pill rr-status-pending">
                            <span className="rr-status-dot" /> Chờ xử lý
                          </span>
                        )}
                        {status === 'UNDER_REVIEW' && (
                          <span className="rr-status-pill rr-status-under-review">
                            <span className="rr-status-dot" /> Đang xem xét
                          </span>
                        )}
                        {status === 'RESOLVED' && (
                          <span className="rr-status-pill rr-status-resolved">
                            <span className="rr-status-dot" /> Đã xử lý
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="rr-action-btn"
                          title="Xem chi tiết"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(review);
                          }}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination bar */}
          <div className="rr-pagination-bar">
            <span>
              Hiển thị <strong>{paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> -{' '}
              <strong>{Math.min(currentPage * pageSize, filteredItems.length)}</strong> của{' '}
              <strong>{filteredItems.length}</strong> báo cáo
            </span>
            <div className="rr-page-controls">
              <button
                type="button"
                className="rr-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }).map((_, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className={`rr-page-btn ${currentPage === pIdx + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pIdx + 1)}
                >
                  {pIdx + 1}
                </button>
              ))}
              <button
                type="button"
                className="rr-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>

              <select
                style={{
                  marginLeft: '8px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: '#334155',
                  outline: 'none',
                }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={8}>8 / trang</option>
                <option value={12}>12 / trang</option>
                <option value={24}>24 / trang</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Inspection & Detail Dock */}
        {selected && (
          <aside className="rr-detail-dock">
            {/* Dock Topbar */}
            <div className="rr-dock-topbar">
              <h3>Chi tiết báo cáo</h3>
              <div className="rr-dock-paginator">
                <button
                  type="button"
                  className="rr-dock-arrow"
                  disabled={selectedIndex <= 0}
                  onClick={handlePrevReport}
                  title="Báo cáo trước"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {selectedIndex + 1} / {filteredItems.length}
                </span>
                <button
                  type="button"
                  className="rr-dock-arrow"
                  disabled={selectedIndex >= filteredItems.length - 1}
                  onClick={handleNextReport}
                  title="Báo cáo tiếp theo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Dock Header Info */}
            <div className="rr-dock-header-info">
              <div className="rr-dock-header-row">
                {getReportStatus(selected) === 'PENDING' && (
                  <span className="rr-status-pill rr-status-pending">
                    <span className="rr-status-dot" /> Chờ xử lý
                  </span>
                )}
                {getReportStatus(selected) === 'UNDER_REVIEW' && (
                  <span className="rr-status-pill rr-status-under-review">
                    <span className="rr-status-dot" /> Đang xem xét
                  </span>
                )}
                {getReportStatus(selected) === 'RESOLVED' && (
                  <span className="rr-status-pill rr-status-resolved">
                    <span className="rr-status-dot" /> Đã xử lý
                  </span>
                )}
                <span className="rr-dock-report-code">{getReportCode(selected)}</span>
              </div>
              <div className="rr-dock-report-time">
                Báo cáo lúc: {formatReportedTime(selected.reportedAt)}
              </div>
            </div>

            {/* Dock Body */}
            <div className="rr-dock-body">
              {/* Section 1: Nội dung đánh giá bị báo cáo */}
              <div className="rr-card-box">
                <h4 className="rr-card-title">Nội dung đánh giá bị báo cáo</h4>

                <div className="rr-review-user-row">
                  <div className="rr-user-identity">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
                      alt="avatar"
                      className="rr-party-avatar"
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                          {getCustomerName(selected)}
                        </span>
                        <span className="rr-customer-tag">Khách hàng</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {formatReportedTime(selected.createdAt || selected.reportedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="rr-stars">
                    {Array.from({ length: 5 }).map((_, sIdx) => (
                      <Star
                        key={sIdx}
                        size={13}
                        fill={sIdx < (selected.rating || 5) ? '#f59e0b' : 'none'}
                        color={sIdx < (selected.rating || 5) ? '#f59e0b' : '#cbd5e1'}
                      />
                    ))}
                  </div>
                </div>

                <div className="rr-review-comment-box">
                  "{selected.comment || 'Dịch vụ quá tệ, lừa đảo. Không nên đặt ở đây!!! Nhân viên thái độ rất kém, đồ cũ và dơ.'}"
                </div>

                {selected.images && selected.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginTop: '2px' }}>
                    {selected.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Đính kèm"
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Thông tin liên quan (2 mini cards) */}
              <div className="rr-two-cards-grid">
                {/* Đối tác / Sản phẩm */}
                <div className="rr-mini-card">
                  <span className="rr-mini-card-head">Đối tác / Sản phẩm</span>
                  <div className="rr-mini-card-body">
                    <img
                      src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=80&auto=format&fit=crop&q=80"
                      alt="thumb"
                      style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                    <div>
                      <div className="rr-mini-card-title">{getProviderName(selected)}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>{getProviderCode(selected)}</div>
                      <a href={`/admin/partners`} target="_blank" rel="noreferrer" className="rr-mini-card-link">
                        Xem trang
                      </a>
                    </div>
                  </div>
                </div>

                {/* Đơn đặt lịch */}
                <div className="rr-mini-card">
                  <span className="rr-mini-card-head">Đơn đặt lịch</span>
                  <div className="rr-mini-card-body">
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        background: '#fff1f2',
                        color: '#be123c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Calendar size={17} />
                    </div>
                    <div>
                      <div className="rr-mini-card-title">{getBookingCode(selected)}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        {formatDateOnly(selected.bookingId?.createdAt || selected.createdAt)}
                      </div>
                      <a href={`/admin/bookings`} target="_blank" rel="noreferrer" className="rr-mini-card-link">
                        Xem chi tiết
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Thông tin báo cáo */}
              <div className="rr-card-box">
                <h4 className="rr-card-title">Thông tin báo cáo</h4>

                <div className="rr-report-meta-row">
                  <div>
                    <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 700 }}>
                      Người báo cáo:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <img
                        src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80"
                        alt="reporter"
                        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <strong style={{ fontSize: '12px', color: '#0f172a' }}>{getReporterName(selected)}</strong>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>{getReporterCode(selected)}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 700 }}>
                      Lý do báo cáo:
                    </span>
                    <span className="rr-reason-badge" style={{ marginTop: '2px' }}>
                      <Flag size={11} /> {getReportReason(selected)}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                    Mô tả thêm:
                  </span>
                  <div className="rr-report-desc-box">
                    "{selected.reportDescription || 'Sử dụng từ ngữ thô tục, xúc phạm đối tác. Đề nghị kiểm tra và gỡ bỏ.'}"
                  </div>
                </div>
              </div>

              {/* Section 4: Lịch sử xử lý */}
              <div className="rr-card-box">
                <h4 className="rr-card-title">Lịch sử xử lý</h4>

                <div className="rr-timeline-list">
                  <div className="rr-timeline-item">
                    <div className="rr-timeline-dot" />
                    <div className="rr-timeline-time">{formatReportedTime(selected.reportedAt)}</div>
                    <div className="rr-timeline-desc">
                      Khách hàng {getReporterName(selected)} đã gửi báo cáo.
                    </div>
                  </div>

                  <div className="rr-timeline-item" style={{ paddingBottom: 0 }}>
                    <div className="rr-timeline-dot" />
                    <div className="rr-timeline-time">
                      {formatReportedTime(new Date(new Date(selected.reportedAt || 0).getTime() + 8 * 60 * 1000))}
                    </div>
                    <div className="rr-timeline-desc">Hệ thống tiếp nhận báo cáo.</div>
                  </div>

                  {selected.historyTimeline &&
                    selected.historyTimeline.map((item, hIdx) => (
                      <div key={hIdx} className="rr-timeline-item" style={{ paddingTop: '10px' }}>
                        <div className="rr-timeline-dot" style={{ borderColor: '#059669' }} />
                        <div className="rr-timeline-time">{formatReportedTime(item.timestamp)}</div>
                        <div className="rr-timeline-desc" style={{ color: '#065f46', fontWeight: 600 }}>
                          {item.title}: {item.description}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Section 5: Action Buttons (2 Rows) */}
            <div className="rr-dock-actions">
              {/* Row 1: Khác, Bỏ qua, Xác nhận */}
              <div className="rr-actions-row">
                <button
                  type="button"
                  className="rr-btn-more"
                  onClick={() =>
                    handleAction(
                      'UNDER_REVIEW',
                      'Đưa báo cáo vào trạng thái Đang xem xét?',
                      'Đang tiến hành đối soát và xác minh bổ sung.'
                    )
                  }
                  title="Chuyển trạng thái Đang xem xét"
                >
                  <MoreVertical size={14} style={{ display: 'inline' }} /> Khác
                </button>

                <button
                  type="button"
                  className="rr-btn-dismiss"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'DISMISS',
                      'Bỏ qua báo cáo vi phạm?',
                      'Báo cáo không vi phạm tiêu chuẩn, giữ nguyên đánh giá.'
                    )
                  }
                >
                  <X size={14} />
                  <span>Bỏ qua</span>
                </button>

                <button
                  type="button"
                  className="rr-btn-acknowledge"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'CONFIRM',
                      'Xác nhận báo cáo vi phạm?',
                      'Xác nhận nội dung đánh giá có vi phạm tiêu chuẩn cộng đồng.'
                    )
                  }
                >
                  <Check size={14} />
                  <span>Xác nhận</span>
                </button>
              </div>

              {/* Row 2: Ẩn đánh giá, Xác nhận xử lý */}
              <div className="rr-actions-row">
                <button
                  type="button"
                  className="rr-btn-hide"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'HIDE',
                      'Ẩn đánh giá này khỏi trang sản phẩm?',
                      'Ẩn đánh giá do ngôn từ không phù hợp với tiêu chuẩn.'
                    )
                  }
                >
                  <EyeOff size={14} />
                  <span>Ẩn đánh giá</span>
                </button>

                <button
                  type="button"
                  className="rr-btn-resolve"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'DELETE',
                      'Xác nhận xử lý dứt điểm báo cáo này?',
                      'Xác nhận xử lý báo cáo và gỡ bỏ đánh giá vi phạm.'
                    )
                  }
                >
                  <CheckCircle2 size={14} />
                  <span>Xác nhận xử lý</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: Hướng Dẫn Quy Trình Xử Lý Báo Cáo */}
      {showGuideModal && (
        <div className="rr-modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="rr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rr-modal-header">
              <h3>Quy trình chuẩn kiểm duyệt &amp; xử lý báo cáo đánh giá</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setShowGuideModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="rr-modal-body">
              <div className="rr-step-card">
                <div className="rr-step-badge">1</div>
                <div className="rr-step-content">
                  <h4>Tiếp nhận báo cáo từ người dùng / đối tác</h4>
                  <p>
                    Hệ thống tự động ghi nhận báo cáo khi có khiếu nại về bình luận thô tục, quảng cáo spam, hoặc bôi nhọ sai sự thật.
                  </p>
                </div>
              </div>

              <div className="rr-step-card">
                <div className="rr-step-badge">2</div>
                <div className="rr-step-content">
                  <h4>Đối soát đơn hàng &amp; ngữ cảnh đánh giá</h4>
                  <p>
                    Admin mở xem xét chi tiết mã đơn `#BK...`, ngày thuê, biên bản bàn giao đồ và toàn văn bình luận để xác minh tính chân thực.
                  </p>
                </div>
              </div>

              <div className="rr-step-card">
                <div className="rr-step-badge">3</div>
                <div className="rr-step-content">
                  <h4>Lựa chọn hình thức chế tài phù hợp</h4>
                  <p>
                    - <strong>Ẩn đánh giá</strong>: Tạm ẩn hoặc gỡ bỏ đánh giá vi phạm thuần phong mỹ tục hoặc spam quảng cáo.<br />
                    - <strong>Bỏ qua</strong>: Nếu đánh giá là phản ánh trải nghiệm thật của khách hàng, tôn trọng tự do đánh giá.<br />
                    - <strong>Đang xem xét</strong>: Yêu cầu đối soát thêm thông tin giữa 2 bên.
                  </p>
                </div>
              </div>

              <div className="rr-step-card">
                <div className="rr-step-badge">4</div>
                <div className="rr-step-content">
                  <h4>Ghi nhận lịch sử &amp; gửi thông báo điện tử</h4>
                  <p>
                    Mọi thao tác của Admin được lưu vào chuỗi lịch sử timeline và hệ thống tự động gửi thông báo đến tài khoản khách hàng lẫn đối tác.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
