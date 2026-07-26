import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Map, Search, X } from 'lucide-react';
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
import type { LocationSelection, PhotographerConcept, PhotographerDiscoverySort } from '../../features/photographers/types/photographer.types';
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

export const PhotographersListingPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart } = useCart();
  const { user, toggleFavorite: apiToggleFavorite } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<PhotographerConcept[]>([]);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [packageCategories, setPackageCategories] = useState<Category[]>([]);
  const [conceptCategories, setConceptCategories] = useState<Category[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [compareList, setCompareList] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [customerLocation, setCustomerLocation] = useState<LocationSelection | null>(null);
  const [isDiscoveryMapOpen, setIsDiscoveryMapOpen] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState(15);
  const [isLocating, setIsLocating] = useState(false);
  const hasAoDaiInCart = cart.some((item) => item.itemType === 'PRODUCT');
  const queryString = searchParams.toString();

  const discoveryParams = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const sort = params.get('sort');
    return {
      q: params.get('q') || undefined,
      concept: params.get('concept') || undefined,
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
  const selectedConcept = discoveryParams.concept ?? '';
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
    const loadConcepts = async () => {
      try {
        const [response, packageCategoryData, conceptCategoryData, styleCategoryData, eventCategoryData] = await Promise.all([
          photographersApi.getConcepts(),
          categoryService.getPublic({ type: 'PHOTOGRAPHY_CATEGORY' }),
          categoryService.getPublic({ type: 'CONCEPT' }),
          categoryService.getPublic({ type: 'STYLE' }),
          categoryService.getPublic({ type: 'EVENT' }),
        ]);
        setConcepts(response.data);
        setPackageCategories(packageCategoryData);
        setConceptCategories(conceptCategoryData);
        setStyleCategories(styleCategoryData);
        setEventCategories(eventCategoryData);
        setConceptsError(null);
      } catch (requestError) {
        setConcepts([]);
        setConceptsError(requestError instanceof Error ? requestError.message : 'Không thể tải concept.');
      }
    };
    void loadConcepts();
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

  const activeConcept = concepts.find((concept) => concept.code === selectedConcept);
  const hasActiveFilters = Boolean(
    discoveryParams.q || selectedConcept || selectedPackageCategory || selectedConceptCategory || selectedStyleCategory || selectedEventCategory || discoveryParams.location || discoveryParams.minPrice !== undefined || discoveryParams.minRating !== undefined || Boolean(customerLocation),
  );

  const renderCustomDropdown = (
    id: string,
    label: string,
    currentValue: string | undefined,
    options: Array<{ value: string; label: string }>,
    onSelect: (val: string | undefined) => void,
    Icon?: React.ComponentType<{ size: number; className?: string }>
  ) => {
    const isOpen = activeDropdown === id;
    const selectedOption = options.find(opt => opt.value === currentValue);
    const displayLabel = selectedOption ? `${label}: ${selectedOption.label}` : label;
    const hasValue = !!currentValue;

    return (
      <div className="pl-h-filter-item-container" key={id}>
        <button
          type="button"
          className={`pl-h-filter-btn ${hasValue ? 'active' : ''} ${isOpen ? 'open' : ''}`}
          onClick={() => setActiveDropdown(isOpen ? null : id)}
        >
          {Icon && <Icon size={13} className="pl-h-filter-icon-inline" />}
          <span>{displayLabel}</span>
          <ChevronDown size={12} className="pl-chevron" />
        </button>

        {isOpen && (
          <>
            <div className="pl-dropdown-overlay" onClick={() => setActiveDropdown(null)} />
            <div className="pl-h-dropdown-menu">
              <button
                type="button"
                className={`pl-dropdown-item ${!currentValue ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(undefined);
                  setActiveDropdown(null);
                }}
              >
                Tất cả
              </button>
              {options.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`pl-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelect(opt.value);
                      setActiveDropdown(null);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="pl-page-container">
      <div className="pl-main-layout pl-horizontal-layout">
        <div className="pl-horizontal-filters-container">
          <div className="pl-horizontal-filters">
            {/* Search */}
            <div className="pl-h-filter-search-wrapper">
              <Search size={14} className="pl-h-search-icon-inside" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm tên, phong cách..."
                className="pl-h-search-input-field"
              />
            </div>

            {/* Khu vực */}
            {renderCustomDropdown(
              'location',
              'Khu vực',
              discoveryParams.location,
              [
                { value: 'Huế', label: 'Huế' },
                { value: 'Hội An', label: 'Hội An' },
                { value: 'Đà Nẵng', label: 'Đà Nẵng' }
              ],
              (val) => updateQuery({ location: val }),
              Map
            )}
             <div className="pl-h-filter-item-container" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
               <button type="button" className={'pl-h-filter-btn ' + (customerLocation ? 'active' : '')} onClick={useCustomerLocation} disabled={isLocating}>
                 <Map size={13} className="pl-h-filter-icon-inline" />
                 <span>{isLocating ? 'Đang lấy vị trí...' : customerLocation ? 'Gần tôi' : 'Dùng vị trí của tôi'}</span>
               </button>
               {customerLocation && <select aria-label="Bán kính tìm nhiếp ảnh gia" value={searchRadiusKm} onChange={(event) => setSearchRadiusKm(Number(event.target.value))} className="pl-sort-select" style={{ height: '34px', minWidth: '76px' }}>
                 <option value={5}>5 km</option><option value={10}>10 km</option><option value={15}>15 km</option><option value={25}>25 km</option><option value={50}>50 km</option>
               </select>}
             </div>

            {/* Concept */}
            {renderCustomDropdown(
              'concept',
              'Concept',
              selectedConcept,
              concepts.map(c => ({ value: c.code, label: c.label })),
              (val) => updateQuery({ concept: val })
            )}

            {/* Loại gói chụp */}
            {renderCustomDropdown(
              'package',
              'Loại gói',
              selectedPackageCategory,
              packageCategories.map(c => ({ value: c.id, label: c.name })),
              (val) => updateQuery({ packageCategoryId: val })
            )}

            {/* Concept theo danh mục */}
            {renderCustomDropdown(
              'conceptCategory',
              'Danh mục',
              selectedConceptCategory,
              conceptCategories.map(c => ({ value: c.id, label: c.name })),
              (val) => updateQuery({ conceptCategoryIds: val })
            )}

            {/* Phong cách */}
            {renderCustomDropdown(
              'style',
              'Phong cách',
              selectedStyleCategory,
              styleCategories.map(c => ({ value: c.id, label: c.name })),
              (val) => updateQuery({ styleCategoryIds: val })
            )}

            {/* Dịp / sự kiện */}
            {renderCustomDropdown(
              'event',
              'Dịp',
              selectedEventCategory,
              eventCategories.map(c => ({ value: c.id, label: c.name })),
              (val) => updateQuery({ eventCategoryIds: val })
            )}

            {/* Mức giá */}
            {renderCustomDropdown(
              'price',
              'Mức giá',
              selectedPriceRange,
              [
                { value: 'under2', label: 'Dưới 2 triệu' },
                { value: '2to5', label: 'Từ 2 đến 5 triệu' },
                { value: 'over5', label: 'Trên 5 triệu' }
              ],
              (val) => {
                updateQuery(
                  val === 'under2'
                    ? { minPrice: undefined, maxPrice: '1999999' }
                    : val === '2to5'
                      ? { minPrice: '2000000', maxPrice: '5000000' }
                      : val === 'over5'
                        ? { minPrice: '5000001', maxPrice: undefined }
                        : { minPrice: undefined, maxPrice: undefined }
                );
              }
            )}

            {/* Đánh giá */}
            {renderCustomDropdown(
              'rating',
              'Đánh giá',
              discoveryParams.minRating?.toString(),
              [
                { value: '4.5', label: 'Từ 4.5★ trở lên' },
                { value: '4', label: 'Từ 4★ trở lên' },
                { value: '3.5', label: 'Từ 3.5★ trở lên' }
              ],
              (val) => updateQuery({ minRating: val })
            )}

            {/* Xóa lọc */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="pl-h-clear-btn"
                title="Xóa lọc"
              >
                <X size={14} />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>


        {isDiscoveryMapOpen && (
          <section className="pl-discovery-map-panel" aria-label="Tìm nhiếp ảnh gia theo vị trí">
            <div className="pl-discovery-map-panel-header">
              <div>
                <h2>Tìm quanh địa điểm của bạn</h2>
                <p>Chỉ pin của bạn và vòng tìm kiếm được hiển thị. Vị trí chính xác của photographer luôn được bảo mật.</p>
              </div>
              {customerLocation && <button type="button" className="pl-discovery-map-clear" onClick={() => setCustomerLocation(null)}>Bỏ vị trí</button>}
            </div>
            <PhotographyLocationPicker
              value={customerLocation}
              onSelect={setCustomerLocation}
              title="Chọn vị trí để tìm photographer"
              hint="Nhập địa chỉ, dùng vị trí hiện tại hoặc kéo pin. Danh sách sẽ tự lọc theo bán kính bên dưới."
              radiusKm={searchRadiusKm}
            />
            <p className="pl-discovery-map-result-note">
              {customerLocation ? `Đang tìm trong bán kính ${searchRadiusKm} km. ${isLoading ? 'Đang cập nhật kết quả...' : `Có ${meta.total} photographer phù hợp.`}` : 'Chọn một vị trí để bắt đầu lọc theo khoảng cách.'}
            </p>
          </section>
        )}
        <section className="pl-content-section">
          <div className="pl-toolbar">
            <div className="pl-concepts-track">
              <span className="pl-concept-label">KHÁM PHÁ CONCEPT:</span>
              <button
                type="button"
                onClick={() => updateQuery({ concept: undefined })}
                className={`pl-concept-pill ${!selectedConcept ? 'active' : ''}`}
              >
                Tất cả
              </button>
              {concepts.slice(0, 6).map((concept) => {
                const isActive = concept.code === selectedConcept;
                return (
                  <button
                    key={concept.code}
                    type="button"
                    onClick={() => updateQuery({ concept: isActive ? undefined : concept.code })}
                    title={`${concept.photographerCount} nhiếp ảnh gia`}
                    className={`pl-concept-pill ${isActive ? 'active' : ''}`}
                  >
                    {concept.label}
                  </button>
                );
              })}
            </div>
            <div className="pl-sort-wrapper">
              <span className="pl-sort-label">Sắp xếp:</span>
              <select
                value={selectedSort}
                onChange={(event) => updateQuery({ sort: event.target.value })}
                className="pl-sort-select"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pl-sort-chevron" />
            </div>
          </div>

          {(activeConcept || discoveryParams.location || discoveryParams.q) && (
            <div className="pl-active-filters-row">
              <span className="pl-active-filters-label">Đang lọc:</span>
              {activeConcept && (
                <span className="pl-active-filter-badge">
                  {activeConcept.label}
                  <button
                    type="button"
                    onClick={() => updateQuery({ concept: undefined })}
                    aria-label="Bỏ lọc concept"
                    className="pl-active-filter-remove"
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
              {discoveryParams.location && (
                <span className="pl-active-filter-badge">
                  {discoveryParams.location}
                  <button
                    type="button"
                    onClick={() => updateQuery({ location: undefined })}
                    aria-label="Bỏ lọc địa điểm"
                    className="pl-active-filter-remove"
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
            </div>
          )}

          {conceptsError && <p style={{ color: '#9c2d2d', fontSize: '13px' }}>{conceptsError}</p>}
          {!isLoading && !error && (
            <p className="pl-results-count">
              Tìm thấy {meta.total} nhiếp ảnh gia phù hợp.
            </p>
          )}

          {isLoading ? (
            <div className="pl-loading-container">
              <div className="vh-loading-spinner">
                <div className="vh-loading-double-bounce1" />
                <div className="vh-loading-double-bounce2" />
              </div>
              <span className="pl-loading-text">Đang tìm nhiếp ảnh gia...</span>
            </div>
          ) : error ? (
            <div className="pl-error-container">
              <h3 className="font-header">Không thể tải dữ liệu</h3>
              <p>{error}</p>
            </div>
          ) : photographers.length === 0 ? (
            <div className="pl-empty-container">
              <Search size={48} className="pl-empty-icon" />
              <h3 className="pl-empty-title">Không tìm thấy nhiếp ảnh gia phù hợp</h3>
              <p className="pl-empty-subtitle">Hãy thử thay đổi từ khóa hoặc bộ lọc.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="vh-btn vh-btn-outline"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <>
              <div className="pl-grid">
                {photographers.map((photographer) => (
                  <PhotographerCard
                    key={photographer.id}
                    photographer={photographer}
                    isFavorite={favorites.includes(photographer.id)}
                    isCompared={compareList.includes(photographer.id)}
                    hasAoDaiInCart={hasAoDaiInCart}
                    onOpen={() => navigate(`/photographers/${photographer.providerId || photographer.id}`)}
                    onCompareChange={(event) => handleCompareToggle(photographer.id, event)}
                    onToggleFavorite={(event) => handleToggleFavorite(photographer.id, event)}
                    onViewPortfolio={(event) => {
                      event.stopPropagation();
                      navigate(`/photographers/${photographer.providerId || photographer.id}`);
                    }}
                  />
                ))}
              </div>
              {meta.totalPages > 1 && (
                <nav aria-label="Phân trang nhiếp ảnh gia" className="pl-pagination">
                  <button
                    type="button"
                    disabled={meta.page === 1}
                    onClick={() => updateQuery({ page: String(meta.page - 1) })}
                    className="vh-btn vh-btn-outline"
                  >
                    Trước
                  </button>
                  <span className="pl-pagination-info">
                    Trang {meta.page}/{meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={meta.page === meta.totalPages}
                    onClick={() => updateQuery({ page: String(meta.page + 1) })}
                    className="vh-btn vh-btn-outline"
                  >
                    Sau
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
      <button
        type="button"
        onClick={() => setIsDiscoveryMapOpen((isOpen) => !isOpen)}
        className={`pl-map-floating-btn ${isDiscoveryMapOpen ? 'active' : ''}`}
        aria-expanded={isDiscoveryMapOpen}
      >
        <Map size={16} />
        Xem bản đồ
      </button>
    </div>
  );
};