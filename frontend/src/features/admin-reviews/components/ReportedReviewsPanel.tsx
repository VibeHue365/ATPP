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
  Calendar,
  EyeOff,
  Maximize2,
  Minimize2,
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

  // Selection & drawer state
  const [selected, setSelected] = useState<ReportedReview | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

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

  const getCustomerAvatar = (review: ReportedReview) => {
    const avatar = review.customerId?.profile?.avatarUrl;
    if (avatar && avatar.trim()) return avatar;
    const name = getCustomerName(review);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f1f5f9&color=475569&bold=true`;
  };

  const getProviderAvatar = (review: ReportedReview) => {
    const logo =
      review.providerId?.media?.logoUrl ||
      review.providerId?.profile?.avatarUrl ||
      review.providerId?.media?.coverUrl;
    if (logo && logo.trim()) return logo;

    const itemCover =
      review.bookingItemId?.coverImage ||
      review.bookingItemId?.productId?.coverImage ||
      review.bookingItemId?.productId?.images?.[0] ||
      review.bookingItemId?.photographyPackageId?.coverImageUrl ||
      review.bookingItemId?.photographyPackageId?.coverImage;
    if (itemCover && itemCover.trim()) return itemCover;

    const name = getProviderName(review);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fff1f2&color=be123c&bold=true`;
  };

  const getReporterAvatar = (review: ReportedReview) => {
    if (review.reporterAvatar && review.reporterAvatar.trim()) return review.reporterAvatar;
    const name = getReporterName(review);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f8fafc&color=334155&bold=true`;
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

  // Sync selected item if drawer is open and data updates
  useEffect(() => {
    if (isDetailOpen && selected) {
      const stillExists = filteredItems.find((d) => d._id === selected._id);
      if (stillExists) {
        setSelected(stillExists);
      }
    }
  }, [filteredItems, isDetailOpen, selected]);

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
        <div className="rr-table-container">
          <table className="rr-table">
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>#</th>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#64748b' }}>
                      Không tìm thấy báo cáo đánh giá nào phù hợp với bộ lọc.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((review, idx) => {
                  const isSelected = selected?._id === review._id && isDetailOpen;
                  const stt = (currentPage - 1) * pageSize + idx + 1;
                  const status = getReportStatus(review);
                  const rating = review.rating || 5;
                  const custName = getCustomerName(review);
                  const provName = getProviderName(review);

                  return (
                    <tr
                      key={review._id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => {
                        setSelected(review);
                        setIsDetailOpen(true);
                      }}
                    >
                      <td style={{ color: '#64748b', fontWeight: 600, textAlign: 'center' }}>{stt}</td>

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
                            src={getCustomerAvatar(review)}
                            alt={custName}
                            className="rr-party-avatar"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(custName)}&background=f1f5f9&color=475569`;
                            }}
                          />
                          <div className="rr-party-info">
                            <span className="rr-party-name">{custName}</span>
                            <span className="rr-party-code">{getCustomerCode(review)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Đối tác / Sản phẩm */}
                      <td>
                        <div className="rr-party-cell">
                          <img
                            src={getProviderAvatar(review)}
                            alt={provName}
                            className="rr-party-avatar"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(provName)}&background=fff1f2&color=be123c`;
                            }}
                          />
                          <div className="rr-party-info">
                            <span className="rr-party-name">{provName}</span>
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
                          className="rr-filter-btn"
                          style={{ padding: '5px 12px', fontSize: '11.5px', margin: 0, display: 'inline-flex' }}
                          title="Xem chi tiết báo cáo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(review);
                            setIsDetailOpen(true);
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

      </div>

      {/* Slide-Over Inspection Drawer */}
      {isDetailOpen && selected && (
        <>
          <div className="rr-drawer-backdrop" onClick={() => setIsDetailOpen(false)} />
          <aside className={`rr-detail-drawer ${isMaximized ? 'maximized' : ''}`}>
            {/* Drawer Header */}
            <div className="rr-drawer-header">
              <div className="rr-drawer-title-wrap">
                <div className="rr-drawer-heading-row">
                  <h2 className="rr-drawer-title">Chi tiết báo cáo</h2>
                  <span className="rr-drawer-code">{getReportCode(selected)}</span>
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
                </div>
                <span className="rr-drawer-timestamp">
                  Thời gian báo cáo: {formatReportedTime(selected.reportedAt)}
                </span>
              </div>

              <div className="rr-drawer-controls">
                {filteredItems.length > 1 && (
                  <div className="rr-drawer-nav-group">
                    <button
                      type="button"
                      className="rr-drawer-nav-btn"
                      disabled={selectedIndex <= 0}
                      onClick={handlePrevReport}
                      title="Báo cáo trước"
                    >
                      <ChevronLeft size={14} />
                      <span>Trước</span>
                    </button>
                    <span className="rr-drawer-nav-counter">
                      {selectedIndex + 1} / {filteredItems.length}
                    </span>
                    <button
                      type="button"
                      className="rr-drawer-nav-btn"
                      disabled={selectedIndex >= filteredItems.length - 1}
                      onClick={handleNextReport}
                      title="Báo cáo tiếp theo"
                    >
                      <span>Tiếp</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="rr-drawer-icon-btn"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Thu nhỏ giao diện' : 'Phóng to toàn màn hình'}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  type="button"
                  className="rr-drawer-icon-btn"
                  onClick={() => setIsDetailOpen(false)}
                  title="Đóng (Phím Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Body (2 Columns) */}
            <div className="rr-drawer-body">
              <div className="rr-drawer-grid-2col">
                {/* Left Column */}
                <div className="rr-drawer-col">
                  {/* Card 1: Review Content */}
                  <div className="rr-card-box">
                    <h4 className="rr-card-title">Nội dung đánh giá bị báo cáo</h4>

                    <div className="rr-review-user-row">
                      <div className="rr-user-identity">
                        <img
                          src={getCustomerAvatar(selected)}
                          alt={getCustomerName(selected)}
                          className="rr-party-avatar"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getCustomerName(selected))}&background=f1f5f9&color=475569`;
                          }}
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
                            size={14}
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
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                          Ảnh đính kèm từ khách hàng:
                        </span>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                          {selected.images.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt="Đính kèm"
                              style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '1px solid #e2e8f0',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: 2 Mini Cards */}
                  <div className="rr-two-cards-grid">
                    <div className="rr-mini-card">
                      <span className="rr-mini-card-head">Đối tác / Sản phẩm</span>
                      <div className="rr-mini-card-body">
                        <img
                          src={getProviderAvatar(selected)}
                          alt={getProviderName(selected)}
                          style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getProviderName(selected))}&background=fff1f2&color=be123c`;
                          }}
                        />
                        <div>
                          <div className="rr-mini-card-title">{getProviderName(selected)}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>{getProviderCode(selected)}</div>
                          <a href="/admin/dashboard?tab=product-moderation" target="_blank" rel="noreferrer" className="rr-mini-card-link">
                            Xem sản phẩm
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="rr-mini-card">
                      <span className="rr-mini-card-head">Đơn đặt lịch</span>
                      <div className="rr-mini-card-body">
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '6px',
                            background: '#fff1f2',
                            color: '#be123c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Calendar size={18} />
                        </div>
                        <div>
                          <div className="rr-mini-card-title">{getBookingCode(selected)}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {formatDateOnly(selected.bookingId?.createdAt || selected.createdAt)}
                          </div>
                          <a href="/admin/dashboard?tab=disputes" target="_blank" rel="noreferrer" className="rr-mini-card-link">
                            Xem đơn hàng
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Report Details */}
                  <div className="rr-card-box">
                    <h4 className="rr-card-title">Thông tin báo cáo</h4>

                    <div className="rr-report-meta-row">
                      <div>
                        <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 700 }}>
                          Người báo cáo:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <img
                            src={getReporterAvatar(selected)}
                            alt={getReporterName(selected)}
                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getReporterName(selected))}&background=f8fafc&color=334155`;
                            }}
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
                        Mô tả thêm từ người báo cáo:
                      </span>
                      <div className="rr-report-desc-box">
                        "{selected.reportDescription || 'Sử dụng từ ngữ thô tục, xúc phạm đối tác. Đề nghị kiểm tra và gỡ bỏ.'}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="rr-drawer-col">
                  {/* Card: Guide / Policy */}
                  <div className="rr-card-box" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <h4 className="rr-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HelpCircle size={15} color="#be123c" /> Hướng dẫn phán quyết kiểm duyệt
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <strong style={{ color: '#059669', minWidth: '85px' }}>Bỏ qua:</strong>
                        <span>Nếu đánh giá phản ánh đúng trải nghiệm của khách, không chứa ngôn từ thô tục/xúc phạm.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <strong style={{ color: '#d97706', minWidth: '85px' }}>Đang xem xét:</strong>
                        <span>Cần thêm thông tin từ đối tác hoặc liên hệ khách hàng để làm rõ tranh chấp.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <strong style={{ color: '#be123c', minWidth: '85px' }}>Ẩn đánh giá:</strong>
                        <span>Đánh giá chứa nội dung vi phạm tiêu chuẩn cộng đồng, tạm ẩn khỏi trang sản phẩm.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <strong style={{ color: '#881337', minWidth: '85px' }}>Xác nhận xử lý:</strong>
                        <span>Khẳng định vi phạm nặng, gỡ bỏ vĩnh viễn và áp dụng chế tài theo chính sách.</span>
                      </div>
                    </div>
                  </div>

                  {/* Card: Timeline */}
                  <div className="rr-card-box">
                    <h4 className="rr-card-title">Tiến trình & Lịch sử xử lý</h4>

                    <div className="rr-timeline-list">
                      <div className="rr-timeline-item">
                        <div className="rr-timeline-dot" />
                        <div className="rr-timeline-time">{formatReportedTime(selected.reportedAt)}</div>
                        <div className="rr-timeline-desc">
                          Khách hàng {getReporterName(selected)} đã gửi báo cáo vi phạm.
                        </div>
                      </div>

                      <div className="rr-timeline-item" style={{ paddingBottom: 0 }}>
                        <div className="rr-timeline-dot" />
                        <div className="rr-timeline-time">
                          {formatReportedTime(new Date(new Date(selected.reportedAt || 0).getTime() + 8 * 60 * 1000))}
                        </div>
                        <div className="rr-timeline-desc">Hệ thống tiếp nhận báo cáo vào danh sách kiểm duyệt.</div>
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
              </div>
            </div>

            {/* Drawer Sticky Footer with Moderation Actions */}
            <div className="rr-drawer-footer">
              <div className="rr-footer-left">
                <button
                  type="button"
                  className="rr-footer-btn-review"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'UNDER_REVIEW',
                      'Đưa báo cáo vào trạng thái Đang xem xét?',
                      'Đang tiến hành đối soát và xác minh bổ sung.'
                    )
                  }
                  title="Chuyển trạng thái Đang xem xét"
                >
                  <Clock size={15} />
                  <span>Đang xem xét</span>
                </button>

                <button
                  type="button"
                  className="rr-footer-btn-dismiss"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'DISMISS',
                      'Bỏ qua báo cáo vi phạm?',
                      'Báo cáo không vi phạm tiêu chuẩn, giữ nguyên đánh giá.'
                    )
                  }
                  title="Giữ nguyên đánh giá, đóng báo cáo"
                >
                  <X size={15} />
                  <span>Bỏ qua báo cáo</span>
                </button>
              </div>

              <div className="rr-footer-right">
                <button
                  type="button"
                  className="rr-footer-btn-hide"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'HIDE',
                      'Ẩn đánh giá này khỏi trang sản phẩm?',
                      'Ẩn đánh giá do ngôn từ không phù hợp với tiêu chuẩn.'
                    )
                  }
                  title="Tạm ẩn đánh giá khỏi hiển thị công khai"
                >
                  <EyeOff size={15} />
                  <span>Ẩn đánh giá</span>
                </button>

                <button
                  type="button"
                  className="rr-footer-btn-resolve"
                  disabled={isHandling}
                  onClick={() =>
                    handleAction(
                      'DELETE',
                      'Xác nhận xử lý dứt điểm báo cáo này?',
                      'Xác nhận xử lý báo cáo và gỡ bỏ đánh giá vi phạm.'
                    )
                  }
                  title="Xác nhận vi phạm và hoàn tất xử lý"
                >
                  <CheckCircle2 size={15} />
                  <span>Xác nhận xử lý</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

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
