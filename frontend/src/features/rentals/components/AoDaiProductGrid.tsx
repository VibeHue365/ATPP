import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ShoppingCart } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { ROUTES } from '../../../config/routes';

interface AoDaiItem {
  id: string;
  name: string;
  material: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED';
  image: string;
}

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
}

const translateMaterial = (mat: string): string => {
  switch (mat.toUpperCase()) {
    case 'SILK': return 'Lụa cao cấp';
    case 'BROCADE': return 'Gấm hoàng gia';
    case 'LINEN': return 'Linen tự nhiên';
    default: return mat;
  }
};

export const AoDaiProductGrid: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AoDaiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ProductFromDb[]>('/products');
        
        const mappedItems: AoDaiItem[] = data.map((p) => ({
          id: p._id,
          name: p.name,
          material: p.materials?.[0] ? translateMaterial(p.materials[0]) : 'Lụa cao cấp',
          price: p.basePrice.toLocaleString('vi-VN') + 'đ',
          status: p.status === 'ACTIVE' ? 'AVAILABLE' : 'RESERVED',
          image: p.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
        }));

        setItems(mappedItems);
      } catch (err: any) {
        console.error('Lỗi khi lấy danh sách sản phẩm:', err);
        setError(err.message || 'Không thể kết nối đến máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <section id="rentals" className="vh-features-section bg-stone-50/50 py-20 px-6 border-y border-stone-200">
      <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto">
        {/* Section Header */}
        <div className="vh-section-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', textAlign: 'left', maxWidth: '100%', marginBottom: '40px' }}>
          <div>
            <span className="vh-section-badge">Thuê Áo Dài</span>
            <h2 className="text-3xl font-bold font-header text-stone-900 mt-2">Xu Hướng Áo Dài</h2>
            <p className="text-stone-500 mt-1">Những thiết kế được yêu thích nhất trong tuần</p>
          </div>
          <button 
            className="vh-btn vh-btn-outline vh-btn-md gap-1"
            onClick={() => navigate(ROUTES.RENTALS)}
          >
            <span>XEM TẤT CẢ</span>
            <ArrowUpRight size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600 }}>
            Đang tải sản phẩm từ cơ sở dữ liệu...
          </div>
        ) : error ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 600 }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600 }}>
            Không tìm thấy sản phẩm nào trong cơ sở dữ liệu.
          </div>
        ) : (
          /* Product Grid */
          <div className="vh-rentals-grid">
            {items.map((item) => (
              <div key={item.id} className="vh-premium-card" style={{ padding: '20px' }}>
                {/* Image Area */}
                <div className="vh-card-image-wrapper">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="vh-card-image"
                  />
                  {/* Premium Hover Overlay Button */}
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
                  {/* Status Tag Overlay */}
                  <span className={`vh-status-badge ${
                    item.status === 'AVAILABLE' ? 'vh-status-available' : 'vh-status-reserved'
                  }`}>
                    {item.status === 'AVAILABLE' ? 'CÓ SẴN' : 'ĐÃ ĐẶT'}
                  </span>
                </div>

                {/* Text Area */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                      {item.name}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                      {item.material}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-light-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Giá thuê</span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{item.price}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
