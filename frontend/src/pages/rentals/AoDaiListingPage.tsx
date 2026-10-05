import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Heart,
  ChevronDown,
  Sparkles,
  Check,
  Calendar,
  ArrowRight,
  SlidersHorizontal,
  MapPin,
  Tag,
  Layers,
} from "lucide-react";
import { httpClient } from "../../services/httpClient";
import { API_BASE_URL } from "../../config/env";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useToast } from "../../components/feedback/Toast";
import { ROUTES } from "../../config/routes";
import Swal from "sweetalert2";
import { ListingHero } from "../../components/common/ListingHero";
import { UnifiedSearchBar, type SearchFieldConfig } from "../../components/common/UnifiedSearchBar";
import { ListingCategoryTabs } from "../../components/common/ListingCategoryTabs";

import "./AoDaiListingPage.css";

const DEFAULT_AODAI_IMAGE = "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80";

const getImageUrl = (url?: string) => {
  if (!url) {
    return DEFAULT_AODAI_IMAGE;
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (url.includes("/public-media/legacy/")) {
    const parts = url.split("/public-media/legacy/");
    const filename = parts[parts.length - 1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
    const normalized = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
  }
  return url.startsWith("/") ? url : `/${url}`;
};

interface ProductFromDb {
  _id: string;
  name: string;
  basePrice: number;
  depositAmount?: number;
  images: string[];
  sizes: string[];
  colors: string[];
  materials?: string[];
  status?: string;
  style?: string;
  rating?: {
    averageRating: number;
    totalReviews: number;
  };
  providerId?: string | {
    _id?: string;
    businessName?: string;
    brandName?: string;
    city?: string;
    address?: { city?: string };
  };
  badges?: Array<{ code: string; label: string; tone?: string }>;
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate?: string;
  } | null;
  discountedPrice?: number;
  recommendation?: {
    score: number;
    matchPercent: number;
    reasons: string[];
  };
}

interface FavoriteEntry {
  targetType: string;
  targetId: string | { toString(): string };
}

interface ProductPageResponse {
  data: ProductFromDb[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const COLOR_PALETTES = [
  { name: "Trắng", value: "WHITE", hex: "#FFFFFF" },
  { name: "Đỏ", value: "RED", hex: "#F87171" },
  { name: "Hồng", value: "PINK", hex: "#F9A8D4" },
  { name: "Xanh", value: "BLUE", hex: "#60A5FA" },
  { name: "Nâu", value: "BROWN", hex: "#5A2E2E" },
  { name: "Đen", value: "BLACK", hex: "#111827" },
];

const SIZE_OPTIONS = ["S", "M", "L", "XL", "Free"];

export const AoDaiListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "";
  const toast = useToast();
  const { user, toggleFavorite: apiToggleFavorite } = useAuth();

  // Data states
  const [products, setProducts] = useState<ProductFromDb[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);

  // Quick category tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Search Bar state
  const [searchLocation, setSearchLocation] = useState<string>("");
  const [rentalType, setRentalType] = useState<string>("Theo ngày");
  const [rentalDate, setRentalDate] = useState<string>("");
  const [selectedSearchSize, setSelectedSearchSize] = useState<string>("");

  // Sidebar Filter states
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Sorting and Pagination
  const [sortOption, setSortOption] = useState<string>("recommended");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 9;
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState(maxPrice);
  const [isPersonalizedFilterActive, setIsPersonalizedFilterActive] = useState<boolean>(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    type: true,
    size: true,
    color: true,
    price: true,
    amenities: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const [disabledProfilePrefs, setDisabledProfilePrefs] = useState<{
    size?: boolean;
    color?: boolean;
    style?: boolean;
    occasion?: boolean;
  }>({});

  // Onboarding user preferences extraction
  const userPreferences = user?.preferences;
  const userHasOnboarding = Boolean(user?.hasCompletedOnboarding && userPreferences);
  const userPrefSize = (userPreferences?.sizeInfo?.preferredSize || '').toUpperCase();
  const userPrefRawColor = userPreferences?.favoriteColors?.[0] || '';
  const userPrefRawStyle = userPreferences?.preferredAoDaiStyles?.[0] || '';
  const userPrefRawOccasion = userPreferences?.preferredOccasions?.[0] || '';

  const formatColorName = (val?: string) => {
    if (!val) return '';
    const map: Record<string, string> = {
      RED_GOLD: 'Đỏ · Vàng',
      PASTEL: 'Pastel nhẹ',
      DARK: 'Tông trầm',
      COLORFUL: 'Rực rỡ',
      WHITE: 'Trắng',
      RED: 'Đỏ',
      PINK: 'Hồng',
      BLUE: 'Xanh',
      BLACK: 'Đen',
    };
    return map[val.toUpperCase()] || val;
  };

  const formatStyleName = (val?: string) => {
    if (!val) return '';
    const map: Record<string, string> = {
      TRADITIONAL: 'Truyền thống',
      MODERN: 'Cách tân',
      EDGY: 'Phá cách',
    };
    return map[val.toUpperCase()] || val;
  };

  const formatOccasionName = (val?: string) => {
    if (!val) return '';
    const map: Record<string, string> = {
      GRADUATION: 'Kỷ yếu',
      WEDDING: 'Cưới hỏi',
      FESTIVAL: 'Lễ hội',
      EVENT: 'Sự kiện',
    };
    return map[val.toUpperCase()] || val;
  };

  const isPersonalizedRanking =
    isPersonalizedFilterActive &&
    sortOption === 'recommended' &&
    Boolean(user?.id) &&
    userHasOnboarding;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMaxPrice(maxPrice), 250);
    return () => window.clearTimeout(timer);
  }, [maxPrice]);

  // Favorites
  const [favorites, setFavorites] = useState<string[]>([]);

  // Sync favorites with user context
  useEffect(() => {
    if (user?.favorites) {
      const favIds = (user.favorites as FavoriteEntry[])
        .filter(
          (f) => f.targetType === "PRODUCT" || f.targetType === "Product"
        )
        .map((f) => f.targetId.toString());
      // Mirror favorites from the authenticated user context into editable UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavorites(favIds);
    } else {
      setFavorites([]);
    }
  }, [user]);

  // Server-side listing request.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const fetchPage = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (debouncedMaxPrice < 1000000) {
          params.append('maxPrice', debouncedMaxPrice.toString());
        }
        if (selectedColors.length > 0) {
          params.append('colors', selectedColors.join(','));
        }
        const sizes = [...new Set([
          ...selectedSizes,
          ...(selectedSearchSize ? [selectedSearchSize] : []),
        ])];
        if (sizes.length > 0) {
          params.append('sizes', sizes.join(','));
        }
        if (categoryId) {
          params.append('categoryId', categoryId);
        }
        if (searchLocation) {
          params.append('providerLocation', searchLocation);
        }
        const productTypes = selectedTypes.length > 0
          ? selectedTypes
          : activeTab !== 'all'
            ? [activeTab]
            : [];
        if (productTypes.length > 0) {
          params.append('types', productTypes.join(','));
        }
        params.append('page', currentPage.toString());
        params.append('limit', ITEMS_PER_PAGE.toString());
        const usePersonalizedRanking =
          isPersonalizedFilterActive &&
          sortOption === 'recommended' &&
          Boolean(user?.id) &&
          userHasOnboarding;
        if (!usePersonalizedRanking) {
          params.append(
            'sort',
            sortOption === 'price-asc'
              ? 'price_asc'
              : sortOption === 'price-desc'
                ? 'price_desc'
                : sortOption === 'rating'
                  ? 'rating_desc'
                  : 'newest',
          );
        }
        const response = await httpClient.get<ProductPageResponse>(
          `${usePersonalizedRanking ? '/products/personalized' : '/products'}?${params.toString()}`,
          { signal: controller.signal },
        );
        if (active) {
          setProducts(response?.data || []);
          setTotalCount(response?.meta?.total || 0);
          setServerTotalPages(response?.meta?.totalPages || 1);
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('Product page request failed:', err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    categoryId,
    debouncedMaxPrice,
    selectedColors,
    selectedSizes,
    selectedSearchSize,
    searchLocation,
    selectedTypes,
    activeTab,
    currentPage,
    sortOption,
    user?.id,
    isPersonalizedFilterActive,
    userHasOnboarding,
  ]);

  // 1. Dynamic statistics computed directly from live product data
  const stats = useMemo(() => {
    const pageCount = products.length;
    const storeIds = new Set<string>();
    let totalRatingPoints = 0;
    let ratedProductsCount = 0;

    let female = 0;
    let male = 0;
    let couple = 0;
    let yearbook = 0;
    let wedding = 0;

    for (const p of products) {
      const pId = typeof p.providerId === "object" && p.providerId ? p.providerId._id : p.providerId;
      if (pId) storeIds.add(String(pId));

      if (p.rating?.averageRating) {
        totalRatingPoints += p.rating.averageRating;
        ratedProductsCount++;
      }

      const name = (p.name || "").toLowerCase();
      if (name.includes("nam")) {
        male++;
      } else if (name.includes("đôi") || name.includes("cặp")) {
        couple++;
      } else {
        female++;
      }

      if (name.includes("kỷ yếu") || name.includes("học sinh") || name.includes("sinh viên")) {
        yearbook++;
      }
      if (name.includes("cưới") || name.includes("hỷ") || name.includes("dâu") || name.includes("rể")) {
        wedding++;
      }
    }

    const avg = ratedProductsCount > 0 ? (totalRatingPoints / ratedProductsCount).toFixed(1) : "4.9";

    return {
      totalCount,
      storesCount: storeIds.size || (pageCount > 0 ? 1 : 0),
      avgRating: avg,
      female,
      male,
      couple,
      yearbook,
      wedding,
    };
  }, [products, totalCount]);


  // 3. Featured live campaign (if any active on platform)
  const featuredCampaign = useMemo(() => {
    const withCampaign = products.find((p) => p.activeCampaign);
    return withCampaign?.activeCampaign || null;
  }, [products]);

  // Products are already filtered, sorted, and paginated by the API.

  // Pagination calculation
  const totalPages = serverTotalPages;
  const paginatedProducts = products;

  // Handlers
  const handleToggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const handleToggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
    setCurrentPage(1);
  };

  const handleToggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
    setCurrentPage(1);
  };

  const handleToggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleClearAll = () => {
    setActiveTab("all");
    setSelectedTypes([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setMaxPrice(1000000);
    setSelectedAmenities([]);
    setSearchLocation("");
    setSelectedSearchSize("");
    setRentalType("Theo ngày");
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      Swal.fire({
        icon: "warning",
        title: "Yêu cầu đăng nhập",
        text: "Vui lòng đăng nhập để lưu sản phẩm yêu thích!",
        confirmButtonColor: "#B52B47",
        confirmButtonText: "Đăng nhập ngay",
        showCancelButton: true,
        cancelButtonText: "Hủy",
      }).then((result) => {
        if (result.isConfirmed) {
          navigate("/auth/login");
        }
      });
      return;
    }
    try {
      const isAlready = favorites.includes(id);
      await apiToggleFavorite("PRODUCT", id);
      if (isAlready) {
        toast.success("Đã xóa khỏi danh sách yêu thích!");
      } else {
        toast.success("Đã thêm vào danh sách yêu thích!");
      }
    } catch {
      toast.error("Không thể cập nhật danh sách yêu thích.");
    }
  };

  // Helper for card badge - only status/highlight badges, not categories
  const getCardBadge = (product: ProductFromDb, index: number) => {
    if (product.activeCampaign) {
      return `-${product.activeCampaign.discountPercent}%`;
    }
    if (product.badges && product.badges.length > 0) {
      const label = product.badges[0].label;
      if (!["KỶ YẾU", "NAM", "CẶP ĐÔI", "ĐÔI"].includes(label.toUpperCase())) {
        return label;
      }
    }
    if (index === 0) return "Bán chạy";
    if (index === 1) return "Yêu thích";
    if (index === 2) return "Mới";
    return null;
  };

  const aodaiCategoryTabs = [
    { id: 'all', label: 'Tất cả mẫu' },
    { id: 'Nữ', label: 'Áo dài Nữ' },
    { id: 'Nam', label: 'Áo dài Nam' },
    { id: 'Cặp đôi', label: 'Cặp đôi' },
    { id: 'Cổ phục', label: 'Cổ phục / Nhật Bình' },
    { id: 'Kỷ yếu', label: 'Kỷ yếu / Sự kiện' },
  ];

  const aodaiSearchFields: SearchFieldConfig[] = [
    {
      label: 'Khu vực',
      icon: <MapPin size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={searchLocation}
            onChange={(e) => {
              setSearchLocation(e.target.value);
              setCurrentPage(1);
            }}
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
      label: 'Hình thức thuê',
      icon: <Tag size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={rentalType}
            onChange={(e) => setRentalType(e.target.value)}
          >
            <option value="Theo ngày">Theo ngày</option>
            <option value="Theo giờ">Theo giờ</option>
            <option value="Theo sự kiện">Theo sự kiện</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
    {
      label: 'Ngày thuê',
      icon: <Calendar size={13} />,
      content: (
        <input
          type="date"
          className="unified-search-input"
          value={rentalDate}
          onChange={(e) => setRentalDate(e.target.value)}
        />
      ),
    },
    {
      label: 'Size',
      icon: <Layers size={13} />,
      content: (
        <>
          <select
            className="unified-search-select"
            value={selectedSearchSize}
            onChange={(e) => {
              setSelectedSearchSize(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tất cả size</option>
            <option value="S">Size S</option>
            <option value="M">Size M</option>
            <option value="L">Size L</option>
            <option value="XL">Size XL</option>
            <option value="Free">Size Free</option>
          </select>
          <ChevronDown size={14} className="unified-search-arrow" />
        </>
      ),
    },
  ];

  return (
    <div className="unified-listing-page">
      <div className="unified-listing-container">
        {/* 1. Unified Hero */}
        <ListingHero
          breadcrumbs={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Thuê áo dài' },
          ]}
          eyebrow="MẪU ÁO DÀI ĐÃ XÁC MINH"
          title="Thuê áo dài tại miền Trung"
          description="Chọn mẫu, size, hình thức thuê và thời gian nhận trả phù hợp."
          stats={[
            { value: stats.totalCount > 0 ? `${stats.totalCount}+` : '120+', label: 'Mẫu áo dài' },
            { value: stats.storesCount > 0 ? `${stats.storesCount}` : '15+', label: 'Cửa hàng' },
            { value: '4.9★', label: 'Đánh giá cao' },
          ]}
        />

        {/* 2. Unified Search Bar */}
        <UnifiedSearchBar
          fields={aodaiSearchFields}
          buttonText="Tìm áo dài"
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentPage(1);
          }}
        />

        {/* 3. Quick Category Tabs */}
        <ListingCategoryTabs
          tabs={aodaiCategoryTabs}
          activeTab={activeTab}
          onSelectTab={(tabId) => {
            setActiveTab(tabId);
            setCurrentPage(1);
          }}
        />

        {/* 4. Main 2-Column Section (Sidebar + Grid) */}
        <div className="unified-main-layout">
          {/* Left Column: Sidebar Filter */}
          <aside className="lume-sidebar">
            <div className="lume-sidebar-header">
              <div className="lume-sidebar-title-row">
                <h2 className="lume-sidebar-title">Bộ lọc</h2>
                <button
                  type="button"
                  className="lume-reset-btn"
                  onClick={handleClearAll}
                >
                  Xóa tất cả
                </button>
              </div>
            </div>

            {/* Onboarding Profile Strip */}
            {userHasOnboarding && (
              <div className="lume-profile-strip">
                <div className="lume-profile-strip-header">
                  <div className="lume-profile-strip-title">
                    <Sparkles size={14} className="lume-sparkle-icon" />
                    <span>Hồ sơ gợi ý</span>
                  </div>
                  <Link
                    to={ROUTES.ONBOARDING}
                    className="lume-profile-edit-link"
                    title="Chỉnh sửa số đo & sở thích"
                  >
                    Đổi sở thích
                  </Link>
                </div>

                <div className="lume-profile-chips">
                  {userPrefSize && !disabledProfilePrefs.size && (
                    <span className="lume-profile-chip">
                      <span>Size {userPrefSize}</span>
                      <button
                        type="button"
                        className="lume-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, size: true }))}
                        title="Bỏ lọc size"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {userPrefRawColor && !disabledProfilePrefs.color && (
                    <span className="lume-profile-chip">
                      <span>{formatColorName(userPrefRawColor)}</span>
                      <button
                        type="button"
                        className="lume-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, color: true }))}
                        title="Bỏ lọc màu"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {userPrefRawStyle && !disabledProfilePrefs.style && (
                    <span className="lume-profile-chip">
                      <span>{formatStyleName(userPrefRawStyle)}</span>
                      <button
                        type="button"
                        className="lume-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, style: true }))}
                        title="Bỏ lọc phong cách"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {userPrefRawOccasion && !disabledProfilePrefs.occasion && (
                    <span className="lume-profile-chip">
                      <span>{formatOccasionName(userPrefRawOccasion)}</span>
                      <button
                        type="button"
                        className="lume-profile-chip-remove"
                        onClick={() => setDisabledProfilePrefs((p) => ({ ...p, occasion: true }))}
                        title="Bỏ lọc dịp"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {Object.values(disabledProfilePrefs).some(Boolean) && (
                    <button
                      type="button"
                      className="lume-profile-chip-reset"
                      onClick={() => setDisabledProfilePrefs({})}
                    >
                      Khôi phục
                    </button>
                  )}
                </div>

                <div className="lume-profile-toggle-row">
                  <span className="lume-toggle-text">
                    {isPersonalizedFilterActive ? "Gợi ý cá nhân hóa" : "Toàn bộ kho áo dài"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPersonalizedFilterActive}
                    onClick={() => {
                      setIsPersonalizedFilterActive(!isPersonalizedFilterActive);
                      setCurrentPage(1);
                    }}
                    className={`lume-switch ${isPersonalizedFilterActive ? "is-active" : ""}`}
                    title="Bật/Tắt gợi ý cá nhân hóa"
                  >
                    <span className="lume-switch-thumb" />
                  </button>
                </div>
              </div>
            )}

            {/* Accordion Section 1: Loại áo dài */}
            <div className="lume-accordion-section">
              <button
                type="button"
                className="lume-accordion-trigger"
                onClick={() => toggleSection('type')}
              >
                <span className="lume-accordion-title">Loại áo dài</span>
                <ChevronDown
                  size={15}
                  className={`lume-accordion-chevron ${openSections.type ? "is-open" : ""}`}
                />
              </button>
              {openSections.type && (
                <div className="lume-accordion-content">
                  <div className="lume-checkbox-list">
                    <label className={`lume-checkbox-label ${stats.female === 0 ? "is-disabled" : ""}`}>
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          disabled={stats.female === 0}
                          checked={selectedTypes.includes("female")}
                          onChange={() => handleToggleType("female")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedTypes.includes("female") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>
                          Áo dài nữ <span className="lume-item-count">({stats.female})</span>
                        </span>
                      </div>
                    </label>

                    <label className={`lume-checkbox-label ${stats.male === 0 ? "is-disabled" : ""}`}>
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          disabled={stats.male === 0}
                          checked={selectedTypes.includes("male")}
                          onChange={() => handleToggleType("male")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedTypes.includes("male") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>
                          Áo dài nam <span className="lume-item-count">({stats.male})</span>
                        </span>
                      </div>
                    </label>

                    <label className={`lume-checkbox-label ${stats.couple === 0 ? "is-disabled" : ""}`}>
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          disabled={stats.couple === 0}
                          checked={selectedTypes.includes("couple")}
                          onChange={() => handleToggleType("couple")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedTypes.includes("couple") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>
                          Áo dài đôi <span className="lume-item-count">({stats.couple})</span>
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Section 2: Kích cỡ */}
            <div className="lume-accordion-section">
              <button
                type="button"
                className="lume-accordion-trigger"
                onClick={() => toggleSection('size')}
              >
                <span className="lume-accordion-title">Kích cỡ</span>
                <ChevronDown
                  size={15}
                  className={`lume-accordion-chevron ${openSections.size ? "is-open" : ""}`}
                />
              </button>
              {openSections.size && (
                <div className="lume-accordion-content">
                  <div className="lume-size-options">
                    {SIZE_OPTIONS.map((size) => {
                      const isSelected = selectedSizes.includes(size);
                      const isUserSize = userPrefSize === size.toUpperCase();
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`lume-size-btn ${isSelected ? "is-selected" : ""} ${isUserSize ? "is-user-preferred" : ""}`}
                          onClick={() => handleToggleSize(size)}
                          title={isUserSize ? "Kích cỡ đề xuất của bạn" : undefined}
                        >
                          <span>{size}</span>
                          {isUserSize && (
                            <span className="lume-size-star" title="Size đề xuất của bạn">
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Section 3: Màu sắc */}
            <div className="lume-accordion-section">
              <button
                type="button"
                className="lume-accordion-trigger"
                onClick={() => toggleSection('color')}
              >
                <span className="lume-accordion-title">Màu sắc</span>
                <ChevronDown
                  size={15}
                  className={`lume-accordion-chevron ${openSections.color ? "is-open" : ""}`}
                />
              </button>
              {openSections.color && (
                <div className="lume-accordion-content">
                  <div className="lume-color-options">
                    {COLOR_PALETTES.map((color) => {
                      const isSelected = selectedColors.includes(color.value);
                      return (
                        <button
                          key={color.value}
                          type="button"
                          title={color.name}
                          className={`lume-color-swatch ${isSelected ? "is-selected" : ""}`}
                          style={{ backgroundColor: color.hex }}
                          onClick={() => handleToggleColor(color.value)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Section 4: Khoảng giá */}
            <div className="lume-accordion-section">
              <button
                type="button"
                className="lume-accordion-trigger"
                onClick={() => toggleSection('price')}
              >
                <span className="lume-accordion-title">Khoảng giá</span>
                <ChevronDown
                  size={15}
                  className={`lume-accordion-chevron ${openSections.price ? "is-open" : ""}`}
                />
              </button>
              {openSections.price && (
                <div className="lume-accordion-content">
                  <div className="lume-range-wrap">
                    <input
                      type="range"
                      min={90000}
                      max={1000000}
                      step={10000}
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="lume-range-slider"
                    />
                    <div className="lume-range-labels">
                      <span>90k</span>
                      <span>1 triệu</span>
                    </div>
                    {maxPrice < 1000000 && (
                      <div className="lume-current-price-badge">
                        Tối đa: {maxPrice.toLocaleString("vi-VN")}đ
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Section 5: Tiện ích dịch vụ */}
            <div className="lume-accordion-section">
              <button
                type="button"
                className="lume-accordion-trigger"
                onClick={() => toggleSection('amenities')}
              >
                <span className="lume-accordion-title">Tiện ích dịch vụ</span>
                <ChevronDown
                  size={15}
                  className={`lume-accordion-chevron ${openSections.amenities ? "is-open" : ""}`}
                />
              </button>
              {openSections.amenities && (
                <div className="lume-accordion-content">
                  <div className="lume-checkbox-list">
                    <label className="lume-checkbox-label">
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes("accessories")}
                          onChange={() => handleToggleAmenity("accessories")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedAmenities.includes("accessories") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>Có phụ kiện</span>
                      </div>
                    </label>

                    <label className="lume-checkbox-label">
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes("tryOn")}
                          onChange={() => handleToggleAmenity("tryOn")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedAmenities.includes("tryOn") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>Được thử trước</span>
                      </div>
                    </label>

                    <label className="lume-checkbox-label">
                      <div className="lume-checkbox-left">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes("changingRoom")}
                          onChange={() => handleToggleAmenity("changingRoom")}
                        />
                        <div className="lume-custom-checkbox">
                          {selectedAmenities.includes("changingRoom") && <Check size={12} color="#FFFFFF" />}
                        </div>
                        <span>Có phòng thay đồ</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Right Column: Listing Results */}
          <main className="lume-listing-results">
            {/* Top Results Toolbar */}
            <div className="lume-results-toolbar">
              <div className="lume-toolbar-left">
                <h2 className="lume-toolbar-title">
                  {isPersonalizedRanking
                    ? "Mẫu áo dài gợi ý cho bạn"
                    : "Mẫu áo dài cho thuê"}
                </h2>
                <div className="lume-toolbar-subtitle-row">
                  <span className="lume-toolbar-count">
                    {totalCount} mẫu phù hợp với bạn
                  </span>
                  {userHasOnboarding && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPersonalizedFilterActive(!isPersonalizedFilterActive);
                        setCurrentPage(1);
                      }}
                      className="lume-toolbar-toggle-btn"
                    >
                      {isPersonalizedFilterActive && sortOption === "recommended"
                        ? "Xem toàn bộ kho"
                        : "Bật lại lọc gợi ý"}
                    </button>
                  )}
                </div>
              </div>

              <div className="lume-sort-dropdown">
                <select
                  className="lume-sort-select"
                  value={sortOption}
                  onChange={(e) => {
                    setSortOption(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="recommended">Phù hợp nhất</option>
                  <option value="price-asc">Giá tăng dần</option>
                  <option value="price-desc">Giá giảm dần</option>
                  <option value="rating">Đánh giá cao nhất</option>
                  <option value="newest">Mới nhất</option>
                </select>
                <ChevronDown size={15} className="lume-sort-icon" />
              </div>
            </div>

            {/* Active Filter Chips */}
            {(rentalType !== "Theo ngày" ||
              searchLocation ||
              selectedTypes.length > 0 ||
              selectedSizes.length > 0 ||
              selectedColors.length > 0 ||
              maxPrice < 1000000) && (
              <div className="lume-active-chips">
                {rentalType && (
                  <span
                    className="lume-chip"
                    onClick={() => setRentalType("Theo ngày")}
                  >
                    {rentalType} <span className="lume-chip-remove">✕</span>
                  </span>
                )}
                {searchLocation && (
                  <span
                    className="lume-chip"
                    onClick={() => setSearchLocation("")}
                  >
                    Khu vực: {searchLocation}{" "}
                    <span className="lume-chip-remove">✕</span>
                  </span>
                )}
                {selectedSizes.map((s) => (
                  <span
                    key={s}
                    className="lume-chip"
                    onClick={() => handleToggleSize(s)}
                  >
                    Size {s} <span className="lume-chip-remove">✕</span>
                  </span>
                ))}
                {selectedColors.map((c) => (
                  <span
                    key={c}
                    className="lume-chip"
                    onClick={() => handleToggleColor(c)}
                  >
                    Màu {COLOR_PALETTES.find((cp) => cp.value === c)?.name || c}{" "}
                    <span className="lume-chip-remove">✕</span>
                  </span>
                ))}
              </div>
            )}

            {/* Promotional Banner Strip */}
            <div className="lume-promo-banner">
              <div className="lume-promo-left">
                <span className="lume-promo-tag">
                  {featuredCampaign ? `Ưu đãi ${featuredCampaign.occasion}` : "Ưu đãi thuê theo ngày"}
                </span>
                <h4 className="lume-promo-headline">
                  {featuredCampaign
                    ? `Giảm ${featuredCampaign.discountPercent}% trực tiếp vào giá thuê khi đặt trước`
                    : "Gói thuê 3 ngày ưu đãi chỉ từ 390.000đ"}
                </h4>
              </div>
              <Link to="/promotions" className="lume-promo-link">
                <span>Xem chi tiết</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Product Grid */}
            {loading ? (
              <div className="lume-loading-state">
                <div className="lume-empty-icon">
                  <Sparkles size={24} />
                </div>
                <h3 className="lume-empty-title">Đang tải danh sách áo dài...</h3>
                <p className="lume-empty-desc">
                  Vui lòng chờ trong giây lát để hệ thống cập nhật các mẫu mới nhất.
                </p>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="lume-empty-state">
                <div className="lume-empty-icon">
                  <SlidersHorizontal size={24} />
                </div>
                <h3 className="lume-empty-title">Không tìm thấy mẫu phù hợp</h3>
                <p className="lume-empty-desc">
                  Hãy thử mở rộng bộ lọc hoặc xóa các tùy chọn đang chọn để xem thêm mẫu.
                </p>
                <button
                  type="button"
                  className="lume-detail-btn"
                  onClick={handleClearAll}
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="lume-product-grid">
                {paginatedProducts.map((product, index) => {
                  const isFavorited = favorites.includes(product._id);
                  const badgeText = getCardBadge(product, index);
                  const provider =
                    typeof product.providerId === "object"
                      ? product.providerId
                      : undefined;
                  const storeName =
                    provider?.businessName ||
                    provider?.brandName ||
                    "LUMÉ ÁO DÀI";
                  const city =
                    provider?.address?.city ||
                    provider?.city ||
                    "Huế";
                  const currentPrice = product.discountedPrice || product.basePrice;

                  return (
                    <article
                      key={product._id}
                      className="lume-product-card"
                      onClick={() => navigate(`/rentals/${product._id}`)}
                    >
                      {/* Image Wrap - 3:4 aspect ratio, full dress visibility */}
                      <div className="lume-card-image-wrap">
                        {badgeText && (
                          <span className="lume-card-badge">{badgeText}</span>
                        )}

                        <button
                          type="button"
                          className={`lume-fav-btn ${isFavorited ? "is-favorited" : ""}`}
                          aria-label="Yêu thích"
                          onClick={(e) => handleToggleFavorite(product._id, e)}
                        >
                          <Heart
                            size={15}
                            fill={isFavorited ? "#B52B47" : "none"}
                            color={isFavorited ? "#B52B47" : "#5E5054"}
                          />
                        </button>

                        <img
                          src={getImageUrl(product.images?.[0])}
                          alt={product.name}
                          className="lume-card-img"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AODAI_IMAGE;
                          }}
                        />
                      </div>

                      {/* Card Content Body */}
                      <div className="lume-card-body">
                        {/* 1. Tên áo dài (đậm) */}
                        <h3
                          className="lume-card-title"
                          title={product.name}
                        >
                          {product.name}
                        </h3>

                        {/* 2. Giá thuê / ngày (nổi bật, màu đỏ rượu) */}
                        <div className="lume-card-price-row">
                          <span className="lume-price-amount">
                            {currentPrice.toLocaleString("vi-VN")}đ
                          </span>
                          <span className="lume-price-unit">/ ngày</span>
                          {product.discountedPrice && product.basePrice > product.discountedPrice && (
                            <span className="lume-price-original">
                              {product.basePrice.toLocaleString("vi-VN")}đ
                            </span>
                          )}
                        </div>

                        {/* 3. Lý do phù hợp ngắn */}
                        {product.recommendation && (
                          <div
                            className="lume-card-match-pill"
                            title={product.recommendation.reasons?.join(' · ') || 'Gợi ý cho bạn'}
                          >
                            <Sparkles size={11} className="lume-match-sparkle" />
                            <span>
                              {product.recommendation.reasons?.[0]
                                ? product.recommendation.reasons[0]
                                : `Phù hợp ${product.recommendation.matchPercent}%`}
                            </span>
                          </div>
                        )}

                        {/* 4. Shop + dấu xác minh + địa điểm (nhỏ, xám) */}
                        <div className="lume-card-shop-row">
                          <span className="lume-shop-name" title={storeName}>
                            {storeName}
                          </span>
                          <span className="lume-verified-badge" title="Cửa hàng đã xác minh">
                            <Check size={11} /> Đã xác minh
                          </span>
                          <span className="lume-meta-dot">•</span>
                          <span>{city}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="lume-pagination">
                <button
                  type="button"
                  className="lume-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`lume-page-btn ${currentPage === pageNum ? "is-active" : ""}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="lume-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  ›
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
