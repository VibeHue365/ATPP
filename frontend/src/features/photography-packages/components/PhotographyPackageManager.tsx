import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FileEdit,
  Layers,
  LoaderCircle,
  PauseCircle,
  Plus,
  Search,
} from 'lucide-react';
import { useToast } from '../../../components/feedback/Toast';
import { usePhotographyPackages } from '../hooks/usePhotographyPackages';
import type { PhotographyPackage, PhotographyPackagePayload } from '../types/photographyPackage.types';
import { PhotographyPackageCard } from './PhotographyPackageCard';
import { PhotographyPackageFormModal } from './PhotographyPackageFormModal';
import { categoryService } from '../../categories/services/categoryService';
import './photographyPackages.css';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

interface PhotographyPackageManagerProps {
  enabled: boolean;
}

type StatusFilter = 'all' | 'active' | 'draft' | 'inactive';
type SortOption = 'newest' | 'price-desc' | 'price-asc' | 'duration';

export function PhotographyPackageManager({ enabled }: PhotographyPackageManagerProps) {
  const toast = useToast();
  const { packages, isLoading, error, refresh, create, update, publish, unpublish, remove } =
    usePhotographyPackages(enabled);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PhotographyPackage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Categories map for friendly label display on cards
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [conceptMap, setConceptMap] = useState<Record<string, string>>({});

  // Toolbar states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Fetch categories for name resolution
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.all([
      categoryService.getPublic({ type: 'PHOTOGRAPHY_CATEGORY' }),
      categoryService.getPublic({ type: 'CONCEPT' }),
      categoryService.getPublic({ type: 'STYLE' }),
      categoryService.getPublic({ type: 'EVENT' }),
    ])
      .then(([pkgs, concepts, styles, events]) => {
        if (!active) return;
        const catObj: Record<string, string> = {};
        pkgs.forEach((c) => {
          catObj[c.id] = c.name;
        });
        setCategoryMap(catObj);

        const conObj: Record<string, string> = {};
        [...concepts, ...styles, ...events].forEach((c) => {
          conObj[c.id] = c.name;
        });
        setConceptMap(conObj);
      })
      .catch(() => {
        // Soft fail; fallback to raw IDs
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  // KPI Metrics Calculation
  const summary = useMemo(() => {
    const total = packages.length;
    let active = 0;
    let draft = 0;
    let inactive = 0;

    packages.forEach((item) => {
      if (item.status === 'ACTIVE') active++;
      else if (item.status === 'DRAFT') draft++;
      else if (item.status === 'INACTIVE') inactive++;
    });

    return { total, active, draft, inactive };
  }, [packages]);

  // Filtering & Sorting
  const filteredPackages = useMemo(() => {
    return packages
      .filter((pkg) => {
        // Status filter
        if (statusFilter === 'active' && pkg.status !== 'ACTIVE') return false;
        if (statusFilter === 'draft' && pkg.status !== 'DRAFT') return false;
        if (statusFilter === 'inactive' && pkg.status !== 'INACTIVE') return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = (pkg.name || '').toLowerCase().includes(q);
          const descMatch = (pkg.description || '').toLowerCase().includes(q);
          const categoryName = pkg.categoryId ? categoryMap[pkg.categoryId] || '' : '';
          const categoryMatch = categoryName.toLowerCase().includes(q);
          const tagMatch = (pkg.conceptCategoryIds || []).some((id) =>
            (conceptMap[id] || '').toLowerCase().includes(q)
          );

          if (!nameMatch && !descMatch && !categoryMatch && !tagMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'price-desc') return (b.price || 0) - (a.price || 0);
        if (sortOption === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (sortOption === 'duration') return (b.durationHours || 0) - (a.durationHours || 0);
        // Default: newest first
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [packages, statusFilter, searchQuery, sortOption, categoryMap, conceptMap]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOption]);

  // Pagination slice
  const totalItems = filteredPackages.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedPackages = filteredPackages.slice(startIndex, startIndex + pageSize);

  const startDisplay = totalItems === 0 ? 0 : startIndex + 1;
  const endDisplay = Math.min(startIndex + pageSize, totalItems);

  if (!enabled) return null;

  const openCreate = () => {
    setEditingPackage(null);
    setIsFormOpen(true);
  };

  const handleOpenPublicPage = () => {
    window.open('/photographers', '_blank');
  };

  const submit = async (payload: PhotographyPackagePayload) => {
    setIsSaving(true);
    try {
      if (editingPackage) {
        await update(editingPackage._id, payload);
        toast.success(
          payload.status === 'ACTIVE'
            ? 'Đã cập nhật và đăng bán gói chụp ảnh.'
            : 'Đã lưu thay đổi vào bản nháp.'
        );
      } else {
        await create(payload);
        toast.success(
          payload.status === 'ACTIVE'
            ? 'Đã tạo và đăng bán gói chụp ảnh thành công!'
            : 'Đã lưu gói chụp ảnh vào bản nháp.'
        );
      }
      setIsFormOpen(false);
      setEditingPackage(null);
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, 'Không thể lưu gói chụp ảnh.'));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublication = async (item: PhotographyPackage) => {
    const shouldUnpublish = item.status === 'ACTIVE';
    if (
      shouldUnpublish &&
      !window.confirm(`Tạm ngưng gói chụp “${item.name}”? Khách hàng sẽ tạm thời không thể đặt gói này.`)
    ) {
      return;
    }
    setBusyId(item._id);
    try {
      if (shouldUnpublish) {
        await unpublish(item._id);
        toast.success('Đã tạm ngưng gói chụp.');
      } else {
        await publish(item._id);
        toast.success('Gói chụp đã được đăng bán công khai.');
      }
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, 'Không thể cập nhật trạng thái gói chụp.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePackage = async (item: PhotographyPackage) => {
    setBusyId(item._id);
    try {
      await remove(item._id);
      toast.success(`Đã xóa gói chụp "${item.name}".`);
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, 'Không thể xóa gói chụp ảnh.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="photography-package-manager">
      {/* ==================== 1. TOP HEADER ==================== */}
      <header className="photography-package-manager__header">
        <div className="photography-package-manager__header-left">
          <div className="photography-package-manager__icon-box">
            <Camera size={24} />
          </div>
          <div className="photography-package-manager__title-wrap">
            <p className="photography-package-manager__eyebrow">
              <Camera size={14} /> DỊCH VỤ NHIẾP ẢNH & GÓI CHỤP
            </p>
            <h1 className="photography-package-manager__title">Quản lý gói chụp ảnh</h1>
            <p className="photography-package-manager__subtitle">
              Tạo và quản lý các gói dịch vụ chụp ảnh với quyền lợi, thời lượng và ảnh thành phẩm rõ ràng để khách hàng dễ dàng đặt lịch.
            </p>
          </div>
        </div>

        <div className="photography-package-manager__header-actions">
          <button
            type="button"
            className="photography-package-button photography-package-button--secondary"
            onClick={handleOpenPublicPage}
            title="Xem danh mục dịch vụ công khai"
          >
            <Eye size={15} />
            <span>Xem trang công khai</span>
          </button>

          <button
            type="button"
            className="photography-package-button photography-package-button--primary"
            onClick={openCreate}
          >
            <Plus size={16} />
            <span>Tạo gói chụp</span>
          </button>
        </div>
      </header>

      {/* ==================== 2. 4 METRIC CARDS (FIGMA 382-1283) ==================== */}
      <section className="photography-package-manager__metrics" aria-label="Thống kê gói chụp ảnh">
        {/* Card 1: Tổng số gói */}
        <div className="photography-package-metric-card photography-package-metric-card--total">
          <div className="photography-package-metric-card__top">
            <span className="photography-package-metric-card__label">Tổng gói chụp</span>
            <div className="photography-package-metric-card__icon-box photography-package-metric-card__icon-box--total">
              <Layers size={20} />
            </div>
          </div>
          <div className="photography-package-metric-card__bottom">
            <span className="photography-package-metric-card__value">{summary.total}</span>
            <span className="photography-package-metric-card__subtext">Dịch vụ đã tạo</span>
          </div>
        </div>

        {/* Card 2: Đang hoạt động */}
        <div className="photography-package-metric-card photography-package-metric-card--active">
          <div className="photography-package-metric-card__top">
            <span className="photography-package-metric-card__label">Đang hoạt động</span>
            <div className="photography-package-metric-card__icon-box photography-package-metric-card__icon-box--active">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="photography-package-metric-card__bottom">
            <span className="photography-package-metric-card__value">{summary.active}</span>
            <span className="photography-package-metric-card__subtext">Đang nhận đặt lịch</span>
          </div>
        </div>

        {/* Card 3: Bản nháp */}
        <div className="photography-package-metric-card photography-package-metric-card--draft">
          <div className="photography-package-metric-card__top">
            <span className="photography-package-metric-card__label">Bản nháp</span>
            <div className="photography-package-metric-card__icon-box photography-package-metric-card__icon-box--draft">
              <FileEdit size={20} />
            </div>
          </div>
          <div className="photography-package-metric-card__bottom">
            <span className="photography-package-metric-card__value">{summary.draft}</span>
            <span className="photography-package-metric-card__subtext">Chưa xuất bản</span>
          </div>
        </div>

        {/* Card 4: Tạm ngưng */}
        <div className="photography-package-metric-card photography-package-metric-card--inactive">
          <div className="photography-package-metric-card__top">
            <span className="photography-package-metric-card__label">Tạm ngưng</span>
            <div className="photography-package-metric-card__icon-box photography-package-metric-card__icon-box--inactive">
              <PauseCircle size={20} />
            </div>
          </div>
          <div className="photography-package-metric-card__bottom">
            <span className="photography-package-metric-card__value">{summary.inactive}</span>
            <span className="photography-package-metric-card__subtext">Tạm ẩn trên sàn</span>
          </div>
        </div>
      </section>

      {/* ==================== 3. TOOLBAR ==================== */}
      <section className="photography-package-manager__toolbar">
        {/* Search Input */}
        <div className="photography-package-manager__search-wrap">
          <Search size={16} className="photography-package-manager__search-icon" />
          <input
            type="text"
            className="photography-package-manager__search-input"
            placeholder="Tìm kiếm theo tên gói chụp, phong cách, concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters Group */}
        <div className="photography-package-manager__filters-group">
          {/* Status Pills */}
          <div className="photography-package-manager__status-pills">
            <button
              type="button"
              className={`photography-package-manager__pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>Tất cả</span>
              <span className="photography-package-manager__pill-badge">{summary.total}</span>
            </button>

            <button
              type="button"
              className={`photography-package-manager__pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              <span className="photography-package-manager__dot photography-package-manager__dot--green" />
              <span>Đang hoạt động</span>
              <span className="photography-package-manager__pill-badge">{summary.active}</span>
            </button>

            <button
              type="button"
              className={`photography-package-manager__pill ${statusFilter === 'draft' ? 'active' : ''}`}
              onClick={() => setStatusFilter('draft')}
            >
              <span className="photography-package-manager__dot photography-package-manager__dot--amber" />
              <span>Bản nháp</span>
              <span className="photography-package-manager__pill-badge">{summary.draft}</span>
            </button>

            <button
              type="button"
              className={`photography-package-manager__pill ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              <span className="photography-package-manager__dot photography-package-manager__dot--slate" />
              <span>Tạm ngưng</span>
              <span className="photography-package-manager__pill-badge">{summary.inactive}</span>
            </button>
          </div>

          {/* Sort Select */}
          <select
            className="photography-package-manager__sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          >
            <option value="newest">Mới nhất</option>
            <option value="price-desc">Giá: Cao đến Thấp</option>
            <option value="price-asc">Giá: Thấp đến Cao</option>
            <option value="duration">Thời lượng chụp</option>
          </select>
        </div>
      </section>

      {/* ==================== 4. LISTING / STATES ==================== */}
      {isLoading ? (
        <div className="photography-package-manager__state">
          <LoaderCircle className="photography-package-form__spin" size={24} />
          <span>Đang tải danh sách gói chụp ảnh...</span>
        </div>
      ) : error ? (
        <div className="photography-package-manager__state photography-package-manager__state--error">
          <CircleAlert size={20} />
          <span>{error}</span>
          <button type="button" onClick={() => void refresh()}>
            Thử lại
          </button>
        </div>
      ) : packages.length === 0 ? (
        <section className="photography-package-manager__empty">
          <div className="photography-package-manager__empty-icon">
            <Camera size={32} />
          </div>
          <h3>Bạn chưa có gói chụp ảnh nào</h3>
          <p>
            Tạo các gói dịch vụ giúp khách hàng hiểu rõ giá cả, thời lượng, số lượng ảnh chỉnh sửa và dễ dàng đặt lịch với bạn.
          </p>
          <button
            type="button"
            className="photography-package-button photography-package-button--primary"
            onClick={openCreate}
          >
            <Plus size={16} /> Tạo gói chụp đầu tiên
          </button>
        </section>
      ) : filteredPackages.length === 0 ? (
        <section className="photography-package-manager__empty">
          <div className="photography-package-manager__empty-icon">
            <Search size={28} />
          </div>
          <h3>Không tìm thấy gói chụp nào phù hợp</h3>
          <p>Thử điều chỉnh từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.</p>
          <button
            type="button"
            className="photography-package-button photography-package-button--secondary"
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
          <section className="photography-package-manager__grid">
            {paginatedPackages.map((item) => {
              const categoryName = item.categoryId ? categoryMap[item.categoryId] : undefined;
              const conceptNames = (item.conceptCategoryIds || [])
                .map((id) => conceptMap[id])
                .filter(Boolean);

              return (
                <PhotographyPackageCard
                  key={item._id}
                  photographyPackage={item}
                  categoryName={categoryName}
                  conceptNames={conceptNames}
                  isBusy={busyId === item._id}
                  onEdit={(selected) => {
                    setEditingPackage(selected);
                    setIsFormOpen(true);
                  }}
                  onTogglePublication={(selected) => void togglePublication(selected)}
                  onDelete={(selected) => void handleDeletePackage(selected)}
                />
              );
            })}
          </section>

          {/* ==================== 5. PAGINATION ==================== */}
          {totalPages > 1 && (
            <footer className="photography-package-manager__pagination">
              <span className="photography-package-manager__pagination-info">
                Hiển thị {startDisplay} - {endDisplay} của {totalItems} gói chụp
              </span>

              <div className="photography-package-manager__pagination-controls">
                <button
                  type="button"
                  className="photography-package-manager__page-btn"
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
                    className={`photography-package-manager__page-btn ${
                      validCurrentPage === page ? 'active' : ''
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="photography-package-manager__page-btn"
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

      {/* ==================== 6. MODAL (OPTION 1) ==================== */}
      {isFormOpen && (
        <PhotographyPackageFormModal
          isOpen
          isSaving={isSaving}
          initialPackage={editingPackage}
          onClose={() => {
            if (!isSaving) {
              setIsFormOpen(false);
              setEditingPackage(null);
            }
          }}
          onSubmit={submit}
        />
      )}
    </main>
  );
}
