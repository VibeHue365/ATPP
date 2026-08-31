import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, PackageOpen, Scissors, Camera } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { ROUTES } from '../../config/routes';
import { ComboFigmaHero } from '../../features/combos/components/ComboFigmaHero';
import {
  ComboCategoryTabs,
  type ComboCategoryTabKey,
  type ComboCategoryCounts
} from '../../features/combos/components/ComboCategoryTabs';
import {
  ComboSidebarFilter,
  type SidebarFilterValues,
  type FilterOptionWithCount
} from '../../features/combos/components/ComboSidebarFilter';
import { ComboFigmaCard } from '../../features/combos/components/ComboFigmaCard';
import { calculateComboPricing, resolveImageUrl } from '../../features/combos/mappers/combo.mapper';
import type { FigmaComboItem } from '../../features/combos/types/combo.types';
import './ComboListingPage.css';

const DEFAULT_SIDEBAR_VALUES: SidebarFilterValues = {
  regions: [],
  types: [],
  minPrice: 500000,
  maxPrice: 5000000,
  presetPrice: null,
  sortBy: 'popular',
};

const BASE_REGIONS = ['Huế', 'Đà Nẵng', 'Hội An', 'Đà Lạt', 'Hà Nội', 'TP.HCM'];
const BASE_TYPES = ['Ngoại cảnh', 'Studio', 'Cặp đôi', 'Gia đình', 'Sự kiện'];

export const ComboListingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Top Hero Search States
  const [heroRegion, setHeroRegion] = useState('all');
  const [heroDate, setHeroDate] = useState('');
  const [heroPeople, setHeroPeople] = useState('all');
  const [heroBudget, setHeroBudget] = useState('all');

  // Category Tab state
  const [activeCategoryTab, setActiveCategoryTab] = useState<ComboCategoryTabKey>('all');

  // Sidebar Filter States
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterValues>(DEFAULT_SIDEBAR_VALUES);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Real Dynamic API combos
  const [combos, setCombos] = useState<FigmaComboItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real combos from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchApiCombos = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<any[]>('/combo-promotions/public');
        if (isMounted) {
          if (Array.isArray(data) && data.length > 0) {
            const mapped: FigmaComboItem[] = data
              .filter((c) => c && c.productId && c.photographyPackageId)
              .map((c, idx) => {
                const { originalPrice, discountedPrice } = calculateComboPricing(c);
                const discount = c.discountPercent || 0;
                const people = c.shootPeopleCount || c.photographyPackageId?.maxPeople || 2;
                const regionName = c.providerId?.address?.city || c.productId?.location || 'Huế';

                // Determine location type
                const pkgName = (c.photographyPackageId?.name || '').toLowerCase();
                let locType: 'Ngoại cảnh' | 'Studio' | 'Cặp đôi' | 'Gia đình' | 'Sự kiện' = 'Ngoại cảnh';
                if (pkgName.includes('studio') || pkgName.includes('phông')) {
                  locType = 'Studio';
                } else if (pkgName.includes('couple') || pkgName.includes('đôi') || people === 2) {
                  locType = 'Cặp đôi';
                } else if (pkgName.includes('gia đình') || pkgName.includes('family') || people >= 4) {
                  locType = 'Gia đình';
                } else if (pkgName.includes('sự kiện') || pkgName.includes('event')) {
                  locType = 'Sự kiện';
                }

                // Determine badge
                let badgeText = `GIẢM ${discount}%`;
                let badgeType: 'dark' | 'red' | 'navy' | 'brown' | 'gold' | 'pink' | 'purple' | 'green' = 'red';
                if (idx === 0) {
                  badgeText = 'BEST SELLER';
                  badgeType = 'dark';
                } else if (discount >= 25) {
                  badgeText = `TIẾT KIỆM ${discount}%`;
                  badgeType = 'red';
                } else if (locType === 'Studio') {
                  badgeText = 'Studio';
                  badgeType = 'brown';
                } else if (locType === 'Cặp đôi') {
                  badgeText = 'COUPLE';
                  badgeType = 'pink';
                }

                return {
                  id: c._id,
                  badge: {
                    text: badgeText,
                    type: badgeType,
                  },
                  title: c.name || 'Combo Áo Dài & Chụp Ảnh',
                  location: locType,
                  locationType: locType,
                  region: regionName as any,
                  people: `${people} người`,
                  peopleCategory: people === 1 ? 'single' : people === 2 ? 'couple' : 'group',
                  description: `${c.productId?.name || 'Áo dài cao cấp'} + ${c.photographyPackageId?.name || 'Gói chụp ảnh nghệ thuật'}`,
                  price: discountedPrice,
                  oldPrice: originalPrice,
                  savingsText: `Tiết kiệm ${discount}%`,
                  discountPercent: discount,
                  image: resolveImageUrl(
                    c.photographyPackageId?.images?.[0] || c.productId?.images?.[0]
                  ),
                };
              });
            setCombos(mapped);
          } else {
            setCombos([]);
          }
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách combo:', err);
        if (isMounted) setCombos([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchApiCombos();
    return () => {
      isMounted = false;
    };
  }, []);

  // Backward-compatibility: auto redirect if ?select=id is provided in URL
  useEffect(() => {
    const selectId = new URLSearchParams(location.search).get('select');
    if (selectId) {
      navigate(`/combos/${selectId}`, { replace: true });
    }
  }, [location.search, navigate]);

  // Compute dynamic category counts
  const categoryCounts: ComboCategoryCounts = useMemo(() => {
    return {
      all: combos.length,
      hot: combos.filter((c) => c.discountPercent >= 20 || c.badge.text === 'BEST SELLER').length,
      savings: combos.filter((c) => c.discountPercent >= 15).length,
      outdoor: combos.filter((c) => c.locationType === 'Ngoại cảnh').length,
      studio: combos.filter((c) => c.locationType === 'Studio').length,
      couple: combos.filter((c) => c.locationType === 'Cặp đôi' || c.peopleCategory === 'couple').length,
    };
  }, [combos]);

  // Compute dynamic region options with real counts
  const regionOptions: FilterOptionWithCount[] = useMemo(() => {
    return BASE_REGIONS.map((reg) => ({
      label: reg,
      count: combos.filter((c) => c.region === reg).length,
    }));
  }, [combos]);

  // Compute dynamic type options with real counts
  const typeOptions: FilterOptionWithCount[] = useMemo(() => {
    return BASE_TYPES.map((t) => ({
      label: t,
      count: combos.filter((c) => c.locationType === t).length,
    }));
  }, [combos]);

  // Reset all filters
  const handleResetAll = () => {
    setSidebarFilters(DEFAULT_SIDEBAR_VALUES);
    setHeroRegion('all');
    setHeroPeople('all');
    setHeroBudget('all');
    setHeroDate('');
    setActiveCategoryTab('all');
    setCurrentPage(1);
  };

  const handleHeroSearch = () => {
    if (heroRegion !== 'all') {
      setSidebarFilters((prev) => ({ ...prev, regions: [heroRegion] }));
    }
    if (heroBudget === 'under_2m') {
      setSidebarFilters((prev) => ({ ...prev, maxPrice: 2000000, presetPrice: 'under_1m' }));
    } else if (heroBudget === '2m_3m') {
      setSidebarFilters((prev) => ({ ...prev, minPrice: 2000000, maxPrice: 3000000, presetPrice: '2m_3m' }));
    } else if (heroBudget === 'above_3m') {
      setSidebarFilters((prev) => ({ ...prev, minPrice: 3000000, maxPrice: 5000000, presetPrice: 'above_3m' }));
    }
    setCurrentPage(1);
  };

  // Filtered & Sorted combos
  const filteredCombos = useMemo(() => {
    return combos.filter((item) => {
      // 1. Category Tab Filter
      if (activeCategoryTab === 'hot' && item.discountPercent < 20 && item.badge.text !== 'BEST SELLER') {
        return false;
      }
      if (activeCategoryTab === 'savings' && item.discountPercent < 15) {
        return false;
      }
      if (activeCategoryTab === 'outdoor' && item.locationType !== 'Ngoại cảnh') {
        return false;
      }
      if (activeCategoryTab === 'studio' && item.locationType !== 'Studio') {
        return false;
      }
      if (activeCategoryTab === 'couple' && item.locationType !== 'Cặp đôi' && item.peopleCategory !== 'couple') {
        return false;
      }

      // 2. Region Filter
      if (sidebarFilters.regions.length > 0 && !sidebarFilters.regions.includes(item.region)) {
        return false;
      }

      // 3. Type Filter
      if (sidebarFilters.types.length > 0 && !sidebarFilters.types.includes(item.locationType)) {
        return false;
      }

      // 4. Price Filter
      if (item.price < sidebarFilters.minPrice || item.price > sidebarFilters.maxPrice) {
        return false;
      }

      return true;
    });
  }, [combos, activeCategoryTab, sidebarFilters]);

  // Sort
  const sortedCombos = useMemo(() => {
    const sorted = [...filteredCombos];
    switch (sidebarFilters.sortBy) {
      case 'newest':
        sorted.reverse();
        break;
      case 'price_low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'discount_high':
        sorted.sort((a, b) => b.discountPercent - a.discountPercent);
        break;
      case 'popular':
      default:
        break;
    }
    return sorted;
  }, [filteredCombos, sidebarFilters.sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedCombos.length / itemsPerPage);
  const paginatedCombos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedCombos.slice(start, start + itemsPerPage);
  }, [sortedCombos, currentPage, itemsPerPage]);

  const maxDiscount = useMemo(() => {
    if (combos.length === 0) return 0;
    return Math.max(...combos.map((c) => c.discountPercent || 0));
  }, [combos]);

  return (
    <main className="figma-combo-page">
      <div className="figma-combo-container">
        {/* 1. Hero Section + Floating Search Bar */}
        <ComboFigmaHero
          maxDiscount={maxDiscount}
          region={heroRegion}
          onRegionChange={setHeroRegion}
          date={heroDate}
          onDateChange={setHeroDate}
          peopleCount={heroPeople}
          onPeopleCountChange={setHeroPeople}
          budget={heroBudget}
          onBudgetChange={setHeroBudget}
          onSearch={handleHeroSearch}
        />

        {/* 2. Category Tabs Bar (6 Tabs) */}
        <ComboCategoryTabs
          activeTab={activeCategoryTab}
          onSelectTab={(tab) => {
            setActiveCategoryTab(tab);
            setCurrentPage(1);
          }}
          counts={categoryCounts}
        />

        {/* 3. Main 2-Column Section (Sidebar + Grid) */}
        <div className="figma-combo-main-layout">
          {/* Left Sidebar */}
          <ComboSidebarFilter
            values={sidebarFilters}
            onChange={(newValues) => {
              setSidebarFilters((prev) => ({ ...prev, ...newValues }));
              setCurrentPage(1);
            }}
            onResetAll={handleResetAll}
            regionOptions={regionOptions}
            typeOptions={typeOptions}
          />

          {/* Right Product Grid Column */}
          <section className="figma-combo-content-area" aria-label="Danh sách combo">
            {/* Header row above grid */}
            <div className="figma-combo-grid-header">
              <span className="grid-count-text">
                Hiển thị{' '}
                {sortedCombos.length > 0
                  ? `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, sortedCombos.length)}`
                  : '0'}{' '}
                trong <strong>{sortedCombos.length}</strong> combo
              </span>

              <div className="grid-sort-dropdown-wrapper">
                <span className="sort-prefix">Sắp xếp:</span>
                <div className="sort-select-box">
                  <select
                    value={sidebarFilters.sortBy}
                    onChange={(e) =>
                      setSidebarFilters((prev) => ({ ...prev, sortBy: e.target.value }))
                    }
                    className="grid-sort-select"
                  >
                    <option value="popular">Phổ biến nhất</option>
                    <option value="newest">Mới nhất</option>
                    <option value="price_low">Giá: Thấp đến cao</option>
                    <option value="price_high">Giá: Cao đến thấp</option>
                    <option value="discount_high">Tiết kiệm nhiều nhất</option>
                  </select>
                  <ChevronDown size={13} className="sort-arrow" />
                </div>
              </div>
            </div>

            {/* Skeleton Loading State */}
            {loading ? (
              <div className="lume-combo-skeleton-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="lume-combo-skeleton-card">
                    <div className="lume-combo-skeleton-img" />
                    <div className="lume-combo-skeleton-body">
                      <div className="lume-combo-skeleton-line short" />
                      <div className="lume-combo-skeleton-line" />
                      <div className="lume-combo-skeleton-line medium" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedCombos.length === 0 ? (
              /* Empty State */
              <div className="figma-combo-empty-state">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#C4B7A6' }}>
                  <PackageOpen size={48} />
                </div>
                <h4>
                  {combos.length === 0
                    ? 'Chưa có gói combo nào được tạo'
                    : 'Không tìm thấy combo phù hợp với bộ lọc'}
                </h4>
                <p>
                  {combos.length === 0
                    ? 'Các đối tác và studio đang chuẩn bị các gói combo ưu đãi mới. Hãy quay lại sau hoặc khám phá các dịch vụ riêng lẻ.'
                    : 'Thử điều chỉnh lại bộ lọc bên trái hoặc bấm Xóa tất cả để xem lại toàn bộ danh sách.'}
                </p>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                  {combos.length > 0 && (
                    <button
                      type="button"
                      className="empty-reset-btn"
                      onClick={handleResetAll}
                    >
                      Xóa tất cả bộ lọc
                    </button>
                  )}
                  <button
                    type="button"
                    className="figma-combo-empty-action-btn"
                    onClick={() => navigate(ROUTES.RENTALS)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ECE5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#231F20',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Scissors size={14} /> Khám phá Áo Dài
                  </button>
                  <button
                    type="button"
                    className="figma-combo-empty-action-btn"
                    onClick={() => navigate(ROUTES.PHOTOGRAPHERS)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #ECE5DB',
                      backgroundColor: '#FFFFFF',
                      color: '#231F20',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Camera size={14} /> Khám phá Thợ Ảnh
                  </button>
                </div>
              </div>
            ) : (
              /* 3-Column Card Grid */
              <div className="figma-combo-3col-grid">
                {paginatedCombos.map((item) => (
                  <ComboFigmaCard key={item.id} combo={item} />
                ))}
              </div>
            )}

            {/* Pagination Controls (Only render when more than 1 page) */}
            {!loading && totalPages > 1 && (
              <div className="figma-combo-pagination">
                <button
                  type="button"
                  className="pagination-arrow-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`pagination-num-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  className="pagination-arrow-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default ComboListingPage;
