import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  ChevronDown,
  Sparkles,
  ShoppingCart,
  Settings,
  Search,
  Ruler,
  Palette,
  Fingerprint,
} from "lucide-react";
import { httpClient } from "../../services/httpClient";
import { API_BASE_URL } from "../../config/env";
import { calculateRecommendedSize } from "../../utils/sizeHelper";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useToast } from "../../components/feedback/Toast";
import Swal from "sweetalert2";
import { categoryService } from "../../features/categories/services/categoryService";
import type { Category } from "../../features/categories/types";
import { SmartTagList } from "../../features/smart-tagging/components/SmartTagList";
import type { PublicSmartTagBadge } from "../../features/smart-tagging/types/smartTag.types";
import { CardSkeleton, EmptyState, ErrorState } from "../../components/feedback/AsyncState";

const getImageUrl = (url: string) => {
  if (!url)
    return "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b";
  if (url.includes('/public-media/legacy/')) {
    const parts = url.split('/public-media/legacy/');
    const filename = parts[parts.length - 1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

const TONE_GROUP_TO_COLORS: Record<string, string[]> = {
  PASTEL: ["WHITE", "PINK", "GOLD"],
  RED_GOLD: ["RED", "GOLD", "YELLOW"],
  DARK: ["BLACK", "GREY", "BROWN", "BLUE"],
  COLORFUL: ["YELLOW", "BLUE", "PINK", "GREEN", "RED"],
};

interface ProductFromDb {
  _id: string;
  name: string;
  basePrice: number;
  depositAmount: number;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  sizes: string[];
  colors: string[];
  materials: string[];
  status: string;
  style?: string;
  categoryId?: { _id: string; name: string; slug: string } | string;
  badges?: PublicSmartTagBadge[];
  rating: {
    averageRating: number;
    totalReviews: number;
  };
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate: string;
  } | null;
  discountedPrice?: number;
}

interface FilterState {
  categoryId: string;
  styleCategoryIds: string[];
  eventCategoryIds: string[];
  colors: string[];
  sizes: string[];
  materials: string[];
  priceRange: number;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  search: string;
}

const translateMaterial = (mat: string): string => {
  switch (mat.toUpperCase()) {
    case "SILK":
      return "Lụa (Silk)";
    case "VELVET":
      return "Nhung (Velvet)";
    case "BROCADE":
      return "Gấm (Brocade)";
    case "ORGANZA":
      return "Organza";
    default:
      return mat;
  }
};

export const AoDaiListingPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, toggleFavorite: apiToggleFavorite } = useAuth();

  const [products, setProducts] = useState<ProductFromDb[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [styleCategories, setStyleCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductFromDb[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and range input states (to allow free typing before apply)
  const [searchVal, setSearchVal] = useState<string>("");

  // Filters State passed to API
  const [filters, setFilters] = useState<FilterState>({
    categoryId: "",
    styleCategoryIds: [],
    eventCategoryIds: [],
    colors: [],
    sizes: [],
    materials: [],
    priceRange: 10000000,
    minPrice: "",
    maxPrice: "",
    minRating: "",
    search: "",
  });

  const [localPriceRange, setLocalPriceRange] = useState<number>(filters.priceRange);
  const [minPriceVal, setMinPriceVal] = useState<string>("");
  const [maxPriceVal, setMaxPriceVal] = useState<string>("");
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const ratingRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ratingRef.current && !ratingRef.current.contains(event.target as Node)) {
        setRatingDropdownOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync local slider when filters state changes (e.g. on clear all)
  useEffect(() => {
    setLocalPriceRange(filters.priceRange);
  }, [filters.priceRange]);

  // Debounce the slider to only trigger API call after 250ms of inactivity
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => {
        if (prev.priceRange === localPriceRange) return prev;
        return {
          ...prev,
          priceRange: localPriceRange,
        };
      });
    }, 250);
    return () => clearTimeout(handler);
  }, [localPriceRange]);

  const [sortOption, setSortOption] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 12;
  const [favorites, setFavorites] = useState<string[]>([]);
  // Màu khách đang xem trên từng thẻ sản phẩm (chỉ để đổi ảnh tại chỗ, không lọc danh sách)
  const [cardColors, setCardColors] = useState<Record<string, string>>({});
  const [matchMySize, setMatchMySize] = useState<boolean>(false);
  const [recommendMyGu, setRecommendMyGu] = useState<boolean>(false);
  const [hoveredCardColors, setHoveredCardColors] = useState<Record<string, string>>({});
  const [lastSelectedColor, setLastSelectedColor] = useState<string | null>(null);
  void hoveredCardColors; void lastSelectedColor;

  // Sync favorites with user context
  useEffect(() => {
    if (user?.favorites) {
      const favIds = user.favorites
        .filter(
          (f: any) => f.targetType === "PRODUCT" || f.targetType === "Product",
        )
        .map((f: any) => f.targetId.toString());
      setFavorites(favIds);
    } else {
      setFavorites([]);
    }
  }, [user]);

  // Derive static filter catalogs from ALL products loaded once
  const availableColors = React.useMemo(() => {
    const colorsSet = new Set<string>();
    products.forEach((p) => {
      p.colors?.forEach((c) => colorsSet.add(c.toUpperCase()));
    });

    const colorCatalog: Record<string, { name: string; hex: string }> = {
      RED: { name: "Đỏ", hex: "#A11E22" },
      BROWN: { name: "Nâu", hex: "#5C4033" },
      GOLD: { name: "Kem/Vàng", hex: "#E6C280" },
      WHITE: { name: "Trắng", hex: "#FFFFFF" },
      GREEN: { name: "Xanh lá", hex: "#2E5A44" },
      GREY: { name: "Xám", hex: "#8E8E93" },
      BLACK: { name: "Đen", hex: "#1A1A1A" },
      YELLOW: { name: "Vàng", hex: "#F4D03F" },
      PINK: { name: "Hồng", hex: "#F1948A" },
      BLUE: { name: "Xanh dương", hex: "#2980B9" },
    };

    return Array.from(colorsSet).map((cVal) => {
      const matched = colorCatalog[cVal];
      return {
        name: matched ? matched.name : cVal,
        value: cVal,
        hex: matched ? matched.hex : "#CCCCCC",
      };
    });
  }, [products]);

  const availableSizes = React.useMemo(() => {
    const sizesSet = new Set<string>();
    products.forEach((p) => {
      p.sizes?.forEach((s) => sizesSet.add(s.toUpperCase()));
    });
    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
    return Array.from(sizesSet).sort(
      (a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b),
    );
  }, [products]);

  const availableMaterials = React.useMemo(() => {
    const materialsSet = new Set<string>();
    products.forEach((p) => {
      p.materials?.forEach((m) => materialsSet.add(m.toUpperCase()));
    });
    return Array.from(materialsSet).map((mVal) => ({
      label: translateMaterial(mVal),
      value: mVal,
    }));
  }, [products]);

  // Load static catalog on mount
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const [productData, categoryData, styleCategoryData, eventCategoryData] = await Promise.all([
          httpClient.get<ProductFromDb[]>("/products"),
          categoryService.getPublic({ type: "AODAI_CATEGORY" }),
        categoryService.getPublic({ type: "STYLE" }),
          categoryService.getPublic({ type: "EVENT" }),
        ]);
        setProducts(productData);
        setCategories(categoryData);
        setStyleCategories(styleCategoryData);
        setEventCategories(eventCategoryData);
      } catch (err) {
        console.error("Lỗi tải danh mục gốc:", err);
      }
    };
    fetchAllProducts();
  }, []);

  // Sync Match My Size setting if user is logged in
  useEffect(() => {
    if (
      user?.hasCompletedOnboarding &&
      user?.preferences?.sizeInfo?.preferredSize
    ) {
      setMatchMySize(true);
    }
  }, [user]);

  // Fetch filtered products from backend API when filters or sorting changes
  useEffect(() => {
    let active = true;
    const fetchFiltered = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (filters.categoryId) params.append("categoryId", filters.categoryId);
        if (filters.styleCategoryIds.length > 0)
          params.append("styleCategoryIds", filters.styleCategoryIds.join(","));
        if (filters.eventCategoryIds.length > 0)
          params.append("eventCategoryIds", filters.eventCategoryIds.join(","));
        if (filters.search) params.append("search", filters.search);
        
        if (filters.minPrice) {
          params.append("minPrice", filters.minPrice);
        }
        if (filters.maxPrice) {
          params.append("maxPrice", filters.maxPrice);
        } else {
          params.append("maxPrice", filters.priceRange.toString());
        }
        
        if (filters.minRating) params.append("minRating", filters.minRating);
        if (filters.colors.length > 0)
          params.append("colors", filters.colors.join(","));
        if (filters.sizes.length > 0)
          params.append("sizes", filters.sizes.join(","));
        if (filters.materials.length > 0)
          params.append("materials", filters.materials.join(","));

        const data = await httpClient.get<ProductFromDb[]>(
          `/products?${params.toString()}`,
        );

        let result = [...data];

        // Apply personal size recommendation locally on top of filtered results
        if (matchMySize && user?.preferences?.sizeInfo) {
          const sizeInfo = user.preferences.sizeInfo;
          const recommended = calculateRecommendedSize(
            sizeInfo.height,
            sizeInfo.weight,
          );
          let sizeToMatch = (
            recommended ||
            sizeInfo.preferredSize ||
            ""
          ).toUpperCase();

          if (
            sizeToMatch === "XXL" &&
            availableSizes.length > 0 &&
            !availableSizes.includes("XXL")
          ) {
            if (availableSizes.includes("XL")) {
              sizeToMatch = "XL";
            }
          }

          if (sizeToMatch) {
            result = result.filter((p) =>
              p.sizes.some((size) => size.toUpperCase() === sizeToMatch),
            );
          }
        }

        // Apply personal style recommendations locally
        if (recommendMyGu && user?.preferences) {
          const prefs = user.preferences;
          if (prefs.favoriteColors && prefs.favoriteColors.length > 0) {
            const favColors = prefs.favoriteColors.map((c: string) =>
              c.toUpperCase(),
            );
            const expandedColors = new Set<string>();
            favColors.forEach((colorTone: string) => {
              const mapped = TONE_GROUP_TO_COLORS[colorTone];
              if (mapped) {
                mapped.forEach((c) => expandedColors.add(c));
              } else {
                expandedColors.add(colorTone);
              }
            });

            if (expandedColors.size > 0) {
              result = result.filter((p) =>
                p.colors.some((color) =>
                  expandedColors.has(color.toUpperCase()),
                ),
              );
            }
          }
          if (
            prefs.preferredAoDaiStyles &&
            prefs.preferredAoDaiStyles.length > 0
          ) {
            const favStyles = prefs.preferredAoDaiStyles.map((s: string) =>
              s.toUpperCase(),
            );
            result = result.filter((p) =>
              favStyles.includes((p.style || "").toUpperCase()),
            );
          }
        }

        // Apply sorting
        if (sortOption === "price-asc") {
          result.sort((a, b) => a.basePrice - b.basePrice);
        } else if (sortOption === "price-desc") {
          result.sort((a, b) => b.basePrice - a.basePrice);
        } else if (sortOption === "rating") {
          result.sort(
            (a, b) => b.rating.averageRating - a.rating.averageRating,
          );
        }

        if (active) {
          setFilteredProducts(result);
          setCurrentPage(1); // reset to page 1 whenever results change
        }
      } catch (err: any) {
        console.error("Lỗi khi lọc sản phẩm từ API:", err);
        if (!active) return;
        setError(err.message || "Không thể tải sản phẩm.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFiltered();
    return () => { active = false; };
  }, [
    filters,
    sortOption,
    matchMySize,
    recommendMyGu,
    user?.preferences,
    availableSizes,
  ]);

  const handleColorToggle = (colorValue: string) => {
    setFilters((prev) => {
      const isSelected = prev.colors.includes(colorValue);
      const nextColors = isSelected
        ? prev.colors.filter((c) => c !== colorValue)
        : [...prev.colors, colorValue];

      if (!isSelected) {
        setLastSelectedColor(colorValue);
      } else if (lastSelectedColor === colorValue) {
        const remaining = nextColors[nextColors.length - 1] || null;
        setLastSelectedColor(remaining);
      }

      return {
        ...prev,
        colors: nextColors,
      };
    });
  };

  const handleSizeToggle = (size: string) => {
    setFilters((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size],
    }));
  };

  const handleMaterialToggle = (materialValue: string) => {
    setFilters((prev) => ({
      ...prev,
      materials: prev.materials.includes(materialValue)
        ? prev.materials.filter((m) => m !== materialValue)
        : [...prev.materials, materialValue],
    }));
  };
  const toggleCategoryFilter = (
    field: 'styleCategoryIds' | 'eventCategoryIds',
    categoryId: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].includes(categoryId)
        ? prev[field].filter((id) => id !== categoryId)
        : [...prev[field], categoryId],
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPriceRange(Number(e.target.value));
  };

  const applyPriceFilter = () => {
    setFilters((prev) => ({
      ...prev,
      minPrice: minPriceVal,
      maxPrice: maxPriceVal,
    }));
  };

  const applySearchFilter = () => {
    setFilters((prev) => ({
      ...prev,
      search: searchVal,
    }));
    // Ghi nhận từ khóa tìm kiếm (fire-and-forget)
    if (searchVal.trim().length >= 2) {
      void httpClient.post('/analytics/search', { keyword: searchVal.trim() }).catch(() => {});
    }
  };


  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applySearchFilter();
    }
  };

  const clearAllFilters = () => {
    setSearchVal("");
    setMinPriceVal("");
    setMaxPriceVal("");
    setFilters({
      categoryId: "",
      styleCategoryIds: [],
    eventCategoryIds: [],
    colors: [],
      sizes: [],
      materials: [],
      priceRange: 10000000,
      minPrice: "",
      maxPrice: "",
      minRating: "",
      search: "",
    });
  };

  const toggleFavorite = async (id: string) => {
    if (!user) {
      Swal.fire({
        icon: "warning",
        title: "Yêu cầu đăng nhập",
        text: "Vui lòng đăng nhập để lưu sản phẩm yêu thích!",
        confirmButtonColor: "var(--color-primary)",
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
      const isAlreadyFavorite = favorites.includes(id);
      await apiToggleFavorite("PRODUCT", id);
      if (isAlreadyFavorite) {
        toast.success("Đã xóa khỏi danh sách yêu thích!");
      } else {
        toast.success("Đã thêm vào danh sách yêu thích!");
      }
    } catch (err) {
      console.error("Lỗi khi lưu yêu thích:", err);
      toast.error("Không thể cập nhật danh sách yêu thích.");
    }
  };

  const calculatedSize = calculateRecommendedSize(
    user?.preferences?.sizeInfo?.height,
    user?.preferences?.sizeInfo?.weight,
  );
  let displaySize =
    calculatedSize || user?.preferences?.sizeInfo?.preferredSize;
  let isFallbackApplied = false;

  if (
    displaySize &&
    displaySize.toUpperCase() === "XXL" &&
    !availableSizes.includes("XXL")
  ) {
    if (availableSizes.includes("XL")) {
      displaySize = "XL";
      isFallbackApplied = true;
    }
  }

  const hasSizePreference = !!displaySize;
  const hasGuPreference = !!(
    (user?.preferences?.favoriteColors &&
      user.preferences.favoriteColors.length > 0) ||
    (user?.preferences?.preferredAoDaiStyles &&
      user.preferences.preferredAoDaiStyles.length > 0)
  );
  const showPersonalization =
    user?.hasCompletedOnboarding && (hasSizePreference || hasGuPreference);

  return (
    <div
      className="vh-listing-page bg-stone-50/50"
      style={{ width: "100%", minHeight: "100vh", padding: "40px 0" }}
    >
      <div
        className="max-w-[1600px] w-full px-6 md:px-12 mx-auto"
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "40px",
        }}
      >
        {/* LEFT COLUMN: Filters Sidebar */}
        <aside className="vh-filter-sidebar" style={{ position: 'sticky', top: '80px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', paddingRight: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                fontFamily: "var(--font-header)",
              }}
            >
              Lọc Theo
            </h3>
            <button
              onClick={clearAllFilters}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Xóa bộ lọc
            </button>
          </div>

          <div className="vh-filter-section" style={{ marginBottom: "20px" }}>
            <h4 className="vh-filter-section-title">DANH MỤC ÁO DÀI</h4>
            <select
              value={filters.categoryId}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  categoryId: event.target.value,
                }))
              }
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-light-border)",
                backgroundColor: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="vh-filter-section" style={{ marginBottom: "20px" }}>
            <h4 className="vh-filter-section-title">PHONG CÁCH</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              {styleCategories.map((category) => {
                const selected = filters.styleCategoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategoryFilter("styleCategoryIds", category.id)}
                    style={{
                      border: `1px solid ${selected ? "var(--color-primary)" : "var(--color-light-border)"}`,
                      backgroundColor: selected ? "rgba(118, 20, 28, 0.08)" : "white",
                      color: selected ? "var(--color-primary-dark)" : "var(--color-text-primary)",
                      borderRadius: "999px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="vh-filter-section" style={{ marginBottom: "20px" }}>
            <h4 className="vh-filter-section-title">DỊP / SỰ KIỆN</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              {eventCategories.map((category) => {
                const selected = filters.eventCategoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategoryFilter("eventCategoryIds", category.id)}
                    style={{
                      border: `1px solid ${selected ? "var(--color-primary)" : "var(--color-light-border)"}`,
                      backgroundColor: selected ? "rgba(118, 20, 28, 0.08)" : "white",
                      color: selected ? "var(--color-primary-dark)" : "var(--color-text-primary)",
                      borderRadius: "999px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>          <div className="vh-filter-divider" />

          {/* SMART FILTER FOR ONBOARDED USERS */}
          {showPersonalization ? (
            <>
              <div
                className="vh-filter-section"
                style={{
                  background:
                    "linear-gradient(180deg, var(--color-primary-trans) 0%, var(--color-light-bg) 70%)",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-primary-trans)",
                }}
              >
                <h4
                  className="vh-filter-section-title"
                  style={{
                    color: "var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    margin: "0 0 12px 0",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Fingerprint size={15} />
                    </span>
                    Gợi ý cá nhân hóa
                  </span>
                  <button
                    onClick={() => navigate("/onboarding")}
                    title="Cập nhật gu & số đo"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                  >
                    <Settings
                      size={14}
                      style={{ color: "var(--color-text-secondary)" }}
                    />
                  </button>
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {hasSizePreference && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        cursor: "pointer",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        backgroundColor: "white",
                        border: matchMySize
                          ? "1.5px solid var(--color-primary)"
                          : "1px solid var(--color-light-border)",
                        boxShadow: matchMySize
                          ? "0 0 0 3px var(--color-primary-trans)"
                          : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <Ruler size={17} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                            Khớp số đo của tôi
                          </span>
                          {isFallbackApplied ? (
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#B45309" }}>
                              Size {displaySize} · kho chưa có XXL, tạm dùng XL
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                              Ưu tiên size {displaySize}
                            </span>
                          )}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={matchMySize}
                        onChange={(e) => setMatchMySize(e.target.checked)}
                        style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", flexShrink: 0 }}
                      />
                    </label>
                  )}
                  {hasGuPreference && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        cursor: "pointer",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        backgroundColor: "white",
                        border: recommendMyGu
                          ? "1.5px solid var(--color-primary)"
                          : "1px solid var(--color-light-border)",
                        boxShadow: recommendMyGu
                          ? "0 0 0 3px var(--color-primary-trans)"
                          : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Palette size={17} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                          Đề xuất theo gu của tôi
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={recommendMyGu}
                        onChange={(e) => setRecommendMyGu(e.target.checked)}
                        style={{ accentColor: "var(--color-primary)", width: "16px", height: "16px", flexShrink: 0 }}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="vh-filter-divider" />
            </>
          ) : (
            user &&
            user.hasCompletedOnboarding && (
              <>
                <div
                  className="vh-filter-section"
                  style={{
                    backgroundColor: "#FFFDF9",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px dashed #E6C280",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#B7791F",
                      margin: "0 0 6px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Sparkles size={14} /> Gợi ý cá nhân hóa
                  </h4>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#744210",
                      margin: "0 0 12px 0",
                      lineHeight: 1.5,
                    }}
                  >
                    Thiết lập gu thời trang và số đo cơ thể để nhận đề xuất
                    trang phục phù hợp nhất.
                  </p>
                  <button
                    onClick={() => navigate("/onboarding")}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    Thiết lập ngay
                  </button>
                </div>
                <div className="vh-filter-divider" />
              </>
            )
          )}

          {/* PROMOTION BANNER FOR USERS WHO HAVEN'T COMPLETED ONBOARDING */}
          {user && !user.hasCompletedOnboarding && (
            <>
              <div
                className="vh-filter-section"
                style={{
                  backgroundColor: "#FFFDF9",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px dashed #E6C280",
                }}
              >
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#B7791F",
                    margin: "0 0 6px 0",
                  }}
                >
                  📏 Chưa tìm thấy size chuẩn?
                </h4>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#744210",
                    margin: "0 0 12px 0",
                    lineHeight: 1.5,
                  }}
                >
                  Làm khảo sát vóc dáng trong 30 giây để nhận gợi ý kích thước
                  phù hợp nhất với bạn.
                </p>
                <button
                  onClick={() => navigate("/onboarding")}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Khảo sát ngay
                </button>
              </div>
              <div className="vh-filter-divider" />
            </>
          )}

          {/* COLOR FILTER */}
          {availableColors.length > 0 && (
            <>
              <div className="vh-filter-section">
                <h4 className="vh-filter-section-title">MÀU SẮC</h4>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  {availableColors.map((color) => {
                    const isSelected = filters.colors.includes(color.value);
                    return (
                      <button
                        key={color.value}
                        onClick={() => handleColorToggle(color.value)}
                        title={color.name}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: color.hex,
                          border: isSelected ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: isSelected ? '0 0 0 2px white, 0 0 0 4px var(--color-primary), var(--shadow-sm)' : 'none',
                          cursor: "pointer",
                          position: "relative",
                          transition: "all 0.2s ease",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="vh-filter-divider" />
            </>
          )}

          {/* SIZE FILTER */}
          {availableSizes.length > 0 && (
            <>
              <div className="vh-filter-section">
                <h4 className="vh-filter-section-title">KÍCH CỠ</h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px 20px",
                    marginTop: "12px",
                  }}
                >
                  {availableSizes.map((size) => (
                    <label
                      key={size}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={filters.sizes.includes(size)}
                        onChange={() => handleSizeToggle(size)}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      <span>{size}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="vh-filter-divider" />
            </>
          )}

          {/* MATERIAL FILTER */}
          {availableMaterials.length > 0 && (
            <>
              <div className="vh-filter-section">
                <h4 className="vh-filter-section-title">CHẤT LIỆU</h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginTop: "12px",
                  }}
                >
                  {availableMaterials.map((mat) => (
                    <label
                      key={mat.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={filters.materials.includes(mat.value)}
                        onChange={() => handleMaterialToggle(mat.value)}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      <span>{mat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="vh-filter-divider" />
            </>
          )}

          {/* PRICE RANGE FILTER */}
          <div className="vh-filter-section" style={{ marginBottom: "20px" }}>
            <h4 className="vh-filter-section-title">KHOẢNG GIÁ</h4>
            <div style={{ marginTop: "16px" }}>
              <input
                type="range"
                min="0"
                max="10000000"
                step="100000"
                value={localPriceRange}
                onChange={handlePriceChange}
                style={{ width: "100%", accentColor: "var(--color-primary)" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  marginTop: "8px",
                  fontWeight: 700,
                }}
              >
                <span>0đ</span>
                <span style={{ color: "var(--color-primary)" }}>
                  {localPriceRange.toLocaleString("vi-VN")}đ
                </span>
              </div>

              {/* Min & Max Price Text Inputs */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px" }}>
                <input
                  type="number"
                  placeholder="Từ (đ)"
                  value={minPriceVal}
                  onChange={(e) => setMinPriceVal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-light-border)",
                    fontSize: "12px",
                    fontWeight: 600,
                    outline: "none",
                    backgroundColor: "white",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-light-border)"}
                />
                <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>-</span>
                <input
                  type="number"
                  placeholder="Đến (đ)"
                  value={maxPriceVal}
                  onChange={(e) => setMaxPriceVal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-light-border)",
                    fontSize: "12px",
                    fontWeight: 600,
                    outline: "none",
                    backgroundColor: "white",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-light-border)"}
                />
                <button
                  onClick={applyPriceFilter}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--color-primary-dark)"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--color-primary)"}
                >
                  Lọc
                </button>
              </div>
            </div>
          </div>
          <div className="vh-filter-divider" />

          {/* RATING FILTER (Dropdown) */}
          <div className="vh-filter-section" style={{ marginBottom: "20px" }} ref={ratingRef}>
            <h4 className="vh-filter-section-title">ĐÁNH GIÁ</h4>
            <div style={{ marginTop: "12px", position: "relative" }}>
              <button
                onClick={() => setRatingDropdownOpen(!ratingDropdownOpen)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-light-border)",
                  backgroundColor: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--color-light-border)"}
              >
                <span>
                  {filters.minRating === "4.5"
                    ? "Từ 4.5 ⭐ trở lên (Xuất sắc)"
                    : filters.minRating === "4.0"
                    ? "Từ 4.0 ⭐ trở lên (Rất tốt)"
                    : filters.minRating === "3.5"
                    ? "Từ 3.5 ⭐ trở lên (Tốt)"
                    : "Tất cả đánh giá"}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: ratingDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                    color: "var(--color-text-secondary)",
                  }}
                />
              </button>

              {ratingDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid var(--color-light-border)",
                    borderRadius: "8px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    zIndex: 10,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    padding: "4px",
                  }}
                >
                  {[
                    { value: "", label: "Tất cả đánh giá" },
                    { value: "4.5", label: "Từ 4.5 ⭐ trở lên (Xuất sắc)" },
                    { value: "4.0", label: "Từ 4.0 ⭐ trở lên (Rất tốt)" },
                    { value: "3.5", label: "Từ 3.5 ⭐ trở lên (Tốt)" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, minRating: opt.value }));
                        setRatingDropdownOpen(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        backgroundColor: filters.minRating === opt.value ? "rgba(239, 68, 68, 0.08)" : "transparent",
                        color: filters.minRating === opt.value ? "var(--color-primary)" : "var(--color-text-primary)",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: filters.minRating === opt.value ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--color-light-bg)";
                        e.currentTarget.style.color = "var(--color-primary)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = filters.minRating === opt.value ? "rgba(239, 68, 68, 0.08)" : "transparent";
                        e.currentTarget.style.color = filters.minRating === opt.value ? "var(--color-primary)" : "var(--color-text-primary)";
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Banner + Grid */}
        <main style={{ display: "flex", flexDirection: "column" }}>
          {/* Banner Việt Nam Heritage */}
          <div className="vh-listing-banner">
            <div className="vh-listing-banner-overlay" />
            <img
              src="https://images.unsplash.com/photo-1596462502278-27bfdc403348"
              alt="Di sản Việt"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div className="vh-listing-banner-content">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--color-gold)",
                  textTransform: "uppercase",
                }}
              >
                <Sparkles size={10} /> Tinh hoa cổ phục
              </span>
              <h2
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  fontFamily: "var(--font-header)",
                  color: "white",
                  marginTop: "6px",
                }}
              >
                Di Sản Việt
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.85)",
                  maxWidth: "540px",
                  lineHeight: 1.6,
                  marginTop: "8px",
                }}
              >
                Khám phá vẻ đẹp trường tồn của tà áo dài truyền thống, nơi kỹ
                thuật thủ công tinh xảo gặp gỡ hơi thở thời đại.
              </p>
            </div>
          </div>

          {/* Grid Header & Sort */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                color: "var(--color-text-primary)",
                fontWeight: 700,
                minWidth: "150px",
              }}
            >
              Mới Nhất ({filteredProducts.length} Sản phẩm)
            </span>

            {/* Inline search input */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                position: "relative",
                flex: 1,
                maxWidth: "360px",
              }}
            >
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  width: "100%",
                  padding: "8px 36px 8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-light-border)",
                  fontSize: "13px",
                  outline: "none",
                  backgroundColor: "white",
                }}
              />
              <button
                onClick={applySearchFilter}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                }}
              >
                <Search size={16} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                position: "relative",
              }}
              ref={sortRef}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-secondary)",
                  fontWeight: 600,
                }}
              >
                Sắp xếp:
              </span>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "none",
                  background: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  outline: "none",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--color-light-bg)"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <span>
                  {sortOption === "newest"
                    ? "Sản phẩm mới"
                    : sortOption === "price-asc"
                    ? "Giá: Thấp đến Cao"
                    : sortOption === "price-desc"
                    ? "Giá: Cao đến Thấp"
                    : sortOption === "rating"
                    ? "Được đánh giá cao"
                    : "Sắp xếp"}
                </span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: sortDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {sortDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid var(--color-light-border)",
                    borderRadius: "8px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    zIndex: 10,
                    width: "180px",
                    display: "flex",
                    flexDirection: "column",
                    padding: "4px",
                  }}
                >
                  {[
                    { value: "newest", label: "Sản phẩm mới" },
                    { value: "price-asc", label: "Giá: Thấp đến Cao" },
                    { value: "price-desc", label: "Giá: Cao đến Thấp" },
                    { value: "rating", label: "Được đánh giá cao" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortOption(opt.value);
                        setSortDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        backgroundColor: sortOption === opt.value ? "rgba(239, 68, 68, 0.08)" : "transparent",
                        color: sortOption === opt.value ? "var(--color-primary)" : "var(--color-text-primary)",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: sortOption === opt.value ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--color-light-bg)";
                        e.currentTarget.style.color = "var(--color-primary)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = sortOption === opt.value ? "rgba(239, 68, 68, 0.08)" : "transparent";
                        e.currentTarget.style.color = sortOption === opt.value ? "var(--color-primary)" : "var(--color-text-primary)";
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Listing Grid */}
          {loading && filteredProducts.length === 0 ? (
            <CardSkeleton count={6} />
          ) : error ? (
            <ErrorState message={error} action={{ label: 'Thử lại', onClick: () => window.location.reload() }} />
          ) : filteredProducts.length === 0 ? (
            <EmptyState title="Không có áo dài phù hợp" message="Hãy thử thay đổi từ khóa hoặc bộ lọc đang chọn." />
          ) : (
            <div
              className="vh-rentals-grid-3"
              style={{
                opacity: loading ? 0.55 : 1,
                transition: "opacity 0.15s ease-in-out",
              }}
            >
              {filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((p) => {
                const isFavorite = favorites.includes(p._id);
                // Màu đang xem trên từng thẻ; chưa chọn thì lấy ảnh mặc định của sản phẩm.
                const previewColor = cardColors[p._id];
                const cardImage =
                  (previewColor &&
                    p.colorImages?.find(
                      (entry) => (entry.color || "").toUpperCase() === previewColor.toUpperCase(),
                    )?.images?.[0]) ||
                  p.images?.[0];
                return (
                  <div
                    key={p._id}
                    className="vh-premium-card"
                    style={{ padding: "16px" }}
                    onMouseLeave={() => setHoveredCardColors(prev => {
                      const copy = { ...prev };
                      delete copy[p._id];
                      return copy;
                    })}
                  >
                    {/* Image Wrapper */}
                    <div className="vh-card-image-wrapper">
                      <img
                        src={getImageUrl(cardImage)}
                        alt={p.name}
                        className="vh-card-image"
                      />
                      {/* Floating Badge (e.g. New or Hot) */}
                      {p.activeCampaign ? (
                        <span className="vh-listing-tag-new" style={{ backgroundColor: '#EF4444' }}>-{p.activeCampaign.discountPercent}%</span>
                      ) : p.basePrice >= 400000 ? (
                        <span className="vh-listing-tag-new">BÁN CHẠY</span>
                      ) : (
                        <span
                          className="vh-listing-tag-new"
                          style={{ backgroundColor: "var(--color-primary)" }}
                        >
                          NEW
                        </span>
                      )}

                      {/* Favorite Icon */}
                      <button
                        className={`vh-favorite-btn ${isFavorite ? "active" : ""}`}
                        onClick={() => toggleFavorite(p._id)}
                      >
                        <Heart
                          size={16}
                          fill={isFavorite ? "var(--color-primary)" : "none"}
                        />
                      </button>

                      {/* Premium Hover Overlay */}
                      <div className="vh-card-hover-overlay">
                        <button
                          className="vh-btn vh-btn-primary vh-btn-sm"
                          style={{
                            flex: 1,
                            borderRadius: "6px",
                            fontSize: "12px",
                            padding: "8px 12px",
                          }}
                          onClick={() => navigate(`/rentals/${p._id}`)}
                        >
                          Thuê ngay
                        </button>
                        <button
                          className="vh-btn vh-btn-sm"
                          style={{
                            padding: "8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            color: "var(--color-primary-dark)",
                            border: "1px solid rgba(0,0,0,0.1)",
                            minWidth: "32px",
                            height: "32px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                          onClick={() => navigate(`/rentals/${p._id}`)}
                          title="Thêm vào giỏ hàng"
                        >
                          <ShoppingCart size={16} />
                        </button>
                      </div>

                      {/* Status badge */}
                      <span
                        className="vh-status-badge vh-status-available"
                        style={{ display: 'none', top: "42px", left: "12px", right: "auto" }}
                      >
                        CÓ SẴN
                      </span>
                    </div>

                    {/* Product Meta */}
                    <div
                      style={{
                        marginTop: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          margin: 0,
                          color: "var(--color-text-primary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {p.name}
                      </h4>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--color-text-secondary)",
                          display: "block",
                        }}
                      >
                        {p.materials?.[0]
                          ? translateMaterial(p.materials[0])
                          : "Lụa cao cấp"}
                      </span>

                      <SmartTagList badges={p.badges} limit={3} />

                      {/* Rating Block */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "2px" }}>
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star
                              key={starIdx}
                              size={12}
                              fill={
                                starIdx <= Math.round(p.rating.averageRating)
                                  ? "var(--color-gold)"
                                  : "none"
                              }
                              color="var(--color-gold)"
                            />
                          ))}
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {p.rating.averageRating.toFixed(1)}
                        </span>
                      </div>

                      {/* Price Block */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-end",
                          marginTop: "6px",
                        }}
                      >
                        <div>
                          {p.activeCampaign ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '12px', textDecoration: 'line-through', color: 'var(--color-text-secondary)' }}>
                                {p.basePrice.toLocaleString('vi-VN')} đ
                              </span>
                              <span style={{ fontSize: '16px', fontWeight: 800, color: '#EF4444' }}>
                                {(p.discountedPrice || p.basePrice).toLocaleString('vi-VN')} đ
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>
                              {p.basePrice.toLocaleString('vi-VN')} đ
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                            / ngày
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "4px" }}>
                          {p.colors.map((c, idx) => {
                            const foundColor = availableColors.find(
                              (ac) => ac.value === c.toUpperCase(),
                            );
                            return (
                              <button
                                key={idx}
                                type="button"
                                title={foundColor?.name || c}
                                aria-label={`Xem màu ${foundColor?.name || c}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCardColors((prev) => ({ ...prev, [p._id]: c }));
                                }}
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  padding: 0,
                                  borderRadius: "50%",
                                  backgroundColor: foundColor?.hex || "#ccc",
                                  border:
                                    (previewColor || "").toUpperCase() === c.toUpperCase()
                                      ? "2px solid var(--color-primary)"
                                      : "1px solid rgba(0,0,0,0.15)",
                                  cursor: "pointer",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}
          {!loading && filteredProducts.length > ITEMS_PER_PAGE && (() => {
            const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
            const delta = 2;
            const pages: (number | 'ellipsis')[] = [];
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                pages.push(i);
              } else if (pages[pages.length - 1] !== 'ellipsis') {
                pages.push('ellipsis');
              }
            }
            return (
              <div className="vh-pagination">
                <button
                  className="vh-pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  &lt;
                </button>
                {pages.map((page, idx) =>
                  page === 'ellipsis' ? (
                    <span key={`ell-${idx}`} style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '0 4px' }}>...</span>
                  ) : (
                    <button
                      key={page}
                      className={`vh-pagination-btn${currentPage === page ? ' active' : ''}`}
                      onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  className="vh-pagination-btn"
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  &gt;
                </button>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
};
