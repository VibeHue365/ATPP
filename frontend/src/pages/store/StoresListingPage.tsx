import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Camera,
  Scissors,
  MapPin,
  Phone,
  Star,
  Search,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  RotateCcw,
  Tag,
  Building2,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { API_BASE_URL } from '../../config/env';
import { ListingHero } from '../../components/common/ListingHero';
import './StoresListingPage.css';

interface ProviderStoreItem {
  _id: string;
  businessName: string;
  capabilities: string[];
  contact?: {
    email?: string;
    phone?: string;
    website?: string | null;
  };
  address?: {
    addressLine?: string;
    city?: string;
    district?: string;
  };
  media?: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    images?: string[];
  };
  rating?: {
    averageRating: number;
    totalReviews: number;
  };
  comboDiscountPercent?: number;
  productCount?: number;
}

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80';

const getImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

export const StoresListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<ProviderStoreItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'RENTAL' | 'PHOTO' | 'HYBRID'>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');

  useEffect(() => {
    let isMounted = true;
    const fetchStores = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ProviderStoreItem[]>('/products/stores');
        if (isMounted && Array.isArray(data)) {
          setStores(data);
        }
      } catch (err) {
        console.error('Không thể tải danh sách cửa hàng & studio:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStores();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const caps = store.capabilities || [];
      const hasRental = caps.includes('AODAI_RENTAL') || caps.includes('COSTUME_RENTAL') || caps.includes('RENTAL');
      const hasPhoto = caps.includes('PHOTOGRAPHY');

      // Capability tab filter
      if (activeTab === 'RENTAL' && !hasRental) return false;
      if (activeTab === 'PHOTO' && !hasPhoto) return false;
      if (activeTab === 'HYBRID' && (!hasRental || !hasPhoto)) return false;

      // City filter
      if (selectedCity !== 'ALL') {
        const storeCity = (store.address?.city || '').toLowerCase();
        if (!storeCity.includes(selectedCity.toLowerCase())) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const name = (store.businessName || '').toLowerCase();
        const address = `${store.address?.addressLine || ''} ${store.address?.city || ''}`.toLowerCase();
        if (!name.includes(query) && !address.includes(query)) return false;
      }

      return true;
    });
  }, [stores, activeTab, selectedCity, searchTerm]);

  // Cities list
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.address?.city) set.add(s.address.city);
    });
    return Array.from(set);
  }, [stores]);

  return (
    <div className="unified-listing-page stores-page">
      <div className="unified-listing-container">
        {/* 1. Hero Banner */}
        <ListingHero
          breadcrumbs={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Cửa hàng & Studio Đối tác' },
          ]}
          eyebrow="ĐỐI TÁC TÀGO ĐÃ XÁC MINH"
          title="Showroom Áo Dài & Studio Nhiếp Ảnh Tại Huế"
          description="Khám phá các tiệm áo dài truyền thống lâu đời, showroom cổ phục tinh xảo và studio nhiếp ảnh uy tín nhất tại Cố đô Huế đã được TàGo kiểm định chất lượng."
          stats={[
            { value: stores.length > 0 ? `${stores.length}+` : '15+', label: 'Đối tác xác minh' },
            { value: '100%', label: 'Kiểm định uy tín' },
            { value: '4.9★', label: 'Đánh giá xuất sắc' },
          ]}
        />

        {/* 2. Filter & Search Controls */}
        <div className="stores-controls-card">
          <div className="stores-search-wrap">
            <Search size={18} className="stores-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên tiệm, studio, địa chỉ tại Huế..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="stores-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="stores-clear-search-btn"
              >
                ✕
              </button>
            )}
          </div>

          <div className="stores-filters-row">
            {/* Capability Tabs */}
            <div className="stores-tabs-group" role="tablist">
              <button
                type="button"
                className={`stores-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                <Building2 size={15} />
                <span>Tất cả đối tác</span>
              </button>
              <button
                type="button"
                className={`stores-tab-btn ${activeTab === 'RENTAL' ? 'active' : ''}`}
                onClick={() => setActiveTab('RENTAL')}
              >
                <Scissors size={15} />
                <span>Showroom Áo Dài</span>
              </button>
              <button
                type="button"
                className={`stores-tab-btn ${activeTab === 'PHOTO' ? 'active' : ''}`}
                onClick={() => setActiveTab('PHOTO')}
              >
                <Camera size={15} />
                <span>Studio Nhiếp Ảnh</span>
              </button>
              <button
                type="button"
                className={`stores-tab-btn ${activeTab === 'HYBRID' ? 'active' : ''}`}
                onClick={() => setActiveTab('HYBRID')}
              >
                <Sparkles size={15} />
                <span>Trọn gói (Áo dài + Chụp)</span>
              </button>
            </div>

            {/* City Selector */}
            {availableCities.length > 0 && (
              <div className="stores-city-select-wrap">
                <MapPin size={15} className="stores-city-icon" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="stores-city-select"
                >
                  <option value="ALL">Tất cả khu vực</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 3. Stores Cards Grid */}
        {loading ? (
          <div className="stores-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="stores-card-skeleton animate-pulse" />
            ))}
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="stores-empty-state">
            <Store size={48} className="stores-empty-icon" />
            <h3>Không tìm thấy đối tác phù hợp</h3>
            <p>Hãy thử tìm kiếm với từ khóa khác hoặc xóa bớt các bộ lọc đang chọn.</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActiveTab('ALL');
                setSelectedCity('ALL');
              }}
              className="stores-reset-btn"
            >
              <RotateCcw size={15} />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        ) : (
          <div className="stores-grid">
            {filteredStores.map((store) => {
              const caps = store.capabilities || [];
              const hasRental = caps.includes('AODAI_RENTAL') || caps.includes('COSTUME_RENTAL') || caps.includes('RENTAL');
              const hasPhoto = caps.includes('PHOTOGRAPHY');
              const coverImg = getImageUrl(store.media?.coverUrl || store.media?.images?.[0]) || DEFAULT_COVER_IMAGE;
              const logoImg = getImageUrl(store.media?.logoUrl);
              const addressText = store.address
                ? `${store.address.addressLine ? `${store.address.addressLine}, ` : ''}${store.address.city || 'Huế'}`
                : 'Thành phố Huế';

              return (
                <article key={store._id} className="stores-card">
                  {/* Card Cover Banner */}
                  <div className="stores-card-banner">
                    <img
                      src={coverImg}
                      alt={store.businessName}
                      className="stores-card-banner-img"
                      loading="lazy"
                    />
                    <div className="stores-card-banner-overlay" />

                    {/* Verified & Discount Badges */}
                    <div className="stores-card-badges">
                      <span className="stores-badge-verified">
                        <CheckCircle2 size={12} /> Đã xác minh
                      </span>
                      {store.comboDiscountPercent ? (
                        <span className="stores-badge-discount">
                          <Tag size={11} /> Giảm {store.comboDiscountPercent}% combo
                        </span>
                      ) : null}
                    </div>

                    {/* Store Avatar Logo */}
                    <div className="stores-card-avatar-wrap">
                      {logoImg ? (
                        <img
                          src={logoImg}
                          alt={store.businessName}
                          className="stores-card-avatar"
                        />
                      ) : (
                        <div className="stores-card-avatar-fallback">
                          <Store size={22} color="#7A1C2E" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="stores-card-body">
                    <div className="stores-card-header">
                      <h2 className="stores-card-title" title={store.businessName}>
                        {store.businessName}
                      </h2>

                      {/* Rating */}
                      <div className="stores-card-rating">
                        <Star size={14} fill="#F59E0B" color="#F59E0B" />
                        <span className="stores-rating-val">
                          {store.rating?.averageRating ? store.rating.averageRating.toFixed(1) : '4.9'}
                        </span>
                        <span className="stores-reviews-count">
                          ({store.rating?.totalReviews || 12} đánh giá)
                        </span>
                      </div>
                    </div>

                    {/* Capability Tags */}
                    <div className="stores-card-tags">
                      {hasRental && (
                        <span className="stores-tag rental">
                          <Scissors size={11} /> Thuê áo dài &amp; cổ phục
                        </span>
                      )}
                      {hasPhoto && (
                        <span className="stores-tag photo">
                          <Camera size={11} /> Chụp ảnh ngoại cảnh
                        </span>
                      )}
                      {hasRental && hasPhoto && (
                        <span className="stores-tag combo">
                          <Sparkles size={11} /> Có gói Combo
                        </span>
                      )}
                    </div>

                    {/* Address & Contact Info */}
                    <div className="stores-card-info-list">
                      <div className="stores-info-row">
                        <MapPin size={14} className="stores-info-icon" />
                        <span className="stores-info-text" title={addressText}>
                          {addressText}
                        </span>
                      </div>

                      {store.contact?.phone && (
                        <div className="stores-info-row">
                          <Phone size={14} className="stores-info-icon" />
                          <span className="stores-info-text">
                            {store.contact.phone}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="stores-card-footer">
                      {hasRental && (
                        <button
                          type="button"
                          onClick={() => navigate(`/stores/${store._id}`)}
                          className="stores-action-btn primary"
                        >
                          <Store size={14} />
                          <span>Ghé thăm gian hàng</span>
                          <ChevronRight size={14} />
                        </button>
                      )}

                      {hasPhoto && (
                        <button
                          type="button"
                          onClick={() => navigate(`/photographers/${store._id}`)}
                          className={`stores-action-btn ${hasRental ? 'secondary' : 'primary'}`}
                          title="Xem portfolio và các gói chụp ảnh"
                        >
                          <Camera size={14} />
                          <span>{hasRental ? 'Gói chụp' : 'Xem Portfolio & Gói chụp'}</span>
                          <ExternalLink size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoresListingPage;
