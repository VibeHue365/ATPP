import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Layers,
  LoaderCircle,
  Plus,
  Search,
} from 'lucide-react';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderPortfolioState } from './useProviderPortfolioState';
import { PortfolioCard } from './components/PortfolioCard';
import './portfolioFigma.css';

type PortfolioPanelProps = Pick<
  ReturnType<typeof useProviderPortfolioState>,
  | 'setIsPortfolioFormOpen'
  | 'portfolioItems'
  | 'hoveredItemId'
  | 'setHoveredItemId'
  | 'setPreviewPortfolioItem'
  | 'setPreviewImageIndex'
  | 'setEditingPortfolioItem'
> &
  Pick<ReturnType<typeof useProviderSessionState>, 'isLoadingProvider'> & {
    handleDeletePortfolioItem: (itemId: string) => Promise<void>;
  };

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected_or_hidden';
type SortOption = 'newest' | 'oldest' | 'most-photos' | 'title-asc';

export function PortfolioPanel({
  setIsPortfolioFormOpen,
  isLoadingProvider,
  portfolioItems,
  setPreviewPortfolioItem,
  setPreviewImageIndex,
  setEditingPortfolioItem,
  handleDeletePortfolioItem,
}: PortfolioPanelProps) {
  // Toolbar states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = portfolioItems.length;
    let approved = 0;
    let pending = 0;
    let inactive = 0;

    portfolioItems.forEach((item) => {
      if (item.moderationStatus === 'APPROVED') approved++;
      else if (item.moderationStatus === 'PENDING_REVIEW') pending++;
      else if (item.moderationStatus === 'REJECTED' || item.moderationStatus === 'HIDDEN') inactive++;
    });

    return { total, approved, pending, inactive };
  }, [portfolioItems]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return portfolioItems
      .filter((item) => {
        // Status filter
        if (statusFilter === 'approved' && item.moderationStatus !== 'APPROVED') return false;
        if (statusFilter === 'pending' && item.moderationStatus !== 'PENDING_REVIEW') return false;
        if (
          statusFilter === 'rejected_or_hidden' &&
          item.moderationStatus !== 'REJECTED' &&
          item.moderationStatus !== 'HIDDEN'
        ) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = (item.title || '').toLowerCase().includes(q);
          const descMatch = (item.description || '').toLowerCase().includes(q);
          if (!titleMatch && !descMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'oldest') {
          return (
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          );
        }
        if (sortOption === 'most-photos') {
          return (b.images?.length || 0) - (a.images?.length || 0);
        }
        if (sortOption === 'title-asc') {
          return (a.title || '').localeCompare(b.title || '', 'vi');
        }
        // Default: newest first
        return (
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
      });
  }, [portfolioItems, statusFilter, searchQuery, sortOption]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOption]);

  // Pagination calculation
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const startDisplay = totalItems === 0 ? 0 : startIndex + 1;
  const endDisplay = Math.min(startIndex + pageSize, totalItems);

  const handleOpenStore = () => {
    window.open('/photographers', '_blank');
  };

  const handlePreview = (item: typeof portfolioItems[0]) => {
    setPreviewPortfolioItem(item);
    setPreviewImageIndex(0);
  };

  const handleEdit = (item: typeof portfolioItems[0]) => {
    setEditingPortfolioItem(item);
    setIsPortfolioFormOpen(true);
  };

  return (
    <main className="portfolio-manager-root">
      {/* ==================== 1. TOP HEADER ==================== */}
      <header className="portfolio-header">
        <div className="portfolio-header__left">
          <div className="portfolio-header__icon-box">
            <Camera size={24} />
          </div>
          <div className="portfolio-header__title-wrap">
            <p className="portfolio-header__eyebrow">
              <Camera size={14} /> BỘ SƯU TẬP & TÁC PHẨM
            </p>
            <h1 className="portfolio-header__title">Quản lý Portfolio</h1>
            <p className="portfolio-header__subtitle">
              Đăng tải và quản lý các tác phẩm mẫu, dự án đã thực hiện để khách hàng chiêm ngưỡng phong cách và tay nghề của bạn.
            </p>
          </div>
        </div>

        <div className="portfolio-header__actions">
          <button
            type="button"
            className="portfolio-button portfolio-button--secondary"
            onClick={handleOpenStore}
            title="Xem hồ sơ nhiếp ảnh gia công khai"
          >
            <Eye size={15} />
            <span>Xem trang hồ sơ</span>
          </button>

          <button
            type="button"
            className="portfolio-button portfolio-button--primary"
            onClick={() => {
              setEditingPortfolioItem(null);
              setIsPortfolioFormOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Thêm tác phẩm mới</span>
          </button>
        </div>
      </header>

      {/* ==================== 2. 4 METRIC CARDS (FIGMA 382-2510) ==================== */}
      <section className="portfolio-metrics-grid" aria-label="Thống kê tác phẩm portfolio">
        {/* Card 1: Tổng tác phẩm */}
        <div className="portfolio-metric-card portfolio-metric-card--total">
          <div className="portfolio-metric-card__top">
            <span className="portfolio-metric-card__label">Tổng tác phẩm</span>
            <div className="portfolio-metric-card__icon-box portfolio-metric-card__icon-box--total">
              <Layers size={20} />
            </div>
          </div>
          <div className="portfolio-metric-card__bottom">
            <span className="portfolio-metric-card__value">{metrics.total}</span>
            <span className="portfolio-metric-card__subtext">Bộ ảnh đã tạo</span>
          </div>
        </div>

        {/* Card 2: Đã duyệt / Công khai */}
        <div className="portfolio-metric-card portfolio-metric-card--approved">
          <div className="portfolio-metric-card__top">
            <span className="portfolio-metric-card__label">Đã duyệt (Công khai)</span>
            <div className="portfolio-metric-card__icon-box portfolio-metric-card__icon-box--approved">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="portfolio-metric-card__bottom">
            <span className="portfolio-metric-card__value">{metrics.approved}</span>
            <span className="portfolio-metric-card__subtext">Hiển thị trên hồ sơ</span>
          </div>
        </div>

        {/* Card 3: Chờ duyệt */}
        <div className="portfolio-metric-card portfolio-metric-card--pending">
          <div className="portfolio-metric-card__top">
            <span className="portfolio-metric-card__label">Đang chờ duyệt</span>
            <div className="portfolio-metric-card__icon-box portfolio-metric-card__icon-box--pending">
              <Clock3 size={20} />
            </div>
          </div>
          <div className="portfolio-metric-card__bottom">
            <span className="portfolio-metric-card__value">{metrics.pending}</span>
            <span className="portfolio-metric-card__subtext">Ban quản trị xét duyệt</span>
          </div>
        </div>

        {/* Card 4: Tạm ẩn / Từ chối */}
        <div className="portfolio-metric-card portfolio-metric-card--inactive">
          <div className="portfolio-metric-card__top">
            <span className="portfolio-metric-card__label">Tạm ẩn / Từ chối</span>
            <div className="portfolio-metric-card__icon-box portfolio-metric-card__icon-box--inactive">
              <EyeOff size={20} />
            </div>
          </div>
          <div className="portfolio-metric-card__bottom">
            <span className="portfolio-metric-card__value">{metrics.inactive}</span>
            <span className="portfolio-metric-card__subtext">Không hiển thị</span>
          </div>
        </div>
      </section>

      {/* ==================== 3. TOOLBAR ==================== */}
      <section className="portfolio-toolbar">
        {/* Search Input */}
        <div className="portfolio-toolbar__search-wrap">
          <Search size={16} className="portfolio-toolbar__search-icon" />
          <input
            type="text"
            className="portfolio-toolbar__search-input"
            placeholder="Tìm kiếm theo tiêu đề hoặc mô tả tác phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills & Sort Select */}
        <div className="portfolio-toolbar__filters-group">
          <div className="portfolio-toolbar__status-pills">
            <button
              type="button"
              className={`portfolio-toolbar__pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>Tất cả</span>
              <span className="portfolio-toolbar__pill-badge">{metrics.total}</span>
            </button>

            <button
              type="button"
              className={`portfolio-toolbar__pill ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <span className="portfolio-toolbar__dot portfolio-toolbar__dot--green" />
              <span>Đã duyệt</span>
              <span className="portfolio-toolbar__pill-badge">{metrics.approved}</span>
            </button>

            <button
              type="button"
              className={`portfolio-toolbar__pill ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span className="portfolio-toolbar__dot portfolio-toolbar__dot--amber" />
              <span>Chờ duyệt</span>
              <span className="portfolio-toolbar__pill-badge">{metrics.pending}</span>
            </button>

            <button
              type="button"
              className={`portfolio-toolbar__pill ${statusFilter === 'rejected_or_hidden' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected_or_hidden')}
            >
              <span className="portfolio-toolbar__dot portfolio-toolbar__dot--slate" />
              <span>Tạm ẩn / Từ chối</span>
              <span className="portfolio-toolbar__pill-badge">{metrics.inactive}</span>
            </button>
          </div>

          <select
            className="portfolio-toolbar__sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="most-photos">Nhiều ảnh nhất</option>
            <option value="title-asc">Tên: A - Z</option>
          </select>
        </div>
      </section>

      {/* ==================== 4. LISTING / STATES ==================== */}
      {isLoadingProvider ? (
        <div className="portfolio-state-box">
          <LoaderCircle className="portfolio-spin" size={26} color="var(--pf-primary)" />
          <span style={{ fontSize: '14px', color: 'var(--pf-text-muted)' }}>Đang tải danh sách portfolio...</span>
        </div>
      ) : portfolioItems.length === 0 ? (
        <section className="portfolio-empty-state">
          <div className="portfolio-empty-state__icon-box">
            <Camera size={32} />
          </div>
          <h3>Chưa có tác phẩm nào trong Portfolio</h3>
          <p>
            Đăng tải các tác phẩm chất lượng cao để khách hàng chiêm ngưỡng phong cách chụp ảnh và tin tưởng đặt lịch với bạn.
          </p>
          <button
            type="button"
            className="portfolio-button portfolio-button--primary"
            onClick={() => {
              setEditingPortfolioItem(null);
              setIsPortfolioFormOpen(true);
            }}
          >
            <Plus size={16} /> Thêm tác phẩm đầu tiên
          </button>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className="portfolio-empty-state">
          <div className="portfolio-empty-state__icon-box">
            <Search size={28} />
          </div>
          <h3>Không tìm thấy tác phẩm phù hợp</h3>
          <p>Thử điều chỉnh từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.</p>
          <button
            type="button"
            className="portfolio-button portfolio-button--secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          >
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        <>
          <section className="portfolio-grid">
            {paginatedItems.map((item) => (
              <PortfolioCard
                key={item._id}
                portfolioItem={item}
                onPreview={handlePreview}
                onEdit={handleEdit}
                onDelete={handleDeletePortfolioItem}
              />
            ))}
          </section>

          {/* ==================== 5. PAGINATION ==================== */}
          {totalPages > 1 && (
            <footer className="portfolio-pagination">
              <span className="portfolio-pagination__info">
                Hiển thị {startDisplay} - {endDisplay} của {totalItems} tác phẩm
              </span>

              <div className="portfolio-pagination__controls">
                <button
                  type="button"
                  className="portfolio-pagination__btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`portfolio-pagination__btn ${
                      validCurrentPage === page ? 'active' : ''
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="portfolio-pagination__btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  title="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
