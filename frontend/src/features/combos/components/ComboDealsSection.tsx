import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Scissors, Camera, ArrowRight, Calendar } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import './ComboDealsSection.css';

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
  };
  photographyPackageId: {
    _id: string;
    name: string;
    images: string[];
    price: number;
    durationHours: number;
    slug: string;
    editedPhotosCount?: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    address?: {
      addressLine: string;
      city: string;
    };
    rating?: {
      averageRating: number;
      totalReviews: number;
    };
  };
  discountPercent: number;
  comboPrice?: number;
  validFrom?: string;
  validTo?: string;
  shootDate?: string | null;
  shootTimeSlot?: string | null;
  image?: string;
}

export const ComboDealsSection: React.FC = () => {
  const navigate = useNavigate();
  const [combos, setCombos] = useState<ComboDeal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCombos = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ComboDeal[]>('/combo-promotions/public');
        const validData = (data || []).filter(
          (c) => c && c.productId && c.photographyPackageId,
        );
        setCombos(validData);
      } catch (err: any) {
        console.warn('Lỗi tải danh sách combo deals:', err);
        setError(err.message || 'Không thể tải danh sách combo khuyến mãi.');
      } finally {
        setLoading(false);
      }
    };
    fetchCombos();
  }, []);

  const handleSelectCombo = (combo: ComboDeal) => {
    navigate(`/combos?select=${combo._id}`);
  };

  if (loading) {
    return (
      <section className="vh-combos-section">
        <div className="vh-combos-container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="vh-combos-badge animate-pulse">
            <Sparkles size={12} style={{ color: '#DC2626' }} />
            <span>Đang tải các combo giá sốc...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error || combos.length === 0) {
    // If no combos exist or there's an error, don't show the section to keep landing page clean, or display a elegant fallback
    return null;
  }

  return (
    <section className="vh-combos-section" id="combos">
      <div className="vh-combos-container">
        {/* Section Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div className="vh-combos-badge">
            <Sparkles size={12} fill="currentColor" />
            <span>COMBO GIÁ SỐC</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '8px 0 0 0' }}>
            Combo Trọn Gói Áo Dài & Nhiếp Ảnh
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '6px', maxWidth: '600px', lineHeight: 1.6 }}>
            Tiết kiệm vượt trội khi đặt đồng thời trang phục Áo Dài cao cấp và Gói Chụp Ảnh nghệ thuật từ cùng một nhà cung cấp.
          </p>
        </div>

        {/* Combos Grid */}
        <div className="vh-combos-grid">
          {combos.map((combo) => {
            const originalPrice = combo.productId.basePrice + combo.photographyPackageId.price;
            const discountedPrice = combo.comboPrice 
              ? combo.comboPrice 
              : Math.round(originalPrice * (1 - combo.discountPercent / 100));

            const aoDaiImg = combo.productId.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
            const packageImg = combo.photographyPackageId.images?.[0] || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb';

            return (
              <div key={combo._id} className="vh-combo-card">
                {/* Ribbon discount badge */}
                <div className="vh-combo-badge-discount">
                  <Sparkles size={13} fill="currentColor" />
                  <span>GIẢM {combo.discountPercent}%</span>
                </div>

                {/* Left/Right diagonal image preview */}
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
                        <strong>Áo dài:</strong> {combo.productId.name}
                      </span>
                    </div>
                    <div className="vh-combo-item-row">
                      <Camera size={14} />
                      <span className="vh-combo-item-text">
                        <strong>Gói chụp:</strong> {combo.photographyPackageId.name} ({combo.photographyPackageId.durationHours}h)
                      </span>
                    </div>
                    <div className="vh-combo-item-row" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      <Calendar size={14} />
                      <span className="vh-combo-item-text">
                        {combo.validFrom && combo.validTo ? (
                          `Áp dụng: ${new Date(combo.validFrom).toLocaleDateString('vi-VN')} - ${new Date(combo.validTo).toLocaleDateString('vi-VN')}`
                        ) : combo.shootDate ? (
                          `Lịch chụp: ${new Date(combo.shootDate).toLocaleDateString('vi-VN')} (${combo.shootTimeSlot || ''})`
                        ) : (
                          'Khung giờ tự chọn'
                        )}
                      </span>
                    </div>
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
                      onClick={() => handleSelectCombo(combo)} 
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
      </div>
    </section>
  );
};
