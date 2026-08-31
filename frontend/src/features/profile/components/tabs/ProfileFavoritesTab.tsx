import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ExternalLink, Sparkles } from 'lucide-react';
import { useAuth } from '../../../auth/hooks/useAuth';
import { httpClient } from '../../../../services/httpClient';
import { getFirstMediaUrl } from '../../../../shared/media/mediaUrl';

export const ProfileFavoritesTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favoriteType, setFavoriteType] = useState<'aodai' | 'photographer'>('aodai');
  const [products, setProducts] = useState<any[]>([]);
  const [photographers, setPhotographers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      httpClient.get<any[]>('/products').then((res: any) => (Array.isArray(res) ? res : res?.data || [])),
      httpClient.get<any[]>('/providers/photographers').then((res: any) => (Array.isArray(res) ? res : res?.data || []))
    ])
      .then(([prodRes, photoRes]) => {
        if (prodRes.status === 'fulfilled') setProducts(prodRes.value);
        if (photoRes.status === 'fulfilled') setPhotographers(photoRes.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const favoriteProducts = React.useMemo(() => {
    if (!user?.favorites || !Array.isArray(user.favorites)) return [];
    return user.favorites
      .filter((f: any) => f.targetType === 'PRODUCT' || f.targetType === 'Product')
      .map((f: any) => {
        const targetId = f.targetId?.toString() || f.targetId;
        const prod = products.find((p) => p._id === targetId);
        return prod || null;
      })
      .filter(Boolean);
  }, [user?.favorites, products]);

  const favoritePhotographers = React.useMemo(() => {
    if (!user?.favorites || !Array.isArray(user.favorites)) return [];
    return user.favorites
      .filter((f: any) => ['PROVIDER', 'Provider', 'PHOTOGRAPHER', 'Photographer'].includes(f.targetType))
      .map((f: any) => {
        const targetId = f.targetId?.toString() || f.targetId;
        const photo = photographers.find((p) => {
          const pid = p._id?.toString() || p._id;
          const provId = p.providerId?.toString() || p.providerId;
          return pid === targetId || provId === targetId;
        });
        return photo || null;
      })
      .filter(Boolean);
  }, [user?.favorites, photographers]);

  return (
    <div className="lume-dashboard-card" style={{ gap: '20px' }}>
      <div className="lume-dashboard-card-header" style={{ marginBottom: 0 }}>
        <h3 className="lume-dashboard-card-title">Danh sách yêu thích của bạn</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFavoriteType('aodai')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: favoriteType === 'aodai' ? '1px solid #8B1E2D' : '1px solid #E5DFD5',
              backgroundColor: favoriteType === 'aodai' ? '#FDF2F4' : '#FFFFFF',
              color: favoriteType === 'aodai' ? '#8B1E2D' : '#574D4F',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Áo dài ({favoriteProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setFavoriteType('photographer')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: favoriteType === 'photographer' ? '1px solid #8B1E2D' : '1px solid #E5DFD5',
              backgroundColor: favoriteType === 'photographer' ? '#FDF2F4' : '#FFFFFF',
              color: favoriteType === 'photographer' ? '#8B1E2D' : '#574D4F',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Nhiếp ảnh gia ({favoritePhotographers.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#8C827A', fontSize: '13px' }}>
          Đang tải danh sách yêu thích...
        </div>
      ) : favoriteType === 'aodai' ? (
        favoriteProducts.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#FCFAF7',
              borderRadius: '12px',
              border: '1px dashed #E2DACF'
            }}
          >
            <Heart size={32} color="#C4B7A6" style={{ marginBottom: '8px' }} />
            <p style={{ margin: '0 0 6px 0', fontSize: '13.5px', fontWeight: 700, color: '#4A3F35' }}>
              Chưa có áo dài nào trong danh sách yêu thích
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#8C827A' }}>
              Bấm biểu tượng trái tim khi xem bộ sưu tập áo dài để lưu lại tại đây.
            </p>
            <button
              type="button"
              onClick={() => navigate('/rentals')}
              style={{
                padding: '8px 18px',
                backgroundColor: '#8B1E2D',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Khám phá áo dài ngay
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {favoriteProducts.map((prod) => (
              <div
                key={prod._id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #ECE5DB',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
                onClick={() => navigate(`/rentals/${prod._id}`)}
              >
                <div style={{ height: '220px', position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'}
                    alt={prod.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      padding: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      display: 'flex',
                      color: '#8B1E2D'
                    }}
                  >
                    <Heart size={14} fill="currentColor" />
                  </span>
                </div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 750, color: '#231F20' }}>
                    {prod.name}
                  </h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#8C827A' }}>
                    {prod.materials?.[0] || 'Lụa truyền thống'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#8B1E2D' }}>
                      {(prod.basePrice || 0).toLocaleString('vi-VN')}đ/ngày
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#574D4F', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Xem <ExternalLink size={11} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : favoritePhotographers.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#FCFAF7',
            borderRadius: '12px',
            border: '1px dashed #E2DACF'
          }}
        >
          <Sparkles size={32} color="#C4B7A6" style={{ marginBottom: '8px' }} />
          <p style={{ margin: '0 0 6px 0', fontSize: '13.5px', fontWeight: 700, color: '#4A3F35' }}>
            Chưa có nhiếp ảnh gia nào trong danh sách yêu thích
          </p>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#8C827A' }}>
            Khám phá đội ngũ thợ chụp tài hoa và concept cổ phong độc quyền.
          </p>
          <button
            type="button"
            onClick={() => navigate('/photographers')}
            style={{
              padding: '8px 18px',
              backgroundColor: '#8B1E2D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Khám phá thợ ảnh
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {favoritePhotographers.map((photo) => (
            <div
              key={photo._id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #ECE5DB',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
              onClick={() => navigate(`/photographers`)}
            >
              <div style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
                <img
                  src={
                    getFirstMediaUrl(
                      photo.packages?.[0]?.images?.[0],
                      photo.coverImage,
                      photo.media?.coverUrl,
                      photo.media?.images?.[0]
                    ) || '/avatar_hanna.webp'
                  }
                  alt={photo.businessName || photo.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    padding: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    display: 'flex',
                    color: '#8B1E2D'
                  }}
                >
                  <Heart size={14} fill="currentColor" />
                </span>
              </div>
              <div style={{ padding: '12px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 750, color: '#231F20' }}>
                  {photo.businessName || photo.name}
                </h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#8C827A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photo.quote || 'Nhiếp ảnh gia chuyên nghiệp tại Huế'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#8B1E2D' }}>
                    Từ {((photo.packages?.[0]?.price || 1500000) as number).toLocaleString('vi-VN')}đ
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#574D4F', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    Xem gói chụp <ExternalLink size={11} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
