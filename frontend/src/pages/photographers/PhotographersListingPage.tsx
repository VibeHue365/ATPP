import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, ChevronDown, Clock3, Map, MapPin, Search, SlidersHorizontal, Users } from 'lucide-react';
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


const FilterGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="photo-filter-group"><h3>{title}</h3><div>{children}</div></section>
);
const FilterChoice: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <label className="photo-filter-choice"><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>
);interface PhotographyListingFilters {
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
  const quickPackageCategories = packageCategoryCards.slice(0, 5);
  const totalPackageCount = packageCategoryCards.reduce((total, category) => total + category.packageCount, 0);
  const quickIcons = [Camera, Users, MapPin, CalendarDays, Clock3];
  const today = new Date().toISOString().slice(0, 10);
  const submitQuickSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateQuery({ q: searchInput.trim() || undefined });
  };
  const hasActiveFilters = Boolean(
    discoveryParams.q || selectedPackageCategory || selectedConceptCategory || selectedStyleCategory || selectedEventCategory || discoveryParams.location || discoveryParams.minPrice !== undefined || discoveryParams.minRating !== undefined || Boolean(customerLocation),
  );

  const avgPhotographerRating = useMemo(() => {
    const rated = photographers.filter((p) => p.rating && p.rating > 0);
    if (!rated.length) return '4.9/5';
    const sum = rated.reduce((acc, p) => acc + (p.rating || 0), 0);
    return `${(sum / rated.length).toFixed(1)}/5`;
  }, [photographers]);

  return (
    <div className="photo-listing-page">
      <main className="photo-listing-shell">
        <nav className="photo-listing-breadcrumb" aria-label="Điều hướng"><span>Trang chủ</span><b>/</b><span>Chụp ảnh</span></nav>
        <section className="photo-listing-intro" aria-labelledby="photo-listing-title"><div><span className="photo-listing-eyebrow">GÓI CHỤP ẢNH</span><h1 id="photo-listing-title">Đặt lịch chụp ảnh theo cách của bạn</h1><p>Khám phá photographer, studio và concept phù hợp cho khoảnh khắc đáng nhớ.</p></div><div className="photo-listing-stats"><div><strong>{totalPackageCount}</strong><span>Gói chụp</span></div><div><strong>{packageCategories.length}</strong><span>Loại hình</span></div><div><strong>{avgPhotographerRating}</strong><span>Đánh giá</span></div></div></section>
        <form className="photo-quick-search" onSubmit={submitQuickSearch}>
          <label><span>LOẠI HÌNH CHỤP</span><select value={selectedPackageCategory} onChange={(event) => updateQuery({ packageCategoryId: event.target.value || undefined })}><option value="">Tất cả loại hình</option>{packageCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={17} /></label>
          <label><span>ĐỊA ĐIỂM</span><select value={discoveryParams.location ?? ''} onChange={(event) => updateQuery({ location: event.target.value || undefined })}><option value="">Tất cả khu vực</option><option value="Huế">Huế</option><option value="Đà Nẵng">Đà Nẵng</option><option value="Hội An">Hội An</option></select><ChevronDown size={17} /></label>
          <label><span>NGÀY CHỤP</span><input type="date" min={today} value={shootDate} onChange={(event) => setShootDate(event.target.value)} /><CalendarDays size={17} /></label>
          <label><span>SỐ NGƯỜI</span><select value={groupSize} onChange={(event) => setGroupSize(event.target.value)}><option value="">Không giới hạn</option><option value="1">1 người</option><option value="2">2 người</option><option value="3-5">3–5 người</option><option value="6+">Từ 6 người</option></select><ChevronDown size={17} /></label>
          <button type="submit"><Search size={18} />Tìm gói chụp</button>
        </form>
        <section className="photo-category-tabs" aria-label="Khám phá theo loại gói chụp">
          <button type="button" onClick={() => updateQuery({ packageCategoryId: undefined })} className={!selectedPackageCategory ? 'is-active' : ''}>
            <span className="photo-category-tabs__icon"><SlidersHorizontal size={16} /></span><strong>Tất cả</strong><small>{totalPackageCount} gói</small>
          </button>
          {quickPackageCategories.map((category, index) => {
            const Icon = quickIcons[index];
            const active = category.id === selectedPackageCategory;
            return <button type="button" key={category.id} onClick={() => updateQuery({ packageCategoryId: active ? undefined : category.id })} className={active ? 'is-active' : ''}><span className="photo-category-tabs__icon"><Icon size={16} /></span><strong>{category.name}</strong><small>{category.packageCount} gói</small></button>;
          })}
        </section>
        {isDiscoveryMapOpen && <section className="photo-map-panel" aria-label="Tìm photographer theo vị trí"><div><h2>Tìm quanh địa điểm của bạn</h2><p>Chọn vị trí để xem những photographer phù hợp trong bán kính mong muốn.</p></div>{customerLocation && <button type="button" onClick={() => setCustomerLocation(null)}>Bỏ vị trí</button>}<PhotographyLocationPicker value={customerLocation} onSelect={setCustomerLocation} title="Chọn vị trí" hint="Nhập địa chỉ hoặc dùng vị trí hiện tại." radiusKm={searchRadiusKm} /></section>}
        <div className="photo-listing-layout">
          <aside className="photo-filter-panel"><div className="photo-filter-panel__header"><div><span>BỘ LỌC</span><h2>Tinh chỉnh kết quả</h2></div>{hasActiveFilters && <button type="button" onClick={clearFilters}>Xóa tất cả</button>}</div>
            <FilterGroup title="Loại hình">{packageCategories.slice(0, 5).map((category) => <FilterChoice key={category.id} label={category.name} checked={selectedPackageCategory === category.id} onChange={() => updateQuery({ packageCategoryId: selectedPackageCategory === category.id ? undefined : category.id })} />)}</FilterGroup>
            <FilterGroup title="Khu vực">{['Huế', 'Đà Nẵng', 'Hội An'].map((place) => <FilterChoice key={place} label={place} checked={discoveryParams.location === place} onChange={() => updateQuery({ location: discoveryParams.location === place ? undefined : place })} />)}<button type="button" className={`photo-nearby-button ${customerLocation ? 'is-active' : ''}`} onClick={useCustomerLocation} disabled={isLocating}><Map size={15} />{isLocating ? 'Đang lấy vị trí...' : customerLocation ? 'Đang tìm gần bạn' : 'Dùng vị trí của tôi'}</button>{customerLocation && <select className="photo-radius-select" value={searchRadiusKm} onChange={(event) => setSearchRadiusKm(Number(event.target.value))}><option value={5}>5 km</option><option value={10}>10 km</option><option value={15}>15 km</option><option value={25}>25 km</option></select>}</FilterGroup>
            <FilterGroup title="Phong cách">{styleCategories.slice(0, 5).map((category) => <FilterChoice key={category.id} label={category.name} checked={selectedStyleCategory === category.id} onChange={() => updateQuery({ styleCategoryIds: selectedStyleCategory === category.id ? undefined : category.id })} />)}</FilterGroup>
            <FilterGroup title="Dịp / sự kiện">{eventCategories.slice(0, 5).map((category) => <FilterChoice key={category.id} label={category.name} checked={selectedEventCategory === category.id} onChange={() => updateQuery({ eventCategoryIds: selectedEventCategory === category.id ? undefined : category.id })} />)}</FilterGroup>
            <FilterGroup title="Khoảng giá">{[['under2','Dưới 2 triệu'], ['2to5','Từ 2 đến 5 triệu'], ['over5','Trên 5 triệu']].map(([value,label]) => <FilterChoice key={value} label={label} checked={selectedPriceRange === value} onChange={() => updateQuery(value === 'under2' ? { minPrice: undefined, maxPrice: '1999999' } : value === '2to5' ? { minPrice: '2000000', maxPrice: '5000000' } : selectedPriceRange === value ? { minPrice: undefined, maxPrice: undefined } : { minPrice: '5000001', maxPrice: undefined })} />)}</FilterGroup>
          </aside>
          <section className="photo-results" aria-label="Danh sách gói chụp">
            <div className="photo-results__top">
              <div>
                <span>GÓI CHỤP ĐỀ XUẤT</span>
                <h2>
                  Gói chụp phù hợp
                </h2>
                <p>
                  {isLoading
                    ? 'Đang tìm gói chụp...'
                    : `${meta.total} gói chụp được tìm thấy`}
                </p>
              </div>
              <label className="photo-sort-select">
                Sắp xếp
                <select
                  value={selectedSort}
                  onChange={(event) => updateQuery({ sort: event.target.value })}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </label>
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
