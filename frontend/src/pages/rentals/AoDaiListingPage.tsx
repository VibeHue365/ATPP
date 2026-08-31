import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Heart,
  Star,
  ChevronDown,
  Sparkles,
  Search,
  Check,
  Calendar,
  User,
  GraduationCap,
  Gem,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { httpClient } from "../../services/httpClient";
import { API_BASE_URL } from "../../config/env";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useToast } from "../../components/feedback/Toast";
import Swal from "sweetalert2";


import "./AoDaiListingPage.css";

const getImageUrl = (url?: string) => {
  if (!url) {
    return "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80";
  }
  if (url.includes("/public-media/legacy/")) {
    const parts = url.split("/public-media/legacy/");
    const filename = parts[parts.length - 1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
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
  providerId?: any;
  badges?: Array<{ code: string; label: string; tone?: string }>;
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate?: string;
  } | null;
  discountedPrice?: number;
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMaxPrice(maxPrice), 250);
    return () => window.clearTimeout(timer);
  }, [maxPrice]);

  // Favorites
  const [favorites, setFavorites] = useState<string[]>([]);

  // Sync favorites with user context
  useEffect(() => {
    if (user?.favorites) {
      const favIds = user.favorites
        .filter(
          (f: any) => f.targetType === "PRODUCT" || f.targetType === "Product"
        )
        .map((f: any) => f.targetId.toString());
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
        const response = await httpClient.get<ProductPageResponse>(
          '/products?' + params.toString(),
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

  // 2. Dynamic Quick Categories Tabs with live counts
  const quickCategories = useMemo(
    () => [
      { id: "all", name: "Tất cả", count: `${stats.totalCount} mẫu`, icon: Sparkles },
      { id: "female", name: "Áo dài nữ", count: `${stats.female} mẫu`, icon: User },
      { id: "male", name: "Áo dài nam", count: `${stats.male} mẫu`, icon: User },
      { id: "couple", name: "Áo dài đôi", count: `${stats.couple} mẫu`, icon: Heart },
      { id: "yearbook", name: "Kỷ yếu", count: `${stats.yearbook} mẫu`, icon: GraduationCap },
      { id: "wedding", name: "Cưới hỏi", count: `${stats.wedding} mẫu`, icon: Gem },
    ],
    [stats]
  );

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

  // Helper for card badge
  const getCardBadge = (product: ProductFromDb, index: number) => {
    if (product.activeCampaign) {
      return `-${product.activeCampaign.discountPercent}%`;
    }
    if (product.badges && product.badges.length > 0) {
      return product.badges[0].label;
    }
    const name = product.name.toLowerCase();
    if (name.includes("cặp") || name.includes("đôi")) return "CẶP ĐÔI";
    if (name.includes("nam")) return "NAM";
    if (name.includes("kỷ yếu")) return "KỶ YẾU";
    if (index === 0) return "BÁN CHẠY";
    if (index === 1) return "PHỔ BIẾN";
    if (index === 2) return "MỚI";
    return "NỔI BẬT";
  };

  return (
    <div className="lume-aodai-page">
      <div className="lume-aodai-container">
        {/* 1. Breadcrumb */}
        <nav className="lume-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="lume-breadcrumb-sep">/</span>
          <span className="lume-breadcrumb-current">Thuê áo dài</span>
        </nav>

        {/* 2. Hero Section */}
        <section className="lume-hero-section">
          <div className="lume-hero-text">
            <span className="lume-hero-eyebrow">MẪU ÁO DÀI ĐÃ XÁC MINH</span>
            <h1 className="lume-hero-title">Thuê áo dài tại miền Trung</h1>
            <p className="lume-hero-sub">
              Chọn mẫu, size, hình thức thuê và thời gian nhận trả phù hợp.
            </p>
          </div>
          <div className="lume-hero-stats">
            <div className="lume-stat-item">
              <strong>{stats.totalCount > 0 ? `${stats.totalCount}+` : "0"}</strong>
              <span>Mẫu áo dài</span>
            </div>
            <div className="lume-stat-item">
              <strong>{stats.storesCount}</strong>
              <span>Cửa hàng</span>
            </div>
            <div className="lume-stat-item">
              <strong>{stats.avgRating}/5</strong>
              <span>Đánh giá</span>
            </div>
          </div>
        </section>

        {/* 3. Quick Search Bar */}
        <section className="lume-search-card">
          <form
            className="lume-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              setCurrentPage(1);
            }}
          >
            {/* Field 1: Khu vực nhận áo */}
            <div className="lume-search-field">
              <span className="lume-search-label">Khu vực nhận áo</span>
              <select
                className="lume-search-select"
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
            </div>

            <div className="lume-search-divider" />

            {/* Field 2: Hình thức thuê */}
            <div className="lume-search-field">
              <span className="lume-search-label">Hình thức thuê</span>
              <select
                className="lume-search-select"
                value={rentalType}
                onChange={(e) => setRentalType(e.target.value)}
              >
                <option value="Theo ngày">Theo ngày</option>
                <option value="Theo giờ">Theo giờ</option>
                <option value="Theo sự kiện">Theo sự kiện</option>
              </select>
            </div>

            <div className="lume-search-divider" />

            {/* Field 3: Thời gian */}
            <div className="lume-search-field">
              <span className="lume-search-label">Thời gian</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="date"
                  className="lume-search-input"
                  value={rentalDate}
                  onChange={(e) => setRentalDate(e.target.value)}
                />
                {!rentalDate && (
                  <Calendar size={15} style={{ color: "var(--lume-text-light)" }} />
                )}
              </div>
            </div>

            <div className="lume-search-divider" />

            {/* Field 4: Size */}
            <div className="lume-search-field">
              <span className="lume-search-label">Size</span>
              <select
                className="lume-search-select"
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
            </div>

            {/* Button */}
            <button type="submit" className="lume-search-btn">
              <Search size={16} />
              <span>Tìm áo dài</span>
            </button>
          </form>
        </section>

        {/* 4. Category Quick Filter Pills (Dynamic from Database) */}
        <section className="lume-category-pills">
          {quickCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`lume-pill-btn ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab(cat.id);
                  setCurrentPage(1);
                }}
              >
                <div className="lume-pill-icon-box">
                  <Icon size={16} />
                </div>
                <div className="lume-pill-info">
                  <span className="lume-pill-name">{cat.name}</span>
                  <span className="lume-pill-count">{cat.count}</span>
                </div>
              </button>
            );
          })}
        </section>

        {/* 5. Main 2-Column Section (Sidebar + Grid) */}
        <div className="lume-main-layout">
          {/* Left Column: Sidebar Filter */}
          <aside className="lume-sidebar">
            <div className="lume-sidebar-header">
              <span className="lume-sidebar-eyebrow">BỘ LỌC</span>
              <div className="lume-sidebar-title-row">
                <h2 className="lume-sidebar-title">Tinh chỉnh kết quả</h2>
                <button
                  type="button"
                  className="lume-reset-btn"
                  onClick={handleClearAll}
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Section 1: Loại áo dài (Dynamic live counts) */}
            <div className="lume-filter-section">
              <h3 className="lume-filter-heading">Loại áo dài</h3>
              <div className="lume-checkbox-list">
                <label className="lume-checkbox-label">
                  <div className="lume-checkbox-left">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes("female")}
                      onChange={() => handleToggleType("female")}
                    />
                    <div className="lume-custom-checkbox">
                      {selectedTypes.includes("female") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
                    </div>
                    <span>Áo dài nữ</span>
                  </div>
                  <span className="lume-checkbox-count">{stats.female}</span>
                </label>

                <label className="lume-checkbox-label">
                  <div className="lume-checkbox-left">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes("male")}
                      onChange={() => handleToggleType("male")}
                    />
                    <div className="lume-custom-checkbox">
                      {selectedTypes.includes("male") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
                    </div>
                    <span>Áo dài nam</span>
                  </div>
                  <span className="lume-checkbox-count">{stats.male}</span>
                </label>

                <label className="lume-checkbox-label">
                  <div className="lume-checkbox-left">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes("couple")}
                      onChange={() => handleToggleType("couple")}
                    />
                    <div className="lume-custom-checkbox">
                      {selectedTypes.includes("couple") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
                    </div>
                    <span>Áo dài đôi</span>
                  </div>
                  <span className="lume-checkbox-count">{stats.couple}</span>
                </label>
              </div>
            </div>

            {/* Section 2: Size */}
            <div className="lume-filter-section">
              <h3 className="lume-filter-heading">Size</h3>
              <div className="lume-size-options">
                {SIZE_OPTIONS.map((size) => {
                  const isSelected = selectedSizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`lume-size-btn ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleToggleSize(size)}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Màu sắc */}
            <div className="lume-filter-section">
              <h3 className="lume-filter-heading">Màu sắc</h3>
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

            {/* Section 4: Khoảng giá */}
            <div className="lume-filter-section">
              <h3 className="lume-filter-heading">Khoảng giá</h3>
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

            {/* Section 5: Tiện ích */}
            <div className="lume-filter-section">
              <h3 className="lume-filter-heading">Tiện ích</h3>
              <div className="lume-checkbox-list">
                <label className="lume-checkbox-label">
                  <div className="lume-checkbox-left">
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes("accessories")}
                      onChange={() => handleToggleAmenity("accessories")}
                    />
                    <div className="lume-custom-checkbox">
                      {selectedAmenities.includes("accessories") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
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
                      {selectedAmenities.includes("tryOn") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
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
                      {selectedAmenities.includes("changingRoom") && (
                        <Check size={12} color="#FFFFFF" />
                      )}
                    </div>
                    <span>Có phòng thay đồ</span>
                  </div>
                </label>
              </div>
            </div>
          </aside>

          {/* Right Column: Listing Results */}
          <main className="lume-listing-results">
            {/* Top Results Toolbar */}
            <div className="lume-results-toolbar">
              <div className="lume-toolbar-left">
                <span className="lume-toolbar-eyebrow">DANH SÁCH ÁO DÀI</span>
                <h2 className="lume-toolbar-title">Mẫu áo dài phù hợp</h2>
                <span className="lume-toolbar-count">
                  {totalCount} kết quả được tìm thấy
                </span>
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

            {/* Promotional Banner Card (Dynamic if campaign active) */}
            <div className="lume-promo-banner">
              <div className="lume-promo-left">
                <span className="lume-promo-tag">
                  {featuredCampaign ? `ƯU ĐÃI ${featuredCampaign.occasion.toUpperCase()}` : "ƯU ĐÃI THUÊ THEO NGÀY"}
                </span>
                <h3 className="lume-promo-headline">
                  {featuredCampaign
                    ? `Giảm ${featuredCampaign.discountPercent}% trực tiếp vào giá thuê`
                    : "Gói thuê 3 ngày ưu đãi chỉ từ 390.000đ"}
                </h3>
              </div>
              <Link to="/promotions" className="lume-promo-link">
                <span>Xem chi tiết</span>
                <ArrowRight size={16} />
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
                  const storeName =
                    product.providerId?.businessName ||
                    product.providerId?.brandName ||
                    "LUMÉ ÁO DÀI";
                  const city =
                    product.providerId?.address?.city ||
                    product.providerId?.city ||
                    "Huế";
                  const ratingVal =
                    product.rating?.averageRating?.toFixed(1) || "4.9";
                  const displayDeposit = product.depositAmount
                    ? product.depositAmount.toLocaleString("vi-VN")
                    : Math.round(product.basePrice * 2).toLocaleString("vi-VN");
                  const displaySizes =
                    product.sizes && product.sizes.length > 0
                      ? `Size ${product.sizes.join("-")}`
                      : "Size Free";
                  const currentPrice = product.discountedPrice || product.basePrice;

                  return (
                    <article
                      key={product._id}
                      className="lume-product-card"
                      onClick={() => navigate(`/rentals/${product._id}`)}
                    >
                      {/* Arched Image Container */}
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
                            size={16}
                            fill={isFavorited ? "#B52B47" : "none"}
                          />
                        </button>

                        <div className="lume-card-arch">
                          <img
                            src={getImageUrl(product.images?.[0])}
                            alt={product.name}
                            className="lume-card-img"
                            loading="lazy"
                          />
                        </div>
                      </div>

                      {/* Card Content Body */}
                      <div className="lume-card-body">
                        <div className="lume-card-brand-row">
                          <span className="lume-brand-name">{storeName}</span>
                          <span className="lume-verified-badge">
                            <Check size={13} /> Đã xác minh
                          </span>
                        </div>

                        <h3
                          className="lume-card-title"
                          title={product.name}
                          onClick={() => navigate(`/rentals/${product._id}`)}
                        >
                          {product.name}
                        </h3>

                        <div className="lume-card-meta">
                          <span className="lume-rating">
                            <Star
                              size={14}
                              fill="var(--lume-star-gold)"
                              className="lume-star-icon"
                            />
                            {ratingVal}
                          </span>
                          <span className="lume-meta-dot">•</span>
                          <span>{city}</span>
                        </div>

                        <div className="lume-card-tags">
                          <span className="lume-tag-pill">{displaySizes}</span>
                          <span className="lume-tag-pill">
                            Cọc {displayDeposit}đ
                          </span>
                        </div>

                        <p className="lume-card-hint">
                          Chọn thời gian để kiểm tra lịch
                        </p>

                        <div className="lume-card-footer">
                          <div className="lume-price-group">
                            <span className="lume-price-amount">
                              {currentPrice.toLocaleString("vi-VN")}đ
                            </span>
                            <span className="lume-price-unit">/ ngày</span>
                          </div>

                          <button
                            type="button"
                            className="lume-detail-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/rentals/${product._id}`);
                            }}
                          >
                            Xem chi tiết
                          </button>
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
