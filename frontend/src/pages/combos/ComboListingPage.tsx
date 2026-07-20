import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles, Scissors, Camera, Calendar, ArrowRight,
  Package, Users
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { API_BASE_URL } from '../../config/env';
import './ComboListingPage.css';

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

interface ComboDeal {
  _id: string;
  name: string;
  description?: string;
  productId: {
    _id: string;
    name: string;
    images: string[];
    basePrice: number;
    slug: string;
    depositAmount?: number;
    sizes?: string[];
    colors?: string[];
    materials?: string[];
  };
  photographyPackageId: {
    _id: string;
    name: string;
    images: string[];
    price: number;
    durationHours: number;
    slug: string;
    editedPhotosCount?: number;
    deliveryDays?: number;
    maxPeople?: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    address?: { addressLine: string; city: string };
    rating?: { averageRating: number; totalReviews: number };
  };
  discountPercent: number;
  comboPrice?: number;
  validFrom?: string;
  validTo?: string;
  aoDaiQuantity: number;
  shootPeopleCount: number;
  maxUsage: number;
  usedCount: number;
}

type SortOption = 'discount_high' | 'price_low' | 'newest' | 'date_soonest';

export const ComboListingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [combos, setCombos] = useState<ComboDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('discount_high');

  useEffect(() => {
    const fetchCombos = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ComboDeal[]>('/combo-promotions/public');
        setCombos(data || []);
      } catch (err: any) {
        console.warn('Lỗi tải combo:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCombos();
  }, []);

  useEffect(() => {
    const selectId = new URLSearchParams(location.search).get('select');
    if (selectId) {
      navigate(`/combos/${selectId}`, { replace: true });
    }
  }, [location.search, navigate]);

  const sortedCombos = React.useMemo(() => {
    const sorted = [...combos];
    switch (sortBy) {
      case 'discount_high':
        sorted.sort((a, b) => b.discountPercent - a.discountPercent);
        break;
      case 'price_low': {
        const getPrice = (c: ComboDeal) =>
          c.comboPrice || Math.round((c.productId.basePrice + c.photographyPackageId.price) * (1 - c.discountPercent / 100));
        sorted.sort((a, b) => getPrice(a) - getPrice(b));
        break;
      }
      case 'newest':
        sorted.sort((a, b) => new Date(b.validFrom || 0).getTime() - new Date(a.validFrom || 0).getTime());
        break;
      case 'date_soonest':
        sorted.sort((a, b) => new Date(a.validFrom || 0).getTime() - new Date(b.validFrom || 0).getTime());
        break;
    }
    return sorted;
  }, [combos, sortBy]);

  const maxDiscount = combos.length > 0 ? Math.max(...combos.map(c => c.discountPercent)) : 0;

  return (
    <div className="vh-combo-page">
      {/* Hero Section */}
      <section className="vh-combo-hero">
        <div className="vh-combo-hero-inner">
          <div className="vh-combo-hero-badge">
            <Sparkles size={13} fill="currentColor" />
            <span>COMBO GIÁ SỐC — TIẾT KIỆM LỚN</span>
          </div>
          <h1>
            Combo Trọn Gói<br />
            <span>Áo Dài & Nhiếp Ảnh</span>
          </h1>
          <p>
            Thuê áo dài cao cấp kèm gói chụp ảnh nghệ thuật từ cùng nhà cung cấp với mức giá ưu đãi vượt trội. Một lần đặt, trọn vẹn trải nghiệm.
          </p>
          <div className="vh-combo-hero-stats">
            <div className="vh-combo-hero-stat">
              <span className="vh-combo-hero-stat-value">{combos.length}</span>
              <span className="vh-combo-hero-stat-label">Combo khả dụng</span>
            </div>
            <div className="vh-combo-hero-stat">
              <span className="vh-combo-hero-stat-value">
                {maxDiscount > 0 ? `${maxDiscount}%` : '—'}
              </span>
              <span className="vh-combo-hero-stat-label">Giảm giá cao nhất</span>
            </div>
            <div className="vh-combo-hero-stat">
              <span className="vh-combo-hero-stat-value">2 in 1</span>
              <span className="vh-combo-hero-stat-label">Áo dài + Chụp ảnh</span>
            </div>
          </div>
        </div>
      </section>

      {/* Controls */}
      {!loading && combos.length > 0 && (
        <div className="vh-combo-controls">
          <div className="vh-combo-count">
            Hiển thị <strong>{sortedCombos.length}</strong> combo khuyến mãi
          </div>
          <select
            className="vh-combo-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="discount_high">Giảm giá cao nhất</option>
            <option value="price_low">Giá thấp nhất</option>
            <option value="date_soonest">Áp dụng sớm nhất</option>
            <option value="newest">Mới nhất</option>
          </select>
        </div>
      )}

      {/* Main Content */}
      <div className="vh-combo-main">
        {loading ? (
          <div className="vh-combo-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="vh-combo-skeleton-card">
                <div className="vh-combo-skeleton-img" />
                <div className="vh-combo-skeleton-content">
                  <div className="vh-combo-skeleton-line short" />
                  <div className="vh-combo-skeleton-line medium" />
                  <div className="vh-combo-skeleton-line" />
                  <div className="vh-combo-skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedCombos.length === 0 ? (
          <div className="vh-combo-empty">
            <div className="vh-combo-empty-icon">
              <Package size={36} />
            </div>
            <h3>Chưa có combo khuyến mãi nào</h3>
            <p>
              Các combo trọn gói sẽ sớm được cập nhật. Hãy quay lại sau hoặc khám phá
              các dịch vụ thuê áo dài và nhiếp ảnh riêng lẻ của chúng tôi.
            </p>
          </div>
        ) : (
          <div className="vh-combo-grid">
            {sortedCombos.map((combo) => {
              const originalPrice = combo.productId.basePrice + combo.photographyPackageId.price;
              const discountedPrice = combo.comboPrice
                ? combo.comboPrice
                : Math.round(originalPrice * (1 - combo.discountPercent / 100));

              const aoDaiImg = getImageUrl(combo.productId.images?.[0] || '');
              const packageImg = getImageUrl(combo.photographyPackageId.images?.[0] || '');
              const remaining = combo.maxUsage - (combo.usedCount || 0);

              return (
                <div
                  key={combo._id}
                  className="vh-combo-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/combos/${combo._id}`)}
                >
                  {/* Discount badge */}
                  <div className="vh-combo-badge-discount">
                    <Sparkles size={13} fill="currentColor" />
                    <span>GIẢM {combo.discountPercent}%</span>
                  </div>

                  {/* Image split */}
                  <div className="vh-combo-images">
                    <div className="vh-combo-badge-type">COMBO ĐỘC QUYỀN</div>
                    <div className="vh-combo-img-side">
                      <img src={aoDaiImg} alt={combo.productId.name} />
                    </div>
                    <div className="vh-combo-divider" />
                    <div className="vh-combo-img-side">
                      <img src={packageImg} alt={combo.photographyPackageId.name} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="vh-combo-content">
                    <div className="vh-combo-provider-name">
                      {combo.providerId?.businessName || 'Nhà Cung Cấp Đối Tác'}
                    </div>
                    <h3 className="vh-combo-title" title={combo.name}>
                      {combo.name}
                    </h3>

                    <div className="vh-combo-items-desc">
                      <div className="vh-combo-item-row">
                        <Scissors size={14} />
                        <span className="vh-combo-item-text">
                          <strong>Áo dài ({combo.aoDaiQuantity || 1} bộ):</strong> {combo.productId.name}
                        </span>
                      </div>
                      <div className="vh-combo-item-row">
                        <Camera size={14} />
                        <span className="vh-combo-item-text">
                          <strong>Gói chụp ({combo.shootPeopleCount || 1} người):</strong> {combo.photographyPackageId.name}
                        </span>
                      </div>
                      <div className="vh-combo-item-row" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                        <Calendar size={14} />
                        <span className="vh-combo-item-text" style={{ fontSize: '11px' }}>
                          Áp dụng: {new Date(combo.validFrom || '').toLocaleDateString('vi-VN')} — {new Date(combo.validTo || '').toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      {remaining > 0 && (
                        <div className="vh-combo-item-row" style={{ color: '#059669', fontWeight: 600 }}>
                          <Users size={14} />
                          <span className="vh-combo-item-text" style={{ fontSize: '11px' }}>
                            Còn {remaining}/{combo.maxUsage} suất
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="vh-combo-footer">
                      <div className="vh-combo-price-block">
                        <span className="vh-combo-old-price">
                          {originalPrice.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="vh-combo-new-price">
                          {discountedPrice.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/combos/${combo._id}`);
                        }}
                        className="vh-combo-action-btn"
                      >
                        <span>Xem chi tiết</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComboListingPage;
