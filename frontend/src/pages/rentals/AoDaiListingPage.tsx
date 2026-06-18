import React, { useState, useEffect } from 'react';
import { Heart, Star, ChevronDown, Sparkles, ShoppingCart } from 'lucide-react';
import { httpClient } from '../../services/httpClient';

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
  rating: {
    averageRating: number;
    totalReviews: number;
  };
}

interface FilterState {
  colors: string[];
  sizes: string[];
  materials: string[];
  priceRange: number;
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
  const [products, setProducts] = useState<ProductFromDb[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductFromDb[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    colors: [],
    sizes: [],
    materials: [],
    priceRange: 10000000,
  });

  const [sortOption, setSortOption] = useState<string>('newest');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Dynamically derive available filter options from the fetched database products
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

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ProductFromDb[]>('/products');
        setProducts(data);
        setFilteredProducts(data);
      } catch (err: any) {
        console.error('Lỗi lấy danh sách sản phẩm:', err);
        setError(err.message || 'Không thể tải sản phẩm.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter & Sort Logic
  useEffect(() => {
    let result = [...products];

    // Apply color filters
    if (filters.colors.length > 0) {
      result = result.filter((p) =>
        p.colors.some((color) => filters.colors.includes(color.toUpperCase()))
      );
    }

    // Apply size filters
    if (filters.sizes.length > 0) {
      result = result.filter((p) =>
        p.sizes.some((size) => filters.sizes.includes(size.toUpperCase()))
      );
    }

    // Apply material filters
    if (filters.materials.length > 0) {
      result = result.filter((p) =>
        p.materials.some((mat) => filters.materials.includes(mat.toUpperCase()))
      );
    }

    // Apply price range
    result = result.filter((p) => p.basePrice <= filters.priceRange);

    // Apply sorting
    if (sortOption === 'price-asc') {
      result.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortOption === 'price-desc') {
      result.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sortOption === 'rating') {
      result.sort((a, b) => b.rating.averageRating - a.rating.averageRating);
    }

    setFilteredProducts(result);
  }, [filters, products, sortOption]);

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

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({
      ...prev,
      priceRange: Number(e.target.value),
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      colors: [],
      sizes: [],
      materials: [],
      priceRange: 10000000,
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

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

          <div className="vh-filter-divider" />

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
          <div className="vh-filter-section">
            <h4 className="vh-filter-section-title">KHOẢNG GIÁ</h4>
            <div style={{ marginTop: '16px' }}>
              <input
                type="range"
                min="0"
                max="10000000"
                step="100000"
                value={filters.priceRange}
                onChange={handlePriceChange}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px', fontWeight: 700 }}>
                <span>0đ</span>
                <span className="vh-txt-primary">{filters.priceRange.toLocaleString('vi-VN')}đ</span>
              </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '15px', color: 'var(--color-text-primary)', fontWeight: 700 }}>
              Mới Nhất ({filteredProducts.length} Sản phẩm)
            </span>
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
                        src={p.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'}
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
                        <button className="vh-btn vh-btn-primary vh-btn-sm" style={{ flex: 1, borderRadius: '6px', fontSize: '12px', padding: '8px 12px' }}>
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
