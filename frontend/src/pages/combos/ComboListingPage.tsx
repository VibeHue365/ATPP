import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, PackageOpen, Scissors, Camera, MapPin, Sparkles, Calendar, Users } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { ROUTES } from '../../config/routes';
import { ListingHero } from '../../components/common/ListingHero';
import { UnifiedSearchBar, type SearchFieldConfig } from '../../components/common/UnifiedSearchBar';
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
import { useAuth } from '../../features/auth/hooks/useAuth';
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

  // User onboarding preferences
  const { user } = useAuth();
  const userPreferences = user?.preferences;
  const userHasOnboarding = Boolean(user?.hasCompletedOnboarding && userPreferences);
  const userPrefOccasion = userPreferences?.preferredOccasions?.[0] || '';
  const userPrefStyle = userPreferences?.preferredAoDaiStyles?.[0] || '';
  const userPrefSize = (userPreferences?.sizeInfo?.preferredSize || '').toUpperCase();

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

  const comboSearchFields: SearchFieldConfig[] = [
    {
      label: 'Khu vực',
      icon: <MapPin size={13} />,
      content: (
        <>
          <select
            value={heroRegion}
            onChange={(e) => setHeroRegion(e.target.value)}
            className="unified-search-select"
          >
            <option value="all">Tất cả khu vực</option>
            <option value="Huế">Huế</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
            <option value="Hội An">Hội An</option>
            <option value="Đà Lạt">Đà Lạt</option>
            <option value="Hà Nội">Hà Nội</option>
            <option value="TP.HCM">TP.HCM</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
    {
      label: 'Loại combo',
      icon: <Sparkles size={13} />,
      content: (
        <>
          <select
            value={heroBudget}
            onChange={(e) => setHeroBudget(e.target.value)}
            className="unified-search-select"
          >
            <option value="all">Tất cả loại combo</option>
            <option value="under_2m">Combo Tiết kiệm (&lt; 2tr)</option>
            <option value="2m_3m">Combo Tiêu chuẩn (2 - 3tr)</option>
            <option value="above_3m">Combo Cao cấp (&gt; 3tr)</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
    {
      label: 'Ngày chụp',
      icon: <Calendar size={13} />,
      content: (
        <input
          type="date"
          value={heroDate}
          onChange={(e) => setHeroDate(e.target.value)}
          className="unified-search-input"
        />
      ),
    },
    {
      label: 'Số người',
      icon: <Users size={13} />,
      content: (
        <>
          <select
            value={heroPeople}
            onChange={(e) => setHeroPeople(e.target.value)}
            className="unified-search-select"
          >
            <option value="all">Không giới hạn</option>
            <option value="1">1 người (Cá nhân)</option>
            <option value="2">2 người (Cặp đôi)</option>
            <option value="3-4">3 - 4 người (Nhóm)</option>
            <option value="5+">Từ 5 người (Gia đình)</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
  ];

  return (
    <main className="unified-listing-page">
      <div className="unified-listing-container">
        {/* 1. Unified Hero */}
        <ListingHero
          breadcrumbs={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Combo' },
          ]}
          eyebrow="COMBO TRỌN GÓI TIẾT KIỆM"
          title="Gói combo Áo dài & Chụp ảnh"
          description="Trải nghiệm trọn gói tiện lợi, đồng bộ phong cách với mức giá ưu đãi nhất."
          stats={[
            { value: `${combos.length > 0 ? combos.length : '30'}+`, label: 'Gói combo' },
            { value: `Tiết kiệm ${maxDiscount > 0 ? maxDiscount : 25}%`, label: 'Ưu đãi trọn gói' },
            { value: '4.9★', label: 'Hài lòng' },
          ]}
        />

        {/* 2. Unified Search Bar */}
        <UnifiedSearchBar
          fields={comboSearchFields}
          buttonText="Tìm combo"
          onSubmit={(e) => {
            e.preventDefault();
            handleHeroSearch();
          }}
        />

        {/* 3. Category Tabs Bar (6 Tabs) */}
        <ComboCategoryTabs
          activeTab={activeCategoryTab}
          onSelectTab={(tab) => {
            setActiveCategoryTab(tab);
            setCurrentPage(1);
          }}
          counts={categoryCounts}
        />

        {/* 4. Main 2-Column Section (Sidebar + Grid) */}
        <div className="unified-main-layout">
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
            userHasOnboarding={userHasOnboarding}
            userPrefOccasion={userPrefOccasion}
            userPrefStyle={userPrefStyle}
            userPrefSize={userPrefSize}
          />

          {/* Right Product Grid Column */}
          <section className="figma-combo-content-area" aria-label="Danh sách combo">
            {/* Top Results Toolbar */}
            <div className="figma-combo-results-toolbar">
              <div className="combo-toolbar-left">
                <h2 className="combo-toolbar-title">Gói combo Áo dài & Chụp ảnh</h2>
                <span className="combo-toolbar-subtitle">
                  {sortedCombos.length} gói combo phù hợp với bạn
                </span>
              </div>

              <div className="combo-sort-dropdown">
                <select
                  value={sidebarFilters.sortBy}
                  onChange={(e) =>
                    setSidebarFilters((prev) => ({ ...prev, sortBy: e.target.value }))
                  }
                  className="combo-sort-select"
                >
                  <option value="popular">Phổ biến nhất</option>
                  <option value="newest">Mới nhất</option>
                  <option value="price_low">Giá: Thấp đến cao</option>
                  <option value="price_high">Giá: Cao đến thấp</option>
                  <option value="discount_high">Tiết kiệm nhiều nhất</option>
                </select>
                <ChevronDown size={14} className="combo-sort-arrow" />
              </div>
            </div>

            {/* Promotional Banner Strip */}
            <div className="combo-promo-banner">
              <div className="combo-promo-left">
                <span className="combo-promo-tag">Tiết kiệm trọn gói</span>
                <h4 className="combo-promo-headline">
                  Gói Combo Áo Dài + Chụp ảnh ưu đãi lên đến 35% so với đặt riêng lẻ
                </h4>
              </div>
              <button
                type="button"
                onClick={() => navigate('/promotions')}
                className="combo-promo-link"
              >
                <span>Xem ưu đãi</span>
                <ChevronRight size={14} />
              </button>
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
