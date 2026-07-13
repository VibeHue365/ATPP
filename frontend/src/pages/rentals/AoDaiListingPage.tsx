import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, ChevronDown, Sparkles, ShoppingCart, Settings, Search } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { API_BASE_URL } from '../../config/env';
import { calculateRecommendedSize } from '../../utils/sizeHelper';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useToast } from '../../components/feedback/Toast';
import Swal from 'sweetalert2';

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

const TONE_GROUP_TO_COLORS: Record<string, string[]> = {
  PASTEL: ['WHITE', 'PINK', 'GOLD'],
  RED_GOLD: ['RED', 'GOLD', 'YELLOW'],
  DARK: ['BLACK', 'GREY', 'BROWN', 'BLUE'],
  COLORFUL: ['YELLOW', 'BLUE', 'PINK', 'GREEN', 'RED'],
};

interface ProductFromDb {
  _id: string;
  name: string;
  basePrice: number;
  depositAmount: number;
  images: string[];
  sizes: string[];
  colors: string[];
  materials: string[];
  status: string;
  style?: string;
  categoryId?: { _id: string; name: string; slug: string } | string;
  rating: {
    averageRating: number;
    totalReviews: number;
  };
}

interface ProductCategory {
  _id: string;
  name: string;
  slug: string;
}

interface FilterState {
  categoryId: string;
  colors: string[];
  sizes: string[];
  materials: string[];
  minPrice: string;
  maxPrice: string;
  minRating: string;
  search: string;
}

const translateMaterial = (mat: string): string => {
  switch (mat.toUpperCase()) {
    case 'SILK': return 'Lụa (Silk)';
    case 'VELVET': return 'Nhung (Velvet)';
    case 'BROCADE': return 'Gấm (Brocade)';
    case 'ORGANZA': return 'Organza';
    default: return mat;
  }
};

export const AoDaiListingPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, toggleFavorite: apiToggleFavorite } = useAuth();

  const [products, setProducts] = useState<ProductFromDb[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductFromDb[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and range input states (to allow free typing before apply)
  const [searchVal, setSearchVal] = useState<string>('');
  const [minPriceVal, setMinPriceVal] = useState<string>('');
  const [maxPriceVal, setMaxPriceVal] = useState<string>('');

  // Filters State passed to API
  const [filters, setFilters] = useState<FilterState>({
    categoryId: '',
    colors: [],
    sizes: [],
    materials: [],
    minPrice: '',
    maxPrice: '',
    minRating: '',
    search: '',
  });

  const [sortOption, setSortOption] = useState<string>('newest');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [matchMySize, setMatchMySize] = useState<boolean>(false);
  const [recommendMyGu, setRecommendMyGu] = useState<boolean>(false);

  // Sync favorites with user context
  useEffect(() => {
    if (user?.favorites) {
      const favIds = user.favorites
        .filter((f: any) => f.targetType === 'PRODUCT' || f.targetType === 'Product')
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
    
    const colorCatalog: Record<string, { name: string, hex: string }> = {
      RED: { name: 'Đỏ', hex: '#A11E22' },
      BROWN: { name: 'Nâu', hex: '#5C4033' },
      GOLD: { name: 'Kem/Vàng', hex: '#E6C280' },
      WHITE: { name: 'Trắng', hex: '#FFFFFF' },
      GREEN: { name: 'Xanh lá', hex: '#2E5A44' },
      GREY: { name: 'Xám', hex: '#8E8E93' },
      BLACK: { name: 'Đen', hex: '#1A1A1A' },
      YELLOW: { name: 'Vàng', hex: '#F4D03F' },
      PINK: { name: 'Hồng', hex: '#F1948A' },
      BLUE: { name: 'Xanh dương', hex: '#2980B9' },
    };

    return Array.from(colorsSet).map((cVal) => {
      const matched = colorCatalog[cVal];
      return {
        name: matched ? matched.name : cVal,
        value: cVal,
        hex: matched ? matched.hex : '#CCCCCC',
      };
    });
  }, [products]);

  const availableSizes = React.useMemo(() => {
    const sizesSet = new Set<string>();
    products.forEach((p) => {
      p.sizes?.forEach((s) => sizesSet.add(s.toUpperCase()));
    });
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return Array.from(sizesSet).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
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
        const [productData, categoryData] = await Promise.all([
          httpClient.get<ProductFromDb[]>('/products'),
          httpClient.get<ProductCategory[]>('/products/categories'),
        ]);
        setProducts(productData);
        setCategories(categoryData);
      } catch (err) {
        console.error('Lỗi tải danh mục gốc:', err);
      }
    };
    fetchAllProducts();
  }, []);

  // Sync Match My Size setting if user is logged in
  useEffect(() => {
    if (user?.hasCompletedOnboarding && user?.preferences?.sizeInfo?.preferredSize) {
      setMatchMySize(true);
    }
  }, [user]);

  // Fetch filtered products from backend API when filters or sorting changes
  useEffect(() => {
    const fetchFiltered = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.categoryId) params.append('categoryId', filters.categoryId);
        if (filters.search) params.append('search', filters.search);
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.minRating) params.append('minRating', filters.minRating);
        if (filters.colors.length > 0) params.append('colors', filters.colors.join(','));
        if (filters.sizes.length > 0) params.append('sizes', filters.sizes.join(','));
        if (filters.materials.length > 0) params.append('materials', filters.materials.join(','));

        const data = await httpClient.get<ProductFromDb[]>(`/products?${params.toString()}`);
        
        let result = [...data];

        // Apply personal size recommendation locally on top of filtered results
        if (matchMySize && user?.preferences?.sizeInfo) {
          const sizeInfo = user.preferences.sizeInfo;
          const recommended = calculateRecommendedSize(sizeInfo.height, sizeInfo.weight);
          let sizeToMatch = (recommended || sizeInfo.preferredSize || '').toUpperCase();
          
          if (sizeToMatch === 'XXL' && availableSizes.length > 0 && !availableSizes.includes('XXL')) {
            if (availableSizes.includes('XL')) {
              sizeToMatch = 'XL';
            }
          }

          if (sizeToMatch) {
            result = result.filter((p) =>
              p.sizes.some((size) => size.toUpperCase() === sizeToMatch)
            );
          }
        }

        // Apply personal style recommendations locally
        if (recommendMyGu && user?.preferences) {
          const prefs = user.preferences;
          if (prefs.favoriteColors && prefs.favoriteColors.length > 0) {
            const favColors = prefs.favoriteColors.map((c: string) => c.toUpperCase());
            const expandedColors = new Set<string>();
            favColors.forEach((colorTone: string) => {
              const mapped = TONE_GROUP_TO_COLORS[colorTone];
              if (mapped) {
                mapped.forEach(c => expandedColors.add(c));
              } else {
                expandedColors.add(colorTone);
              }
            });

            if (expandedColors.size > 0) {
              result = result.filter((p) =>
                p.colors.some((color) => expandedColors.has(color.toUpperCase()))
              );
            }
          }
          if (prefs.preferredAoDaiStyles && prefs.preferredAoDaiStyles.length > 0) {
            const favStyles = prefs.preferredAoDaiStyles.map((s: string) => s.toUpperCase());
            result = result.filter((p) =>
              favStyles.includes((p.style || '').toUpperCase())
            );
          }
        }

        // Apply sorting
        if (sortOption === 'price-asc') {
          result.sort((a, b) => a.basePrice - b.basePrice);
        } else if (sortOption === 'price-desc') {
          result.sort((a, b) => b.basePrice - a.basePrice);
        } else if (sortOption === 'rating') {
          result.sort((a, b) => b.rating.averageRating - a.rating.averageRating);
        }

        setFilteredProducts(result);
      } catch (err: any) {
        console.error('Lỗi khi lọc sản phẩm từ API:', err);
        setError(err.message || 'Không thể tải sản phẩm.');
      } finally {
        setLoading(false);
      }
    };

    fetchFiltered();
  }, [filters, sortOption, matchMySize, recommendMyGu, user?.preferences, availableSizes]);

  const handleColorToggle = (colorValue: string) => {
    setFilters((prev) => ({
      ...prev,
      colors: prev.colors.includes(colorValue)
        ? prev.colors.filter((c) => c !== colorValue)
        : [...prev.colors, colorValue],
    }));
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
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applySearchFilter();
    }
  };

  const clearAllFilters = () => {
    setSearchVal('');
    setMinPriceVal('');
    setMaxPriceVal('');
    setFilters({
      categoryId: '',
      colors: [],
      sizes: [],
      materials: [],
      minPrice: '',
      maxPrice: '',
      minRating: '',
      search: '',
    });
  };

  const toggleFavorite = async (id: string) => {
    if (!user) {
      Swal.fire({
        icon: 'warning',
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để lưu sản phẩm yêu thích!',
        confirmButtonColor: 'var(--color-primary)',
        confirmButtonText: 'Đăng nhập ngay',
        showCancelButton: true,
        cancelButtonText: 'Hủy',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }
    try {
      const isAlreadyFavorite = favorites.includes(id);
      await apiToggleFavorite('PRODUCT', id);
      if (isAlreadyFavorite) {
        toast.success('Đã xóa khỏi danh sách yêu thích!');
      } else {
        toast.success('Đã thêm vào danh sách yêu thích!');
      }
    } catch (err) {
      console.error('Lỗi khi lưu yêu thích:', err);
      toast.error('Không thể cập nhật danh sách yêu thích.');
    }
  };

  const calculatedSize = calculateRecommendedSize(user?.preferences?.sizeInfo?.height, user?.preferences?.sizeInfo?.weight);
  let displaySize = calculatedSize || user?.preferences?.sizeInfo?.preferredSize;
  let isFallbackApplied = false;

  if (displaySize && displaySize.toUpperCase() === 'XXL' && !availableSizes.includes('XXL')) {
    if (availableSizes.includes('XL')) {
      displaySize = 'XL';
      isFallbackApplied = true;
    }
  }

  const hasSizePreference = !!displaySize;
  const hasGuPreference = !!((user?.preferences?.favoriteColors && user.preferences.favoriteColors.length > 0) || 
                             (user?.preferences?.preferredAoDaiStyles && user.preferences.preferredAoDaiStyles.length > 0));
  const showPersonalization = user?.hasCompletedOnboarding && (hasSizePreference || hasGuPreference);

  return (
    <div className="vh-listing-page bg-stone-50/50" style={{ width: '100%', minHeight: '100vh', padding: '40px 0' }}>
      <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '40px' }}>
        
        {/* LEFT COLUMN: Filters Sidebar */}
        <aside className="vh-filter-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-header)' }}>Lọc Theo</h3>
            <button 
              onClick={clearAllFilters}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Xóa bộ lọc
            </button>
          </div>

          <div className="vh-filter-section" style={{ marginBottom: '20px' }}>
            <h4 className="vh-filter-section-title">DANH MỤC ÁO DÀI</h4>
            <select
              value={filters.categoryId}
              onChange={(event) => setFilters((previous) => ({
                ...previous,
                categoryId: event.target.value,
              }))}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-light-border)',
                backgroundColor: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="vh-filter-divider" />

          {/* SMART FILTER FOR ONBOARDED USERS */}
          {showPersonalization ? (
            <>
              <div className="vh-filter-section" style={{ backgroundColor: 'var(--color-light-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                <h4 className="vh-filter-section-title" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> GỢI Ý CÁ NHÂN HÓA
                  </span>
                  <button 
                    onClick={() => navigate('/onboarding')} 
                    title="Cập nhật gu & số đo"
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                  >
                    <Settings size={14} style={{ color: 'var(--color-text-secondary)' }} />
                  </button>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hasSizePreference && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={matchMySize}
                        onChange={(e) => setMatchMySize(e.target.checked)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      {isFallbackApplied ? (
                        <span title="Hệ thống tự động lùi về size lớn nhất hiện có (XL) do kho chưa có sản phẩm size XXL của bạn.">
                          📏 Khớp số đo (Size XL - khuyên dùng XXL ⚠️)
                        </span>
                      ) : (
                        `📏 Khớp số đo (Size ${displaySize})`
                      )}
                    </label>
                  )}
                  {hasGuPreference && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={recommendMyGu}
                        onChange={(e) => setRecommendMyGu(e.target.checked)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      ✨ Đề xuất theo gu của tôi
                    </label>
                  )}
                </div>
              </div>
              <div className="vh-filter-divider" />
            </>
          ) : (
            user && user.hasCompletedOnboarding && (
              <>
                <div className="vh-filter-section" style={{ backgroundColor: '#FFFDF9', padding: '16px', borderRadius: '8px', border: '1px dashed #E6C280' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#B7791F', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Gợi ý cá nhân hóa
                  </h4>
                  <p style={{ fontSize: '11px', color: '#744210', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    Thiết lập gu thời trang và số đo cơ thể để nhận đề xuất trang phục phù hợp nhất.
                  </p>
                  <button
                    onClick={() => navigate('/onboarding')}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
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
              <div className="vh-filter-section" style={{ backgroundColor: '#FFFDF9', padding: '16px', borderRadius: '8px', border: '1px dashed #E6C280' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#B7791F', margin: '0 0 6px 0' }}>📏 Chưa tìm thấy size chuẩn?</h4>
                <p style={{ fontSize: '11px', color: '#744210', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Làm khảo sát vóc dáng trong 30 giây để nhận gợi ý kích thước phù hợp nhất với bạn.
                </p>
                <button
                  onClick={() => navigate('/onboarding')}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
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
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {availableColors.map((color) => {
                    const isSelected = filters.colors.includes(color.value);
                    return (
                      <button
                        key={color.value}
                        onClick={() => handleColorToggle(color.value)}
                        title={color.name}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: color.hex,
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: isSelected ? '0 0 0 2px white, var(--shadow-sm)' : 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s ease',
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginTop: '12px' }}>
                  {availableSizes.map((size) => (
                    <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={filters.sizes.includes(size)}
                        onChange={() => handleSizeToggle(size)}
                        style={{ accentColor: 'var(--color-primary)' }}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {availableMaterials.map((mat) => (
                    <label key={mat.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={filters.materials.includes(mat.value)}
                        onChange={() => handleMaterialToggle(mat.value)}
                        style={{ accentColor: 'var(--color-primary)' }}
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
          <div className="vh-filter-section" style={{ marginBottom: '20px' }}>
            <h4 className="vh-filter-section-title">KHOẢNG GIÁ</h4>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Từ (đ)"
                  value={minPriceVal}
                  onChange={(e) => setMinPriceVal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-light-border)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                <input
                  type="number"
                  placeholder="Đến (đ)"
                  value={maxPriceVal}
                  onChange={(e) => setMaxPriceVal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-light-border)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={applyPriceFilter}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
              >
                Áp dụng khoảng giá
              </button>
            </div>
          </div>
          <div className="vh-filter-divider" />

          {/* RATING FILTER (Dropdown) */}
          <div className="vh-filter-section" style={{ marginBottom: '20px' }}>
            <h4 className="vh-filter-section-title">ĐÁNH GIÁ</h4>
            <div style={{ marginTop: '12px' }}>
              <select
                value={filters.minRating}
                onChange={(e) => setFilters(prev => ({ ...prev, minRating: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-light-border)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                }}
              >
                <option value="">Tất cả đánh giá</option>
                <option value="4.5">Từ 4.5 ⭐ trở lên (Xuất sắc)</option>
                <option value="4.0">Từ 4.0 ⭐ trở lên (Rất tốt)</option>
                <option value="3.5">Từ 3.5 ⭐ trở lên (Tốt)</option>
              </select>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Banner + Grid */}
        <main style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* Banner Việt Nam Heritage */}
          <div className="vh-listing-banner">
            <div className="vh-listing-banner-overlay" />
            <img 
              src="https://images.unsplash.com/photo-1596462502278-27bfdc403348" 
              alt="Di sản Việt" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div className="vh-listing-banner-content">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-gold)', textTransform: 'uppercase' }}>
                <Sparkles size={10} /> Tinh hoa cổ phục
              </span>
              <h2 style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-header)', color: 'white', marginTop: '6px' }}>
                Di Sản Việt
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', maxWidth: '540px', lineHeight: 1.6, marginTop: '8px' }}>
                Khám phá vẻ đẹp trường tồn của tà áo dài truyền thống, nơi kỹ thuật thủ công tinh xảo gặp gỡ hơi thở thời đại.
              </p>
            </div>
          </div>

          {/* Grid Header & Sort */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-text-primary)', fontWeight: 700, minWidth: '150px' }}>
              Mới Nhất ({filteredProducts.length} Sản phẩm)
            </span>

            {/* Inline search input */}
            <div style={{ display: 'flex', gap: '8px', position: 'relative', flex: 1, maxWidth: '360px' }}>
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-light-border)',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: 'white',
                }}
              />
              <button
                onClick={applySearchFilter}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Search size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Sắp xếp:</span>
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  paddingRight: '16px',
                  outline: 'none',
                  appearance: 'none',
                }}
              >
                <option value="newest">Sản phẩm mới</option>
                <option value="price-asc">Giá: Thấp đến Cao</option>
                <option value="price-desc">Giá: Cao đến Thấp</option>
                <option value="rating">Được đánh giá cao</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 0, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Dynamic Listing Grid */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '120px 0', fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Đang tải danh sách áo dài...
            </div>
          ) : error ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '120px 0', fontSize: '14px', color: 'var(--color-primary)', fontWeight: 600 }}>
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '120px 0', fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Không có sản phẩm nào phù hợp với bộ lọc đã chọn.
            </div>
          ) : (
            <div className="vh-rentals-grid-3">
              {filteredProducts.map((p) => {
                const isFavorite = favorites.includes(p._id);
                return (
                  <div key={p._id} className="vh-premium-card" style={{ padding: '16px' }}>
                    {/* Image Wrapper */}
                    <div className="vh-card-image-wrapper">
                      <img
                        src={getImageUrl(p.images?.[0])}
                        alt={p.name}
                        className="vh-card-image"
                      />
                      {/* Floating Badge (e.g. New or Hot) */}
                      {p.basePrice >= 400000 ? (
                        <span className="vh-listing-tag-new">BÁN CHẠY</span>
                      ) : (
                        <span className="vh-listing-tag-new" style={{ backgroundColor: 'var(--color-primary)' }}>NEW</span>
                      )}

                      {/* Favorite Icon */}
                      <button 
                        className={`vh-favorite-btn ${isFavorite ? 'active' : ''}`}
                        onClick={() => toggleFavorite(p._id)}
                      >
                        <Heart size={16} fill={isFavorite ? 'var(--color-primary)' : 'none'} />
                      </button>

                      {/* Premium Hover Overlay */}
                      <div className="vh-card-hover-overlay">
                        <button
                          className="vh-btn vh-btn-primary vh-btn-sm"
                          style={{ flex: 1, borderRadius: '6px', fontSize: '12px', padding: '8px 12px' }}
                          onClick={() => navigate(`/rentals/${p._id}`)}
                        >
                          Thuê ngay
                        </button>
                        <button 
                          className="vh-btn vh-btn-sm" 
                          style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: 'var(--color-primary-dark)', border: '1px solid rgba(0,0,0,0.1)', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Thêm vào giỏ hàng"
                        >
                          <ShoppingCart size={16} />
                        </button>
                      </div>

                      {/* Status badge */}
                      <span className="vh-status-badge vh-status-available" style={{ top: '42px', left: '12px', right: 'auto' }}>
                        CÓ SẴN
                      </span>
                    </div>

                    {/* Product Meta */}
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                        {p.name}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                        {p.materials?.[0] ? translateMaterial(p.materials[0]) : 'Lụa cao cấp'}
                      </span>
                      
                      {/* Rating Block */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star 
                              key={starIdx} 
                              size={12} 
                              fill={starIdx <= Math.round(p.rating.averageRating) ? 'var(--color-gold)' : 'none'} 
                              color="var(--color-gold)" 
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                          {p.rating.averageRating.toFixed(1)}
                        </span>
                      </div>

                      {/* Price Block */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '6px' }}>
                        <div>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>
                            {p.basePrice.toLocaleString('vi-VN')} đ
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                            / ngày
                          </span>
                        </div>

                        {/* Color Circles */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {p.colors.map((c, idx) => {
                            const foundColor = availableColors.find((ac) => ac.value === c.toUpperCase());
                            return (
                              <span 
                                key={idx} 
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: foundColor?.hex || '#ccc',
                                  border: '1px solid rgba(0,0,0,0.1)'
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
          {!loading && filteredProducts.length > 0 && (
            <div className="vh-pagination">
              <button className="vh-pagination-btn">&lt;</button>
              <button className="vh-pagination-btn active">1</button>
              <button className="vh-pagination-btn">2</button>
              <button className="vh-pagination-btn">3</button>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>...</span>
              <button className="vh-pagination-btn">&gt;</button>
            </div>
          )}
        </main>

      </div>
    </div>
  );
};
