import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  Star,
  MapPin,
  Phone,
  Mail,
  Search,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Tag,
  Clock,
  Shirt,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { API_BASE_URL } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { SmartTagList } from '../../features/smart-tagging/components/SmartTagList';
import type { PublicSmartTagBadge } from '../../features/smart-tagging/types/smartTag.types';

const getImageUrl = (url?: string | null) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.includes('/public-media/legacy/')) {
    const parts = url.split('/public-media/legacy/');
    const filename = parts[parts.length - 1];
    return `${API_BASE_URL}/uploads/${filename}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
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
  badges?: PublicSmartTagBadge[];
  rating?: {
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

interface StoreInfo {
  _id: string;
  businessName: string;
  capabilities?: string[];
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  address?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string;
  };
  media?: {
    logoUrl?: string;
    coverUrl?: string;
    images?: string[];
  };
  rating?: {
    averageRating?: number;
    reviewCount?: number;
  };
  policies?: {
    cancellationPolicy?: string;
    rentalPolicy?: string;
  };
  rentalSettings?: {
    pickupLocation?: {
      addressLine?: string;
      ward?: string;
      district?: string;
      city?: string;
    };
  };
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate: string;
  } | null;
}

const ITEMS_PER_PAGE = 12;

export const ProviderStorePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productsGridRef = useRef<HTMLDivElement>(null);

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductFromDb[]>([]);
  const [loadingStore, setLoadingStore] = useState<boolean>(true);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [activeTab, setActiveTab] = useState<'products' | 'info'>('products');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load Store Info
  useEffect(() => {
    if (!id) return;
    const fetchStoreInfo = async () => {
      try {
        setLoadingStore(true);
        const data = await httpClient.get<StoreInfo>(`/products/store-info/${id}`);
        setStore(data);
      } catch (err: any) {
        console.error('Lỗi khi tải thông tin cửa hàng:', err);
        setError('Không thể tải thông tin gian hàng.');
      } finally {
        setLoadingStore(false);
      }
    };
    fetchStoreInfo();
  }, [id]);

  // Load Store Products (Build proper query string for httpClient fetch)
  useEffect(() => {
    if (!id) return;
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const queryParams = new URLSearchParams();
        queryParams.set('providerId', id);
        
        const data = await httpClient.get<ProductFromDb[]>(`/products?${queryParams.toString()}`);
        setProducts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Lỗi khi tải sản phẩm cửa hàng:', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [id]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSize, selectedColor, sortBy]);

  // Extract available sizes & colors from provider's products for filtering
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.sizes?.forEach((s) => set.add(s.trim().toUpperCase())));
    return Array.from(set).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.colors?.forEach((c) => set.add(c.trim().toUpperCase())));
    return Array.from(set).sort();
  }, [products]);

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesName = p.name?.toLowerCase().includes(term);
          if (!matchesName) return false;
        }
        // Size
        if (selectedSize !== 'ALL') {
          const hasSize = p.sizes?.some((s) => s.trim().toUpperCase() === selectedSize);
          if (!hasSize) return false;
        }
        // Color
        if (selectedColor !== 'ALL') {
          const hasColor = p.colors?.some((c) => c.trim().toUpperCase() === selectedColor);
          if (!hasColor) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.discountedPrice ?? a.basePrice;
        const priceB = b.discountedPrice ?? b.basePrice;
        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        if (sortBy === 'rating') return (b.rating?.averageRating || 0) - (a.rating?.averageRating || 0);
        return 0;
      });
  }, [products, searchTerm, selectedSize, selectedColor, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (productsGridRef.current) {
        productsGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const addressString = useMemo(() => {
    if (!store?.address) return null;
    const parts = [store.address.addressLine, store.address.ward, store.address.district, store.address.city].filter(
      Boolean,
    );
    return parts.join(', ');
  }, [store]);

  const pickupAddressString = useMemo(() => {
    const loc = store?.rentalSettings?.pickupLocation;
    if (!loc) return null;
    const parts = [loc.addressLine, loc.ward, loc.district, loc.city].filter(Boolean);
    return parts.join(', ');
  }, [store]);

  if (loadingStore) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles className="animate-spin" style={{ width: 40, height: 40, color: '#8B263E', margin: '0 auto 16px' }} />
          <p style={{ color: '#666', fontWeight: 500 }}>Đang tải thông tin gian hàng...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div style={{ minHeight: '70vh', padding: '60px 20px', textAlign: 'center', background: '#FAF7F2' }}>
        <Store style={{ width: 64, height: 64, color: '#ccc', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#333', marginBottom: 8 }}>Không tìm thấy gian hàng</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>Gian hàng này không tồn tại hoặc đã tạm ngừng hoạt động.</p>
        <button
          onClick={() => navigate(ROUTES.RENTALS)}
          style={{
            padding: '12px 28px',
            borderRadius: 12,
            background: '#8B263E',
            color: '#fff',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Khám phá danh sách Áo Dài
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#FAF7F2', minHeight: '100vh', paddingBottom: 80 }}>
      {/* STORE HERO HEADER */}
      <div style={{ position: 'relative', width: '100%', background: '#1F1A18', color: '#fff' }}>
        {/* Banner Cover Background */}
        <div
          style={{
            height: 220,
            backgroundImage: store.media?.coverUrl
              ? `url(${getImageUrl(store.media.coverUrl)})`
              : 'linear-gradient(135deg, #2D141A 0%, #4A1E28 50%, #1A0B0E 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.85,
          }}
        />

        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px 32px',
            position: 'relative',
            marginTop: -60,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: 24,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(12px)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.8)',
              color: '#333',
            }}
          >
            {/* Store Avatar Logo */}
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 18,
                overflow: 'hidden',
                background: '#fff',
                border: '4px solid #fff',
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {store.media?.logoUrl ? (
                <img
                  src={getImageUrl(store.media.logoUrl)}
                  alt={store.businessName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Store style={{ width: 50, height: 50, color: '#8B263E' }} />
              )}
            </div>

            {/* Store Meta Details */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#2B181C', margin: 0, letterSpacing: '-0.5px' }}>
                  {store.businessName || 'Gian hàng Áo Dài'}
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: '#FFF3D6',
                    color: '#B37D00',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <Star style={{ width: 14, height: 14, fill: '#FFB800', color: '#FFB800' }} />
                  {store.rating?.averageRating ? store.rating.averageRating.toFixed(1) : '5.0'}
                  {store.rating?.reviewCount ? ` (${store.rating.reviewCount} đánh giá)` : ''}
                </span>
              </div>

              {addressString && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555', fontSize: 14, marginBottom: 8 }}>
                  <MapPin style={{ width: 16, height: 16, color: '#8B263E', flexShrink: 0 }} />
                  <span>{addressString}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#666', marginTop: 10 }}>
                {store.contact?.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone style={{ width: 14, height: 14, color: '#8B263E' }} />
                    <span>{store.contact.phone}</span>
                  </div>
                )}
                {store.contact?.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail style={{ width: 14, height: 14, color: '#8B263E' }} />
                    <span>{store.contact.email}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shirt style={{ width: 14, height: 14, color: '#8B263E' }} />
                  <span>{products.length} mẫu thiết kế</span>
                </div>
              </div>
            </div>

            {/* Campaign Badge if active */}
            {store.activeCampaign && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #E52E71 0%, #FF8A00 100%)',
                  padding: '12px 18px',
                  borderRadius: 14,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 6px 16px rgba(229,46,113,0.3)',
                }}
              >
                <Tag style={{ width: 22, height: 22 }} />
                <div>
                  <div style={{ fontSize: 12, opacity: 0.9, textTransform: 'uppercase', fontWeight: 600 }}>
                    {store.activeCampaign.occasion || 'Khuyến mãi đặc biệt'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Giảm {store.activeCampaign.discountPercent}% toàn gian hàng</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #EAE4DC', marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('products')}
            style={{
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 700,
              color: activeTab === 'products' ? '#8B263E' : '#666',
              borderBottom: activeTab === 'products' ? '3px solid #8B263E' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            Tất cả sản phẩm ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 700,
              color: activeTab === 'info' ? '#8B263E' : '#666',
              borderBottom: activeTab === 'info' ? '3px solid #8B263E' : '3px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            Thông tin & Chính sách cửa hàng
          </button>
        </div>

        {activeTab === 'products' ? (
          <>
            {/* SEARCH & FILTER CONTROLS BAR */}
            <div
              ref={productsGridRef}
              style={{
                background: '#fff',
                padding: 18,
                borderRadius: 16,
                marginBottom: 24,
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                border: '1px solid #EAE4DC',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Search Bar */}
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 18,
                    height: 18,
                    color: '#999',
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm mẫu áo dài trong gian hàng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    borderRadius: 10,
                    border: '1px solid #DDD',
                    outline: 'none',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Filters & Sorting */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Size Filter */}
                {availableSizes.length > 0 && (
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #DDD',
                      fontSize: 14,
                      background: '#fff',
                      color: '#444',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">Kích cỡ: Tất cả</option>
                    {availableSizes.map((s) => (
                      <option key={s} value={s}>
                        Size {s}
                      </option>
                    ))}
                  </select>
                )}

                {/* Color Filter */}
                {availableColors.length > 0 && (
                  <select
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #DDD',
                      fontSize: 14,
                      background: '#fff',
                      color: '#444',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">Màu sắc: Tất cả</option>
                    {availableColors.map((c) => (
                      <option key={c} value={c}>
                        Màu {c}
                      </option>
                    ))}
                  </select>
                )}

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #DDD',
                    fontSize: 14,
                    background: '#fff',
                    color: '#444',
                    cursor: 'pointer',
                  }}
                >
                  <option value="featured">Sắp xếp: Mặc định</option>
                  <option value="price-asc">Giá: Thấp đến Cao</option>
                  <option value="price-desc">Giá: Cao đến Thấp</option>
                  <option value="rating">Đánh giá cao nhất</option>
                </select>
              </div>
            </div>

            {/* PRODUCT GRID */}
            {loadingProducts ? (
              <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles className="animate-spin" style={{ width: 32, height: 32, color: '#8B263E' }} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '48px 24px',
                  textAlign: 'center',
                  border: '1px solid #EAE4DC',
                }}
              >
                <Shirt style={{ width: 56, height: 56, color: '#ccc', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 6 }}>
                  Không tìm thấy sản phẩm nào
                </h3>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
                  Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSize('ALL');
                    setSelectedColor('ALL');
                    setSortBy('featured');
                  }}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: '1px solid #8B263E',
                    color: '#8B263E',
                    background: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 24,
                    marginBottom: 32,
                  }}
                >
                  {paginatedProducts.map((p) => {
                    const finalPrice = p.discountedPrice ?? p.basePrice;
                    const hasDiscount = p.activeCampaign && p.activeCampaign.discountPercent > 0;
                    return (
                      <div
                        key={p._id}
                        onClick={() => navigate(`/rentals/${p._id}`)}
                        style={{
                          background: '#fff',
                          borderRadius: 16,
                          overflow: 'hidden',
                          border: '1px solid #EAE4DC',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.04)';
                        }}
                      >
                        {/* Product Image Wrapper */}
                        <div style={{ position: 'relative', width: '100%', paddingTop: '133%', background: '#F5F5F5' }}>
                          <img
                            src={getImageUrl(p.images?.[0])}
                            alt={p.name}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />

                          {/* Discount Badge */}
                          {hasDiscount && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                background: '#E52E71',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 12,
                                padding: '4px 8px',
                                borderRadius: 6,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              }}
                            >
                              -{p.activeCampaign!.discountPercent}%
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <h4
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: '#2B181C',
                              margin: '0 0 8px',
                              lineHeight: '1.3',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.name}
                          </h4>

                          {/* Badges */}
                          {p.badges && p.badges.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <SmartTagList badges={p.badges} limit={2} />
                            </div>
                          )}

                          {/* Sizes & Colors Summary */}
                          <div style={{ fontSize: 12, color: '#777', marginBottom: 12 }}>
                            {p.sizes?.length > 0 && <span>Size: {p.sizes.join(', ')}</span>}
                          </div>

                          {/* Price Row */}
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#8B263E' }}>
                              {finalPrice.toLocaleString('vi-VN')}đ
                            </span>
                            {hasDiscount && (
                              <span style={{ fontSize: 13, color: '#999', textDecoration: 'line-through' }}>
                                {p.basePrice.toLocaleString('vi-VN')}đ
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>/ ngày</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      background: '#fff',
                      padding: '16px 24px',
                      borderRadius: 16,
                      border: '1px solid #EAE4DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ fontSize: 14, color: '#666' }}>
                      Hiển thị <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> -{' '}
                      <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}</strong> trong tổng số{' '}
                      <strong>{filteredProducts.length}</strong> thiết kế
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Previous Page */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #DDD',
                          background: currentPage === 1 ? '#F5F5F5' : '#fff',
                          color: currentPage === 1 ? '#AAA' : '#333',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronLeft style={{ width: 16, height: 16 }} />
                        Trước
                      </button>

                      {/* Numeric Page Buttons */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: pageNum === currentPage ? 'none' : '1px solid #DDD',
                            background: pageNum === currentPage ? '#8B263E' : '#fff',
                            color: pageNum === currentPage ? '#fff' : '#333',
                            fontWeight: pageNum === currentPage ? 700 : 500,
                            fontSize: 14,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      {/* Next Page */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #DDD',
                          background: currentPage === totalPages ? '#F5F5F5' : '#fff',
                          color: currentPage === totalPages ? '#AAA' : '#333',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Sau
                        <ChevronRight style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* STORE INFO & POLICIES TAB */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Pickup Location & Address */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #EAE4DC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <MapPin style={{ width: 22, height: 22, color: '#8B263E' }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#2B181C' }}>Địa điểm nhận & thử áo</h3>
              </div>
              <p style={{ color: '#444', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                {pickupAddressString || addressString || 'Vui lòng liên hệ shop để biết địa chỉ thử đồ chính xác.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 13 }}>
                <Clock style={{ width: 16, height: 16, color: '#8B263E' }} />
                <span>Giờ mở cửa: 08:00 - 21:00 (Hàng ngày)</span>
              </div>
            </div>

            {/* Cancellation & Rental Policies */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #EAE4DC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <ShieldCheck style={{ width: 22, height: 22, color: '#8B263E' }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#2B181C' }}>Chính sách cho thuê</h3>
              </div>
              <p style={{ color: '#444', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                {store.policies?.rentalPolicy ||
                  'Khách hàng kiểm tra áo dài kỹ lưỡng khi nhận đồ. Đặt cọc tiền hoặc giấy tờ tùy thân theo yêu cầu của shop.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid #EEE' }}>
                <RotateCcw style={{ width: 20, height: 20, color: '#8B263E' }} />
                <div style={{ fontSize: 13, color: '#555' }}>
                  <strong>Chính sách hủy đơn:</strong> {store.policies?.cancellationPolicy || 'Hủy trước 48h hoàn 100% tiền cọc.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderStorePage;
