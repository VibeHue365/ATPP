import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, PackageOpen, Scissors, Camera, MapPin, Sparkles, Calendar, Users, Search } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { ROUTES } from '../../config/routes';
import { ListingHero } from '../../components/common/ListingHero';
import { UnifiedSearchBar, type SearchFieldConfig } from '../../components/common/UnifiedSearchBar';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ServiceDatePicker } from '../../components/common/ServiceDatePicker';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialRegion = (): string => {
    const loc = searchParams.get('location') || searchParams.get('region');
    return loc && loc !== 'all' ? loc : 'all';
  };

  const getInitialTab = (): ComboCategoryTabKey => {
    const concept = searchParams.get('concept');
    if (concept === 'ngoai-canh') return 'outdoor';
    if (concept === 'studio') return 'studio';
    if (concept === 'cap-doi') return 'couple';
    const tab = searchParams.get('tab');
    if (tab && ['all', 'hot', 'savings', 'outdoor', 'studio', 'couple'].includes(tab)) {
      return tab as ComboCategoryTabKey;
    }
    return 'all';
  };

  // Top Hero Search States
  const [comboSearchText, setComboSearchText] = useState<string>(
    searchParams.get('q') || searchParams.get('search') || ''
  );
  const [debouncedComboSearch, setDebouncedComboSearch] = useState(comboSearchText);
  const [heroRegion, setHeroRegion] = useState<string>(getInitialRegion);
  const [heroDate, setHeroDate] = useState<string>(searchParams.get('date') || '');
  const [heroPeople, setHeroPeople] = useState<string>(searchParams.get('people') || 'all');
  const [heroBudget, setHeroBudget] = useState<string>('all');

  // Debounce search text 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedComboSearch(comboSearchText);
    }, 300);
    return () => clearTimeout(handler);
  }, [comboSearchText]);

  // Sync debounced search to URL params and reset page
  useEffect(() => {
    const currentQ = searchParams.get('q') || searchParams.get('search') || '';
    if (debouncedComboSearch.trim() !== currentQ.trim()) {
      const params = new URLSearchParams(searchParams);
      if (debouncedComboSearch.trim()) {
        params.set('q', debouncedComboSearch.trim());
      } else {
        params.delete('q');
        params.delete('search');
      }
      setSearchParams(params, { replace: true });
      setCurrentPage(1);
    }
  }, [debouncedComboSearch]);

  // Category Tab state
  const [activeCategoryTab, setActiveCategoryTab] = useState<ComboCategoryTabKey>(getInitialTab);

  // Sidebar Filter States
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterValues>(() => {
    const reg = getInitialRegion();
    return { ...DEFAULT_SIDEBAR_VALUES, regions: reg !== 'all' ? [reg] : [] };
  });

  // Sync searchParams from URL whenever they change
  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('search');
    if (qParam !== null && qParam !== undefined && qParam !== comboSearchText) {
      setComboSearchText(qParam);
    }
    const loc = searchParams.get('location') || searchParams.get('region');
    const d = searchParams.get('date');
    const p = searchParams.get('people');
    const concept = searchParams.get('concept');
    const tab = searchParams.get('tab');

    if (loc !== null) {
      const reg = loc && loc !== 'all' ? loc : 'all';
      setHeroRegion(reg);
      setSidebarFilters((prev) => ({ ...prev, regions: reg !== 'all' ? [reg] : [] }));
    }
    if (d !== null) setHeroDate(d);
    if (p !== null) setHeroPeople(p);

    if (concept === 'ngoai-canh') setActiveCategoryTab('outdoor');
    else if (concept === 'studio') setActiveCategoryTab('studio');
    else if (concept === 'cap-doi') setActiveCategoryTab('couple');
    else if (tab && ['all', 'hot', 'savings', 'outdoor', 'studio', 'couple'].includes(tab)) {
      setActiveCategoryTab(tab as ComboCategoryTabKey);
    }
  }, [searchParams]);

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
    setComboSearchText('');
    setDebouncedComboSearch('');
    setActiveCategoryTab('all');
    setCurrentPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleHeroSearch = () => {
    const params = new URLSearchParams(searchParams);
    if (comboSearchText.trim()) {
      params.set('q', comboSearchText.trim());
      setDebouncedComboSearch(comboSearchText.trim());
    } else {
      params.delete('q');
      params.delete('search');
      setDebouncedComboSearch('');
    }

    if (heroRegion !== 'all') {
      params.set('location', heroRegion);
      setSidebarFilters((prev) => ({ ...prev, regions: [heroRegion] }));
    } else {
      params.delete('location');
      params.delete('region');
      setSidebarFilters((prev) => ({ ...prev, regions: [] }));
    }

    if (heroDate) {
      params.set('date', heroDate);
    } else {
      params.delete('date');
    }

    if (heroPeople !== 'all') {
      params.set('people', heroPeople);
    } else {
      params.delete('people');
    }

    if (heroBudget === 'under_2m') {
      setSidebarFilters((prev) => ({ ...prev, maxPrice: 2000000, presetPrice: 'under_1m' }));
    } else if (heroBudget === '2m_3m') {
      setSidebarFilters((prev) => ({ ...prev, minPrice: 2000000, maxPrice: 3000000, presetPrice: '2m_3m' }));
    } else if (heroBudget === 'above_3m') {
      setSidebarFilters((prev) => ({ ...prev, minPrice: 3000000, maxPrice: 5000000, presetPrice: 'above_3m' }));
    }
    setSearchParams(params, { replace: true });
    setCurrentPage(1);
  };

  // Filtered & Sorted combos
  const filteredCombos = useMemo(() => {
    return combos.filter((item) => {
      // 0. Keyword text search
      if (debouncedComboSearch.trim()) {
        const query = debouncedComboSearch.trim().toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(query);
        const matchDesc = (item.description || '').toLowerCase().includes(query);
        const matchRegion = (item.region || '').toLowerCase().includes(query);
        const matchType = (item.locationType || '').toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchRegion && !matchType) {
          return false;
        }
      }

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

      // 5. People Filter
      if (heroPeople !== 'all') {
        const count = parseInt(item.people, 10) || (item.peopleCategory === 'single' ? 1 : item.peopleCategory === 'couple' ? 2 : 4);
        if (heroPeople === '1' && count !== 1) return false;
        if (heroPeople === '2' && count !== 2) return false;
        if (heroPeople === '3-4' && (count < 3 || count > 4)) return false;
        if (heroPeople === '5+' && count < 5) return false;
      }

      return true;
    });
  }, [combos, activeCategoryTab, sidebarFilters, heroPeople, debouncedComboSearch]);

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
      label: 'Từ khóa',
      icon: <Search size={13} />,
      content: (
        <input
          type="text"
          className="unified-search-input"
          value={comboSearchText}
          onChange={(e) => setComboSearchText(e.target.value)}
          placeholder="Tên combo, áo dài..."
        />
      ),
    },
    {
      label: 'Khu vực',
      icon: <MapPin size={13} />,
      content: (
        <CustomSelect
          value={heroRegion}
          onChange={(val) => setHeroRegion(val)}
          options={[
            { value: 'all', label: 'Tất cả khu vực' },
            { value: 'Huế', label: 'Huế' },
            { value: 'Đà Nẵng', label: 'Đà Nẵng' },
            { value: 'Hội An', label: 'Hội An' },
            { value: 'Đà Lạt', label: 'Đà Lạt' },
            { value: 'Hà Nội', label: 'Hà Nội' },
            { value: 'TP.HCM', label: 'TP.HCM' },
          ]}
        />
      ),
    },
    {
      label: 'Loại combo',
      icon: <Sparkles size={13} />,
      content: (
        <CustomSelect
          value={heroBudget}
          onChange={(val) => setHeroBudget(val)}
          options={[
            { value: 'all', label: 'Tất cả loại combo' },
            { value: 'under_2m', label: 'Combo Tiết kiệm (< 2tr)' },
            { value: '2m_3m', label: 'Combo Tiêu chuẩn (2 - 3tr)' },
            { value: 'above_3m', label: 'Combo Cao cấp (> 3tr)' },
          ]}
        />
      ),
    },
    {
      label: 'Lịch Combo',
      icon: <Calendar size={13} />,
      content: (
        <ServiceDatePicker
          serviceType="combo"
          value={{
            rentalType: 'HOURLY',
            startDate: heroDate,
            endDate: heroDate,
            singleDate: heroDate,
            startTime: '08:00',
            endTime: '11:00',
            timeSlot: searchParams.get('timeSlot') || '08:00 - 11:00',
          }}
          onChange={(val) => {
            const chosen = val.singleDate || val.startDate;
            setHeroDate(chosen);
            const params = new URLSearchParams(searchParams);
            if (chosen) params.set('date', chosen);
            if (val.timeSlot) params.set('timeSlot', val.timeSlot);
            setSearchParams(params, { replace: true });
          }}
        />
      ),
    },
    {
      label: 'Số người',
      icon: <Users size={13} />,
      content: (
        <CustomSelect
          value={heroPeople}
          onChange={(val) => setHeroPeople(val)}
          options={[
            { value: 'all', label: 'Không giới hạn' },
            { value: '1', label: '1 người (Cá nhân)' },
            { value: '2', label: '2 người (Cặp đôi)' },
            { value: '3-4', label: '3 - 4 người (Nhóm)' },
            { value: '5+', label: 'Từ 5 người (Gia đình)' },
          ]}
        />
      ),
    },
  ];

  return (
    <main className="unified-listing-page">
      <div className="unified-listing-container">
        {/* 1. Unified Hero */}
        <ListingHero
          placement="COMBO"
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
            const params = new URLSearchParams(searchParams);
            if (tab === 'all') {
              params.delete('tab');
              params.delete('concept');
            } else {
              params.set('tab', tab);
              if (tab === 'outdoor') params.set('concept', 'ngoai-canh');
              else if (tab === 'studio') params.set('concept', 'studio');
              else if (tab === 'couple') params.set('concept', 'cap-doi');
              else params.delete('concept');
            }
            setSearchParams(params, { replace: true });
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
