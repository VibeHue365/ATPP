import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Camera, Check, ChevronDown, Map, MapPin, Search, Sparkles, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import { useToast } from '../../components/feedback/Toast';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { photographersApi } from '../../features/photographers/api/photographers.api';
import { categoryService } from '../../features/categories/services/categoryService';
import type { Category } from '../../features/categories/types';
import { PhotographerCard } from '../../features/photographers/components/PhotographerCard';
import { usePhotographers } from '../../features/photographers/hooks/usePhotographers';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';
import type { LocationSelection, PhotographerDiscoverySort, PhotographerPackageCategory } from '../../features/photographers/types/photographer.types';
import { ROUTES } from '../../config/routes';
import { ListingHero } from '../../components/common/ListingHero';
import { UnifiedSearchBar, type SearchFieldConfig } from '../../components/common/UnifiedSearchBar';
import { ListingCategoryTabs } from '../../components/common/ListingCategoryTabs';
import './PhotographersListingPage.css';

const sortOptions: Array<{ value: PhotographerDiscoverySort; label: string }> = [
  { value: 'rating_desc', label: 'Đánh giá cao nhất' },
  { value: 'reviews_desc', label: 'Nhiều đánh giá nhất' },
  { value: 'price_asc', label: 'Giá thấp đến cao' },
  { value: 'price_desc', label: 'Giá cao đến thấp' },
];

const readCategoryIds = (value: string | null): string[] | undefined => {
  const ids = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  return ids.length ? ids : undefined;
};

const readNumber = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

interface PhotographyListingFilters {
  packageCategoryCards: PhotographerPackageCategory[];
  styleCategories: Category[];
  eventCategories: Category[];
}

let photographyFiltersCache: { value: PhotographyListingFilters; expiresAt: number } | null = null;
let photographyFiltersRequest: Promise<PhotographyListingFilters> | null = null;

const loadPhotographyFilters = (): Promise<PhotographyListingFilters> => {
  if (photographyFiltersCache && photographyFiltersCache.expiresAt > Date.now()) {
    return Promise.resolve(photographyFiltersCache.value);
  }
  if (photographyFiltersRequest) return photographyFiltersRequest;

  photographyFiltersRequest = Promise.all([
    photographersApi.getPackageCategories(),
    categoryService.getPublic({ type: 'STYLE' }),
    categoryService.getPublic({ type: 'EVENT' }),
  ])
    .then(([packageCategoryResponse, styleCategories, eventCategories]) => {
      const value = {
        packageCategoryCards: packageCategoryResponse.data,
        styleCategories,
        eventCategories,
      };
      photographyFiltersCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    })
    .finally(() => {
      photographyFiltersRequest = null;
    });

  return photographyFiltersRequest;
};
export const PhotographersListingPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart } = useCart();
  const { user, toggleFavorite: apiToggleFavorite } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [packageCategories, setPackageCategories] = useState<Category[]>([]);
  const [packageCategoryCards, setPackageCategoryCards] = useState<PhotographerPackageCategory[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [compareList, setCompareList] = useState<string[]>([]);
  const [customerLocation, setCustomerLocation] = useState<LocationSelection | null>(null);
  const [isDiscoveryMapOpen, setIsDiscoveryMapOpen] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState(15);
  const [shootDate, setShootDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const hasAoDaiInCart = cart.some((item) => item.itemType === 'PRODUCT');
  const queryString = searchParams.toString();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    type: true,
    location: true,
    style: true,
    event: true,
    price: true,
  });
  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const userPreferences = user?.preferences;
  const userHasOnboarding = Boolean(user?.hasCompletedOnboarding && userPreferences);
  const userPrefOccasion = userPreferences?.preferredOccasions?.[0] || '';
  const userPrefStyle = userPreferences?.preferredAoDaiStyles?.[0] || '';
  const [isPersonalizedFilterActive, setIsPersonalizedFilterActive] = useState(true);
  const [disabledProfilePrefs, setDisabledProfilePrefs] = useState<{
    occasion?: boolean;
    style?: boolean;
  }>({});

  const discoveryParams = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const sort = params.get('sort');
    return {
      q: params.get('q') || undefined,
      packageCategoryId: params.get('packageCategoryId') || undefined,
      conceptCategoryIds: readCategoryIds(params.get('conceptCategoryIds')),
      styleCategoryIds: readCategoryIds(params.get('styleCategoryIds')),
      eventCategoryIds: readCategoryIds(params.get('eventCategoryIds')),
      location: params.get('location') || undefined,
      minPrice: readNumber(params.get('minPrice')),
      maxPrice: readNumber(params.get('maxPrice')),
      minRating: readNumber(params.get('minRating')),
      latitude: customerLocation?.latitude,
      longitude: customerLocation?.longitude,
      searchRadiusKm: customerLocation ? searchRadiusKm : undefined,
      sort: (sortOptions.some((option) => option.value === sort)
        ? sort
        : 'rating_desc') as PhotographerDiscoverySort,
      page: readNumber(params.get('page')) ?? 1,
      limit: 12,
    };
  }, [queryString, customerLocation, searchRadiusKm]);

  const { photographers, meta, isLoading, error } = usePhotographers(discoveryParams);
  const selectedPackageCategory = discoveryParams.packageCategoryId ?? '';
  const selectedConceptCategory = discoveryParams.conceptCategoryIds?.[0] ?? '';
  const selectedStyleCategory = discoveryParams.styleCategoryIds?.[0] ?? '';
  const selectedEventCategory = discoveryParams.eventCategoryIds?.[0] ?? '';
  const selectedSort = discoveryParams.sort;
  const selectedPriceRange =
    discoveryParams.maxPrice === 1999999
      ? 'under2'
      : discoveryParams.minPrice === 2000000 && discoveryParams.maxPrice === 5000000
        ? '2to5'
        : discoveryParams.minPrice === 5000001
          ? 'over5'
          : '';

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const filters = await loadPhotographyFilters();
        setPackageCategoryCards(filters.packageCategoryCards);
        setPackageCategories(filters.packageCategoryCards.map(({ packageCount, metadata, ...category }) => ({
          ...category,
          metadata: metadata ? {
            color: metadata.color ?? undefined,
            occasion: metadata.occasion ?? undefined,
            season: metadata.season ?? undefined,
          } : undefined,
        })));
        setStyleCategories(filters.styleCategories);
        setEventCategories(filters.eventCategories);
        setFiltersError(null);
      } catch (requestError) {
        setPackageCategoryCards([]);
        setPackageCategories([]);
        setFiltersError(requestError instanceof Error ? requestError.message : 'Không thể tải bộ lọc.');
      }
    };
    void loadFilters();
  }, []);

  useEffect(() => {
    const favoriteIds = user?.favorites
      ?.filter((favorite: { targetType?: string; targetId: unknown }) => favorite.targetType === 'PROVIDER' || favorite.targetType === 'Provider')
      .map((favorite: { targetId: unknown }) => String(favorite.targetId)) ?? [];
    setFavorites(favoriteIds);
  }, [user]);

  useEffect(() => {
    setSearchInput(searchParams.get('q') ?? '');
  }, [queryString, customerLocation, searchRadiusKm]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const currentValue = searchParams.get('q') ?? '';
      const nextValue = searchInput.trim();
      if (currentValue === nextValue) return;
      const next = new URLSearchParams(searchParams);
      if (nextValue) next.set('q', nextValue);
      else next.delete('q');
      next.set('page', '1');
      setSearchParams(next);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput, searchParams, setSearchParams]);

  const updateQuery = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!Object.prototype.hasOwnProperty.call(changes, 'page')) next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({ sort: 'rating_desc' });
    setCustomerLocation(null);
  };

  const useCustomerLocation = () => {
    if (!navigator.geolocation) { toast.error('Trình duyệt không hỗ trợ lấy vị trí hiện tại.'); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setCustomerLocation({ address: 'Vị trí hiện tại', latitude: position.coords.latitude, longitude: position.coords.longitude }); setIsDiscoveryMapOpen(true); setIsLocating(false); },
      () => { setIsLocating(false); toast.error('Không thể lấy vị trí. Hãy cho phép quyền vị trí rồi thử lại.'); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleToggleFavorite = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!user) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để lưu nhiếp ảnh gia yêu thích.',
        confirmButtonColor: '#7a1519',
        confirmButtonText: 'Đăng nhập ngay',
        showCancelButton: true,
        cancelButtonText: 'Hủy',
      });
      if (result.isConfirmed) navigate('/login');
      return;
    }

    try {
      const isFavorite = favorites.includes(id);
      await apiToggleFavorite('PROVIDER', id);
      setFavorites((current) => isFavorite ? current.filter((favoriteId) => favoriteId !== id) : [...current, id]);
      toast.success(isFavorite ? 'Đã xóa khỏi danh sách yêu thích.' : 'Đã thêm vào danh sách yêu thích.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Không thể cập nhật danh sách yêu thích.');
    }
  };

  const handleCompareToggle = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.target.checked) {
      if (compareList.length >= 3) {
        toast.error('Chỉ có thể chọn tối đa 3 nhiếp ảnh gia để so sánh.');
        return;
      }
      setCompareList((current) => [...current, id]);
      return;
    }
    setCompareList((current) => current.filter((item) => item !== id));
  };
  const totalPackageCount = packageCategoryCards.reduce((total, category) => total + category.packageCount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const submitQuickSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateQuery({ q: searchInput.trim() || undefined });
  };
  const hasActiveFilters = Boolean(
    discoveryParams.q || selectedPackageCategory || selectedConceptCategory || selectedStyleCategory || selectedEventCategory || discoveryParams.location || discoveryParams.minPrice !== undefined || discoveryParams.minRating !== undefined || Boolean(customerLocation),
  );

  const photoSearchFields: SearchFieldConfig[] = [
    {
      label: 'Khu vực',
      icon: <MapPin size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={discoveryParams.location ?? ''}
            onChange={(event) => updateQuery({ location: event.target.value || undefined })}
          >
            <option value="">Tất cả khu vực</option>
            <option value="Huế">Huế</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
            <option value="Hội An">Hội An</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
    {
      label: 'Loại hình chụp',
      icon: <Camera size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={selectedPackageCategory}
            onChange={(event) => updateQuery({ packageCategoryId: event.target.value || undefined })}
          >
            <option value="">Tất cả loại hình</option>
            {packageCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
    {
      label: 'Ngày chụp',
      icon: <CalendarDays size={13} />,
      content: (
        <input
          type="date"
          min={today}
          className="unified-search-input"
          value={shootDate}
          onChange={(event) => setShootDate(event.target.value)}
        />
      ),
    },
    {
      label: 'Số người',
      icon: <Users size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={groupSize}
            onChange={(event) => setGroupSize(event.target.value)}
          >
            <option value="">Không giới hạn</option>
            <option value="1">1 người</option>
            <option value="2">2 người</option>
            <option value="3-5">3–5 người</option>
            <option value="6+">Từ 6 người</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
  ];

  const photoTabs = [
    { id: '', label: 'Tất cả loại hình' },
    ...packageCategoryCards.slice(0, 5).map((c) => ({
      id: c.id,
      label: c.name,
      count: c.packageCount,
    })),
  ];

  return (
    <div className="unified-listing-page">
      <main className="unified-listing-container">
        {/* 1. Unified Hero */}
        <ListingHero
          breadcrumbs={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Chụp ảnh' },
          ]}
          eyebrow="GÓI CHỤP ẢNH ĐÃ XÁC MINH"
          title="Đặt lịch chụp ảnh theo cách của bạn"
          description="Khám phá photographer, studio và concept phù hợp cho khoảnh khắc đáng nhớ."
          stats={[
            { value: `${totalPackageCount > 0 ? totalPackageCount : 45}+`, label: 'Gói chụp' },
            { value: `${photographers.length > 0 ? photographers.length : 20}+`, label: 'Nhiếp ảnh gia' },
            { value: '4.9★', label: 'Hài lòng' },
          ]}
        />

        {/* 2. Unified Search Bar */}
        <UnifiedSearchBar
          fields={photoSearchFields}
          buttonText="Tìm gói chụp"
          onSubmit={submitQuickSearch}
        />

        {/* 3. Category Tabs Bar */}
        <ListingCategoryTabs
          tabs={photoTabs}
          activeTab={selectedPackageCategory || ''}
          onSelectTab={(tabId) => updateQuery({ packageCategoryId: tabId || undefined })}
        />

        {isDiscoveryMapOpen && (
          <section className="photo-map-panel" aria-label="Tìm photographer theo vị trí">
            <div>
              <h2>Tìm quanh địa điểm của bạn</h2>
              <p>Chọn vị trí để xem những photographer phù hợp trong bán kính mong muốn.</p>
            </div>
            {customerLocation && <button type="button" onClick={() => setCustomerLocation(null)}>Bỏ vị trí</button>}
            <PhotographyLocationPicker
              value={customerLocation}
              onSelect={setCustomerLocation}
              title="Chọn vị trí"
              hint="Nhập địa chỉ hoặc dùng vị trí hiện tại."
              radiusKm={searchRadiusKm}
            />
          </section>
        )}

        <div className="unified-main-layout">
          <aside className="photo-filter-panel">
            <div className="photo-filter-panel__header">
              <div className="photo-filter-title-row">
                <h2>Bộ lọc</h2>
                {hasActiveFilters && (
                  <button type="button" className="photo-reset-btn" onClick={clearFilters}>
                    Xóa tất cả
                  </button>
                )}
              </div>
            </div>

            {/* Profile strip if user has preferences */}
            {userHasOnboarding && (
              <div className="photo-profile-strip">
                <div className="photo-profile-strip-header">
                  <div className="photo-profile-strip-title">
                    <Sparkles size={14} className="photo-sparkle-icon" />
                    <span>Hồ sơ gợi ý</span>
                  </div>
                  <Link
                    to={ROUTES.ONBOARDING}
                    className="photo-profile-edit-link"
                    title="Chỉnh sửa số đo & sở thích"
                  >
                    Đổi sở thích
                  </Link>
                </div>

                <div className="photo-profile-chips">
                  {userPrefOccasion && !disabledProfilePrefs.occasion && (
                    <span className="photo-profile-chip">
                      <span>Dịp {userPrefOccasion}</span>
                      <button
                        type="button"
                        className="photo-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, occasion: true }))}
                        title="Bỏ lọc dịp"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {userPrefStyle && !disabledProfilePrefs.style && (
                    <span className="photo-profile-chip">
                      <span>Gu {userPrefStyle}</span>
                      <button
                        type="button"
                        className="photo-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, style: true }))}
                        title="Bỏ lọc phong cách"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {Object.values(disabledProfilePrefs).some(Boolean) && (
                    <button
                      type="button"
                      className="photo-profile-chip-reset"
                      onClick={() => setDisabledProfilePrefs({})}
                    >
                      Khôi phục
                    </button>
                  )}
                </div>

                <div className="photo-profile-toggle-row">
                  <span className="photo-toggle-text">
                    {isPersonalizedFilterActive ? "Gợi ý cá nhân hóa" : "Toàn bộ danh mục"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPersonalizedFilterActive}
                    onClick={() => setIsPersonalizedFilterActive(!isPersonalizedFilterActive)}
                    className={`photo-switch ${isPersonalizedFilterActive ? "is-active" : ""}`}
                    title="Bật/Tắt gợi ý cá nhân hóa"
                  >
                    <span className="photo-switch-thumb" />
                  </button>
                </div>
              </div>
            )}

            {/* Accordion 1: Loại hình */}
            <div className="photo-accordion-section">
              <button
                type="button"
                className="photo-accordion-trigger"
                onClick={() => toggleSection('type')}
              >
                <span className="photo-accordion-title">Loại hình chụp</span>
                <ChevronDown
                  size={15}
                  className={`photo-accordion-chevron ${openSections.type ? "is-open" : ""}`}
                />
              </button>
              {openSections.type && (
                <div className="photo-accordion-content">
                  <div className="photo-checkbox-list">
                    {packageCategories.slice(0, 6).map((category) => (
                      <label key={category.id} className="photo-checkbox-label">
                        <div className="photo-checkbox-left">
                          <input
                            type="checkbox"
                            checked={selectedPackageCategory === category.id}
                            onChange={() =>
                              updateQuery({
                                packageCategoryId:
                                  selectedPackageCategory === category.id
                                    ? undefined
                                    : category.id,
                              })
                            }
                          />
                          <div className="photo-custom-checkbox">
                            {selectedPackageCategory === category.id && <Check size={12} color="#FFFFFF" />}
                          </div>
                          <span>{category.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Khu vực */}
            <div className="photo-accordion-section">
              <button
                type="button"
                className="photo-accordion-trigger"
                onClick={() => toggleSection('location')}
              >
                <span className="photo-accordion-title">Khu vực</span>
                <ChevronDown
                  size={15}
                  className={`photo-accordion-chevron ${openSections.location ? "is-open" : ""}`}
                />
              </button>
              {openSections.location && (
                <div className="photo-accordion-content">
                  <div className="photo-checkbox-list">
                    {['Huế', 'Đà Nẵng', 'Hội An'].map((place) => (
                      <label key={place} className="photo-checkbox-label">
                        <div className="photo-checkbox-left">
                          <input
                            type="checkbox"
                            checked={discoveryParams.location === place}
                            onChange={() =>
                              updateQuery({
                                location:
                                  discoveryParams.location === place ? undefined : place,
                              })
                            }
                          />
                          <div className="photo-custom-checkbox">
                            {discoveryParams.location === place && <Check size={12} color="#FFFFFF" />}
                          </div>
                          <span>{place}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`photo-nearby-button ${customerLocation ? 'is-active' : ''}`}
                    onClick={useCustomerLocation}
                    disabled={isLocating}
                  >
                    <Map size={14} />
                    {isLocating
                      ? 'Đang lấy vị trí...'
                      : customerLocation
                      ? 'Đang tìm gần bạn'
                      : 'Dùng vị trí của tôi'}
                  </button>
                  {customerLocation && (
                    <select
                      className="photo-radius-select"
                      value={searchRadiusKm}
                      onChange={(event) => setSearchRadiusKm(Number(event.target.value))}
                    >
                      <option value={5}>Bán kính 5 km</option>
                      <option value={10}>Bán kính 10 km</option>
                      <option value={15}>Bán kính 15 km</option>
                      <option value={25}>Bán kính 25 km</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 3: Phong cách */}
            <div className="photo-accordion-section">
              <button
                type="button"
                className="photo-accordion-trigger"
                onClick={() => toggleSection('style')}
              >
                <span className="photo-accordion-title">Phong cách chụp</span>
                <ChevronDown
                  size={15}
                  className={`photo-accordion-chevron ${openSections.style ? "is-open" : ""}`}
                />
              </button>
              {openSections.style && (
                <div className="photo-accordion-content">
                  <div className="photo-checkbox-list">
                    {styleCategories.slice(0, 6).map((category) => (
                      <label key={category.id} className="photo-checkbox-label">
                        <div className="photo-checkbox-left">
                          <input
                            type="checkbox"
                            checked={selectedStyleCategory === category.id}
                            onChange={() =>
                              updateQuery({
                                styleCategoryIds:
                                  selectedStyleCategory === category.id
                                    ? undefined
                                    : category.id,
                              })
                            }
                          />
                          <div className="photo-custom-checkbox">
                            {selectedStyleCategory === category.id && <Check size={12} color="#FFFFFF" />}
                          </div>
                          <span>{category.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Dịp / Sự kiện */}
            <div className="photo-accordion-section">
              <button
                type="button"
                className="photo-accordion-trigger"
                onClick={() => toggleSection('event')}
              >
                <span className="photo-accordion-title">Dịp / Sự kiện</span>
                <ChevronDown
                  size={15}
                  className={`photo-accordion-chevron ${openSections.event ? "is-open" : ""}`}
                />
              </button>
              {openSections.event && (
                <div className="photo-accordion-content">
                  <div className="photo-checkbox-list">
                    {eventCategories.slice(0, 6).map((category) => (
                      <label key={category.id} className="photo-checkbox-label">
                        <div className="photo-checkbox-left">
                          <input
                            type="checkbox"
                            checked={selectedEventCategory === category.id}
                            onChange={() =>
                              updateQuery({
                                eventCategoryIds:
                                  selectedEventCategory === category.id
                                    ? undefined
                                    : category.id,
                              })
                            }
                          />
                          <div className="photo-custom-checkbox">
                            {selectedEventCategory === category.id && <Check size={12} color="#FFFFFF" />}
                          </div>
                          <span>{category.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 5: Khoảng giá */}
            <div className="photo-accordion-section">
              <button
                type="button"
                className="photo-accordion-trigger"
                onClick={() => toggleSection('price')}
              >
                <span className="photo-accordion-title">Khoảng giá</span>
                <ChevronDown
                  size={15}
                  className={`photo-accordion-chevron ${openSections.price ? "is-open" : ""}`}
                />
              </button>
              {openSections.price && (
                <div className="photo-accordion-content">
                  <div className="photo-checkbox-list">
                    {[
                      ['under2', 'Dưới 2 triệu'],
                      ['2to5', 'Từ 2 đến 5 triệu'],
                      ['over5', 'Trên 5 triệu'],
                    ].map(([value, label]) => (
                      <label key={value} className="photo-checkbox-label">
                        <div className="photo-checkbox-left">
                          <input
                            type="checkbox"
                            checked={selectedPriceRange === value}
                            onChange={() =>
                              updateQuery(
                                value === 'under2'
                                  ? { minPrice: undefined, maxPrice: '1999999' }
                                  : value === '2to5'
                                  ? { minPrice: '2000000', maxPrice: '5000000' }
                                  : selectedPriceRange === value
                                  ? { minPrice: undefined, maxPrice: undefined }
                                  : { minPrice: '5000001', maxPrice: undefined }
                              )
                            }
                          />
                          <div className="photo-custom-checkbox">
                            {selectedPriceRange === value && <Check size={12} color="#FFFFFF" />}
                          </div>
                          <span>{label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
          <section className="photo-results" aria-label="Danh sách gói chụp">
            <div className="photo-results__top">
              <div className="photo-results__header-left">
                <h2 className="photo-results__title">
                  Gói chụp ảnh đề xuất
                </h2>
                <p className="photo-results__subtitle">
                  {isLoading
                    ? 'Đang tìm gói chụp...'
                    : `${meta.total} gói chụp phù hợp với bạn`}
                </p>
              </div>
              <div className="photo-sort-dropdown">
                <select
                  value={selectedSort}
                  onChange={(event) => updateQuery({ sort: event.target.value })}
                  className="photo-sort-select-input"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="photo-sort-arrow" />
              </div>
            </div>

            {/* Promotional Banner Strip */}
            <div className="photo-promo-banner">
              <div className="photo-promo-left">
                <span className="photo-promo-tag">Ưu đãi đặt sớm</span>
                <h4 className="photo-promo-headline">
                  Gói chụp kỷ yếu & ngoại cảnh giảm 15% khi đặt lịch trước 7 ngày
                </h4>
              </div>
              <Link to="/promotions" className="photo-promo-link">
                <span>Xem chi tiết</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {filtersError && <p className="photo-results__notice">{filtersError}</p>}

            {isLoading ? (
              <div className="photo-results__state">
                <div className="vh-loading-spinner">
                  <div className="vh-loading-double-bounce1" />
                  <div className="vh-loading-double-bounce2" />
                </div>
                <span>Đang tải các gói chụp...</span>
              </div>
            ) : error ? (
              <div className="photo-results__state is-error">
                <h3>Không thể tải dữ liệu</h3>
                <p>{error}</p>
              </div>
            ) : photographers.length === 0 ? (
              <div className="photo-results__state">
                <Search size={38} />
                <h3>Chưa có gói chụp phù hợp</h3>
                <p>Hãy thử thay đổi bộ lọc để xem thêm lựa chọn.</p>
                <button type="button" onClick={clearFilters}>
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <>
                <div className="photo-package-grid">
                  {photographers.map((photographer) => (
                    <PhotographerCard
                      key={photographer.id}
                      photographer={photographer}
                      isFavorite={favorites.includes(photographer.id)}
                      isCompared={compareList.includes(photographer.id)}
                      hasAoDaiInCart={hasAoDaiInCart}
                      onOpen={() =>
                        navigate(`/photographers/${photographer.providerId || photographer.id}`)
                      }
                      onCompareChange={(event) =>
                        handleCompareToggle(photographer.id, event)
                      }
                      onToggleFavorite={(event) =>
                        handleToggleFavorite(photographer.id, event)
                      }
                      onViewPortfolio={(event) => {
                        event.stopPropagation();
                        navigate(`/photographers/${photographer.providerId || photographer.id}`);
                      }}
                    />
                  ))}
                </div>

                {meta.totalPages > 1 && (
                  <nav className="photo-pagination" aria-label="Phân trang">
                    <button
                      type="button"
                      disabled={meta.page === 1}
                      onClick={() => updateQuery({ page: String(meta.page - 1) })}
                    >
                      Trước
                    </button>
                    <span>
                      Trang {meta.page}/{meta.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={meta.page === meta.totalPages}
                      onClick={() => updateQuery({ page: String(meta.page + 1) })}
                    >
                      Sau
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <button type="button" onClick={() => setIsDiscoveryMapOpen((open) => !open)} className={`photo-map-toggle ${isDiscoveryMapOpen ? 'is-active' : ''}`}><Map size={17} />{isDiscoveryMapOpen ? 'Ẩn bản đồ' : 'Xem bản đồ'}</button>
    </div>
  );
};
